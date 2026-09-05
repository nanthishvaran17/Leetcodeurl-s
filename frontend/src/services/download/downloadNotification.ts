/**
 * downloadNotification.ts
 *
 * Centralized PWA/Browser Notification Service for LeetCode Tracker Global Download System.
 * Notification Title: "LeetCode Tracker"
 */

import { triggerNativeStatusBarNotification } from '../pushNotifications';

export const APP_NOTIFICATION_TITLE = 'LeetCode Tracker';

export function getFileEmoji(filename: string, mimeType?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType?.includes('pdf')) return '📄';
  if (ext === 'xlsx' || ext === 'xls' || mimeType?.includes('spreadsheet')) return '📊';
  if (ext === 'csv' || mimeType?.includes('csv')) return '📈';
  if (ext === 'zip' || mimeType?.includes('zip')) return '📁';
  if (filename.toLowerCase().includes('certificat') || filename.toLowerCase().includes('forensic')) return '📜';
  if (ext === 'docx' || ext === 'doc' || mimeType?.includes('word')) return '📝';
  return '📦';
}

class DownloadNotificationService {
  /**
   * Dispatches a branded notification via Web Notifications, ServiceWorker, or Capacitor LocalNotifications.
   */
  private async show(body: string, actionRoute: string = '/dashboard'): Promise<void> {
    try {
      // 1. Try Capacitor Native Status Bar Notification
      try {
        await triggerNativeStatusBarNotification(APP_NOTIFICATION_TITLE, body, { actionRoute });
      } catch {
        // Non-native fallback
      }

      // 2. Try Web Notification API / Service Worker Notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.showNotification) {
              await reg.showNotification(APP_NOTIFICATION_TITLE, {
                body,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: 'leetcode-tracker-download',
                data: { actionRoute, FCM_MSG: false }
              } as NotificationOptions);
              return;
            }
          }

          // Direct browser notification fallback
          const n = new Notification(APP_NOTIFICATION_TITLE, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'leetcode-tracker-download'
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } else if (Notification.permission === 'default') {
          // Request permission silently
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[DownloadNotification] Notification dispatch note:', err);
    }
  }

  /**
   * Download Started Notification
   * Example:
   * LeetCode Tracker
   * 📄 Weekly_Report.pdf
   * Download started…
   */
  async notifyStart(filename: string, mimeType?: string): Promise<void> {
    const emoji = getFileEmoji(filename, mimeType);
    const body = `${emoji} ${filename}\nDownload started…`;
    await this.show(body);
  }

  /**
   * Download Completed Notification
   * Example:
   * LeetCode Tracker
   * ✅ Weekly_Report.pdf
   * Download completed
   */
  async notifySuccess(filename: string): Promise<void> {
    const body = `✅ ${filename}\nDownload completed`;
    await this.show(body);
  }

  /**
   * Download Failed Notification
   * Example:
   * LeetCode Tracker
   * ❌ Weekly_Report.pdf
   * Download failed.
   */
  async notifyFailure(filename: string, reason?: string): Promise<void> {
    const body = `❌ ${filename}\n${reason || 'Download failed.'}`;
    await this.show(body);
  }

  /**
   * Permission Error Notification
   * Example:
   * LeetCode Tracker
   * 🔒 You don't have permission to download this file.
   */
  async notifyPermissionDenied(filename?: string): Promise<void> {
    const body = filename
      ? `🔒 You don't have permission to download ${filename}.`
      : `🔒 You don't have permission to download this file.`;
    await this.show(body);
  }

  /**
   * Download Authorization Expired Notification
   */
  async notifyExpired(filename?: string): Promise<void> {
    const body = filename
      ? `⏱️ ${filename}\nDownload link expired. Please try again.`
      : `⏱️ Download link expired. Please try again.`;
    await this.show(body);
  }
}

export const downloadNotification = new DownloadNotificationService();
