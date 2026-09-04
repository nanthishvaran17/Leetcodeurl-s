/**
 * mobileDownload.ts
 *
 * Cross-platform file download helper for:
 *  - Standard browser (desktop & mobile Chrome/Firefox)
 *  - PWA / standalone mode (where window.open is blocked)
 *  - Capacitor Android/iOS native (FileSystem + Share plugin)
 *
 * Usage:
 *   await triggerDownload(blob, 'Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 *   // or with a URL:
 *   await downloadFromUrl('/api/reports/export-excel', 'Report.xlsx', axiosInstance, authToken);
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Map of common file extensions → MIME types */
const MIME_MAP: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  csv:  'text/csv;charset=utf-8',
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  zip:  'application/zip',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
};

/**
 * Infer MIME type from filename extension.
 */
export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
};

/**
 * Trigger a file download on the current platform.
 * Works in: browser, PWA standalone mode, Capacitor Android/iOS.
 */
export const triggerDownload = async (
  blob: Blob,
  filename: string,
  mimeType?: string
): Promise<void> => {
  const effectiveMime = mimeType || getMimeType(filename) || blob.type || 'application/octet-stream';
  const typedBlob = new Blob([blob], { type: effectiveMime });

  // ── Capacitor Native (Android / iOS) ─────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(typedBlob);
      const safeFilename = filename.replace(/[^a-zA-Z0-9._\-()]/g, '_');

      await Filesystem.writeFile({
        path: safeFilename,
        data: base64,
        directory: Directory.Cache,
      });

      const { uri } = await Filesystem.getUri({
        directory: Directory.Cache,
        path: safeFilename,
      });

      await Share.share({
        title: filename,
        url: uri,
        dialogTitle: `Save ${filename}`,
      });
      return;
    } catch (err) {
      console.warn('[MobileDownload] Capacitor download failed, falling back to blob URL:', err);
      // Fall through to blob URL method
    }
  }

  // ── PWA Standalone + Browser ──────────────────────────────────────────────
  // Check if the native File System Access API is available (Chrome 86+, Edge 86+)
  if ('showSaveFilePicker' in window && !isStandaloneMode()) {
    try {
      const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
      const opts: any = {
        suggestedName: filename,
        types: [{ description: 'File', accept: { [effectiveMime]: [`.${ext}`] } }],
      };
      const fileHandle = await (window as any).showSaveFilePicker(opts);
      const writable = await fileHandle.createWritable();
      await writable.write(typedBlob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled (AbortError) → do nothing; any other error → fall through
      if (err?.name === 'AbortError') return;
      console.warn('[MobileDownload] showSaveFilePicker failed, falling back:', err);
    }
  }

  // ── Classic blob-URL anchor click (all browsers + PWA) ───────────────────
  const blobUrl = URL.createObjectURL(typedBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);

  // Small delay needed in some mobile WebViews to ensure the URL is ready
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  link.click();

  // Cleanup after a generous delay so the browser has time to initiate the download
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 3000);
};

/**
 * Fetch a file from a URL (using the current auth token) and trigger download.
 *
 * @param endpoint     — Full or relative URL (e.g. "/api/reports/export-excel")
 * @param filename     — Suggested download filename
 * @param getToken     — Callback that returns the current JWT token (or null)
 * @param onProgress   — Optional progress callback (0–100)
 * @returns            — Object: { ok: true } | { ok: false; error: string; status?: number }
 */
export const downloadFromUrl = async (
  endpoint: string,
  filename: string,
  getToken: () => string | null,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; error?: string; status?: number }> => {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Bypass-Tunnel-Reminder': 'true',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let errDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errDetail = errJson.detail || errDetail;
      } catch {
        try {
          errDetail = await response.text() || errDetail;
        } catch { /* keep default */ }
      }
      return { ok: false, error: errDetail, status: response.status };
    }

    // Read response as blob, optionally tracking progress
    let blob: Blob;
    if (onProgress && response.body && response.headers.get('content-length')) {
      blob = await readBodyWithProgress(response, onProgress);
    } else {
      blob = await response.blob();
    }

    // Try to get a better filename from Content-Disposition header
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      if (match?.[1]) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    // Get MIME from Content-Type header if available
    const contentType = response.headers.get('content-type') || getMimeType(filename);

    await triggerDownload(blob, filename, contentType);
    return { ok: true };
  } catch (err: any) {
    console.error('[MobileDownload] downloadFromUrl error:', err);
    return { ok: false, error: err?.message || 'Download failed' };
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check if running in PWA standalone mode */
const isStandaloneMode = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

/** Convert Blob to base64 string for Capacitor Filesystem */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (data:<mime>;base64,)
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/** Read a fetch Response body chunk-by-chunk, reporting download progress */
const readBodyWithProgress = async (
  response: Response,
  onProgress: (pct: number) => void
): Promise<Blob> => {
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        onProgress(Math.min(99, Math.round((received / contentLength) * 100)));
      }
    }
  }

  onProgress(100);
  return new Blob(chunks as unknown as BlobPart[]);
};
