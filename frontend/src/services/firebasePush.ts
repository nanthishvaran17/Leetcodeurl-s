import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { isFirebaseConfigured } from './firebase';

export const requestPushPermissionAndGetToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[FCM] Notification API not available in window.');
    return null;
  }

  try {
    console.log('[FCM] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[FCM] Notification permission result:', permission);
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied by user.');
      return null;
    }

    if (!isFirebaseConfigured()) {
      console.warn('[FCM] Firebase is not configured. Missing VITE_FIREBASE_API_KEY.');
      return null;
    }

    const messaging = getMessaging(getApp());

    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAsP9hOeAxrIO5hbmlrPhmGa3p1vv-1Jek";
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "leetcode-student-data.firebaseapp.com";
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "leetcode-student-data";
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "leetcode-student-data.firebasestorage.app";
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "384483144435";
    const appId = import.meta.env.VITE_FIREBASE_APP_ID || "1:384483144435:web:bcc3284e79ed3ac5323d86";

    const swUrl = `/firebase-messaging-sw.js?apiKey=${apiKey}&authDomain=${authDomain}&projectId=${projectId}&storageBucket=${storageBucket}&messagingSenderId=${messagingSenderId}&appId=${appId}`;
    
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(swUrl);
      await navigator.serviceWorker.ready;
      console.log('[FCM] Service worker registered successfully.');
    } catch (swErr) {
      console.warn('[FCM] SW registration error, attempting fallback:', swErr);
      const existing = await navigator.serviceWorker.getRegistration();
      if (existing) {
        registration = existing;
      } else {
        throw swErr;
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const getTokenOptions: any = { serviceWorkerRegistration: registration };
    if (vapidKey) {
      getTokenOptions.vapidKey = vapidKey;
    }

    const currentToken = await getToken(messaging, getTokenOptions);

    if (currentToken) {
      console.log('[FCM] Token retrieved successfully:', currentToken.substring(0, 15) + '...');
      return currentToken;
    } else {
      console.log('[FCM] No registration token available.');
      return null;
    }
  } catch (err) {
    console.error('[FCM] An error occurred while retrieving token:', err);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!isFirebaseConfigured()) return () => {};
  
  try {
    const messaging = getMessaging(getApp());
    return onMessage(messaging, (payload) => {
      console.log('[FCM] Received foreground message', payload);
      callback(payload);
    });
  } catch (err) {
    console.error('[FCM] Error setting up foreground message listener', err);
    return () => {};
  }
};
