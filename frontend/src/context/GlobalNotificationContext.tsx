import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

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
  // WITHOUT being listed as a dependency (prevents tearing down Firestore listener on category change)
  const selectedCategoryRef = React.useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;
  
  const { user, isAuthenticated, token } = useAuth();

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
      // Always fetch all — category filtering applied via useMemo
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
  // token and user are stable — selectedCategory intentionally NOT in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.email]);

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

    const roleClean = (user.role || '').trim().toLowerCase();
    const isStaffOrAdmin = ['admin', 'administrator', 'super admin', 'super_admin', 'hod', 'faculty', 'staff', 'professor'].includes(roleClean);
    const isAdmin = ['admin', 'administrator', 'super admin', 'super_admin'].includes(roleClean);

    const targetIds = new Set<string>();
    targetIds.add('ALL');
    if (user.id) targetIds.add(String(user.id));
    if (user.email) {
      targetIds.add(user.email.toLowerCase().trim());
      targetIds.add(user.email.trim());
    }
    if (user.uid) targetIds.add(user.uid);
    if (user.username) {
      targetIds.add(user.username.toLowerCase().trim());
      targetIds.add(user.username.trim());
    }
    if (isStaffOrAdmin) targetIds.add('STAFF');
    if (isAdmin) targetIds.add('ADMIN');
    if (roleClean === 'student') targetIds.add('STUDENT');

    const validTargets = Array.from(targetIds).slice(0, 10);
    
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

