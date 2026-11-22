import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveNotificationDestination } from '../utils/notificationNavigation';
import { Bell, Check, Archive, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Calendar, FileText, Download, Eye, X, Settings, ChevronRight, ArrowLeft, Send, Smartphone, Loader2, RefreshCw, TrendingUp, Users, Award, Activity, Volume2, Play, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useGlobalNotifications, normalizeCategory, type Notification } from '../context/GlobalNotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestPushPermissionAndGetToken } from '../services/firebasePush';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { downloadManager } from '../services/download/downloadManager';
import { useNotification } from '../context/NotificationContext';
import { playWhatsAppPop, playAppleGlassChime, playTechKnockDing } from '../utils/audioChime';

import { API_BASE_URL } from '../config/apiConfig';

const timeAgo = (rawDate: any) => {
  if (!rawDate) return "Just now";
  let date: Date;
  if (typeof rawDate.toDate === 'function') {
    date = rawDate.toDate();
  } else if (rawDate instanceof Date) {
    date = rawDate;
  } else if (typeof rawDate === 'number') {
    date = new Date(rawDate);
  } else if (typeof rawDate === 'string') {
    date = new Date(rawDate);
  } else {
    return "Just now";
  }

  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 10) return "Just now";
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'archived', label: 'Archived' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'exams', label: 'Exams' },
  { id: 'reports', label: 'Reports' },
  { id: 'contests', label: 'Contests' },
  { id: 'announcements', label: 'Announcements' },
];

const cleanNotificationText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/(Weekly Contest)\s+(Weekly Contest)/gi, '$1')
    .replace(/(Contest)\s+(Contest)/gi, '$1')
    .replace(/\b(Weekly Contest)\s+\1\b/gi, '$1')
    .replace(/\b(Contest)\s+\1\b/gi, '$1')
    .trim();
};

