/**
 * downloadUtils.ts
 *
 * Helper utilities for MIME mapping, filename processing, response validation,
 * and safe SPA browser & Android Capacitor download triggers.
 */

const MIME_MAP: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv;charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  zip: 'application/zip',
  json: 'application/json',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  sqlite: 'application/x-sqlite3',
  db: 'application/x-sqlite3',
};

/** True when running inside Capacitor Android/iOS native app */
export function isNativeMobile(): boolean {
  try {
    return !!((window as any)?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Ensures any payload (Blob, ArrayBuffer, Uint8Array, Object, or String) is converted to a valid Blob instance */
export function normalizeBlob(raw: any, defaultMime?: string): Blob {
  if (!raw) {
    return new Blob([], { type: defaultMime || 'application/octet-stream' });
  }
  if (raw instanceof Blob) {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new Blob([raw], { type: defaultMime || 'application/octet-stream' });
  }
  if (ArrayBuffer.isView(raw)) {
    return new Blob([new Uint8Array(raw.buffer as ArrayBuffer, raw.byteOffset, raw.byteLength)], { type: defaultMime || 'application/octet-stream' });
  }
  if (typeof raw === 'string') {
    return new Blob([raw], { type: defaultMime || 'text/plain' });
  }
  if (typeof raw === 'object' && raw.data) {
    if (raw.data instanceof Blob) {
      return raw.data;
    }
    if (raw.data instanceof ArrayBuffer) {
      return new Blob([raw.data], { type: defaultMime || 'application/octet-stream' });
    }
    if (ArrayBuffer.isView(raw.data)) {
      return new Blob([new Uint8Array(raw.data.buffer as ArrayBuffer, raw.data.byteOffset, raw.data.byteLength)], { type: defaultMime || 'application/octet-stream' });
    }
  }
  return new Blob([raw], { type: defaultMime || 'application/octet-stream' });
}

/** Convert a Blob or any raw binary payload to a base64 string */
export async function blobToBase64(rawBlob: any): Promise<string> {
  if (!rawBlob) {
    throw new Error('File payload is undefined or null');
  }

  if (typeof rawBlob === 'string') {
    if (rawBlob.startsWith('data:')) {
      return rawBlob.split(',')[1] || rawBlob;
    }
    try {
      if (typeof btoa === 'function') {
        return btoa(rawBlob);
      }
    } catch {
      /* ignore */
    }
  }

  const blob = normalizeBlob(rawBlob);

  // High-Speed Path 1: Native browser FileReader (C++ streaming in V8 / WebKit / Android WebView)
  // Handles multi-megabyte reports in <10ms without freezing the JavaScript thread.
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file binary.'));
      reader.onload = () => {
        const result = (reader.result as string) || '';
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  // High-Speed Path 2: Node / Capacitor Buffer environment
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    try {
      const buffer = await blob.arrayBuffer();
      return (globalThis as any).Buffer.from(buffer).toString('base64');
    } catch {
      /* continue to chunked fallback */
    }
  }

  // High-Speed Path 3: Chunked Uint8Array conversion (32KB blocks, zero multi-million string allocations)
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32768
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE) as any));
  }
  return btoa(chunks.join(''));
}

import { registerPlugin } from '@capacitor/core';

export interface DocumentOpenerPluginType {
  openDocument(options: { path: string; filename: string; mimeType?: string }): Promise<void>;
  shareDocument(options: { path: string; filename: string; mimeType?: string; text?: string }): Promise<void>;
  fileExists(options: { path: string; filename: string }): Promise<{ exists: boolean; size?: number }>;
  saveToDownloads(options: { data: string; filename: string; mimeType?: string }): Promise<{ success: boolean; path: string; fileUri: string; publicUri: string }>;
  openAppSettings(): Promise<{ success: boolean }>;
}

export const DocumentOpener = registerPlugin<DocumentOpenerPluginType>('DocumentOpener');

/** Launch device app details / permission settings page */
export async function openNativeAppSettings(): Promise<void> {
  if (isNativeMobile()) {
    try {
      await DocumentOpener.openAppSettings();
    } catch (e) {
      console.warn('Failed to open app settings:', e);
    }
  }
}

