import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useGlobalWebSocket } from './GlobalWebSocketProvider';
import { useNotification as useToastNotification } from './NotificationContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export interface Notification {
  id: string;
  eventId?: string;
  title: string;
  message: string;
  body?: string;
  type: string;
  category?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  recipientUserId: string;
  createdAt: any;
  isRead: boolean;
  actionRoute?: string;
  entityType?: string;
  entityId?: string;
  fileId?: string;
  createdBy?: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  categories: Record<string, boolean>;
}

interface GlobalNotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: NotificationPreferences) => Promise<boolean>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  registerFCMDeviceToken: (token: string, platform?: string) => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

export const GlobalNotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  // Keep selectedCategory in a ref so snapshot callbacks can read latest value
  // WITHOUT being listed as a dependency
  const selectedCategoryRef = React.useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;
  
  const { user, isAuthenticated, token } = useAuth();
  const { registerCallback, unregisterCallback } = useGlobalWebSocket();
  const { notify } = useToastNotification();
  const seenNotificationIdsRef = React.useRef(new Set<string>());

  // Request browser desktop notification permission if supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const registerFCMDeviceToken = useCallback(async (fcmToken: string, platform: string = 'web'): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_token: fcmToken,
          platform: platform,
          app_version: '2.0.0'
        })
      });
      if (res.ok) {
        console.log('[FCM] Device token registered successfully on backend database');
        return true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('[FCM] Device token registration HTTP error:', res.status, errJson);
        return false;
      }
    } catch (err) {
      console.warn("[FCM] Token registration notice:", err);
      return false;
    }
  }, [token]);

  const fetchPreferences = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (err) {
      console.warn("[GlobalNotificationContext] Preferences fetch notice:", err);
    }
  }, [token]);

  const updatePreferences = async (newPrefs: NotificationPreferences) => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPrefs)
      });
      if (res.ok) {
        setPreferences(newPrefs);
        return true;
      }
    } catch (err) {
      console.error("Error updating notification preferences:", err);
    }
    return false;
  };

  const fetchFromBackendAPI = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((it: any) => ({
          ...it,
          message: it.message || it.body,
          body: it.body || it.message,
          category: it.category || 'announcements',
          priority: it.priority || 'normal',
          recipientUserId: user?.email || 'user'
        }));

        setAllNotifications(items);
        setUnreadCount(data.unreadCount || items.filter((n: Notification) => !n.isRead).length);
        setIsLoading(false);
      }
    } catch (err) {
      console.warn("[GlobalNotificationContext] REST API sync notice:", err);
    }
  }, [token, user?.email]);

  const handleIncomingNotification = useCallback((payload: any) => {
    if (!payload) return;

    const eventType = payload.type || payload.eventType;
    if (eventType !== 'NEW_NOTIFICATION' && eventType !== 'notification') {
      return;
    }

    const notif = payload.notification || payload;
    const notifId = notif.id || notif.notification_id || notif.eventId || notif.event_id;
    if (!notifId) return;

    if (seenNotificationIdsRef.current.has(String(notifId))) {
      return;
    }
    seenNotificationIdsRef.current.add(String(notifId));

    const title = notif.title || 'New Notification';
    const message = notif.message || notif.body || '';
    const category = notif.category || notif.event_type || 'announcements';
    const priority = notif.priority || 'normal';
    const actionRoute = notif.action_url || notif.action_route || notif.actionRoute || '/dashboard';

    const newNotificationItem: Notification = {
      id: String(notifId),
      eventId: notif.event_id || notif.eventId || String(notifId),
      title,
      message,
      body: message,
      type: category,
      category,
      priority,
      recipientUserId: notif.recipient_user_id || notif.recipient_id || user?.email || '',
      createdAt: notif.created_at || notif.createdAt || new Date().toISOString(),
      isRead: false,
      actionRoute,
      entityType: notif.entity_type || notif.entityType,
      entityId: notif.entity_id || notif.entityId,
      fileId: notif.file_id || notif.fileId,
      createdBy: notif.sender_name || notif.sender_id || 'System'
    };

    setAllNotifications(prev => [newNotificationItem, ...prev.filter(n => n.id !== String(notifId))]);
    setUnreadCount(prev => prev + 1);

    // Immediate Foreground Popup / Toast
    if (!document.hidden) {
      notify.info(title, message, {
        category: category.toUpperCase(),
        duration: priority === 'high' || priority === 'critical' ? 7000 : 5000,
        actionLabel: 'Open',
        onAction: () => {
          if (actionRoute) {
            window.location.href = actionRoute;
          }
        }
      });
    } else {
      // Browser background tab notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const bNotif = new window.Notification(title, {
            body: message,
            icon: '/logo.png',
            tag: String(notifId)
          });
          bNotif.onclick = () => {
            window.focus();
            if (actionRoute) window.location.href = actionRoute;
          };
        } catch (e) {
          console.warn('[Browser Notification] Error showing notification:', e);
        }
      }
    }
  }, [user?.email, notify]);

  // Register WebSocket listener
  useEffect(() => {
    if (!isAuthenticated) return;
    
    registerCallback('global_notification_context', (data: any) => {
      handleIncomingNotification(data);
    });

    return () => {
      unregisterCallback('global_notification_context');
    };
  }, [isAuthenticated, registerCallback, unregisterCallback, handleIncomingNotification]);

  // Listen to mobile FCM foreground custom event
  useEffect(() => {
    const handleFcmReceived = (event: any) => {
      const detail = event.detail;
      if (!detail) return;
      const notifData = detail.notification || detail;
      const notifId = notifData.data?.notificationId || notifData.id || `fcm_${Date.now()}`;

      if (seenNotificationIdsRef.current.has(String(notifId))) return;
      seenNotificationIdsRef.current.add(String(notifId));

      const title = notifData.title || notifData.data?.title || 'New Notification';
      const message = notifData.body || notifData.data?.message || '';
      const actionRoute = notifData.data?.actionRoute || '/dashboard';

      setUnreadCount(prev => prev + 1);
      notify.info(title, message, {
        category: 'MOBILE PUSH',
        duration: 5000,
        actionLabel: 'Open',
        onAction: () => {
          if (actionRoute) window.location.href = actionRoute;
        }
      });
      fetchFromBackendAPI();
    };

    window.addEventListener('fcm_notification_received', handleFcmReceived);
    return () => {
      window.removeEventListener('fcm_notification_received', handleFcmReceived);
    };
  }, [notify, fetchFromBackendAPI]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setAllNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchFromBackendAPI();
  }, [user, isAuthenticated, fetchFromBackendAPI]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated, fetchPreferences]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setAllNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API mark read notice:", err);
      }
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    const unreadNotifs = allNotifications.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;

    setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API mark all read notice:", err);
      }
    }
  }, [allNotifications, token]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const item = allNotifications.find(n => n.id === notificationId);
      return item && !item.isRead ? Math.max(0, prev - 1) : prev;
    });

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API delete notice:", err);
      }
    }
  }, [allNotifications, token]);

  // Apply category filter in a pure memo — no subscription restart needed
  const notifications = React.useMemo(() =>
    selectedCategory === 'all'
      ? allNotifications
      : allNotifications.filter(n => (n.category || n.type || '').toLowerCase() === selectedCategory.toLowerCase()),
    [allNotifications, selectedCategory]
  );

  // Memoize the context value so stable-reference consumers don't re-render
  const ctxValue = React.useMemo(() => ({
    notifications,
    unreadCount,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    preferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    registerFCMDeviceToken,
    refreshNotifications: fetchFromBackendAPI
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [notifications, unreadCount, isLoading, error, selectedCategory, preferences, markAsRead, markAllAsRead, deleteNotification, registerFCMDeviceToken, fetchFromBackendAPI]);

  return (
    <GlobalNotificationContext.Provider value={ctxValue}>
      {children}
    </GlobalNotificationContext.Provider>
  );
};

export const useGlobalNotifications = () => {
  const context = useContext(GlobalNotificationContext);
  if (!context) {
    throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider');
  }
  return context;
};

export const useNotification = useGlobalNotifications;

