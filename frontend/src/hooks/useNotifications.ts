import { useGlobalNotifications } from '../context/GlobalNotificationContext';

export type { Notification, NotificationPreferences } from '../context/GlobalNotificationContext';

export const useNotifications = useGlobalNotifications;
