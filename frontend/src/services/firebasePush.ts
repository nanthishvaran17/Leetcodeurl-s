import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { isFirebaseConfigured } from './firebase';

export const requestPushPermissionAndGetToken = async (): Promise<string | null> => {
  if (!isFirebaseConfigured()) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied by user.');
      return null;
    }

    const messaging = getMessaging(getApp());
    // We can fetch the token. 
    // Wait: VAPID key is often needed for Web Push, but if not provided, Firebase might still work if config is enough.
    // If a VAPID key is required, it must be added in the getToken call: { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY }
    
    // As per the project structure, we will use the existing config or register the SW with params.
    // Registering the SW with params first so that the SW has the config before we get the token.
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
    const appId = import.meta.env.VITE_FIREBASE_APP_ID;

    const swUrl = `/firebase-messaging-sw.js?apiKey=${apiKey}&authDomain=${authDomain}&projectId=${projectId}&storageBucket=${storageBucket}&messagingSenderId=${messagingSenderId}&appId=${appId}`;
    
    const registration = await navigator.serviceWorker.register(swUrl);
    await navigator.serviceWorker.ready;

    const currentToken = await getToken(messaging, { 
      serviceWorkerRegistration: registration,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // Optional if not strictly required
    });

    if (currentToken) {
      console.log('[FCM] Token retrieved successfully.');
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
