import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useGlobalWebSocket } from './GlobalWebSocketProvider';
import { useNotification as useToastNotification } from './NotificationContext';

import { API_BASE_URL, getApiUrl } from '../config/apiConfig';
import { playNotificationChime } from '../utils/audioChime';
import { triggerConfetti } from '../utils/confettiCelebration';
const notifySystem = (opts: any) => {
  import('../services/systemNotification')
    .then(({ triggerSystemNotification }) => triggerSystemNotification(opts))
    .catch(() => {});
};
import { Capacitor } from '@capacitor/core';

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
  isArchived?: boolean;
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

export const normalizeCategory = (catOrType?: string): string => {
  if (!catOrType) return 'announcements';
  const c = catOrType.toLowerCase().trim();
  if (c === 'assignments' || c === 'assignment' || c.includes('assignment')) return 'assignments';
  if (c === 'attendance' || c.includes('attendance')) return 'attendance';
  if (c === 'exams' || c === 'exam' || c === 'marks' || c === 'mark' || c.includes('exam') || c.includes('mark') || c.includes('result') || c.includes('cat1') || c.includes('cat2')) return 'exams';
  if (c === 'reports' || c === 'report' || c === 'files' || c === 'file' || c.includes('report') || c.includes('file') || c.includes('document')) return 'reports';
  if (c === 'contests' || c === 'contest' || c === 'achievements' || c === 'achievement' || c.includes('contest') || c.includes('rank') || c.includes('achieve') || c.includes('milestone') || c.includes('surge') || c.includes('solved') || c.includes('delta')) return 'contests';
  return 'announcements';
};

interface GlobalNotificationContextType {
  notifications: Notification[];
  allNotifications: Notification[];
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
  archiveNotification: (id: string) => Promise<void>;
  unarchiveNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
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
  const seenIdentifiersRef = React.useRef(new Map<string, number>());
  const lastChimeTimeRef = React.useRef<number>(0);
  const lastFetchTimeRef = React.useRef<number>(0);

  // Unified deduplication helper across WebSocket and FCM
  const isDuplicateAndRecord = useCallback((ids: (string | number | undefined | null)[], title?: string, body?: string): boolean => {
    const now = Date.now();
    // Evict entries older than 60s
    for (const [k, ts] of seenIdentifiersRef.current.entries()) {
      if (now - ts > 60000) {
        seenIdentifiersRef.current.delete(k);
      }
    }

    const cleanIds = ids.filter(Boolean).map(x => String(x).trim().toLowerCase());
    const contentKey = (title || body)
      ? `${(title || '').trim().toLowerCase()}::${(body || '').trim().toLowerCase().slice(0, 50)}`
      : null;

    // Check if any ID has been seen recently
    for (const id of cleanIds) {
      if (id && seenIdentifiersRef.current.has(id)) {
        return true;
      }
    }

    // Check if identical content signature has been seen recently
    if (contentKey && seenIdentifiersRef.current.has(contentKey)) {
      return true;
    }

    // Mark all cleanIds and contentKey as seen
    for (const id of cleanIds) {
      if (id) seenIdentifiersRef.current.set(id, now);
    }
    if (contentKey) {
      seenIdentifiersRef.current.set(contentKey, now);
    }

    return false;
  }, []);

  // Live OS / Mobile App Icon Badge & Dynamic Tab Title (like WhatsApp, Twitter, Instagram)
  useEffect(() => {
    // 1. Mobile Home Screen App Icon Badge (PWA & Android)
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as any).setAppBadge(unreadCount).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }

