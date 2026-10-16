/**
 * downloadNotification.ts
 *
 * Centralized Notification Service for LeetCode Tracker Report Downloads.
 * 
 * Guarantees:
 * 1. Notifications appear ONLY AFTER the download completes successfully.
 * 2. Notification payload contains the real file reference (filePath, filename, mimeType).
 * 3. Tapping the notification directly opens the downloaded file via native document viewer (NO app routing).
 * 4. Deduplicated notification IDs per download.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeMobile, getMimeTypeFromFilename, openDownloadedDocument, shareDownloadedDocument } from './downloadUtils';

export interface DownloadCompletionPayload {
  filename: string;
  localFileUri?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  reportId?: string;
}

function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2147483647) || 1;
}

/**
 * Resolves the dynamic notification action configuration based on file extension.
 * Excel/CSV: "Open in Excel"
 * PDF: "Open in PDF"
 * Word: "Open in Word"
 * PowerPoint: "Open in PowerPoint"
 * Others: "Open File"
 */
export function getReportActionConfig(filename: string): { actionTypeId: string; openTitle: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return { actionTypeId: 'DOWNLOAD_ACTION_EXCEL', openTitle: 'Open in Excel' };
  }
  if (ext === 'pdf') {
    return { actionTypeId: 'DOWNLOAD_ACTION_PDF', openTitle: 'Open in PDF' };
  }
  if (['docx', 'doc'].includes(ext)) {
    return { actionTypeId: 'DOWNLOAD_ACTION_WORD', openTitle: 'Open in Word' };
  }
  if (['pptx', 'ppt'].includes(ext)) {
    return { actionTypeId: 'DOWNLOAD_ACTION_PPT', openTitle: 'Open in PowerPoint' };
  }
  return { actionTypeId: 'DOWNLOAD_ACTION_GENERIC', openTitle: 'Open File' };
}

