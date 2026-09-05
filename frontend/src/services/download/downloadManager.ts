import api from '../api';
import { auth } from '../../firebase';
import {
  DownloadOptions,
  DownloadState,
  DownloadStatus,
  PrepareResponse,
} from './downloadTypes';
import { downloadNotification } from './downloadNotification';
import {
  getMimeTypeFromFilename,
  sanitizeFilename,
  triggerBrowserAnchorDownload,
  validateFileBlob,
  isNativeMobile,
  blobToBase64,
  shareOrOpenFile,
} from './downloadUtils';

class DownloadManager {
  private activeDownloads: Map<string, DownloadState> = new Map();
  private stateListeners: Set<(downloads: DownloadState[]) => void> = new Set();

  /**
   * Main central download method.
   * Enforces backend token pre-flight, branded notifications, state machine updates,
   * and native Android Filesystem storage for mobile app or SPA anchor trigger for web.
   */
  async download(options: DownloadOptions): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const endpoint = options.endpoint.startsWith('/') ? options.endpoint : `/${options.endpoint}`;
    const filename = sanitizeFilename(options.filename || this.inferFilenameFromEndpoint(endpoint));
    const mimeType = options.mimeType || getMimeTypeFromFilename(filename);

    const downloadId = `${endpoint}:${filename}:${JSON.stringify(options.params || {})}`;

    // Duplicate Download Protection
    const existing = this.activeDownloads.get(downloadId);
    if (existing && ['AUTHENTICATING', 'PREPARING', 'READY', 'DOWNLOADING', 'STARTED'].includes(existing.status)) {
      console.warn('[DownloadManager] Duplicate download request ignored:', downloadId);
      return { success: false, downloadId, error: 'Download is already in progress.' };
    }

    const state: DownloadState = {
      downloadId,
      endpoint,
      filename,
      mimeType,
      status: 'AUTHENTICATING',
      startTime: Date.now(),
    };

    this.updateState(state, options.onStateChange);

    // ─── 1. NATIVE ANDROID CAPACITOR MOBILE APP DOWNLOAD FLOW ──────────────────
    if (isNativeMobile()) {
      state.status = 'DOWNLOADING';
      this.updateState(state, options.onStateChange);

      await downloadNotification.notifyStart(filename, mimeType);

      try {
        // Direct authenticated REST request via Axios (includes Bearer Token)
        const response = await api.get(endpoint, {
          params: options.params || {},
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              state.progress = pct;
              this.updateState(state, options.onStateChange);
            }
          },
        });

        const blob = response.data;
        const validation = await validateFileBlob(blob, mimeType);
        if (!validation.valid) {
          throw new Error(validation.error || 'Downloaded file payload is invalid.');
        }

