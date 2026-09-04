import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, PushNotificationSchema, Token } from '@capacitor/push-notifications';
import axios from 'axios';

export const initPushNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[FCM] Web platform active — native push notification listener skipped.');
    return;
  }

  try {
    // 1. Request POST_NOTIFICATIONS permission (Android 13+)
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

    // Registration Success
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[FCM] Device Token received:', token.value);
      
      // Register Token / Topic with backend
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
        
        // Dispatch custom event for UI toast / banner
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
        const notificationType = data.type || data.notification_type;

        if (actionRoute) {
          console.log(`[FCM] Navigating user to action route: ${actionRoute} (Type: ${notificationType})`);
          if (actionRoute.startsWith('/')) {
            window.location.hash = `#${actionRoute}`;
          } else {
            window.location.href = actionRoute;
          }
        }
      }
    );

    // 3. Register device with FCM
    await PushNotifications.register();

  } catch (error) {
    console.error('[FCM] Failed to initialize Push Notifications:', error);
  }
};
