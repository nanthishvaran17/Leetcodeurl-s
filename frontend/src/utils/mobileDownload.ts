/**
 * mobileDownload.ts
 *
 * Compatibility wrapper delegating all download requests to the centralized DownloadManager.
 */

import { downloadManager } from '../services/download/downloadManager';
import { getMimeTypeFromFilename } from '../services/download/downloadUtils';

export const getMimeType = getMimeTypeFromFilename;

/**
 * Trigger a file download for a Blob using the central DownloadManager.
 */
export const triggerDownload = async (
  blob: Blob,
  filename: string,
  mimeType?: string
): Promise<void> => {
  await downloadManager.downloadBlob(blob, filename, mimeType);
};

/**
 * Download a file from an endpoint using the central DownloadManager.
 */
export const downloadFromUrl = async (
  endpoint: string,
  filename: string,
  _getToken?: () => string | null,
  _onProgress?: (pct: number) => void
): Promise<{ ok: boolean; error?: string; status?: number }> => {
  const result = await downloadManager.download({
    endpoint,
    filename,
  });

  return {
    ok: result.success,
    error: result.error,
    status: result.success ? 200 : 500,
  };
};