        // Save to device local storage via Capacitor Filesystem
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = await blobToBase64(blob);

        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state, options.onStateChange);

        await downloadNotification.notifySuccess(filename);

        // Optionally trigger native file share/open dialog
        setTimeout(() => {
          shareOrOpenFile(writeResult.uri, filename);
        }, 300);

        return { success: true, downloadId };
      } catch (err: any) {
        return this.handleDownloadError(err, state, filename, options.onStateChange);
      }
    }

    // ─── 2. WEB BROWSER SPA DOWNLOAD FLOW ────────────────────────────────────
    try {
      state.status = 'PREPARING';
      this.updateState(state, options.onStateChange);

      // Fetch Firebase ID Token if authenticated
      let token = localStorage.getItem('token');
      if (auth && auth.currentUser) {
        try {
          const fbToken = await auth.currentUser.getIdToken();
          if (fbToken) {
            token = fbToken;
            localStorage.setItem('token', fbToken);
          }
        } catch {
          /* fallback to stored token */
        }
      }

      // Call POST /api/downloads/prepare
      const prepareRes = await api.post<PrepareResponse>('/downloads/prepare', {
        endpoint,
        filename,
        mime_type: mimeType,
        params: options.params || {},
        method: options.method || 'GET',
      });

      const prepData = prepareRes.data;
      if (!prepData || !prepData.download_url) {
        throw new Error('Failed to prepare secure download authorization.');
      }

      state.status = 'READY';
      state.preparedUrl = prepData.download_url;
      this.updateState(state, options.onStateChange);

      await downloadNotification.notifyStart(filename, mimeType);

      state.status = 'STARTED';
      this.updateState(state, options.onStateChange);

      const apiBase = api.defaults.baseURL || '/api';
      const cleanBase = apiBase.replace(/\/+$/, '');
      const downloadPath = prepData.download_url.startsWith('/') ? prepData.download_url : `/${prepData.download_url}`;

      const fullUrl = prepData.download_url.startsWith('http')
        ? prepData.download_url
        : `${cleanBase}${downloadPath.replace(/^\/api/, '')}`;

      await triggerBrowserAnchorDownload(fullUrl, filename);

      state.status = 'COMPLETED';
      this.updateState(state, options.onStateChange);

      return { success: true, downloadId };
    } catch (err: any) {
      return this.handleDownloadError(err, state, filename, options.onStateChange);
    }
  }

  /**
   * Helper method for downloading client-generated Blobs (e.g. settings export, audit log CSV).
   */
  async downloadBlob(blob: Blob, filename: string, mimeType?: string): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const safeFilename = sanitizeFilename(filename);
    const effectiveMime = mimeType || blob.type || getMimeTypeFromFilename(safeFilename);
    const downloadId = `blob:${safeFilename}:${Date.now()}`;

    const state: DownloadState = {
      downloadId,
      endpoint: 'local:blob',
      filename: safeFilename,
      mimeType: effectiveMime,
      status: 'PREPARING',
      startTime: Date.now(),
    };

    this.updateState(state);

    try {
      const validation = await validateFileBlob(blob, effectiveMime);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file payload.');
      }

      await downloadNotification.notifyStart(safeFilename, effectiveMime);

      if (isNativeMobile()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = await blobToBase64(blob);

        const writeResult = await Filesystem.writeFile({
          path: safeFilename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state);

        await downloadNotification.notifySuccess(safeFilename);

        setTimeout(() => {
          shareOrOpenFile(writeResult.uri, safeFilename);
        }, 300);

        return { success: true, downloadId };
      }

      state.status = 'STARTED';
      this.updateState(state);

      const blobUrl = URL.createObjectURL(blob);
      await triggerBrowserAnchorDownload(blobUrl, safeFilename);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 5000);

      state.status = 'COMPLETED';
      this.updateState(state);

      return { success: true, downloadId };
    } catch (err: any) {
      return this.handleDownloadError(err, state, safeFilename);
    }
  }

  private handleDownloadError(
    err: any,
    state: DownloadState,
    filename: string,
    onStateChange?: (state: DownloadState) => void
  ): { success: boolean; downloadId: string; error: string } {
    let status: DownloadStatus = 'FAILED';
    let errorMessage = 'Unable to download the file. Please try again.';

    const httpStatus = err?.response?.status;
    const detail = err?.response?.data?.detail || err?.message;

    if (httpStatus === 401) {
      status = 'UNAUTHORIZED';
      errorMessage = 'Your session has expired. Please sign in again.';
      downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus === 403) {
      status = 'FORBIDDEN';
      errorMessage = "You don't have permission to download this file.";
      downloadNotification.notifyPermissionDenied(filename);
    } else if (httpStatus === 404) {
      status = 'FAILED';
      errorMessage = 'File not found.';
      downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus === 410) {
      status = 'EXPIRED';
      errorMessage = 'Download link expired. Please try again.';
      downloadNotification.notifyExpired(filename);
    } else if (httpStatus === 429) {
      status = 'FAILED';
      errorMessage = 'Too many download requests. Please try again shortly.';
      downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus >= 500) {
      status = 'FAILED';
      errorMessage = detail || 'Unable to download the file. Please try again.';
      downloadNotification.notifyFailure(filename, errorMessage);
    } else if (err?.code === 'ERR_NETWORK' || (typeof window !== 'undefined' && !window.navigator.onLine)) {
      status = 'FAILED';
      errorMessage = 'Network error. Please check your connection and try again.';
      downloadNotification.notifyFailure(filename, errorMessage);
    } else {
      status = 'FAILED';
      errorMessage = detail || errorMessage;
      downloadNotification.notifyFailure(filename, errorMessage);
    }

    state.status = status;
    state.error = errorMessage;
    this.updateState(state, onStateChange);

    return { success: false, downloadId: state.downloadId, error: errorMessage };
  }

  private inferFilenameFromEndpoint(endpoint: string): string {
    const clean = endpoint.split('?')[0].replace(/\/+$/, '');
    const lastPart = clean.split('/').pop() || 'report';
    if (lastPart.includes('.')) return lastPart;
    if (clean.includes('excel') || clean.includes('summary')) return `${lastPart}.xlsx`;
    if (clean.includes('pdf')) return `${lastPart}.pdf`;
    if (clean.includes('csv')) return `${lastPart}.csv`;
    if (clean.includes('zip')) return `${lastPart}.zip`;
    if (clean.includes('word') || clean.includes('docx')) return `${lastPart}.docx`;
    return `${lastPart}.xlsx`;
  }

  private updateState(state: DownloadState, onStateChange?: (state: DownloadState) => void): void {
    this.activeDownloads.set(state.downloadId, { ...state });
    if (onStateChange) {
      onStateChange({ ...state });
    }
    this.notifyListeners();
  }

  subscribe(listener: (downloads: DownloadState[]) => void): () => void {
    this.stateListeners.add(listener);
    listener(Array.from(this.activeDownloads.values()));
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentList = Array.from(this.activeDownloads.values());
    this.stateListeners.forEach((listener) => {
      try {
        listener(currentList);
      } catch (err) {
        console.error('[DownloadManager] Listener error:', err);
      }
    });
  }

  getActiveDownloads(): DownloadState[] {
    return Array.from(this.activeDownloads.values());
  }

  isDownloading(endpoint: string): boolean {
    for (const d of this.activeDownloads.values()) {
      if (d.endpoint === endpoint && ['AUTHENTICATING', 'PREPARING', 'READY', 'DOWNLOADING', 'STARTED'].includes(d.status)) {
        return true;
      }
    }
    return false;
  }
}

export const downloadManager = new DownloadManager();