class DownloadNotificationService {
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNotificationListeners();
    }
  }

  /**
   * Initializes notification tap listeners and dynamic action categories.
   * Guarantees tapping the notification opens the report directly in Excel, Word, PDF or document viewer.
   */
  async initNotificationListeners(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (isNativeMobile()) {
      try {
        // Register Action Types dynamically based on document formats
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'DOWNLOAD_ACTION_EXCEL',
              actions: [
                {
                  id: 'OPEN_EXCEL',
                  title: 'Open in Excel',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
            {
              id: 'DOWNLOAD_ACTION_PDF',
              actions: [
                {
                  id: 'OPEN_PDF',
                  title: 'Open in PDF',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
            {
              id: 'DOWNLOAD_ACTION_WORD',
              actions: [
                {
                  id: 'OPEN_WORD',
                  title: 'Open in Word',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
            {
              id: 'DOWNLOAD_ACTION_PPT',
              actions: [
                {
                  id: 'OPEN_PPT',
                  title: 'Open in PowerPoint',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
            {
              id: 'DOWNLOAD_ACTION_GENERIC',
              actions: [
                {
                  id: 'OPEN_FILE',
                  title: 'Open File',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
            {
              id: 'DOWNLOAD_ACTIONS',
              actions: [
                {
                  id: 'OPEN_EXCEL',
                  title: 'Open in Excel',
                },
                {
                  id: 'SHARE_FILE',
                  title: 'Share',
                },
              ],
            },
          ],
        }).catch(() => {});

        // Listen for user tapping or selecting an action on the notification
        LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
          console.log('[DownloadNotification] Notification action performed by user:', action);
          const extra = action.notification?.extra || {};
          const actionId = action.actionId;

          const filePath = extra.filePath || extra.localFileUri || '';
          const filename = extra.filename || action.notification?.body || 'report.xlsx';
          const mimeType = extra.mimeType || getMimeTypeFromFilename(filename);

          if (actionId === 'SHARE_FILE') {
            console.log(`[DownloadNotification] Triggering share for: ${filename}`);
            try {
              await shareDownloadedDocument(filePath, filename, mimeType);
            } catch (err) {
              console.warn('[DownloadNotification] Share action failed:', err);
            }
            return; // STRICT RETURN: Do not fall through to openDownloadedDocument!
          }

          // User tapped 'OPEN_EXCEL', 'OPEN_PDF', 'OPEN_WORD', 'OPEN_FILE' OR notification body ('tap')
          if (filePath || filename) {
            console.log(`[DownloadNotification] Opening ${filename} in document viewer... (action: ${actionId})`);
            await openDownloadedDocument(filePath, filename, mimeType);
          }
        });

        console.log('[DownloadNotification] Native notification action listeners successfully initialized.');
      } catch (err) {
        console.warn('[DownloadNotification] Failed to initialize native notification listeners:', err);
      }
    }

    // Web / PWA ServiceWorker notification click listener
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'OPEN_DOWNLOADED_FILE') {
            const payload = event.data.payload || {};
            console.log('[DownloadNotification] Received OPEN_DOWNLOADED_FILE from ServiceWorker:', payload);
            if (payload.localFileUri || payload.filename) {
              openDownloadedDocument(payload.localFileUri, payload.filename, payload.mimeType);
            }
          }
        });
      } catch (swMsgErr) {
        console.warn('[DownloadNotification] SW message listener error:', swMsgErr);
      }
    }
  }

  /**
   * NEVER SHOW START NOTIFICATION.
   * Start notifications are completely disabled per production specification.
   */
  async notifyStart(_filename: string, _mimeType?: string): Promise<void> {
    // Intentionally no-op: notifications must only appear after download completes.
  }

  /**
   * Download Completed Notification.
   * Fires only after file is validated on disk with size > 0.
   */
  async notifySuccess(payload: string | DownloadCompletionPayload): Promise<void> {
    const filename = typeof payload === 'string' ? payload : payload.filename;
    const localFileUri = typeof payload === 'string' ? '' : (payload.localFileUri || '');
    const mimeType = typeof payload === 'string' ? getMimeTypeFromFilename(payload) : (payload.mimeType || getMimeTypeFromFilename(filename));
    const fileSizeBytes = typeof payload === 'string' ? undefined : payload.fileSizeBytes;
    const reportId = typeof payload === 'string' ? undefined : payload.reportId;

    const fileType = filename.split('.').pop()?.toLowerCase() || 'document';
    const notifUniqueKey = `download:${filename}:${localFileUri || reportId || 'web'}`;
    const notifId = hashStringToId(notifUniqueKey);

    const title = 'Report downloaded';
    const body = filename;
    const { actionTypeId, openTitle } = getReportActionConfig(filename);

    // 1. Native Mobile (Capacitor LocalNotifications)
    if (isNativeMobile()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title,
              body,
              channelId: 'leetcode_intelligence_channel',
              smallIcon: 'ic_stat_notification',
              iconColor: '#3b82f6',
              actionTypeId: actionTypeId,
              extra: {
                type: 'DOWNLOAD_COMPLETE',
                filePath: localFileUri,
                localFileUri: localFileUri,
                filename: filename,
                fileType: fileType,
                mimeType: mimeType,
                fileSizeBytes: fileSizeBytes,
                createdAt: Date.now(),
                reportId: reportId,
              },
              schedule: { at: new Date(Date.now() + 50) },
            },
          ],
        });
        console.log(`[DownloadNotification] Native completion notification posted: id=${notifId} file="${filename}" actionType="${actionTypeId}" ("${openTitle}")`);
        return;
      } catch (err) {
        console.warn('[DownloadNotification] Native local notification error:', err);
      }
    }

    // 2. Web Notification API / Service Worker
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.showNotification) {
              await reg.showNotification(title, {
                body,
                icon: '/nec_25_logo.png',
                badge: '/nec_25_logo.png',
                tag: `download-${notifId}`,
                actions: [
                  { action: 'open_file', title: openTitle },
                  { action: 'share_file', title: 'Share' },
                ],
                data: {
                  type: 'DOWNLOAD_COMPLETE',
                  filename,
                  localFileUri,
                  mimeType,
                },
              } as NotificationOptions);
              return;
            }
          }

          const n = new Notification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: `download-${notifId}`,
          });
          n.onclick = () => {
            window.focus();
            if (localFileUri) {
              openDownloadedDocument(localFileUri, filename, mimeType);
            }
            n.close();
          };
        }
      } catch (err) {
        console.warn('[DownloadNotification] Web notification dispatch note:', err);
      }
    }
  }

  /**
   * Download Failed Notification.
   */
  async notifyFailure(filename: string, reason?: string): Promise<void> {
    const title = 'Download Failed';
    const body = `${filename}\n${reason || 'Unable to download report. Please try again.'}`;

    if (isNativeMobile()) {
      try {
        const notifId = hashStringToId(`failed:${filename}:${Date.now()}`);
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title,
              body,
              channelId: 'leetcode_intelligence_channel',
              smallIcon: 'ic_stat_notification',
              iconColor: '#ef4444',
              extra: { type: 'DOWNLOAD_FAILED', filename },
              schedule: { at: new Date(Date.now() + 50) },
            },
          ],
        });
        return;
      } catch {
        /* ignore */
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/logo.png' });
      } catch {
        /* ignore */
      }
    }
  }

  async notifyPermissionDenied(filename?: string): Promise<void> {
    await this.notifyFailure(filename || 'Report', 'Permission Denied.');
  }

  async notifyExpired(filename?: string): Promise<void> {
    await this.notifyFailure(filename || 'Report', 'Download link expired. Please try again.');
  }
}

export const downloadNotification = new DownloadNotificationService();
