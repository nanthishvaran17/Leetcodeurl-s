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
   * Scoped-Storage Compliant Download & Report Generation Method.
   * - Uses app-sandboxed cache (Scoped Storage compliant across all modern Android versions)
   * - Emits notifications ONLY following the verified state machine:
   *   GENERATING (no start notification) -> GENERATION SUCCESS -> START DOWNLOAD notification -> SUCCESS notification.
   * - If generation fails, stops all download actions and shows clean error notification.
   */
  async download(options: DownloadOptions): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const startTime = performance.now();
    const endpoint = options.endpoint.startsWith('/') ? options.endpoint : `/${options.endpoint}`;
    const filename = sanitizeFilename(options.filename || this.inferFilenameFromEndpoint(endpoint));
    const mimeType = options.mimeType || getMimeTypeFromFilename(filename);

    const downloadId = `${endpoint}:${filename}:${JSON.stringify(options.params || {})}`;

    // 1. DUPLICATE CLICK PROTECTION: Block concurrent duplicate taps
    const existing = this.activeDownloads.get(downloadId);
    if (existing && ['AUTHENTICATING', 'PREPARING', 'READY', 'DOWNLOADING', 'STARTED'].includes(existing.status)) {
      console.warn('[DownloadManager] Duplicate download tap blocked:', downloadId);
      return { success: false, downloadId, error: 'A report generation or download is already in progress.' };
    }

    const state: DownloadState = {
      downloadId,
      endpoint,
      filename,
      mimeType,
      status: 'PREPARING',
      startTime: Date.now(),
    };

    this.updateState(state, options.onStateChange);

    try {
      // 2. FAST AUTHENTICATION (Synchronous read from local session)
      const token = localStorage.getItem('token') || '';

      // 3. GENERATE REPORT VIA API (Axios Blob Request)
      // Note: We DO NOT emit notifyStart before the server responds successfully!
      const response = await api.request({
        url: endpoint,
        method: options.method || 'GET',
        params: options.params || {},
        data: options.data,
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            state.progress = pct;
            this.updateState(state, options.onStateChange);
          }
        },
      });

      // 4. VALIDATE REPORT PAYLOAD
      const blob = response.data;
      const validation = await validateFileBlob(blob, mimeType);
      if (!validation.valid) {
        throw new Error(validation.error || 'Generated report payload is invalid or empty.');
      }

      // 5. STATE MACHINE: GENERATION SUCCEEDED -> NOW FINALIZE DOWNLOAD
      state.status = 'DOWNLOADING';
      this.updateState(state, options.onStateChange);

      // 6. STORAGE & PLATFORM-SPECIFIC DISPATCH
      if (isNativeMobile()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = await blobToBase64(blob);

        // Modern Scoped Storage compliant: Write into Directory.Cache (app-sandboxed internal storage).
        // Zero permission requirements on Android 10, 11, 12, 13, 14, 15, 16+.
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        const totalMs = Math.round(performance.now() - startTime);
        console.log(`[DownloadManager] Mobile report saved to cache in ${totalMs}ms -> ${writeResult.uri}`);

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state, options.onStateChange);

        // Notify with full persistent file reference
        await downloadNotification.notifySuccess({
          filename,
          localFileUri: writeResult.uri,
          mimeType,
          fileSizeBytes: blob.size,
          reportId: options.params?.report_id || options.params?.reportId
        });

        setTimeout(() => {
          if (writeResult.uri) {
            shareOrOpenFile(writeResult.uri, filename, mimeType);
          }
        }, 250);

        return { success: true, downloadId };
      }

      // WEB BROWSER PATH (Desktop & Mobile Web Browsers)
      state.status = 'STARTED';
      this.updateState(state, options.onStateChange);

      const typedBlob = blob instanceof Blob && blob.type ? blob : new Blob([blob], { type: mimeType });
      const blobUrl = URL.createObjectURL(typedBlob);
      await triggerBrowserAnchorDownload(blobUrl, filename, mimeType);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      const totalMs = Math.round(performance.now() - startTime);
      console.log(`[DownloadManager] Web report download completed in ${totalMs}ms`);

      state.status = 'COMPLETED';
      this.updateState(state, options.onStateChange);

      await downloadNotification.notifySuccess({
        filename,
        localFileUri: blobUrl,
        mimeType,
        fileSizeBytes: blob.size,
        reportId: options.params?.report_id || options.params?.reportId
      });

      return { success: true, downloadId };
    } catch (err: any) {
      return await this.handleDownloadError(err, state, filename, options.onStateChange);
    } finally {
      // Auto cleanup active download record after short grace window
      setTimeout(() => {
        this.activeDownloads.delete(downloadId);
      }, 3000);
    }
  }

  /**
   * Async Job Engine Download Flow
   * Posts to /api/report-jobs, polls status, and downloads when complete.
   */
  async downloadJob(options: { 
    report_type: string; 
    format: string; 
    filters?: any; 
    filename?: string;
    onStateChange?: (state: DownloadState) => void 
  }): Promise<{ success: boolean; downloadId: string; error?: string }> {
    const startTime = performance.now();
    const endpoint = '/api/report-jobs';
    const filename = sanitizeFilename(options.filename || `${options.report_type}.${options.format}`);
    const mimeType = getMimeTypeFromFilename(filename);

    const downloadId = `job:${options.report_type}:${Date.now()}`;

    const state: DownloadState = {
      downloadId,
      endpoint,
      filename,
      mimeType,
      status: 'QUEUED',
      startTime: Date.now(),
    };

    this.updateState(state, options.onStateChange);

    try {
      const token = localStorage.getItem('token') || '';
      
      // 1. Create Job
      const createRes = await api.post(endpoint, {
        report_type: options.report_type,
        format: options.format,
        filters: options.filters || {}
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const jobId = createRes.data?.job_id;
      if (!jobId) throw new Error("Failed to create report job");

      state.downloadId = jobId; // Update to the real reference ID
      this.updateState(state, options.onStateChange);

      // 2. Poll Status
      let isComplete = false;
      let finalFilePath = '';
      
      while (!isComplete) {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
        
        const statusRes = await api.get(`${endpoint}/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        const jobStatus = statusRes.data?.status;
        
        if (jobStatus === 'COMPLETED') {
          isComplete = true;
          state.status = 'DOWNLOADING';
          this.updateState(state, options.onStateChange);
        } else if (jobStatus === 'FAILED') {
          throw new Error(statusRes.data?.error_message || "Report generation failed");
        } else {
          state.status = jobStatus === 'PROCESSING' ? 'PROCESSING' : 'GENERATING';
          state.progress = statusRes.data?.progress || 0;
          this.updateState(state, options.onStateChange);
        }
      }

      // 3. Download the actual file
      const downloadUrl = `${endpoint}/${jobId}/download`;
      
      const response = await api.request({
        url: downloadUrl,
        method: 'GET',
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const blob = response.data;
      const validation = await validateFileBlob(blob, mimeType);
      if (!validation.valid) {
        throw new Error(validation.error || 'Generated report payload is invalid or empty.');
      }

      // 4. File Saving & Dispatch
      if (isNativeMobile()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = await blobToBase64(blob);

        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state, options.onStateChange);

        await downloadNotification.notifySuccess({
          filename,
          localFileUri: writeResult.uri,
          mimeType,
          fileSizeBytes: blob.size,
          reportId: jobId
        });

        setTimeout(() => {
          if (writeResult.uri) {
            shareOrOpenFile(writeResult.uri, filename, mimeType);
          }
        }, 250);

        return { success: true, downloadId: jobId };
      }

      state.status = 'STARTED';
      this.updateState(state, options.onStateChange);

      const typedBlob = blob instanceof Blob && blob.type ? blob : new Blob([blob], { type: mimeType });
      const blobUrl = URL.createObjectURL(typedBlob);
      await triggerBrowserAnchorDownload(blobUrl, filename, mimeType);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      state.status = 'COMPLETED';
      this.updateState(state, options.onStateChange);

      await downloadNotification.notifySuccess({
        filename,
        localFileUri: blobUrl,
        mimeType,
        fileSizeBytes: blob.size,
        reportId: jobId
      });

      return { success: true, downloadId: jobId };

    } catch (err: any) {
      return await this.handleDownloadError(err, state, filename, options.onStateChange);
    } finally {
      setTimeout(() => {
        this.activeDownloads.delete(downloadId);
      }, 5000);
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
      status: 'PREPARING',
      startTime: Date.now(),
    };

    this.updateState(state);

    try {
      const validation = await validateFileBlob(blob, effectiveMime);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file payload.');
      }

      state.status = 'DOWNLOADING';
      this.updateState(state);

      if (isNativeMobile()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = await blobToBase64(blob);

        const writeResult = await Filesystem.writeFile({
          path: safeFilename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        const totalMs = Math.round(performance.now() - startTime);
        console.log(`[DownloadManager] Native blob export completed in ${totalMs}ms`);

        state.status = 'COMPLETED';
        state.localPath = writeResult.uri;
        this.updateState(state);

        await downloadNotification.notifySuccess({
          filename: safeFilename,
          localFileUri: writeResult.uri,
          mimeType: effectiveMime,
          fileSizeBytes: blob.size
        });

        setTimeout(() => {
          shareOrOpenFile(writeResult.uri, safeFilename, effectiveMime);
        }, 250);

        return { success: true, downloadId };
      }

      state.status = 'STARTED';
      this.updateState(state);

      const typedBlob = blob instanceof Blob && blob.type ? blob : new Blob([blob], { type: effectiveMime });
      const blobUrl = URL.createObjectURL(typedBlob);
      await triggerBrowserAnchorDownload(blobUrl, safeFilename, effectiveMime);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);

      state.status = 'COMPLETED';
      this.updateState(state);

      await downloadNotification.notifySuccess({
        filename: safeFilename,
        localFileUri: blobUrl,
        mimeType: effectiveMime,
        fileSizeBytes: blob.size
      });

      return { success: true, downloadId };
    } catch (err: any) {
      return await this.handleDownloadError(err, state, safeFilename);
    } finally {
      setTimeout(() => {
        this.activeDownloads.delete(downloadId);
      }, 3000);
    }
  }

  private async handleDownloadError(
    err: any,
    state: DownloadState,
    filename: string,
    onStateChange?: (state: DownloadState) => void
  ): Promise<{ success: boolean; downloadId: string; error: string }> {
    // 1. Log real error with stack trace & status code for debugging
    console.error(`[DownloadManager Debug] Download failed for ${filename}:`, {
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      data: err?.response?.data,
      message: err?.message,
      err,
    });

    let status: DownloadStatus = 'FAILED';
    let errorMessage = 'Unable to generate report. Please try again.';

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

    const isRawTechnicalError = (msg?: string) => {
      if (!msg) return true;
      const lower = String(msg).toLowerCase();
      return (
        lower.includes('500') ||
        lower.includes('status code') ||
        lower.includes('request failed') ||
        lower.includes('internal server error') ||
        lower.includes('exception') ||
        lower.includes('traceback') ||
        lower.includes('none_type') ||
        lower.includes('attributeerror')
      );
    };

    if (httpStatus === 401) {
      status = 'UNAUTHORIZED';
      errorMessage = 'Your session has expired. Please sign in again.';
      await downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus === 403) {
      status = 'FORBIDDEN';
      errorMessage = "You don't have permission to generate this report.";
      await downloadNotification.notifyPermissionDenied(filename);
    } else if (httpStatus === 404) {
      status = 'FAILED';
      errorMessage = 'Report data not found.';
      await downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus === 410) {
      status = 'EXPIRED';
      errorMessage = 'Report link expired. Please try again.';
      await downloadNotification.notifyExpired(filename);
    } else if (httpStatus === 429) {
      status = 'FAILED';
      errorMessage = 'Too many requests. Please try again shortly.';
      await downloadNotification.notifyFailure(filename, errorMessage);
    } else if (httpStatus >= 500) {
      status = 'FAILED';
      errorMessage = 'Unable to generate report. Please try again.';
      await downloadNotification.notifyFailure(filename, errorMessage);
    } else if (err?.code === 'ERR_NETWORK' || (typeof window !== 'undefined' && !window.navigator.onLine)) {
      status = 'FAILED';
      errorMessage = 'Network error. Please check your connection and try again.';
      await downloadNotification.notifyFailure(filename, errorMessage);
    } else {
      status = 'FAILED';
      errorMessage = !isRawTechnicalError(detail) ? detail : 'Unable to generate report. Please try again.';
      await downloadNotification.notifyFailure(filename, errorMessage);
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
