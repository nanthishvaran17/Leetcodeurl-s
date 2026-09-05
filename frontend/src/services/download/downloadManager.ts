import api from '../api';
import {
  DownloadOptions,
  DownloadState,
  DownloadStatus,
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
   * High-Performance Direct Download Method.
   * Eliminates sequential /prepare roundtrips, eliminates token refresh delays,
   * and uses native C++ Android Filesystem.downloadFile streaming on mobile.
   */
  async download(options: DownloadOptions): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const startTime = performance.now();
    const endpoint = options.endpoint.startsWith('/') ? options.endpoint : `/${options.endpoint}`;
    const filename = sanitizeFilename(options.filename || this.inferFilenameFromEndpoint(endpoint));
    const mimeType = options.mimeType || getMimeTypeFromFilename(filename);

    const downloadId = `${endpoint}:${filename}:${JSON.stringify(options.params || {})}`;

    // 1. DUPLICATE CLICK PROTECTION: Block fast double-taps
    const existing = this.activeDownloads.get(downloadId);
    if (existing && ['AUTHENTICATING', 'PREPARING', 'READY', 'DOWNLOADING', 'STARTED'].includes(existing.status)) {
      console.warn('[DownloadManager] Duplicate download tap blocked:', downloadId);
      return { success: false, downloadId, error: 'Download is already in progress.' };
    }

    const state: DownloadState = {
      downloadId,
      endpoint,
      filename,
      mimeType,
      status: 'DOWNLOADING',
      startTime: Date.now(),
    };

    this.updateState(state, options.onStateChange);

    // 2. SECURE TOKEN VERIFICATION: Verify and refresh token securely if needed
    let token = localStorage.getItem('token') || '';
    try {
      const { auth } = await import('../firebase');
      if (auth && auth.currentUser) {
        // getIdToken(false) returns cached token instantly if valid, or securely refreshes if expired
        const fbToken = await auth.currentUser.getIdToken();
        if (fbToken) {
          token = fbToken;
          localStorage.setItem('token', fbToken);
        }
      }
    } catch (tokenErr) {
      console.warn('[DownloadManager] Token refresh failed. Proceeding with fallback handling.');
    }

    // Construct target URL
    const apiBase = api.defaults.baseURL || '/api';
    const cleanBase = apiBase.replace(/\/+$/, '');
    let queryString = '';
    if (options.params && Object.keys(options.params).length > 0) {
      const sp = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.append(k, String(v));
      });
      queryString = `?${sp.toString()}`;
    }

    const targetUrl = endpoint.startsWith('http')
      ? `${endpoint}${queryString}`
      : `${cleanBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}${queryString}`;

    // ─── FAST PATH A: NATIVE ANDROID CAPACITOR MOBILE APP ────────────────────────
    if (isNativeMobile()) {
      await downloadNotification.notifyStart(filename, mimeType);

      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Native Android C++/Java Direct Stream Download directly to Documents disk
        // ZERO JS memory allocation, ZERO Base64 conversion, ZERO FileReader blocking!
        const downloadRes = await Filesystem.downloadFile({
          url: targetUrl,
          path: filename,
          directory: Directory.Documents,
          headers,
          recursive: true,
        });

        // Some Capacitor versions do not throw on 401 HTTP response, so we must verify the file or fall back
        // If it's a 401 error, fallback to Axios which correctly handles the 401 token refresh loop
        if (downloadRes.path && (downloadRes.path.endsWith('.json') || downloadRes.path.includes('unauthorized'))) {
           throw new Error('Possible 401 Error in native download, falling back to Axios');
        }

        const totalMs = Math.round(performance.now() - startTime);
        console.log(`[FAST_DOWNLOAD] Completed natively in ${totalMs}ms -> ${downloadRes.path || ''}`);

        state.status = 'COMPLETED';
        state.localPath = downloadRes.path || '';
        this.updateState(state, options.onStateChange);

        await downloadNotification.notifySuccess(filename);

        setTimeout(() => {
          if (downloadRes.path) {
            shareOrOpenFile(downloadRes.path, filename);
          }
        }, 250);

        return { success: true, downloadId };
      } catch (err: any) {
        console.warn('[FAST_DOWNLOAD] Native downloadFile fallback to Blob stream:', err);
        return this.handleFallbackMobileBlobDownload(endpoint, options.params, filename, mimeType, state, startTime, options.onStateChange);
      }
    }

    // ─── FAST PATH B: WEB BROWSER DIRECT 1-REQUEST DOWNLOAD ──────────────────────
    try {
      await downloadNotification.notifyStart(filename, mimeType);

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

      const blobUrl = URL.createObjectURL(blob);
      await triggerBrowserAnchorDownload(blobUrl, filename);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      const totalMs = Math.round(performance.now() - startTime);
      console.log(`[FAST_DOWNLOAD] Web download completed in ${totalMs}ms`);

      state.status = 'COMPLETED';
      this.updateState(state, options.onStateChange);

      return { success: true, downloadId };
    } catch (err: any) {
      return await this.handleDownloadError(err, state, filename, options.onStateChange);
    }
  }

  /** Fallback Mobile Download using Axios Blob if Filesystem.downloadFile fails */
  private async handleFallbackMobileBlobDownload(
    endpoint: string,
    params: any,
    filename: string,
    mimeType: string,
    state: DownloadState,
    startTime: number,
    onStateChange?: (state: DownloadState) => void
  ): Promise<{ success: boolean; downloadId: string; error?: string }> {
    try {
      const response = await api.get(endpoint, {
        params: params || {},
        responseType: 'blob',
      });

      const blob = response.data;
      const validation = await validateFileBlob(blob, mimeType);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file payload.');
      }

      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64Data = await blobToBase64(blob);

      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      const totalMs = Math.round(performance.now() - startTime);
      console.log(`[FAST_DOWNLOAD] Fallback blob download completed in ${totalMs}ms`);

      state.status = 'COMPLETED';
      state.localPath = writeResult.uri;
      this.updateState(state, onStateChange);

      await downloadNotification.notifySuccess(filename);

      setTimeout(() => {
        shareOrOpenFile(writeResult.uri, filename);
      }, 250);

      return { success: true, downloadId: state.downloadId };
    } catch (err: any) {
      return await this.handleDownloadError(err, state, filename, onStateChange);
    }
  }

  /**
   * Helper method for downloading client-generated Blobs (e.g. settings export, audit log CSV).
   */
  async downloadBlob(blob: Blob, filename: string, mimeType?: string): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const startTime = performance.now();
    const safeFilename = sanitizeFilename(filename);
    const effectiveMime = mimeType || blob.type || getMimeTypeFromFilename(safeFilename);
    const downloadId = `blob:${safeFilename}:${Date.now()}`;

    const state: DownloadState = {
      downloadId,
      endpoint: 'local:blob',
      filename: safeFilename,
      mimeType: effectiveMime,
      status: 'DOWNLOADING',
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

        const totalMs = Math.round(performance.now() - startTime);
        console.log(`[FAST_DOWNLOAD] Native blob export completed in ${totalMs}ms`);

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state);

        await downloadNotification.notifySuccess(safeFilename);

        setTimeout(() => {
          shareOrOpenFile(writeResult.uri, safeFilename);
        }, 250);

        return { success: true, downloadId };
      }

      state.status = 'STARTED';
      this.updateState(state);

      const blobUrl = URL.createObjectURL(blob);
      await triggerBrowserAnchorDownload(blobUrl, safeFilename);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);

      state.status = 'COMPLETED';
      this.updateState(state);

      return { success: true, downloadId };
    } catch (err: any) {
      return await this.handleDownloadError(err, state, safeFilename);
    }
  }

  private async handleDownloadError(
    err: any,
    state: DownloadState,
    filename: string,
    onStateChange?: (state: DownloadState) => void
  ): Promise<{ success: boolean; downloadId: string; error: string }> {
    let status: DownloadStatus = 'FAILED';
    let errorMessage = 'Unable to download the file. Please try again.';

    const httpStatus = err?.response?.status;
    let detail = err?.response?.data?.detail || err?.message;

    // Axios returns a Blob for error responses if responseType is 'blob'
    if (err?.response?.data && err.response.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        detail = parsed.detail || parsed.error || detail;
      } catch {
        // Ignore parse errors
      }
    }

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
