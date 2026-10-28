import React, { useState, useEffect } from 'react';
import { 
  Bell, Smartphone, Mail, CheckCircle2, AlertTriangle, AlertCircle, 
  Send, FileSpreadsheet, Loader2, Shield, Calendar, FileText, Award, Megaphone, Sliders,
  Volume2, Play, Check, Sparkles, VolumeX
} from 'lucide-react';
import { useGlobalNotifications, type NotificationPreferences } from '../context/GlobalNotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestPushPermissionAndGetToken } from '../services/firebasePush';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL, getApiUrl } from '../config/apiConfig';
import { useNotification as useToastNotification } from '../context/NotificationContext';
import { playWhatsAppPop, playAppleGlassChime, playTechKnockDing } from '../utils/audioChime';

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
  const [selectedTone, setSelectedTone] = useState<string>(() => {
    try {
      return localStorage.getItem('notification_sound_tone') || 'whatsapp';
    } catch {
      return 'whatsapp';
    }
  });

  const handleSelectTone = (tone: 'whatsapp' | 'apple' | 'tech' | 'none') => {
    setSelectedTone(tone);
    try {
      localStorage.setItem('notification_sound_tone', tone);
    } catch {}

    if (tone === 'whatsapp') {
      playWhatsAppPop();
      notify.info('WhatsApp Bubble Pop Selected', 'Short, bubbly water pop — now active for messages & alerts.', { category: 'AUDIO' });
    } else if (tone === 'apple') {
      playAppleGlassChime();
      notify.info('Apple Crystal Glass Selected', 'Acoustic glass tri-tone chord — now active for messages & alerts.', { category: 'AUDIO' });
    } else if (tone === 'tech') {
      playTechKnockDing();
      notify.info('Tech Knock & Ding Selected', 'Acoustic knock with crystal ding — now active for messages & alerts.', { category: 'AUDIO' });
    } else if (tone === 'none') {
      notify.info('Silent / Mute Mode Selected', 'Notifications will arrive silently without any sound.', { category: 'AUDIO' });
    }
  };

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
      const res = await fetch(getApiUrl('/notifications/test-push'), {
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
    { key: 'reports', label: 'Reports & Summaries', desc: 'Daily faculty summaries, HOD digests, and PDF exports', icon: FileSpreadsheet, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
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

            <div className="flex items-center justify-center gap-3 flex-wrap w-full sm:w-auto mt-2 sm:mt-0">
              {pushPermState !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isEnablingPush}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isEnablingPush ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  <span>{isEnablingPush ? 'Requesting...' : 'Enable Push Notifications'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isSendingTestPush}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isSendingTestPush ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Send Test Push</span>
              </button>
            </div>
          </div>

          {pushErrorMessage && (
            <div className="p-3.5 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center text-center gap-2.5 font-medium shadow-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{pushErrorMessage}</span>
            </div>
          )}

          {testPushStatus && (
            <div className="p-3.5 mt-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs flex items-center justify-center text-center gap-2.5 font-medium shadow-xs">
              <CheckCircle2 size={15} className="shrink-0 text-brand-500" />
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
              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">Receive instant foreground and background push popups on your devices.</p>
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
              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">Receive automated daily summaries, contest digests, and report emails.</p>
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

      {/* Notification Sound Timbre Studio & Live Preview */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-navy-700 space-y-4 shadow-sm bg-gradient-to-br from-indigo-500/[0.03] to-purple-500/[0.03]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-indigo-500" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Notification Sound Studio (Live Preview)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Click to test & pick your favourite tone
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Option 1: WhatsApp Bubbly Pop */}
          <div
            onClick={() => handleSelectTone('whatsapp')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedTone === 'whatsapp'
                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-white dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  💬 WhatsApp Pop
                </span>
                {selectedTone === 'whatsapp' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-0.5">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                Bubbly water pop tone. Fast, playful, and non-intrusive.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelectTone('whatsapp'); }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Play size={12} className="fill-current" />
              <span>Listen & Select</span>
            </button>
          </div>

          {/* Option 2: Apple Crystal Glass */}
          <div
            onClick={() => handleSelectTone('apple')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedTone === 'apple'
                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm ring-1 ring-indigo-500/30'
                : 'bg-white dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  🔔 Apple Crystal Glass
                </span>
                {selectedTone === 'apple' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500 text-white flex items-center gap-0.5">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                Tri-tone acoustic glass bell. Premium, soft, and professional.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelectTone('apple'); }}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Play size={12} className="fill-current" />
              <span>Listen & Select</span>
            </button>
          </div>

          {/* Option 3: Tech Knock & Ding */}
          <div
            onClick={() => handleSelectTone('tech')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedTone === 'tech'
                ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm ring-1 ring-cyan-500/30'
                : 'bg-white dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  ⚡ Tech Knock & Ding
                </span>
                {selectedTone === 'tech' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-cyan-600 text-white flex items-center gap-0.5">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                Snappy wood knock + digital ping. Distinct, punchy & sharp.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelectTone('tech'); }}
              className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Play size={12} className="fill-current" />
              <span>Listen & Select</span>
            </button>
          </div>

          {/* Option 4: Silent / Mute (None) */}
          <div
            onClick={() => handleSelectTone('none')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedTone === 'none' || selectedTone === 'silent'
                ? 'bg-rose-500/10 border-rose-500/40 shadow-sm ring-1 ring-rose-500/30'
                : 'bg-white dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  🔕 Silent / Mute
                </span>
                {(selectedTone === 'none' || selectedTone === 'silent') && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-0.5">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                No notification sound. Alerts and toasts arrive 100% silently.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelectTone('none'); }}
              className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <VolumeX size={13} />
              <span>Select Mute</span>
            </button>
          </div>
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
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
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
                    <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium leading-tight">
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
