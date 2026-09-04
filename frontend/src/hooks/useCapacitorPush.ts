import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { createNotificationChannels, triggerNativeStatusBarNotification } from '../services/pushNotifications';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export const useCapacitorPush = () => {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !token || !Capacitor.isNativePlatform()) return;

    let isMounted = true;

    const registerPush = async () => {
      try {
        await createNotificationChannels();

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

    // Handler for global custom native notification triggers
    const handleNativeTrigger = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const detail = customEvt.detail || {};
      if (detail.title) {
        triggerNativeStatusBarNotification(detail.title, detail.body || '', detail.extraData || detail);
      }
    };

    // Register listeners only once
    const addListeners = async () => {
      window.addEventListener('trigger_native_push_notification', handleNativeTrigger);

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
        triggerNativeStatusBarNotification(
          notification.title || 'LeetCode Tracker',
          notification.body || '',
          notification.data
        );
        window.dispatchEvent(new CustomEvent('fcm_notification_received', { detail: notification }));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[CAPACITOR PUSH] Push action performed: ', notification);
        const data = notification.notification.data;
        if (data && data.actionRoute) {
          let route = data.actionRoute;
          if (!route.startsWith('/')) route = '/' + route;
          window.location.href = route;
        }
      });
    };

    addListeners();
    registerPush();

    return () => {
      isMounted = false;
      window.removeEventListener('trigger_native_push_notification', handleNativeTrigger);
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [isAuthenticated, token]);
};