/** Native Android file open helper via DocumentOpener (Excel/Sheets) with fallback to Share */
export async function openDownloadedDocument(
  fileUri: string,
  filename: string,
  mimeType?: string
): Promise<{ success: boolean; error?: string }> {
  const effectiveMime = mimeType || getMimeTypeFromFilename(filename);

  if (isNativeMobile()) {
    // 1. Primary: Launch directly into Microsoft Excel / Google Sheets via Android Intent
    try {
      await DocumentOpener.openDocument({
        path: fileUri,
        filename,
        mimeType: effectiveMime,
      });
      console.log(`[DownloadUtils] DocumentOpener successfully launched for ${filename}`);
      return { success: true };
    } catch (err: any) {
      console.warn('[DownloadUtils] DocumentOpener launch failed, falling back to Share:', err);
    }

    // 2. Fallback: Capacitor Share (user selects Excel or other installed apps)
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: filename,
        text: `Open report: ${filename}`,
        url: fileUri,
        dialogTitle: `Open ${filename} with...`,
      });
      return { success: true };
    } catch (err: any) {
      console.warn('[DownloadUtils] Capacitor Share fallback failed:', err);
      return { success: false, error: 'Unable to open file in document viewer.' };
    }
  }

  // 3. Web browser environment
  if (typeof window !== 'undefined' && fileUri) {
    try {
      if (fileUri.startsWith('blob:') || fileUri.startsWith('http') || fileUri.startsWith('data:')) {
        const opened = window.open(fileUri, '_blank');
        if (!opened) {
          window.location.href = fileUri;
        }
      }
    } catch (e) {
      console.warn('[DownloadUtils] Web open error:', e);
    }
  }

  return { success: true };
}

/**
 * Saves a file to the user's mobile device storage.
 * Prioritizes the native Android Public Downloads folder (MediaStore.Downloads) via DocumentOpener.saveToDownloads,
 * so the file appears directly in the phone's "Downloads" and "My Files" apps.
 * Falls back to Capacitor Filesystem (Directory.Documents).
 */
export async function saveFileToMobileStorage(
  rawBlob: any,
  filename: string,
  mimeType?: string
): Promise<{ uri: string; path: string }> {
  const effectiveMime = mimeType || getMimeTypeFromFilename(filename);
  const base64Data = await blobToBase64(rawBlob);

  // 1. Primary: Native Android Public Downloads folder (appears in phone's Downloads app & File Manager)
  if (isNativeMobile()) {
    try {
      const saveRes = await DocumentOpener.saveToDownloads({
        data: base64Data,
        filename,
        mimeType: effectiveMime,
      });
      if (saveRes?.fileUri) {
        console.log(`[DownloadUtils] Successfully saved to Android Public Downloads: ${filename} -> ${saveRes.publicUri || saveRes.fileUri}`);
        return {
          uri: saveRes.fileUri,
          path: saveRes.path || saveRes.fileUri,
        };
      }
    } catch (nativeErr) {
      console.warn('[DownloadUtils] Native saveToDownloads failed, attempting Filesystem fallback:', nativeErr);
    }

    // 2. Fallback: Capacitor Filesystem Directory.Documents (accessible to user)
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      return {
        uri: writeResult.uri,
        path: writeResult.uri,
      };
    } catch (docErr) {
      console.warn('[DownloadUtils] Directory.Documents write failed, falling back to Directory.Cache:', docErr);
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      return {
        uri: writeResult.uri,
        path: writeResult.uri,
      };
    }
  }

  return { uri: '', path: '' };
}

