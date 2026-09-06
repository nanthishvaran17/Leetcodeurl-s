import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, PushNotificationSchema, Token } from '@capacitor/push-notifications';
import { LocalNotifications, Importance, Visibility, Channel } from '@capacitor/local-notifications';
import axios from 'axios';

export const createNotificationChannels = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions();
    }

    const channels: Channel[] = [
      {
        id: 'leetcode_intelligence_channel',
        name: 'LeetCode Intelligence Alerts',
        description: 'Real-time alerts for contests, imports, reports, and system notices',
        importance: 5 as Importance, // MAX Importance (Heads-up notification banner)
        visibility: 1 as Visibility, // Public (lock screen)
        vibration: true,
        sound: 'default'
      },
      {
        id: 'leetcode_alerts',
        name: 'LeetCode Tracker Notifications',
        description: 'General push notifications and messages',
        importance: 5 as Importance,
        visibility: 1 as Visibility,
        vibration: true,
        sound: 'default'
      }
    ];

    for (const ch of channels) {
      await LocalNotifications.createChannel(ch);
    }
    console.log('[FCM/LOCAL] Notification channels created successfully.');
  } catch (err) {
    console.warn('[FCM/LOCAL] Error creating notification channels:', err);
  }
};

function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2147483647) || 1;
}

export const triggerNativeStatusBarNotification = async (title: string, body: string, data?: any) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const rawId = data?.conversation_id || data?.conversationId || data?.notificationId || data?.event_id || title;
    const notifId = rawId ? hashStringToId(String(rawId)) : Math.floor(Math.random() * 2147483647);
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: title || 'LeetCode Tracker',
          body: body || 'New update received',
          channelId: 'leetcode_intelligence_channel',
          smallIcon: 'ic_stat_notification',
          iconColor: '#3b82f6',
          extra: data || {},
          schedule: { at: new Date(Date.now() + 100) }
        }
      ]
    });
    console.log(`[LOCAL NOTIF] Status bar notification posted successfully. id=${notifId} title="${title}"`);
  } catch (e) {
    console.warn('[LOCAL NOTIF] Schedule failed:', e);
  }
};

export const initPushNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[FCM] Web platform active — native push notification listener skipped.');
    return;
  }

  try {
    // 1. Create channels & request permissions
    await createNotificationChannels();

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[FCM] Push Notification permission denied by user.');
      return;
    }

    console.log('[FCM] Push Notification permission granted. Registering for FCM...');

    // 2. Add listeners BEFORE calling register()
    await PushNotifications.removeAllListeners();
    await LocalNotifications.removeAllListeners();

    // Registration Success
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[FCM] Device Token received:', token.value);
      
      try {
        const prodUrl = import.meta.env.VITE_API_URL || 'https://leetcodeurl-s-3mig.onrender.com';
        await axios.post(`${prodUrl}/api/bot-notifications/register-token`, {
          token: token.value,
          topic: 'all_app_users',
          platform: 'android'
        }, { timeout: 5000 }).catch(err => {
          console.warn('[FCM] Backend token registration note:', err.message);
        });
      } catch (err) {
        console.warn('[FCM] Error registering token with backend:', err);
      }
    });

    // Registration Error
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[FCM] FCM Registration Error:', error);
    });

    // Foreground Notification Received
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[FCM] Notification Received in Foreground:', notification);
        
        // If user is actively viewing this specific conversation in foreground, suppress redundant banner
        const notifData = notification.data || {};
        const convId = notifData.conversation_id || notifData.conversationId;
        const currentSearch = window.location.search;
        const currentPath = window.location.pathname;
        const isViewingConversation = Boolean(
          convId && 
          (currentPath.includes('/messages') || window.location.hash.includes('/messages')) &&
          (currentSearch.includes(convId) || window.location.href.includes(convId))
        );

        if (!isViewingConversation) {
          triggerNativeStatusBarNotification(
            notification.title || 'LeetCode Tracker',
            notification.body || '',
            notification.data
          );
        } else {
          console.log(`[FCM] Redundant system notification suppressed: user is actively viewing conversation ${convId}`);
        }

        // Dispatch custom event for UI toast / banner / real-time message stream
        const event = new CustomEvent('fcm_notification_received', { detail: notification });
        window.dispatchEvent(event);
      }
    );

    // Notification Tapped / Action Performed
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('[FCM] Notification Tapped / Action Performed:', action);
        const data = action.notification.data || {};
        const actionRoute = data.actionRoute || data.action_route;

        if (actionRoute) {
          console.log(`[FCM] Navigating user to action route: ${actionRoute}`);
          window.location.href = actionRoute.startsWith('/') ? actionRoute : '/' + actionRoute;
        }
      }
    );

    // Local Notification Tapped
    await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      console.log('[LOCAL NOTIF] Local notification tapped:', action);
      const extra = action.notification.extra || {};

      // 1. Download Completion Notification: Open the ACTUAL file directly with external document viewer
      if (extra.type === 'DOWNLOAD_COMPLETE' || extra.filePath || extra.localFileUri) {
        const filePath = extra.filePath || extra.localFileUri;
        const filename = extra.filename || 'report';
        const mimeType = extra.mimeType;

        console.log(`[LOCAL NOTIF] Download notification clicked -> Opening file: ${filePath} (${mimeType})`);
        const { openDownloadedDocument } = await import('./download/downloadUtils');
        await openDownloadedDocument(filePath, filename, mimeType);
        return; // DO NOT REDIRECT OR NAVIGATE TO APP ROUTES
      }

      // 2. Non-download system notifications (navigation fallback)
      const actionRoute = extra.actionRoute || extra.action_route;
      if (actionRoute) {
        window.location.href = actionRoute.startsWith('/') ? actionRoute : '/' + actionRoute;
      }
    });

    // 3. Register device with FCM
    await PushNotifications.register();

  } catch (error) {
    console.error('[FCM] Failed to initialize Push Notifications:', error);
  }
};
