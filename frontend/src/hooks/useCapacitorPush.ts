import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export const useCapacitorPush = () => {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !token || !Capacitor.isNativePlatform()) return;

    let isMounted = true;

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('[CAPACITOR PUSH] User denied push permissions');
          return;
        }

        if (!isMounted) return;
        await PushNotifications.register();
      } catch (err) {
        console.error('[CAPACITOR PUSH] Error requesting push permissions:', err);
      }
    };

    // Register listeners only once
    const addListeners = async () => {
      await PushNotifications.addListener('registration', async (capacitorToken) => {
        console.log('[CAPACITOR PUSH] Push registration success, token:', capacitorToken.value);
        try {
          await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              device_token: capacitorToken.value,
              platform: Capacitor.getPlatform(),
              app_version: '2.0.0'
            })
          });
        } catch (e) {
          console.warn('[CAPACITOR PUSH] Backend registration failed:', e);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[CAPACITOR PUSH] Error on registration:', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[CAPACITOR PUSH] Push received in foreground: ', notification);
        window.dispatchEvent(new CustomEvent('fcm_notification_received', { detail: notification }));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[CAPACITOR PUSH] Push action performed: ', notification);
        const data = notification.notification.data;
        if (data && data.actionRoute) {
          // Route the user to the deeply linked page
          let route = data.actionRoute;
          if (!route.startsWith('/')) route = '/' + route;
          window.location.href = route; // Simplest deep link fallback for React router if history not available in hook
        }
      });
    };

    addListeners();
    registerPush();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [isAuthenticated, token]);
};
