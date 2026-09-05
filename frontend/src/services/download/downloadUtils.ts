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

/** Convert a Blob to a raw base64 string */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file binary.'));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/** Native Android file open/share helper via Capacitor Share plugin */
export async function shareOrOpenFile(fileUri: string, filename: string): Promise<void> {
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: filename,
      text: `Downloaded ${filename}`,
      url: fileUri,
      dialogTitle: `Open ${filename}`,
    });
  } catch (err) {
    console.warn('[DownloadUtils] Native share/open note:', err);
  }
}

/** Infer MIME type from filename extension */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

/** Sanitize filename for safe cross-platform download */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'download_file';
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/** Check if running in PWA standalone mode */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Validates a response Blob to ensure it is non-empty and not a JSON error.
 */
export async function validateFileBlob(blob: Blob, mimeType?: string): Promise<{ valid: boolean; error?: string }> {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Downloaded file is 0 bytes.' };
  }

  if (blob.type.includes('application/json') || mimeType?.includes('json')) {
    try {
      const text = await blob.text();
      if (text.startsWith('{') && (text.includes('"detail"') || text.includes('"error"'))) {
        const parsed = JSON.parse(text);
        const detail = parsed.detail || parsed.error || 'Server returned an error response.';
        return { valid: false, error: detail };
      }
    } catch {
      /* ignore parse error */
    }
  }

  // Reject HTML payloads masking as files (e.g. 504 Gateway Timeout proxy pages)
  if (blob.type.includes('text/html') || mimeType?.includes('html')) {
    try {
      const text = await blob.text();
      if (text.toLowerCase().includes('504 gateway time-out') || text.toLowerCase().includes('502 bad gateway') || text.toLowerCase().includes('<html')) {
        return { valid: false, error: 'Server returned an HTML error page. The request may have timed out.' };
      }
    } catch {
      /* ignore parse error */
    }
  }

  return { valid: true };
}

/**
 * Executes a clean browser native download trigger without navigating the SPA page.
 * Uses a hidden anchor tag with Blob URL or secure temporary URL.
 */
export async function triggerBrowserAnchorDownload(url: string, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.style.display = 'none';
  anchor.rel = 'noopener noreferrer';

  document.body.appendChild(anchor);

  // Execute click immediately. Delaying this click blocks it from being considered a user-triggered event by the browser.
  anchor.click();

  // Remove anchor after a small delay
  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
  }, 1000);
}

