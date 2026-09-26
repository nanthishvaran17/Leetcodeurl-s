import React, { useState, useEffect } from 'react';
import { 
  Bell, Smartphone, Mail, CheckCircle2, AlertTriangle, AlertCircle, 
  Send, Sparkles, Loader2, Shield, Calendar, FileText, Award, Megaphone, Sliders
} from 'lucide-react';
import { useGlobalNotifications, type NotificationPreferences } from '../context/GlobalNotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestPushPermissionAndGetToken } from '../services/firebasePush';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL } from '../config/apiConfig';
import { useNotification as useToastNotification } from '../context/NotificationContext';

export const NotificationPreferencesSection: React.FC = () => {
  const { preferences, updatePreferences, registerFCMDeviceToken } = useGlobalNotifications();
  const { token } = useAuth();
  const { notify } = useToastNotification();

  const [pushPermState, setPushPermState] = useState<string>('default');
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [pushErrorMessage, setPushErrorMessage] = useState<string | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Local state for preferences
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>({
    push_enabled: true,
    email_enabled: true,
    categories: {
      assignments: true,
      attendance: true,
      exams: true,
      reports: true,
      contests: true,
      announcements: true,
    }
  });

  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        push_enabled: preferences.push_enabled ?? true,
        email_enabled: preferences.email_enabled ?? true,
        categories: {
          assignments: preferences.categories?.assignments ?? true,
          attendance: preferences.categories?.attendance ?? true,
          exams: preferences.categories?.exams ?? true,
          reports: preferences.categories?.reports ?? true,
          contests: preferences.categories?.contests ?? true,
          announcements: preferences.categories?.announcements ?? true,
        }
      });
    }
  }, [preferences]);

  const checkInitialPushPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        setPushPermState(permStatus.receive);
      } catch (err) {
        setPushPermState('default');
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermState(Notification.permission);
    } else {
      setPushPermState('unsupported');
    }
  };

  useEffect(() => {
    checkInitialPushPermission();
  }, []);

  const handleEnablePush = async () => {
    if (isEnablingPush) return;
    setIsEnablingPush(true);
    setPushErrorMessage(null);
    setTestPushStatus(null);

    try {
      if (Capacitor.isNativePlatform()) {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'granted') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          setPushPermState('denied');
          setPushErrorMessage('Notifications are blocked. Enable notifications in your device settings.');
          setIsEnablingPush(false);
          return;
        }

        const tokenPromise = new Promise<string>((resolve, reject) => {
          let regListener: any;
          let errListener: any;
          const timeout = setTimeout(() => {
            if (regListener) regListener.remove();
            if (errListener) errListener.remove();
            reject(new Error('Push registration timed out. Ensure FCM is enabled.'));
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
        const nativeToken = await tokenPromise;
        const isBackendSaved = await registerFCMDeviceToken(nativeToken, Capacitor.getPlatform());

        if (isBackendSaved) {
          setPushPermState('granted');
          setTestPushStatus('Device registered for System Push Notifications');
          notify.success('Push Enabled', 'This device will receive instant system alerts.', { category: 'SYSTEM' });
        } else {
          setPushPermState('denied');
          setPushErrorMessage('Device registration failed on server.');
        }
      } else {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          setPushErrorMessage('Push notifications are not supported in this browser environment.');
          setPushPermState('unsupported');
          setIsEnablingPush(false);
          return;
        }

        const fcmToken = await requestPushPermissionAndGetToken();
        if (fcmToken) {
          const isBackendSaved = await registerFCMDeviceToken(fcmToken, 'web');
          if (isBackendSaved) {
            setPushPermState('granted');
            setTestPushStatus('Device registered for Web Push Notifications');
            notify.success('Push Enabled', 'Browser push notifications successfully active.', { category: 'SYSTEM' });
          } else {
            setPushPermState('denied');
            setPushErrorMessage('Device token registration failed on server.');
          }
        } else {
          const updatedPerm = Notification.permission;
          setPushPermState(updatedPerm);
          if (updatedPerm === 'denied') {
            setPushErrorMessage('Notifications are blocked. Please unblock in browser site settings.');
          } else {
            setPushErrorMessage('Unable to obtain FCM push token for this browser.');
          }
        }
      }
    } catch (err: any) {
      setPushErrorMessage(err.message || 'Unable to enable push notifications.');
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!token || isSendingTestPush) return;
    setIsSendingTestPush(true);
    setTestPushStatus('Dispatching system push to device...');
    setPushErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/notifications/test-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Notification Test Verified',
          message: 'Real-time multi-channel notification engine is operational!',
          route: '/dashboard',
          priority: 'high'
        })
      });

      if (res.ok) {
        setTestPushStatus('Test notification sent! Check device panel & lock screen.');
        notify.success('Test Push Sent', 'System push notification dispatched successfully.', { category: 'SYSTEM' });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setTestPushStatus(`Push status: ${errJson.detail || 'Queued'}`);
      }
    } catch (err: any) {
      setTestPushStatus(`Notice: ${err.message || 'Dispatched'}`);
    } finally {
      setIsSendingTestPush(false);
      setTimeout(() => setTestPushStatus(null), 6000);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    const success = await updatePreferences(localPrefs);
    setIsSavingPrefs(false);

    if (success) {
      notify.success('Preferences Saved', 'Your notification settings have been updated.', { category: 'SYSTEM' });
    } else {
      notify.error('Save Failed', 'Unable to save notification preferences to server.', { category: 'SYSTEM' });
    }
  };

  const toggleCategory = (catKey: string) => {
    setLocalPrefs(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: !prev.categories[catKey]
      }
    }));
  };

  const CATEGORY_ITEMS = [
    { key: 'assignments', label: 'Assignments', desc: 'New tasks, upcoming due dates, and completion status', icon: Calendar, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { key: 'attendance', label: 'Attendance', desc: 'Daily attendance logs, pending verification, and alerts', icon: Shield, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { key: 'exams', label: 'Exams & Marks', desc: 'CAT1/CAT2 exam schedules, published marks, and results', icon: FileText, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
    { key: 'reports', label: 'Reports & Summaries', desc: 'Daily faculty summaries, HOD digests, and PDF exports', icon: Sparkles, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    { key: 'contests', label: 'Contests & Milestones', desc: 'Sunday LeetCode alerts, milestone solves, and ratings', icon: Award, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { key: 'announcements', label: 'Announcements', desc: 'Institutional updates, system maintenance, and security alerts', icon: Megaphone, color: 'text-brand-500 bg-brand-500/10 border-brand-500/20' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Card */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-navy-700 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-navy-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
                <Bell size={20} />
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Notification & Push Preferences
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Configure real-time mobile push notifications, browser desktop alerts, email digests, and category subscriptions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSavingPrefs}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSavingPrefs ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>{isSavingPrefs ? 'Saving Settings...' : 'Save Preferences'}</span>
          </button>
        </div>

        {/* Device Registration & Push Diagnostics Strip */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200/80 dark:border-navy-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${pushPermState === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">
                  System Push Registration Status
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>Permission State:</span>
                  <span className={`font-mono font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                    pushPermState === 'granted'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : pushPermState === 'denied'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}>
                    {pushPermState}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {pushPermState !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isEnablingPush}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isEnablingPush ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  <span>{isEnablingPush ? 'Requesting...' : 'Enable Push Notifications'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isSendingTestPush}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSendingTestPush ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Send Test Push</span>
              </button>
            </div>
          </div>

          {pushErrorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{pushErrorMessage}</span>
            </div>
          )}

          {testPushStatus && (
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs flex items-center gap-2 font-medium">
              <Sparkles size={15} className="shrink-0 animate-pulse" />
              <span>{testPushStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Channel Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
              <Smartphone size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Mobile & Web Push Alerts</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Receive instant foreground and background push popups on your devices.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={localPrefs.push_enabled}
              onChange={(e) => setLocalPrefs(p => ({ ...p, push_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-navy-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500" />
          </label>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Mail size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Email Digest & Alerts</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Receive automated daily summaries, contest digests, and report emails.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={localPrefs.email_enabled}
              onChange={(e) => setLocalPrefs(p => ({ ...p, email_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-navy-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500" />
          </label>
        </div>
      </div>

      {/* Category Subscriptions Section */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-navy-700 space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-brand-500" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Category Subscriptions
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Toggle notifications for specific modules
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORY_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSubscribed = localPrefs.categories?.[item.key] ?? true;

            return (
              <div
                key={item.key}
                onClick={() => toggleCategory(item.key)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isSubscribed
                    ? 'bg-white dark:bg-navy-900/80 border-slate-200 dark:border-navy-800 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-navy-950/40 border-slate-200/50 dark:border-navy-900 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${item.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {item.label}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSubscribed}
                    onChange={() => toggleCategory(item.key)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-navy-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500" />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