    // 2. Dynamic Browser Tab Title with Live Unread Counter
    if (typeof document !== 'undefined') {
      const baseTitle = 'Nandha LeetCode Tracker';
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    }
  }, [unreadCount]);

  // Request browser desktop notification permission on explicit user action
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (_e) {}
    }
  }, []);

  const registerFCMDeviceToken = useCallback(async (fcmToken: string, platform?: string): Promise<boolean> => {
    if (!token) return false;
    const resolvedPlatform = platform || (Capacitor.isNativePlatform() ? (Capacitor.getPlatform() || 'android') : 'web');
    try {
      const res = await fetch(getApiUrl('/notifications/register-device'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_token: fcmToken,
          platform: resolvedPlatform,
          app_version: '2.2.0'
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
      const res = await fetch(getApiUrl('/notifications/preferences'), {
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
      const res = await fetch(getApiUrl('/notifications/preferences'), {
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
      } else {
        const text = await res.text();
        console.error("updatePreferences failed:", res.status, text);
      }
    } catch (err) {
      console.error("Error updating notification preferences:", err);
    }
    return false;
  };

  // Local read cache to prevent unread state flickers on polling/re-open
  const readIdsRef = React.useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    try {
      const stored = localStorage.getItem('read_notification_ids');
      if (stored) {
        const arr = JSON.parse(stored);
        arr.forEach((id: string) => readIdsRef.current.add(String(id)));
      }
    } catch (_e) {}
  }, []);

  const saveLocalReadId = (idStr: string) => {
    if (!idStr) return;
    readIdsRef.current.add(idStr);
    try {
      const arr = Array.from(readIdsRef.current).slice(-200); // keep recent 200
      localStorage.setItem('read_notification_ids', JSON.stringify(arr));
    } catch (_e) {}
  };

  const fetchFromBackendAPI = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/notifications'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((it: any) => {
          const idStr = String(it.id || '');
          const eventIdStr = String(it.eventId || '');
          const isLocallyRead = readIdsRef.current.has(idStr) || (eventIdStr && readIdsRef.current.has(eventIdStr));
          const finalIsRead = isLocallyRead ? true : Boolean(it.isRead);

          return {
            ...it,
            isRead: finalIsRead,
            message: it.message || it.body,
            body: it.body || it.message,
            category: normalizeCategory(it.category || it.type || it.event_type),
            priority: it.priority || 'normal',
            recipientUserId: user?.email || 'user'
          };
        });

        setAllNotifications(items);
        const actualUnread = items.filter((n: Notification) => !n.isRead).length;
        setUnreadCount(actualUnread);
      } else {
        console.warn("[GlobalNotificationContext] Non-ok status from backend:", res.status);
      }
    } catch (err) {
      console.warn("[GlobalNotificationContext] REST API sync notice:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.email]);

  const handleIncomingNotification = useCallback((payload: any) => {
    if (!payload) return;
    console.log('[NOTIF-DEBUG] RAW_EVENT_RECEIVED:', payload);

    const eventType = payload.type || payload.eventType;

    // 1. REAL-TIME CHAT & DIRECT MESSAGES (WhatsApp-like Instant Notification)
    if (eventType === 'NEW_MESSAGE') {
      const msg = payload.message || payload;
      if (!msg) return;

      const currentUserId = user ? String(user.email || user.username || (user as any).reg_no || (user.id ? `STAFF_${user.id}` : '')).toLowerCase() : '';
      const senderId = String(msg.senderId || msg.sender_id || '').toLowerCase();
      if (currentUserId && (senderId === currentUserId || (user?.id && (senderId === String(user.id) || senderId === `staff_${user.id}`.toLowerCase())))) {
        return; // Skip notifying own sent messages
      }

      const msgId = String(msg.messageId || msg.id || `msg_${Date.now()}`);
      if (isDuplicateAndRecord([msgId], `Message from ${msg.senderName || msg.sender_name}`, msg.content)) return;

      const senderRealName = msg.senderName || msg.sender_name || 'Faculty / Staff';
      const senderRole = msg.senderRole ? ` · ${msg.senderRole}` : '';
      const msgContent = msg.content || 'Sent a new attachment/message';
      const convId = msg.conversationId || msg.conversation_id || '';
      const actionRoute = convId ? `/messages?conversationId=${convId}` : '/messages';
      const title = `Message from ${senderRealName}${senderRole}`;

      // In-App Toast with WhatsApp-style Sender Card & Quick Reply
      notify.info(title, msgContent, {
        category: 'MESSAGES',
        duration: 7000,
        actionLabel: 'Reply',
        onAction: () => {
          if (convId) {
            sessionStorage.setItem('target_conversation_id', convId);
          }
          window.dispatchEvent(new CustomEvent('navigate_to_route', { detail: { route: actionRoute } }));
        }
      });

      // Official Mobile System Heads-Up Notification (Status Bar / Lock Screen with Sound & Vibration)
      notifySystem({
        title,
        body: msgContent,
        actionRoute,
        category: 'messages',
        notifId: msgId,
        playSound: true
      });
      return;
    }

    if (eventType !== 'NEW_NOTIFICATION' && eventType !== 'notification') {
      return;
    }

    const notif = payload.notification || payload;
    const notifId = notif.id || notif.notification_id || notif.eventId || notif.event_id;
    if (!notifId) return;

    const title = notif.title || 'New Notification';
    const message = notif.message || notif.body || '';

    // Unified deduplication across WebSocket and FCM
    const candidateIds = [
      notif.id,
      notif.notification_id,
      notif.eventId,
      notif.event_id,
      notif.data?.notificationId,
      notif.data?.eventId,
      notif.data?.event_id
    ];

    if (isDuplicateAndRecord(candidateIds, title, message)) {
      console.log(`[NOTIF-DEBUG] DEDUPLICATION_SUPPRESSED title="${title}"`);
      return;
    }

    const rawCat = notif.category || notif.event_type || notif.type || 'announcements';
    const category = normalizeCategory(rawCat);
    const priority = notif.priority || 'normal';
    const actionRoute = notif.action_url || notif.action_route || notif.actionRoute || '/dashboard';

    console.log(`[NOTIF-DEBUG] PROVIDER_HANDLED notifId=${notifId} title="${title}" category="${category}"`);

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
    setUnreadCount(prev => {
      console.log(`[NOTIF-DEBUG] UNREAD_INCREMENT old=${prev} new=${prev + 1}`);
      return prev + 1;
    });

    // Rate-limited Crisp Audio Chime & Confetti Celebration (at least 3.5s cooldown)
    const now = Date.now();
    const shouldPlayChime = now - lastChimeTimeRef.current > 3500;
    if (shouldPlayChime) {
      lastChimeTimeRef.current = now;
      try {
        const isCelebratory = category === 'contests' || 
          rawCat.toLowerCase().includes('milestone') || 
          rawCat.toLowerCase().includes('achievement') || 
          rawCat.toLowerCase().includes('finalized') ||
          title.toLowerCase().includes('congrat') || 
          title.toLowerCase().includes('live') ||
          title.toLowerCase().includes('solved');

        if (isCelebratory) {
          triggerConfetti({ playSound: true });
        } else {
          playNotificationChime();
        }
      } catch {
        // Audio/confetti safety
      }
    }

    // Immediate Foreground Popup / Toast
    console.log(`[NOTIF-DEBUG] TOAST_TRIGGERED title="${title}" document_hidden=${document.hidden}`);
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

    // Dispatch official system status-bar notification (handled cleanly without duplicate sounds)
    notifySystem({
      title,
      body: message,
      actionRoute,
      category,
      notifId,
      playSound: false // already chimed above
    });
  }, [user?.email, user?.username, (user as any)?.reg_no, user?.id, notify, isDuplicateAndRecord]);

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

  // Listen to mobile FCM foreground & background events
  useEffect(() => {
    const handleFcmReceived = (event: any) => {
      const detail = event.detail;
      if (!detail) return;
      const notifData = detail.notification || detail;
      const data = detail.data || notifData.data || {};

      const title = notifData.title || data.title || 'New Notification';
      const message = notifData.body || data.body || data.message || '';
      const actionRoute = data.actionRoute || data.route || '/dashboard';
      const rawCat = data.category || notifData.category || data.type || 'announcements';
      const category = normalizeCategory(rawCat);

      const candidateIds = [
        data.notificationId,
        data.notification_id,
        data.eventId,
        data.event_id,
        notifData.id,
        notifData.notification_id
      ];

      // Strict Deduplication: skip if already handled via WebSocket or previous FCM dispatch
      if (isDuplicateAndRecord(candidateIds, title, message)) {
        console.log(`[NOTIF-DEBUG] FCM_DEDUPLICATION_SUPPRESSED title="${title}"`);
        return;
      }

      setUnreadCount(prev => prev + 1);

      // In-App Toast
      notify.info(title, message, {
        category: category.toUpperCase(),
        duration: 5000,
        actionLabel: 'Open',
        onAction: () => {
          if (actionRoute) window.location.href = actionRoute;
        }
      });

      const now = Date.now();
      const shouldPlaySound = now - lastChimeTimeRef.current > 3500;
      if (shouldPlaySound) {
        lastChimeTimeRef.current = now;
      }

      // Delegate to system notification
      const notifId = data.notificationId || data.eventId || notifData.id || `fcm_${now}`;
      notifySystem({
        title,
        body: message,
        actionRoute,
        category,
        notifId,
        playSound: shouldPlaySound
      });

      // Rate-limit background REST API synchronization to once per 6 seconds
      if (now - lastFetchTimeRef.current > 6000) {
        lastFetchTimeRef.current = now;
        fetchFromBackendAPI();
      }
    };

    const handlePortalNotification = (event: any) => {
      const detail = event.detail;
      if (!detail) return;
      handleIncomingNotification({
        type: 'NEW_NOTIFICATION',
        notification: {
          id: `local_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: detail.title,
          message: detail.message,
          category: detail.category || 'announcements',
          priority: detail.priority || 'high',
          actionRoute: detail.actionRoute || '/dashboard',
          created_at: new Date().toISOString()
        }
      });
    };

    window.addEventListener('fcm_notification_received', handleFcmReceived);
    window.addEventListener('fcm_foreground_message', handleFcmReceived);
    window.addEventListener('dispatch_portal_notification', handlePortalNotification);
    return () => {
      window.removeEventListener('fcm_notification_received', handleFcmReceived);
      window.removeEventListener('fcm_foreground_message', handleFcmReceived);
      window.removeEventListener('dispatch_portal_notification', handlePortalNotification);
    };
  }, [notify, fetchFromBackendAPI, handleIncomingNotification]);

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
    saveLocalReadId(notificationId);

    setAllNotifications(prev => prev.map(n => {
      if (n.id === notificationId || n.eventId === notificationId) {
        if (n.id) saveLocalReadId(n.id);
        if (n.eventId) saveLocalReadId(n.eventId);
        return { ...n, isRead: true };
      }
      return n;
    }));

    setUnreadCount(prev => Math.max(0, prev - 1));

    if (token) {
      try {
        await fetch(getApiUrl(`/notifications/${notificationId}/read`), {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API mark read notice:", err);
      }
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    allNotifications.forEach(n => {
      if (n.id) saveLocalReadId(n.id);
      if (n.eventId) saveLocalReadId(n.eventId);
    });

    setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    if (token) {
      try {
        await fetch(getApiUrl('/notifications/mark-all-read'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API mark all read notice:", err);
      }
    }
  }, [allNotifications, token]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    setAllNotifications(prev => prev.filter(n => n.id !== notificationId && n.eventId !== notificationId));
    setUnreadCount(prev => {
      const item = allNotifications.find(n => n.id === notificationId || n.eventId === notificationId);
      return item && !item.isRead ? Math.max(0, prev - 1) : prev;
    });

    if (token) {
      try {
        await fetch(getApiUrl(`/notifications/${notificationId}`), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API delete notice:", err);
      }
    }
  }, [allNotifications, token]);

  const archiveNotification = useCallback(async (notificationId: string) => {
    setAllNotifications(prev => prev.map(n => {
      if (n.id === notificationId || n.eventId === notificationId) {
        return { ...n, isArchived: true, isRead: true };
      }
      return n;
    }));

    // If it was unread, decrement the unread count since archiving implicitly marks it as read/handled
    setUnreadCount(prev => {
      const item = allNotifications.find(n => n.id === notificationId || n.eventId === notificationId);
      return item && !item.isRead ? Math.max(0, prev - 1) : prev;
    });

    if (token) {
      try {
        await fetch(getApiUrl(`/notifications/${notificationId}/archive`), {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API archive notice:", err);
      }
    }
  }, [allNotifications, token]);

  const unarchiveNotification = useCallback(async (notificationId: string) => {
    setAllNotifications(prev => prev.map(n => {
      if (n.id === notificationId || n.eventId === notificationId) {
        return { ...n, isArchived: false };
      }
      return n;
    }));

    if (token) {
      try {
        await fetch(getApiUrl(`/notifications/${notificationId}/unarchive`), {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("REST API unarchive notice:", err);
      }
    }
  }, [token]);

  const clearAllNotifications = useCallback(async () => {
    // Preserve archived notifications, clear all active ones
    setAllNotifications(prev => prev.filter(n => n.isArchived));
    setUnreadCount(0);

    if (token) {
      try {
        const res = await fetch(getApiUrl('/notifications/clear-all'), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Server returned error while clearing notifications');
        }
      } catch (err) {
        console.warn("REST API clear all notice:", err);
        throw err;
      }
    }
  }, [token]);

  const notifications = React.useMemo(() => {
    if (selectedCategory === 'archived') {
      return allNotifications.filter(n => n.isArchived);
    }
    const unarchived = allNotifications.filter(n => !n.isArchived);
    if (selectedCategory === 'all') {
      return unarchived;
    }
    return unarchived.filter(n => normalizeCategory(n.category || n.type) === selectedCategory.toLowerCase());
  }, [allNotifications, selectedCategory]);

  // Memoize the context value so stable-reference consumers don't re-render
  const ctxValue = React.useMemo(() => ({
    notifications,
    allNotifications,
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
    archiveNotification,
    unarchiveNotification,
    clearAllNotifications,
    registerFCMDeviceToken,
    refreshNotifications: fetchFromBackendAPI
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [notifications, allNotifications, unreadCount, isLoading, error, selectedCategory, preferences, markAsRead, markAllAsRead, deleteNotification, archiveNotification, unarchiveNotification, registerFCMDeviceToken, fetchFromBackendAPI]);

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

export const dispatchPortalNotification = (payload: {
  title: string;
  message: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  actionRoute?: string;
}) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dispatch_portal_notification', { detail: payload }));
  }
};


