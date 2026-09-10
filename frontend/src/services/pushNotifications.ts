import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getOrInitApp } from './firebase';
import api from './api';

// VAPID Key from Firebase Console (Project Settings > Cloud Messaging > Web configuration)
const VAPID_KEY = 'BIqYk89P9oE0oB3-F7W4o0p4lDkM6D_Oq5H2Qe_G_8kYtB1n2L_I3G1c9n7fU9O_M8_T9L2H1G9kYtB1n2L_I3G'; // Needs real key in prod if required, but firebase config might be enough or we can use environment var.
// We should use process.env or import.meta.env, for now defaulting to empty string if not provided in env.
const vapidKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) || undefined;

export const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

export const isStandalonePWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

export const canUsePushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  
  if (isIOS() && !isStandalonePWA()) {
    console.warn('[Push] iOS devices require the app to be installed as a PWA (Add to Home Screen) for Push Notifications.');
    return false;
  }

  try {
    const supported = await isSupported();
    return supported;
  } catch (e) {
    return false;
  }
};

export const requestPushPermissionAndSync = async (userEmailOrId: string) => {
  const canUse = await canUsePushNotifications();
  if (!canUse) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const app = getOrInitApp();
      const messaging = getMessaging(app);
      
      const currentToken = await getToken(messaging, { 
        vapidKey: vapidKey 
      });

      if (currentToken) {
        console.log('[Push] FCM Token acquired, syncing to backend...');
        
        // Determine platform string safely
        let platform = 'web';
        if (isIOS()) platform = 'ios-pwa';
        else if (/android/i.test(navigator.userAgent)) platform = 'android-web';
        
        await api.post('/notifications/register-device', {
          user_id: userEmailOrId,
          device_token: currentToken,
          platform: platform,
          app_version: '2.2.0', // can be dynamic
          device_model: navigator.userAgent
        });
        
        return true;
      } else {
        console.log('[Push] No registration token available.');
        return false;
      }
    } else {
      console.log('[Push] Permission not granted.');
      return false;
    }
  } catch (err) {
    console.error('[Push] An error occurred while retrieving token:', err);
    return false;
  }
};

export const listenForForegroundMessages = () => {
  canUsePushNotifications().then(supported => {
    if (supported) {
      const app = getOrInitApp();
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('[Push] Message received in foreground:', payload);
        // Dispatch custom event so React components (like a toast manager) can catch it
        const event = new CustomEvent('fcm_foreground_message', { detail: payload });
        window.dispatchEvent(event);
      });
    }
  });
};