const NotificationItem = ({ n, handleNotificationClick, confirmDeleteNotification, confirmArchiveNotification, markAsRead, setActiveFileModal, getIcon }: any) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const THRESHOLD = 90;

  const handleDrag = (_e: any, info: any) => {
    setSwipeX(info.offset.x);
  };

  const handleDragEnd = (_e: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -THRESHOLD || velocity < -500) {
      // Swiped LEFT -> Delete
      setSwipeX(-100);
      setTimeout(() => confirmDeleteNotification(n, () => setSwipeX(0)), 200);
    } else if (offset > THRESHOLD || velocity > 500) {
      // Swiped RIGHT -> Archive (hide)
      setSwipeX(100);
      setTimeout(() => confirmArchiveNotification(n, () => setSwipeX(0)), 200);
    } else {
      setSwipeX(0);
    }
  };

  const cleanTitle = cleanNotificationText(n.title || '');
  const cleanBody = cleanNotificationText(n.message || n.body || '');
  const isMultiLine = cleanBody.includes('\n') || cleanBody.length > 90;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0a0f1d] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-shadow">
      {/* RIGHT bg: Delete (revealed ONLY on left-swipe) */}
      <div
        className={`absolute inset-y-0 right-0 w-1/2 flex items-center justify-end bg-rose-600 px-5 rounded-r-2xl transition-opacity duration-150 ${swipeX < 0 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={18} />
          <span className="text-[10px] font-black tracking-wide">Delete</span>
        </div>
      </div>

      {/* LEFT bg: Archive (revealed ONLY on right-swipe) */}
      <div
        className={`absolute inset-y-0 left-0 w-1/2 flex items-center justify-start bg-blue-600 px-5 rounded-l-2xl transition-opacity duration-150 ${swipeX > 0 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Archive size={18} />
          <span className="text-[10px] font-black tracking-wide">Archive</span>
        </div>
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.06}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{ x: swipeX }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className={`relative z-10 flex items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 cursor-pointer select-none rounded-2xl transition-colors
          ${!n.isRead
            ? 'bg-indigo-50/50 dark:bg-[#0f172a] border-l-3 border-l-brand-500 shadow-xs'
            : 'bg-white dark:bg-[#0a0f1d]'
          }`}
        onClick={() => {
          if (Math.abs(swipeX) > 5) { setSwipeX(0); return; }
          handleNotificationClick(n);
        }}
      >
        {/* Compact Squircle Category Icon */}
        <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/50 dark:border-white/[0.06] transition-shadow ${n.isRead ? 'opacity-70' : ''}`}>
          {getIcon(n.type, n.priority)}
        </div>

        <div className={`flex-1 min-w-0 ${n.isRead ? 'opacity-80' : ''}`}>
          {/* Header Row: Title, Dot, Timestamp, Delete */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 shadow-xs" title="Unread" />
              )}
              <h4 className={`text-xs sm:text-[13px] leading-snug truncate ${!n.isRead ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-600 dark:text-slate-300 font-bold'}`}>
                {cleanTitle}
              </h4>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                {timeAgo(n.createdAt)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDeleteNotification(n);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Delete notification"
                aria-label="Delete notification"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Badges for Surge, Milestone, Results, Attendance */}
          {((n.type === 'STUDENT_DAILY_SURGE_MILESTONE' || (n.title && (n.title.includes('100 Solved') || n.title.includes('Single Day')))) ||
            (n.type === 'STUDENT_FETCH_SURGE_DELTA' || (n.title && (n.title.includes('Surge Alert') || n.title.includes('Growth')))) ||
            (n.type === 'CONTEST_RESULTS_SYNCED' || (n.title && n.title.includes('Results Published'))) ||
            (n.type === 'SUNDAY_CONTEST_ATTENDANCE_REPORT' || n.type === 'SUNDAY_CONTEST_FACULTY_SUMMARY' || (n.title && n.title.includes('Attendance Report')))) && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {(n.type === 'STUDENT_DAILY_SURGE_MILESTONE' || (n.title && (n.title.includes('100 Solved') || n.title.includes('Single Day')))) && (
                  <span className="inline-flex items-center text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    100 Solved Today
                  </span>
                )}
                {(n.type === 'STUDENT_FETCH_SURGE_DELTA' || (n.title && (n.title.includes('Surge Alert') || n.title.includes('Growth')))) && (
                  <span className="inline-flex items-center text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                    Verified Growth
                  </span>
                )}
                {(n.type === 'CONTEST_RESULTS_SYNCED' || (n.title && n.title.includes('Results Published'))) && (
                  <span className="inline-flex items-center text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Web & App Synced
                  </span>
                )}
                {(n.type === 'SUNDAY_CONTEST_ATTENDANCE_REPORT' || n.type === 'SUNDAY_CONTEST_FACULTY_SUMMARY' || (n.title && n.title.includes('Attendance Report'))) && (
                  <span className="inline-flex items-center text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                    Attendance Roster
                  </span>
                )}
              </div>
            )}

          {/* Compact Overview Message Preview (2-line clamp when collapsed) */}
          <p className={`text-xs leading-relaxed mt-1 ${isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'
            } ${!n.isRead ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
            {cleanBody}
          </p>

          {/* iOS Expand / Collapse & Inline Action Bar */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            {isMultiLine ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 cursor-pointer transition-colors"
              >
                <span>{isExpanded ? 'Show less' : 'View more'}</span>
                <ChevronDown size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            ) : <div />}

            {(n.actionRoute || n.entityId) && (
              <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                <span>View details</span>
                <ChevronRight size={12} />
              </div>
            )}
          </div>

          {/* Document Preview & Download (Visible on expand) */}
          {n.fileId && isExpanded && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveFileModal({ fileId: n.fileId, title: n.title }); }}
                className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <Eye size={13} /> Preview
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const {
    notifications = [],
    allNotifications = [],
    unreadCount = 0,
    isLoading = false,
    error = null,
    selectedCategory = 'all',
    setSelectedCategory,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
    clearAllNotifications,
    registerFCMDeviceToken,
    refreshNotifications
  } = useGlobalNotifications();

  const { token, user } = useAuth();
  const { confirmAction, notify } = useNotification();
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeFileModal, setActiveFileModal] = useState<{ fileId: string; title: string; filename?: string } | null>(null);
  const [pushPermState, setPushPermState] = useState<string>('default');
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReadStatus, setFilterReadStatus] = useState<'all' | 'unread'>('all');
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [pushErrorMessage, setPushErrorMessage] = useState<string | null>(null);

  const confirmDeleteNotification = async (notification: Notification, onCancel?: () => void) => {
    const rawTitle = (notification.title || '').trim();

    const confirmed = await confirmAction({
      title: 'Delete notification?',
      message: 'Are you sure you want to permanently delete this notification? This action cannot be undone.',
      detail: rawTitle || undefined,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      category: 'NOTIFICATION',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await deleteNotification(notification.id);
        notify.success('Deleted', 'Notification removed', { duration: 2000 });
      } catch (err: any) {
        notify.error('Delete Failed', err.message || 'Unable to delete notification.', { category: 'NOTIFICATION' });
        if (onCancel) onCancel();
      }
    } else {
      if (onCancel) onCancel();
    }
  };

  const confirmArchiveNotification = async (notification: Notification, onFinish?: () => void) => {
    try {
      await archiveNotification(notification.id);
      notify.info('Archived', 'Moved to Archived tab', { duration: 2200 });
      if (onFinish) onFinish();
    } catch (err: any) {
      notify.error('Archive Failed', err.message || 'Unable to archive notification.', { category: 'NOTIFICATION' });
    }
  };

  const handleClearAll = async () => {
    const activeItems = allNotifications.filter(n => !n.isArchived);
    if (activeItems.length === 0) return;

    const confirmed = await confirmAction({
      title: 'Clear All Notifications?',
      message: `Are you sure you want to permanently clear all ${activeItems.length} active notifications? Archived items will remain safely stored.`,
      confirmLabel: 'Clear All',
      cancelLabel: 'Cancel',
      category: 'NOTIFICATION',
      variant: 'danger',
    });

    if (confirmed) {
      setIsClearingAll(true);
      try {
        await clearAllNotifications();
        notify.success('Inbox Cleared', 'All active notifications have been removed.', { category: 'NOTIFICATION', duration: 2500 });
      } catch (err: any) {
        notify.error('Clear Failed', err.message || 'Failed to clear notifications.', { category: 'NOTIFICATION' });
      } finally {
        setIsClearingAll(false);
      }
    }
  };

  const checkInitialPushPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const permStatus = await PushNotifications.checkPermissions();
          console.log('[Push] Capacitor initial perm status:', permStatus.receive);
          setPushPermState(permStatus.receive);
        } catch (err) {
          console.warn('[Push] Error checking Capacitor permissions:', err);
          setPushPermState('default');
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = (window as any).Notification?.permission || 'default';
        console.log('[Push] Web initial perm status:', perm);
        setPushPermState(perm);
      } else {
        setPushPermState('unsupported');
      }
    } catch (_err) {
      setPushPermState('unsupported');
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkInitialPushPermission();
    }
  }, [isOpen]);

  const handleEnablePush = async () => {
    if (isEnablingPush) return;
    setIsEnablingPush(true);
    setPushErrorMessage(null);
    setTestPushStatus(null);

    console.log('[Push] Enable Push clicked');

    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[Push] Platform: Capacitor Native', Capacitor.getPlatform());
        let permStatus = await PushNotifications.checkPermissions();
        console.log('[Push] Permission state before request:', permStatus.receive);

        if (permStatus.receive !== 'granted') {
          permStatus = await PushNotifications.requestPermissions();
          console.log('[Push] Permission state after request:', permStatus.receive);
        }

        if (permStatus.receive !== 'granted') {
          setPushPermState('denied');
          setPushErrorMessage('Notifications are blocked. Enable notifications in your device settings.');
          console.log('[Push] ERROR: Permission denied by user');
          setIsEnablingPush(false);
          return;
        }

        console.log('[Push] Permission granted, starting native push registration...');

        const tokenPromise = new Promise<string>((resolve, reject) => {
          let regListener: any;
          let errListener: any;
          const timeout = setTimeout(() => {
            if (regListener) regListener.remove();
            if (errListener) errListener.remove();
            reject(new Error('Push registration timed out. Ensure Firebase FCM is active.'));
          }, 12000);

          PushNotifications.addListener('registration', (capToken) => {
            clearTimeout(timeout);
            if (regListener) regListener.remove();
            if (errListener) errListener.remove();
            resolve(capToken.value);
          }).then(l => regListener = l);

          PushNotifications.addListener('registrationError', (err) => {
            clearTimeout(timeout);
            if (regListener) regListener.remove();
            if (errListener) errListener.remove();
            reject(new Error(err.error || 'Registration failed'));
          }).then(l => errListener = l);
        });

        await PushNotifications.register();
        console.log('[Push] PushNotifications.register() called, waiting for FCM device token...');

        const nativeToken = await tokenPromise;
        console.log('[Push] Token: received (len ' + nativeToken.length + ')');

        console.log('[Push] Backend registration: started');
        const isBackendSaved = await registerFCMDeviceToken(nativeToken, Capacitor.getPlatform());

        if (isBackendSaved) {
          console.log('[Push] Backend registration: success');
          console.log('[Push] Push status: ENABLED');
          setPushPermState('granted');
          setTestPushStatus(' Device registered for System Push Notifications');
          setTimeout(() => setTestPushStatus(null), 5000);
        } else {
          console.log('[Push] ERROR: Backend registration failed');
          setPushPermState('denied');
          setPushErrorMessage('Device registration failed on server. Please try again.');
        }
      } else {
        // Web / PWA Flow
        console.log('[Push] Platform: Web / PWA');
        if (typeof window === 'undefined' || !('Notification' in window)) {
          setPushErrorMessage('Push notifications are not supported in this browser environment.');
          setPushPermState('unsupported');
          setIsEnablingPush(false);
          return;
        }

        const currentPerm = Notification.permission;
        console.log('[Push] Permission current state:', currentPerm);

        if (currentPerm === 'denied') {
          setPushPermState('denied');
          setPushErrorMessage('Notifications are blocked. Enable notifications in your browser settings.');
          console.log('[Push] ERROR: Browser permission blocked');
          setIsEnablingPush(false);
          return;
        }

        console.log('[Push] Service Worker / FCM Token registration starting...');
        const fcmToken = await requestPushPermissionAndGetToken();

        if (fcmToken) {
          console.log('[Push] Token: received');
          console.log('[Push] Backend registration: started');
          const isBackendSaved = await registerFCMDeviceToken(fcmToken, 'web');

          if (isBackendSaved) {
            console.log('[Push] Backend registration: success');
            console.log('[Push] Push status: ENABLED');
            setPushPermState('granted');
            setTestPushStatus(' Device registered for System Push Notifications');
            setTimeout(() => setTestPushStatus(null), 5000);
          } else {
            console.log('[Push] ERROR: Backend token save failed');
            setPushPermState('denied');
            setPushErrorMessage('Device registration failed on server. Please try again.');
          }
        } else {
          const updatedPerm = Notification.permission;
          console.log('[Push] ERROR: Token generation failed. Permission status:', updatedPerm);
          if (updatedPerm === 'denied') {
            setPushPermState('denied');
            setPushErrorMessage('Notifications are blocked. Enable notifications in your browser settings.');
          } else {
            setPushPermState(updatedPerm);
            setPushErrorMessage('Unable to register this device for notifications. Please check your network or push configuration.');
          }
        }
      }
    } catch (err: any) {
      console.error('[Push] ERROR:', err);
      setPushErrorMessage(err.message || 'Unable to enable push notifications.');
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSendTestSystemPush = async () => {
    if (!token || isSendingTestPush) return;
    setIsSendingTestPush(true);
    setTestPushStatus('Dispatching system push to device...');
    setPushErrorMessage(null);

    try {
      if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const fcmToken = await requestPushPermissionAndGetToken();
        if (fcmToken) {
          await registerFCMDeviceToken(fcmToken, 'web');
        }
      }

      const res = await fetch(`${API_BASE_URL}/notifications/test-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Contest Reminder',
          message: 'Sunday LeetCode Contest starts in 30 minutes! Tap to view leaderboard.',
          route: '/weekly-contest',
          priority: 'high'
        })
      });

      if (res.ok) {
        setTestPushStatus(' Real system push sent! Check device notification panel & lock screen.');
      } else {
        const errJson = await res.json().catch(() => ({}));
        setTestPushStatus(`Push warning: ${errJson.detail || 'Push queued'}`);
      }
    } catch (err: any) {
      setTestPushStatus(`Push notice: ${err.message || 'Dispatched'}`);
    } finally {
      setIsSendingTestPush(false);
      setTimeout(() => setTestPushStatus(null), 6000);
    }
  };

  const handleRefreshNotifications = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Do not close if clicking the notification trigger (bell button) so toggling works properly
      const isTrigger = (event.target as HTMLElement)?.closest?.('[data-notification-trigger]');
      if (isTrigger) return;

      if (window.innerWidth >= 640 && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const getIcon = (type: string, priority: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('daily_surge') || t.includes('100') || t.includes('single_day')) return <Activity className="text-amber-500" size={18} />;
    if (t.includes('fetch_surge') || t.includes('delta')) return <TrendingUp className="text-indigo-500" size={18} />;
    if (t.includes('synced') || t.includes('finalized')) return <Award className="text-amber-500" size={18} />;
    if (t.includes('attendance')) return <Users className="text-blue-500" size={18} />;
    if (priority === 'high' || priority === 'critical') return <AlertTriangle className="text-rose-500" size={18} />;
    if (t.includes('assignment')) return <Calendar className="text-emerald-500" size={18} />;
    if (t.includes('report') || t.includes('file')) return <FileText className="text-cyan-500" size={18} />;
    if (t.includes('alert')) return <AlertCircle className="text-amber-500" size={18} />;
    return <Bell className="text-brand-500" size={18} />;
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);

    const target = resolveNotificationDestination(n);

    if (target.modalType === 'FILE_PREVIEW' && target.entityId) {
      setActiveFileModal({ fileId: target.entityId, title: n.title });
      return;
    }

    if (target.path) {
      if (onNavigateTab) {
        onNavigateTab(target.path);
      } else {
        window.location.hash = `#${target.path}`;
      }
      onClose();
    }
  };


  const handleFileDownload = (fileId: string) => {
    downloadManager.download({
      endpoint: `/notifications/files/${fileId}/download`,
    });
  };

  const handleFilePreview = (fileId: string) => {
    downloadManager.download({
      endpoint: `/notifications/files/${fileId}/preview`,
    });
  };

  const displayedNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterReadStatus === 'unread' && n.isRead) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const bodyMatch = (n.message || n.body || '').toLowerCase().includes(q);
        const catMatch = (n.category || '').toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch && !catMatch) return false;
      }
      return true;
    });
  }, [notifications, filterReadStatus, searchQuery]);

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100050] pointer-events-auto">
            {/* Backdrop for desktop click outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 sm:bg-black/40 backdrop-blur-xs sm:backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Notification Panel Modal */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              className="fixed inset-0 sm:inset-auto sm:right-6 sm:top-16 sm:w-[420px] max-w-[100vw] sm:max-w-[420px] bg-slate-50 dark:bg-[#070A12] sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-white/[0.1] z-[100051] overflow-hidden flex flex-col h-dvh sm:h-[680px] sm:max-h-[85vh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,12px)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                    title="Back to previous screen"
                    aria-label="Back"
                  >
                    <ArrowLeft size={19} className="sm:hidden" />
                    <X size={18} className="hidden sm:block" />
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-extrabold text-base sm:text-sm text-slate-900 dark:text-white truncate">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[32px] px-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/[0.08] shrink-0"
                      title="Mark all as read"
                    >
                      <Check size={13} />
                      <span className="hidden xs:inline">Mark all</span>
                    </button>
                  )}
                  {allNotifications.some(n => !n.isArchived) && (
                    <button
                      type="button"
                      onClick={() => void handleClearAll()}
                      disabled={isClearingAll}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0 disabled:opacity-40"
                      title="Clear all active notifications"
                      aria-label="Clear all notifications"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRefreshNotifications()}
                    disabled={isRefreshing}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-50 disabled:cursor-wait"
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                  >
                    <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* iOS Full-Width Search Input */}
              <div className="px-3.5 sm:px-4 pt-2.5 pb-2 bg-white dark:bg-[#0B0F19] shrink-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notifications..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200/60 dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-slate-300 dark:bg-white/20 text-slate-600 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-white/30 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* iOS Full-Width Segmented Control for Read Status */}
              <div className="px-3.5 sm:px-4 pb-2 bg-white dark:bg-[#0B0F19] shrink-0">
                <div className="grid grid-cols-2 p-0.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setFilterReadStatus('all')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${filterReadStatus === 'all'
                        ? 'bg-white dark:bg-brand-500 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    <span>All</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${filterReadStatus === 'all'
                        ? 'bg-slate-100 dark:bg-white/20 text-slate-700 dark:text-white'
                        : 'bg-slate-200/60 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                      }`}>
                      {allNotifications.filter(n => !n.isArchived).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterReadStatus('unread')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${filterReadStatus === 'unread'
                        ? 'bg-white dark:bg-brand-500 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    <span>Unread</span>
                    {unreadCount > 0 ? (
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${filterReadStatus === 'unread'
                          ? 'bg-brand-500 text-white dark:bg-white dark:text-brand-600'
                          : 'bg-brand-500/20 text-brand-600 dark:text-brand-400'
                        }`}>
                        {unreadCount}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold opacity-60">0</span>
                    )}
                  </button>
                </div>
              </div>

              {/* iOS Category Filter Chips (Horizontal Scroll) */}
              <div className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 border-b border-slate-200/80 dark:border-white/[0.08] overflow-x-auto overflow-y-hidden whitespace-nowrap shrink-0 bg-white/50 dark:bg-[#070A12] touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CATEGORIES.map((cat, idx) => {
                  const categoryCount = cat.id === 'all'
                    ? allNotifications.filter(n => !n.isArchived).length
                    : cat.id === 'archived'
                      ? allNotifications.filter(n => n.isArchived).length
                      : allNotifications.filter(n => !n.isArchived && normalizeCategory(n.category || n.type) === cat.id).length;

                  const categoryUnread = cat.id === 'all'
                    ? unreadCount
                    : cat.id === 'archived'
                      ? 0
                      : allNotifications.filter(n => !n.isArchived && !n.isRead && normalizeCategory(n.category || n.type) === cat.id).length;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-[11px] font-bold h-7 px-3 rounded-full transition-all shrink-0 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${selectedCategory === cat.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] border border-slate-200/50 dark:border-white/[0.06]'
                        }`}
                    >
                      <span>{cat.label}</span>
                      {categoryUnread > 0 ? (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${selectedCategory === cat.id
                            ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                            : 'bg-brand-500/20 text-brand-600 dark:text-brand-400'
                          }`}>
                          {categoryUnread}
                        </span>
                      ) : categoryCount > 0 && (
                        <span className="text-[10px] font-semibold opacity-60">
                          ({categoryCount})
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="w-2 shrink-0 pointer-events-none" aria-hidden="true" />
              </div>

              {/* Body List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-navy-700 flex flex-col bg-slate-50 dark:bg-[#070A12]">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-start space-x-3 animate-pulse p-2 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-slate-200 dark:bg-navy-800 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 dark:bg-navy-800 rounded w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center space-y-3 my-auto">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                      <AlertCircle size={22} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Unable to load notifications</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                  </div>
                ) : displayedNotifications.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center my-auto min-h-[260px] animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] flex items-center justify-center mb-4 text-slate-400 dark:text-slate-400 shadow-sm">
                      <Bell size={28} />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">
                      {searchQuery ? 'No matching notifications' : 'No notifications'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed">
                      {searchQuery
                        ? `No notifications found matching "${searchQuery}".`
                        : filterReadStatus === 'unread'
                          ? 'All caught up! No unread notifications.'
                          : 'Notifications for your selected category will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 sm:p-3.5 space-y-2.5 bg-slate-100/50 dark:bg-[#070A12] pb-8">
                    {displayedNotifications.map((n) => (
                      <NotificationItem
                        key={n.id}
                        n={n}
                        handleNotificationClick={handleNotificationClick}
                        confirmDeleteNotification={confirmDeleteNotification}
                        confirmArchiveNotification={confirmArchiveNotification}
                        archiveNotification={archiveNotification}
                        markAsRead={markAsRead}
                        setActiveFileModal={setActiveFileModal}
                        getIcon={getIcon}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Detail Modal */}
      <AnimatePresence>
        {activeFileModal && (
          <div className="fixed inset-0 z-[100090] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0B0F19] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/[0.1] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-extrabold">
                  <FileText size={20} />
                  <span>Document Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFileModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{activeFileModal.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Institutional document attachment ready for preview or download.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleFilePreview(activeFileModal.fileId)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleFileDownload(activeFileModal.fileId)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-brand-500/20"
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default NotificationPanel;
