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

    const syncDeviceToken = async () => {
      try {
        await createNotificationChannels();
        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (err) {
        console.error('[CAPACITOR PUSH] Token sync check failed:', err);
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

    window.addEventListener('trigger_native_push_notification', handleNativeTrigger);
    syncDeviceToken();

    return () => {
      isMounted = false;
      window.removeEventListener('trigger_native_push_notification', handleNativeTrigger);
    };
  }, [isAuthenticated, token]);
};
