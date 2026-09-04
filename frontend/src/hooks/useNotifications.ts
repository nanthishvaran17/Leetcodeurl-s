import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

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

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const { user, isAuthenticated, token } = useAuth();
  
  // Register FCM Device Token with Backend
  const registerFCMDeviceToken = useCallback(async (fcmToken: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_token: fcmToken,
          platform: 'web',
          app_version: '2.0.0'
        })
      });
    } catch (err) {
      console.warn("[FCM] Token registration notice:", err);
    }
  }, [token]);

  // Fetch Preferences
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
      console.warn("[useNotifications] Preferences fetch notice:", err);
    }
  }, [token]);

  // Update Preferences
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

  // REST API Fallback Sync
  const fetchFromBackendAPI = useCallback(async () => {
    if (!token) return;
    try {
      const catParam = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const res = await fetch(`${API_BASE_URL}/api/notifications${catParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((it: any) => ({
          id: it.id,
          eventId: it.eventId,
          title: it.title,
          message: it.message || it.body,
          body: it.body || it.message,
          type: it.type,
          category: it.category || 'announcements',
          priority: it.priority || 'normal',
          recipientUserId: user?.email || 'user',
          createdAt: it.createdAt,
          isRead: it.isRead,
          actionRoute: it.actionRoute,
          entityType: it.entityType,
          entityId: it.entityId,
          fileId: it.fileId,
          createdBy: it.createdBy
        }));

        setNotifications(items);
        setUnreadCount(data.unreadCount || items.filter((n: Notification) => !n.isRead).length);
        setIsLoading(false);
      }
    } catch (err) {
      console.warn("[useNotifications] REST API sync notice:", err);
    }
  }, [token, selectedCategory, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
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

    // Collect all valid target IDs for this user
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
    
    if (db) {
      try {
        const notificationsRef = collection(db, 'notifications');
        let q;
        if (validTargets.length === 1) {
          q = query(notificationsRef, where('recipientUserId', '==', validTargets[0]));
        } else {
          q = query(notificationsRef, where('recipientUserId', 'in', validTargets));
        }

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const fetched = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            })) as Notification[];

            // Sort manually by creation timestamp descending
            fetched.sort((a, b) => {
              const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt || 0));
              const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt || 0));
              return timeB - timeA;
            });

            const filtered = selectedCategory === 'all' 
              ? fetched 
              : fetched.filter(n => (n.category || n.type || '').toLowerCase() === selectedCategory.toLowerCase());

            setNotifications(filtered);
            setUnreadCount(fetched.filter(n => !n.isRead).length);
            setIsLoading(false);
            setError(null);
          },
          (err) => {
            console.warn("[useNotifications] Firestore listener notice, falling back to REST API:", err);
            fetchFromBackendAPI();
          }
        );

        return () => unsubscribe();
      } catch (e) {
        console.warn("[useNotifications] Firestore setup notice:", e);
        fetchFromBackendAPI();
      }
    } else {
      fetchFromBackendAPI();
    }
  }, [user, isAuthenticated, selectedCategory, fetchFromBackendAPI]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
      // Initialize Firebase Web Push and register token
      import('../services/firebasePush').then(({ requestPushPermissionAndGetToken, onForegroundMessage }) => {
        requestPushPermissionAndGetToken().then((token) => {
          if (token) registerFCMDeviceToken(token);
        });
        
        onForegroundMessage((payload) => {
          // Play a gentle notification sound or show toast for foreground message
          // Firestore sync handles the UI list update, so we don't strictly need to add it to state here.
          console.log('[useNotifications] Foreground message:', payload);
        });
      });
    }
  }, [isAuthenticated, fetchPreferences, registerFCMDeviceToken]);

  const markAsRead = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (db) {
      try {
        const docRef = doc(db, 'notifications', notificationId);
        await updateDoc(docRef, { isRead: true });
      } catch (err) {
        console.warn("Firestore update notice:", err);
      }
    }

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
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    if (db) {
      try {
        const batch = writeBatch(db);
        unreadNotifs.forEach(n => {
          const docRef = doc(db, 'notifications', n.id);
          batch.update(docRef, { isRead: true });
        });
        await batch.commit();
      } catch (err) {
        console.warn("Firestore mark all read notice:", err);
      }
    }

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
  };

  const deleteNotification = async (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const item = notifications.find(n => n.id === notificationId);
      return item && !item.isRead ? Math.max(0, prev - 1) : prev;
    });

    if (db) {
      try {
        const docRef = doc(db, 'notifications', notificationId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore delete notice:", err);
      }
    }

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
  };

  return {
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
  };
};
