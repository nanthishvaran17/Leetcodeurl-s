import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveNotificationDestination } from '../utils/notificationNavigation';
import { Bell, Check, Archive, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Calendar, FileText, Download, Eye, X, Settings, ChevronRight, ArrowLeft, Send, Smartphone, Loader2, RefreshCw, TrendingUp, Users, Award, Activity } from 'lucide-react';
import { useGlobalNotifications, normalizeCategory, type Notification } from '../context/GlobalNotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestPushPermissionAndGetToken } from '../services/firebasePush';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { downloadManager } from '../services/download/downloadManager';
import { useNotification } from '../context/NotificationContext';

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

const NotificationItem = ({ n, handleNotificationClick, confirmDeleteNotification, confirmArchiveNotification, markAsRead, setActiveFileModal, getIcon }: any) => {
  const [swipeX, setSwipeX] = useState(0);
  const THRESHOLD = 90;

  const handleDrag = (_e: any, info: any) => {
    setSwipeX(info.offset.x);
  };

  const handleDragEnd = (_e: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -THRESHOLD || velocity < -500) {
      // Swiped LEFT → Delete
      setSwipeX(-100);
      setTimeout(() => confirmDeleteNotification(n, () => setSwipeX(0)), 200);
    } else if (offset > THRESHOLD || velocity > 500) {
      // Swiped RIGHT → Archive (hide)
      setSwipeX(100);
      setTimeout(() => confirmArchiveNotification(n, () => setSwipeX(0)), 200);
    } else {
      setSwipeX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0a0f1d] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-shadow">
      {/* RIGHT bg: Delete (revealed ONLY on left-swipe - dragging right to left) */}
      <div 
        className={`absolute inset-y-0 right-0 w-1/2 flex items-center justify-end bg-rose-600 px-5 rounded-r-2xl transition-opacity duration-150 ${
          swipeX < 0 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={20} />
          <span className="text-[10px] font-black tracking-wide">Delete</span>
        </div>
      </div>

      {/* LEFT bg: Archive (revealed ONLY on right-swipe - dragging left to right) */}
      <div 
        className={`absolute inset-y-0 left-0 w-1/2 flex items-center justify-start bg-blue-600 px-5 rounded-l-2xl transition-opacity duration-150 ${
          swipeX > 0 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Archive size={20} />
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
        className={`relative z-10 flex items-start gap-3 p-3.5 sm:p-4 cursor-pointer min-h-[64px] select-none rounded-2xl transition-colors
          ${!n.isRead
            ? 'bg-indigo-50/80 dark:bg-[#111728] border-l-4 border-l-brand-500 shadow-sm'
            : 'bg-white dark:bg-[#0a0f1d]'
          }`}
        onClick={() => {
          if (Math.abs(swipeX) > 5) { setSwipeX(0); return; }
          handleNotificationClick(n);
        }}
      >
        {/* Unread indicator glow */}
        {!n.isRead && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-brand-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
        )}

        <div className={`mt-0.5 shrink-0 p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/50 dark:border-white/[0.06] transition-shadow ${n.isRead ? 'opacity-60' : ''}`}>
          {getIcon(n.type, n.priority)}
        </div>

        <div className={`flex-1 min-w-0 pr-1 ${n.isRead ? 'opacity-75' : ''}`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className={`text-xs sm:text-sm line-clamp-2 leading-snug flex-1 ${!n.isRead ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-600 dark:text-slate-300 font-bold'}`}>
              {n.title}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Badges for Surge, Milestone, Results, Attendance */}
          <div className="flex items-center gap-1.5 flex-wrap my-1">
            {(n.type === 'STUDENT_DAILY_SURGE_MILESTONE' || (n.title && (n.title.includes('100 Solved') || n.title.includes('Single Day')))) && (
              <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                100 Solved Today
              </span>
            )}
            {(n.type === 'STUDENT_FETCH_SURGE_DELTA' || (n.title && (n.title.includes('Surge Alert') || n.title.includes('Growth')))) && (
              <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                Verified Growth
              </span>
            )}
            {(n.type === 'CONTEST_RESULTS_SYNCED' || (n.title && n.title.includes('Results Published'))) && (
              <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                Web & App Synced
              </span>
            )}
            {(n.type === 'SUNDAY_CONTEST_ATTENDANCE_REPORT' || n.type === 'SUNDAY_CONTEST_FACULTY_SUMMARY' || (n.title && n.title.includes('Attendance Report'))) && (
              <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                Attendance Roster
              </span>
            )}
          </div>

          <p className={`text-xs leading-relaxed whitespace-pre-line line-clamp-6 mt-1.5 ${!n.isRead ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
            {n.message}
          </p>

          {(n.actionRoute || n.entityId) && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-extrabold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
              <span>View details & actions</span>
              <ChevronRight size={13} />
            </div>
          )}

          {n.fileId && (
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
    notifications,
    allNotifications = [],
    unreadCount,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
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
      await deleteNotification(notification.id);
      notify.success('Deleted', 'Notification removed', { duration: 2000 });
    } else {
      if (onCancel) onCancel();
    }
  };

  const confirmArchiveNotification = async (notification: Notification, onFinish?: () => void) => {
    // Instant, smooth archive with toast notification
    await archiveNotification(notification.id);
    notify.info('Archived', 'Moved to Archived tab', { duration: 2200 });
    if (onFinish) onFinish();
  };

  const checkInitialPushPermission = async () => {
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
      console.log('[Push] Web initial perm status:', Notification.permission);
      setPushPermState(Notification.permission);
    } else {
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

  if (typeof document === 'undefined') return null;

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
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B0F19] shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                    title="Back to previous screen"
                    aria-label="Back"
                  >
                    <ArrowLeft size={20} className="sm:hidden" />
                    <X size={18} className="hidden sm:block" />
                  </button>
                  <h3 className="font-black text-base sm:text-sm text-slate-900 dark:text-white truncate">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRefreshNotifications()}
                    disabled={isRefreshing}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-wait"
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                  >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px] px-2 rounded-xl hover:bg-brand-50 dark:hover:bg-white/[0.08] shrink-0"
                    >
                      <Check size={15} />
                      <span className="hidden xs:inline">Mark all</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.08] overflow-x-auto overflow-y-hidden whitespace-nowrap shrink-0 bg-white dark:bg-[#070A12] touch-pan-x snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CATEGORIES.map((cat) => {
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
                      className={`text-[11px] font-extrabold min-h-[44px] px-3.5 rounded-xl transition-all shrink-0 cursor-pointer whitespace-nowrap snap-start flex items-center justify-center gap-1.5 ${
                        selectedCategory === cat.id
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] border border-transparent dark:border-white/[0.06]'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {categoryUnread > 0 ? (
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                          selectedCategory === cat.id
                            ? 'bg-white/30 text-white'
                            : 'bg-brand-500/20 text-brand-600 dark:text-brand-400'
                        }`}>
                          {categoryUnread}
                        </span>
                      ) : categoryCount > 0 && (
                        <span className="text-[10px] font-semibold opacity-70">
                          ({categoryCount})
                        </span>
                      )}
                    </button>
                  );
                })}
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
                ) : notifications.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center my-auto min-h-[260px] animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] flex items-center justify-center mb-4 text-slate-400 dark:text-slate-400 shadow-sm">
                      <Bell size={28} />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">No notifications</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed">
                      Notifications for your selected category will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 space-y-3 bg-slate-50 dark:bg-[#070A12] pb-6">
                    {notifications.map((n) => (
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
