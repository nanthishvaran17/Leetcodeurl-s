import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { playNotificationChime } from '../utils/audioChime';

export const isNativeMobile = () => Capacitor.isNativePlatform();

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ============================================================================
// ANDROID SYSTEM NOTIFICATION CHANNELS (Heads-Up & Lockscreen Enabled)
// ============================================================================

export const SYSTEM_CHANNELS: Channel[] = [
  {
    id: 'messages_channel',
    name: 'Messages & Chat',
    description: 'Real-time direct messages, staff discussions, and student chat alerts',
    importance: 5, // Max / Heads-Up popup
    visibility: 1, // Public on lockscreen
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#3b82f6',
  },
  {
    id: 'leetcode_intelligence_channel',
    name: 'LeetCode Intelligence Alerts',
    description: 'Official contest telemetry, milestones, achievements, and emergency notices',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#3b82f6',
  },
  {
    id: 'academic_announcements',
    name: 'Academic Announcements',
    description: 'Institutional announcements, department notices, and student allocations',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#3b82f6',
  },
];

let channelsInitialized = false;

export const initSystemNotificationChannels = async () => {
  if (channelsInitialized || !isNativeMobile() || Capacitor.getPlatform() !== 'android') return;
  try {
    for (const ch of SYSTEM_CHANNELS) {
      await LocalNotifications.createChannel(ch);
    }
    channelsInitialized = true;
    console.log('[SystemNotification] Android heads-up notification channels configured successfully.');
  } catch (err) {
    console.warn('[SystemNotification] Channel setup note:', err);
  }
};

export interface SystemNotificationOptions {
  title: string;
  body: string;
  actionRoute?: string;
  category?: string;
  notifId?: string | number;
  playSound?: boolean;
}

const seenSystemNotifs = new Map<string, number>();
let lastSystemChimeTime = 0;

/**
 * Dispatches an official status-bar & lock-screen push notification on mobile (and desktop web).
 * Emits sound and vibration, replicating native WhatsApp/messaging behaviour with strict deduplication.
 */
export const triggerSystemNotification = async (options: SystemNotificationOptions): Promise<void> => {
  const { title, body, actionRoute = '/dashboard', category = 'messages', notifId, playSound = true } = options;

  if (!title && !body) return;

  // Deduplication check: prevent duplicate notifications within 30 seconds
  const dedupKey = notifId ? String(notifId) : `${(title || '').trim().toLowerCase()}::${(body || '').trim().toLowerCase().slice(0, 50)}`;
  const now = Date.now();
  
  // Evict entries older than 60s
  for (const [k, ts] of seenSystemNotifs.entries()) {
    if (now - ts > 60000) seenSystemNotifs.delete(k);
  }

  if (seenSystemNotifs.has(dedupKey)) {
    return;
  }
  seenSystemNotifs.set(dedupKey, now);

  // 1. Audio Chime & Haptic Vibration (instant feedback, rate-limited to avoid audio spam)
  if (playSound && now - lastSystemChimeTime > 3500) {
    lastSystemChimeTime = now;
    try {
      playNotificationChime();
    } catch {
      // Audio safety
    }
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([250, 100, 250]);
      }
    } catch {
      // Vibrate safety
    }
  }

  // 2. Native Mobile (Capacitor Android / iOS) — Official Heads-Up Push Notification
  if (isNativeMobile()) {
    try {
      await initSystemNotificationChannels();

      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          console.warn('[SystemNotification] Display permission denied by user.');
          return;
        }
      }

      const rawId = notifId ? String(notifId) : `${Date.now()}_${Math.random()}`;
      const numericId = (hashCode(rawId) % 2147483000) + 1;

      const targetChannel = category === 'messages' || category === 'direct_message'
        ? 'messages_channel'
        : (category === 'announcements' ? 'academic_announcements' : 'leetcode_intelligence_channel');

      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title: title || 'Nandha LeetCode Intelligence',
            body: body || 'You have a new update.',
            channelId: targetChannel,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            iconColor: '#3b82f6',
            autoCancel: true,
            extra: {
              type: 'APP_NOTIFICATION',
              actionRoute,
              notifId: rawId,
              category,
            },
          },
        ],
      });

      console.log(`[SystemNotification] Native heads-up notification scheduled: id=${numericId} channel="${targetChannel}" title="${title}"`);
      return;
    } catch (err) {
      console.warn('[SystemNotification] Native notification dispatch error:', err);
    }
  }

  // 3. Web / PWA / Desktop Browser Notification — ONLY show if tab is in background
  // When the user is active in foreground, in-app toast handles presentation cleanly without OS popup spam
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title || 'Nandha LeetCode Intelligence', {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: notifId ? String(notifId) : undefined,
        data: { actionRoute },
      });

      n.onclick = () => {
        window.focus();
        if (actionRoute) {
          window.dispatchEvent(new CustomEvent('navigate_to_route', { detail: { route: actionRoute } }));
        }
        n.close();
      };
    } catch (webErr) {
      console.warn('[SystemNotification] Web Notification API note:', webErr);
    }
  }
};

let listenersAttached = false;

/**
 * Initializes global event listeners to route incoming notifications and actions.
 */
export const initSystemNotificationListeners = () => {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  // Initialize channels on native
  if (isNativeMobile()) {
    initSystemNotificationChannels();

    // Listen for user tapping the notification
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[SystemNotification] Action performed on local notification:', action);
      const extra = action.notification?.extra || (action as any)?.extra || {};
      const actionRoute = extra.actionRoute || extra.route;
      if (actionRoute) {
        window.dispatchEvent(new CustomEvent('navigate_to_route', { detail: { route: actionRoute } }));
      }
    });
  }

  // Bridge custom events from GlobalNotificationContext
  window.addEventListener('trigger_native_push_notification', (event: any) => {
    const detail = event?.detail;
    if (detail) {
      triggerSystemNotification({
        title: detail.title,
        body: detail.body || detail.message,
        actionRoute: detail.actionRoute || detail.route || '/dashboard',
        category: detail.category || 'announcements',
        notifId: detail.notifId || detail.id,
      });
    }
  });
};
