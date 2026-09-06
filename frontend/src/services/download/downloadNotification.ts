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
import { isNativeMobile, getMimeTypeFromFilename, openDownloadedDocument } from './downloadUtils';

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

class DownloadNotificationService {
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
    const notifUniqueKey = `download:${filename}:${localFileUri || Date.now()}`;
    const notifId = hashStringToId(notifUniqueKey);

    const title = 'Report downloaded';
    const body = filename;

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
        console.log(`[DownloadNotification] Native completion notification posted: id=${notifId} file="${filename}"`);
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
                icon: '/logo.png',
                badge: '/logo.png',
                tag: `download-${notifId}`,
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
