/**
 * downloadTypes.ts
 * Type definitions for LeetCode Tracker Global Download System.
 */

export type DownloadStatus =
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'PREPARING'
  | 'READY'
  | 'DOWNLOADING'
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

export interface DownloadOptions {
  /** Target backend endpoint (e.g. "/api/reports/export-excel" or relative path) */
  endpoint: string;
  /** Suggested download filename */
  filename?: string;
  /** Expected MIME type (e.g. "application/pdf") */
  mimeType?: string;
  /** Additional query parameters or data */
  params?: Record<string, any>;
  data?: any;
  /** HTTP Method ('GET' | 'POST') */
  method?: 'GET' | 'POST';
  /** Optional state change listener */
  onStateChange?: (state: DownloadState) => void;
}

export interface DownloadState {
  downloadId: string;
  endpoint: string;
  filename: string;
  mimeType: string;
  status: DownloadStatus;
  error?: string;
  preparedUrl?: string;
  startTime?: number;
}

export interface PrepareResponse {
  download_url: string;
  filename: string;
  mime_type: string;
  expires_in: number;
  status: string;
}