/** Display non-disruptive user notification when file is deleted or unavailable */
export function showFileUnavailableNotice(filename?: string) {
  const message = 'File is no longer available.';
  console.warn('[DownloadUtils]', message, filename);
  
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('show_toast', {
      detail: { message, type: 'error' }
    });
    window.dispatchEvent(event);

    // Also trigger subtle alert if no custom toast container is mounted
    if (typeof alert === 'function') {
      try {
        alert(message);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Native Android file share helper via DocumentOpener.shareDocument with fallback to Share plugin and Web Share */
export async function shareDownloadedDocument(
  fileUri: string,
  filename: string,
  mimeType?: string
): Promise<{ success: boolean; error?: string }> {
  const effectiveMime = mimeType || getMimeTypeFromFilename(filename);

  if (isNativeMobile()) {
    // 1. Primary: Android Native ACTION_SEND chooser via DocumentOpener
    try {
      await DocumentOpener.shareDocument({
        path: fileUri,
        filename,
        mimeType: effectiveMime,
      });
      console.log(`[DownloadUtils] Native shareDocument launched for ${filename}`);
      return { success: true };
    } catch (pluginErr) {
      console.warn('[DownloadUtils] DocumentOpener.shareDocument failed, trying Capacitor Share fallback:', pluginErr);
    }

    // 2. Fallback: Capacitor Share plugin
    try {
      const { Share } = await import('@capacitor/share');
      let shareUrl: string | undefined = fileUri;
      if (shareUrl && !shareUrl.startsWith('file:') && !shareUrl.startsWith('http') && !shareUrl.startsWith('content:')) {
        if (shareUrl.startsWith('/')) {
          shareUrl = `file://${shareUrl}`;
        }
      }

      await Share.share({
        title: filename,
        text: `Report: ${filename}`,
        url: shareUrl,
        dialogTitle: `Share ${filename}`,
      });
      return { success: true };
    } catch (shareErr: any) {
      console.warn('[DownloadUtils] Capacitor Share failed:', shareErr);
      return { success: false, error: shareErr?.message || 'Failed to share file' };
    }
  }

  // 3. Web Navigator Share fallback
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({
        title: filename,
        text: `Report: ${filename}`,
      });
      return { success: true };
    } catch (webErr) {
      console.warn('[DownloadUtils] Web share error:', webErr);
    }
  }

  return { success: false, error: 'Sharing not supported on this platform' };
}

/** Native Android file open/share helper via DocumentOpener/Share plugin */
export async function shareOrOpenFile(fileUri: string, filename: string, mimeType?: string): Promise<void> {
  await openDownloadedDocument(fileUri, filename, mimeType);
}

/** Infer MIME type from filename extension */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

/** Sanitize filename for safe cross-platform download, preventing path traversal, HTTP header injection, and OS issues */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'download_file';
  // Strip control characters, quotes, semicolons, path traversal sequences, and illegal OS characters
  const clean = filename
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Control characters
    .replace(/\.\.+/g, '')                 // Path traversal dots (..)
    .replace(/[/\\?%*:|"<>`';]/g, '_')     // Path separators, quotes, semicolons
    .trim();
  
  // Truncate to maximum safe filesystem length (180 chars)
  const safe = clean.length > 180 ? clean.substring(0, 180) : clean;
  return safe || 'download_file';
}

/** Check if running in PWA standalone mode */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/** Check if running on a mobile web browser (iOS Safari, Android Chrome, etc.) */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Check if running on iOS (iPhone/iPad) */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
}

/**
 * Validates a response Blob to ensure it is non-empty and not a JSON error.
 */
export async function validateFileBlob(rawBlob: any, mimeType?: string): Promise<{ valid: boolean; error?: string }> {
  if (!rawBlob) {
    return { valid: false, error: 'Downloaded file payload is empty or undefined.' };
  }

  const blob = normalizeBlob(rawBlob, mimeType);

  if (blob.size === 0) {
    return { valid: false, error: 'Downloaded file is 0 bytes.' };
  }

  // Inspect small blobs (<50KB) that might be disguised JSON error payloads or HTML error pages
  const blobType = (blob && blob.type) ? String(blob.type) : '';
  const effectiveMime = mimeType ? String(mimeType) : '';

  if (blob.size < 50000 || blobType.includes('application/json') || effectiveMime.includes('json') || blobType.includes('text/html')) {
    try {
      const text = await blob.text();
      const trimmed = text.trim();
      if (trimmed.startsWith('{') && (trimmed.includes('"detail"') || trimmed.includes('"error"') || trimmed.includes('"message"'))) {
        try {
          const parsed = JSON.parse(trimmed);
          const detail = parsed.detail || parsed.error || parsed.message || 'Server returned an error response.';
          return { valid: false, error: detail };
        } catch {
          /* ignore parse error */
        }
      }
      if (trimmed.toLowerCase().includes('504 gateway time-out') || trimmed.toLowerCase().includes('502 bad gateway') || trimmed.toLowerCase().startsWith('<!doctype html') || (trimmed.startsWith('<html') && trimmed.includes('error'))) {
        return { valid: false, error: 'Server returned an HTML error page. The request may have timed out.' };
      }
    } catch {
      /* ignore read error */
    }
  }

  return { valid: true };
}

/**
 * Executes a clean browser native download trigger without navigating the SPA page.
 * Uses a hidden anchor tag with Blob URL or secure temporary URL.
 * Handles iOS Safari, Android Chrome, and Desktop browsers cleanly.
 */
export async function triggerBrowserAnchorDownload(url: string, filename: string, mimeType?: string): Promise<void> {
  const safeName = sanitizeFilename(filename);

  // iOS Safari mobile browser handling:
  // iOS Safari can preview PDFs and images directly inline in a new tab.
  // For document files (xlsx, csv, docx, zip), navigating to blob: URLs fails or opens a blank screen.
  // Therefore, only use window.open for PDF/images on iOS.
  const isPreviewableOnIOS = !!(mimeType?.includes('pdf') || mimeType?.startsWith('image/'));
  if (isIOS() && url.startsWith('blob:') && isPreviewableOnIOS) {
    try {
      const w = window.open(url, '_blank');
      if (w) return;
    } catch {
      /* fallback to anchor download */
    }
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  // Position offscreen instead of display: none (some mobile browsers ignore programmatic clicks on display: none)
  anchor.style.position = 'fixed';
  anchor.style.top = '-9999px';
  anchor.style.left = '-9999px';
  anchor.style.opacity = '0';
  anchor.style.pointerEvents = 'none';
  anchor.rel = 'noopener noreferrer';
  if (mimeType) {
    anchor.type = mimeType;
  }

  document.body.appendChild(anchor);

  try {
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch (e) {
    try {
      anchor.click();
    } catch (clickErr) {
      console.warn('[DownloadUtils] Anchor click failed, falling back to direct navigation:', clickErr);
      if (!isIOS()) {
        window.location.href = url;
      }
    }
  }

  // Remove anchor after a small delay
  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
  }, 1500);
}

