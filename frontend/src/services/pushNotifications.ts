import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { PushNotifications, Channel } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { getOrInitApp } from './firebase';
import api from './api';

const vapidKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) || undefined;

export const isNativeMobile = () => Capacitor.isNativePlatform();

export const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

export const isStandalonePWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

// ============================================================================
// ANDROID NOTIFICATION CHANNELS (Android 8.0+ / Oreo+)
// ============================================================================

export const ANDROID_CHANNELS: Channel[] = [
  {
    id: 'account_security',
    name: 'Account & Security',
    description: 'Critical security alerts, password changes, and account activity',
    importance: 5, // High / Urgent
    visibility: 1, // Public
    sound: 'default',
    vibration: true,
  },
  {
    id: 'contest_updates',
    name: 'Contest Updates',
    description: 'Live contest alerts, reminders, and contest result announcements',
    importance: 4, // High
    visibility: 1,
    sound: 'default',
    vibration: true,
  },
  {
    id: 'weekly_reports',
    name: 'Weekly Performance Reports',
    description: 'Weekly student performance reports and analytical summaries',
    importance: 3, // Default
    visibility: 1,
    sound: 'default',
    vibration: false,
  },
  {
    id: 'performance_updates',
    name: 'Performance Milestones',
    description: 'Rating changes, milestones, and performance velocity updates',
    importance: 3, // Default
    visibility: 1,
    sound: 'default',
    vibration: false,
  },
  {
    id: 'academic_announcements',
    name: 'Academic Announcements',
    description: 'Institutional, department, and academic announcements',
    importance: 3, // Default
    visibility: 1,
    sound: 'default',
    vibration: false,
  },
  {
    id: 'system_status',
    name: 'System Status',
    description: 'Maintenance schedules and system status updates',
    importance: 3, // Default
    visibility: 1,
    sound: 'default',
    vibration: false,
  },
];

export const createAndroidChannels = async () => {
  if (!isNativeMobile() || Capacitor.getPlatform() !== 'android') return;
  try {
    for (const channel of ANDROID_CHANNELS) {
      await PushNotifications.createChannel(channel);
    }
    console.log('[Push] 6 Native Android Notification Channels configured successfully.');
  } catch (err) {
    console.warn('[Push] Android channel setup note:', err);
  }
};

// ============================================================================
// TOKEN MANAGEMENT & REGISTRATION
// ============================================================================

export const syncTokenToBackend = async (deviceToken: string, userEmailOrId?: string) => {
  if (!deviceToken) return false;
  try {
    let platform = 'android';
    if (isNativeMobile()) {
      platform = Capacitor.getPlatform(); // 'android' | 'ios'
    } else if (isIOS()) {
      platform = 'ios-pwa';
    } else if (/android/i.test(navigator.userAgent)) {
      platform = 'android-web';
    } else {
      platform = 'web';
    }

    await api.post('/notifications/register-device', {
      user_id: userEmailOrId || undefined,
      device_token: deviceToken,
      platform: platform,
      app_version: '2.2.0',
      device_model: navigator.userAgent,
    });
    console.log('[Push] FCM Device Token registered with backend server.');
    return true;
  } catch (err) {
    console.warn('[Push] Backend token registration note:', err);
    return false;
  }
};

export const requestPushPermissionAndSync = async (userEmailOrId: string) => {
  // 1. Native Capacitor App (Android / iOS)
  if (isNativeMobile()) {
    try {
      await createAndroidChannels();

      const permStatus = await PushNotifications.checkPermissions();
      let granted = permStatus.receive === 'granted';

      if (!granted) {
        const reqResult = await PushNotifications.requestPermissions();
        granted = reqResult.receive === 'granted';
      }

      if (granted) {
        await PushNotifications.register();
        return true;
      } else {
        console.warn('[Push] Native Push Notification permission denied.');
        return false;
      }
    } catch (err) {
      console.error('[Push] Native Push Notification registration error:', err);
      return false;
    }
  }

  // 2. Web Browser / PWA Mode
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  if (isIOS() && !isStandalonePWA()) {
    console.warn('[Push] iOS devices require PWA (Add to Home Screen) for Push Notifications.');
    return false;
  }

  try {
    const supported = await isSupported();
    if (!supported) return false;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const app = getOrInitApp();
      const messaging = getMessaging(app);
      
      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        return await syncTokenToBackend(currentToken, userEmailOrId);
      }
    }
    return false;
  } catch (err) {
    console.error('[Push] Web Push Notification error:', err);
    return false;
  }
};

// ============================================================================
// FOREGROUND & BACKGROUND LISTENERS WITH DEEP LINKING
// ============================================================================

export const listenForForegroundMessages = () => {
  // 1. Native Capacitor Listeners
  if (isNativeMobile()) {
    try {
      // FCM Token registration listener
      PushNotifications.addListener('registration', (token) => {
        if (token.value) {
          syncTokenToBackend(token.value);
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Native Registration Error:', err);
      });

      // App is OPEN & IN FOREGROUND
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Native Push Received in Foreground:', notification);
        const event = new CustomEvent('fcm_foreground_message', {
          detail: {
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: notification.data || {},
          },
        });
        window.dispatchEvent(event);
      });

      // User TAPS on Notification (Background, Lock screen, or Foreground)
      PushNotifications.addListener('pushNotificationActionPerformed', (notificationAction) => {
        console.log('[Push] Notification Action Performed (Tapped):', notificationAction);
        const data = notificationAction.notification?.data || {};
        const route = data.actionRoute || data.route || '/dashboard';
        
        // Dispatch Deep Link Navigation Event
        const navEvent = new CustomEvent('navigate_to_route', {
          detail: { route, data },
        });
        window.dispatchEvent(navEvent);
      });
    } catch (err) {
      console.warn('[Push] Native listeners setup note:', err);
    }
    return;
  }

  // 2. Web Browser FCM Listener
  isSupported().then((supported) => {
    if (supported) {
      try {
        const app = getOrInitApp();
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          console.log('[Push] FCM Web Message received in foreground:', payload);
          const event = new CustomEvent('fcm_foreground_message', { detail: payload });
          window.dispatchEvent(event);
        });
      } catch (err) {
        console.warn('[Push] Web FCM listener note:', err);
      }
    }
  });
};
