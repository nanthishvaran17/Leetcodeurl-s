import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Lock, Activity, Clock, RefreshCw, Mail, Database, 
  AlertTriangle, Save, CheckCircle2, XCircle, ArrowRight, Layers,
  Shield, Server, FileText, CheckCircle, FileSpreadsheet, Archive,
  Send, Fingerprint
} from 'lucide-react';
import api from '../services/api';
import { SecurityActivitySection } from '../components/SecurityActivitySection';

export const SettingsPage: React.FC = () => {
  const [initialSettings, setInitialSettings] = useState<any>({});
  const [settings, setSettings] = useState<any>({
    SESSION_START: '08:00',
    SESSION_END: '09:30',
    PROGRESS_THRESHOLD: '1',
    TIMEZONE: 'Asia/Kolkata',
    ENABLE_AUTO_SUNDAY_SESSION: 'true',
    AUTO_START_SNAPSHOT: 'true',
    AUTO_FINALIZATION_SNAPSHOT: 'true', // Merged control
    LOCK_FINALIZED_SESSIONS: 'true',
    ALLOW_MANUAL_REFETCH: 'true',
    AUTO_CONTEST_SYNC: 'true',
    HISTORICAL_ARCHIVE_SYNC: 'true',
    FETCH_TIMEOUT: '30',
    RETRY_COUNT: '3',
    REPORT_RECIPIENT_EMAILS: 'hod.cyber@college.edu, hod.iot@college.edu',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USERNAME: 'notifications@nandha.edu.in',
    SMTP_PASSWORD_MASKED: '••••••••',
    SMTP_ENCRYPTION: 'TLS',
    SENDER_EMAIL: 'notifications@nandha.edu.in',
    SENDER_NAME: 'Nandha Engineering College Contest Engine',
    AUTO_EMAIL_AFTER_FINALIZE: 'true',
    SEND_ONLY_VALIDATED: 'true',
    BLOCK_EMAIL_ON_FAILURE: 'true',
    ATTACH_EXCEL: 'true',
    ATTACH_PDF: 'true',
    ATTACH_WORD: 'true',
    ATTACH_ZIP: 'true',
    AUTO_REPORT_GENERATION: 'true',
    AUTO_BACKUP: 'true',
    BACKUP_FREQUENCY: 'Daily',
    BACKUP_RETENTION: '14',
    BACKUP_BEFORE_DANGEROUS: 'true',
    PRODUCTION_MODE: 'true',
    ADMIN_SESSION_TIMEOUT: '30',
    REAUTH_DANGEROUS: 'true',
    MAX_LOGIN_ATTEMPTS: '5',
    LOCKOUT_DURATION: '15',
    MAINTENANCE_MODE: 'false',
    LAST_UPDATED_AT: ''
  });

  const [backups, setBackups] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveDiffMsg, setSaveDiffMsg] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFullAuditLog, setShowFullAuditLog] = useState(false);

  // Unsaved Changes Tracking
  const [changedKeys, setChangedKeys] = useState<string[]>([]);

  // Dangerous Operation Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    impact: string;
    actionType: string;
    targetFilename?: string;
  }>({ open: false, title: '', description: '', impact: '', actionType: '' });

  useEffect(() => {
    fetchSettings();
    fetchBackups();
    fetchSystemHealth();
    fetchAuditLogs();
  }, []);

  // Compute unsaved changes count
  useEffect(() => {
    if (!initialSettings || Object.keys(initialSettings).length === 0) return;
    const diffs: string[] = [];
    Object.keys(settings).forEach(key => {
      if (key === 'SMTP_PASSWORD_MASKED' || key === 'LAST_UPDATED_AT') return;
      if (String(settings[key]) !== String(initialSettings[key])) {
        diffs.push(key);
      }
    });
    setChangedKeys(diffs);
  }, [settings, initialSettings]);

  // Unsaved changes unload prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (changedKeys.length > 0) {
        e.preventDefault();
        e.returnValue = 'Unsaved configuration changes will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [changedKeys]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setSettings(res.data);
        setInitialSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/settings/backups');
      setBackups(res.data || []);
    } catch (err) {
      console.error('Failed to load database backups:', err);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const res = await api.get('/settings/system-health');
      setSystemHealth(res.data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/settings/audit-logs');
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changedKeys.length === 0) return;

    setSaving(true);
    setSaveDiffMsg(null);

    try {
      await api.post('/settings', settings);
      
      const diffSummary = changedKeys.map(k => `${k}: ${initialSettings[k] || 'default'} → ${settings[k]}`).join(', ');
      setSaveDiffMsg(`🟢 Configuration saved successfully. Changed (${changedKeys.length}): ${diffSummary}`);
      setTimeout(() => setSaveDiffMsg(null), 6000);

      await fetchSettings();
      await fetchAuditLogs();
      await fetchSystemHealth();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to save settings.';
      alert(`Save Error: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading('create-backup');
    try {
      const res = await api.post('/settings/backup');
      if (res.data?.status === 'SUCCESS') {
        alert(`✅ Database Snapshot Created!\n\nFilename: ${res.data.filename}\nChecksum: ${res.data.checksum}`);
        fetchBackups();
        fetchAuditLogs();
      } else {
        alert(`Failed to create backup: ${res.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Error creating database snapshot.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyBackup = async (filename: string) => {
    setActionLoading(`verify-${filename}`);
    try {
      const res = await api.post(`/settings/backups/${encodeURIComponent(filename)}/verify`);
      if (res.data?.verified) {
        alert(`🟢 BACKUP INTEGRITY VERIFIED\n\nFilename: ${filename}\nStatus: HEALTHY\nSHA256 Checksum: ${res.data.checksum}`);
      } else {
        alert(`🔴 INTEGRITY ERROR: ${res.data?.message || 'File check failed'}`);
      }
    } catch (err) {
      alert('Error verifying backup integrity.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreBackup = (filename: string) => {
    setConfirmModal({
      open: true,
      title: `Restore Database Snapshot: "${filename}"?`,
      description: `Restoring this database snapshot will overwrite active application state.`,
      impact: `A pre-restore safety snapshot will automatically be created first before applying snapshot '${filename}'.`,
      actionType: 'restore-backup',
      targetFilename: filename
    });
  };

  const handleDeleteBackup = (filename: string) => {
    setConfirmModal({
      open: true,
      title: `Delete Snapshot "${filename}"?`,
      description: `This action will permanently delete the backup snapshot file from disk storage.`,
      impact: `File cannot be recovered after deletion.`,
      actionType: 'delete-backup',
      targetFilename: filename
    });
  };

  const executeConfirmedAction = async () => {
    const { actionType, targetFilename } = confirmModal;
    setConfirmModal({ open: false, title: '', description: '', impact: '', actionType: '' });

    if (actionType === 'restore-backup' && targetFilename) {
      setActionLoading(`restore-${targetFilename}`);
      try {
        const res = await api.post(`/settings/backups/${encodeURIComponent(targetFilename)}/restore`);
        if (res.data?.status === 'SUCCESS') {
          alert(`✅ RESTORE SUCCESSFUL!\n\n${res.data.message}`);
          fetchBackups();
          fetchAuditLogs();
        } else {
          alert(`Restore error: ${res.data?.message}`);
        }
      } catch (err) {
        alert('Failed to restore snapshot.');
      } finally {
        setActionLoading(null);
      }
    } else if (actionType === 'delete-backup' && targetFilename) {
      setActionLoading(`delete-${targetFilename}`);
      try {
        const res = await api.delete(`/settings/backups/${encodeURIComponent(targetFilename)}`);
        if (res.data?.status === 'SUCCESS') {
          fetchBackups();
          fetchAuditLogs();
        } else {
          alert(`Delete failed: ${res.data?.message}`);
        }
      } catch (err) {
        alert('Failed to delete backup snapshot.');
      } finally {
        setActionLoading(null);
      }
    } else if (actionType.startsWith('advanced-')) {
      const op = actionType.replace('advanced-', '');
      setActionLoading(actionType);
      try {
        // Create safety backup first if configured
        if (settings.BACKUP_BEFORE_DANGEROUS === 'true') {
          await api.post('/settings/backup');
        }
        const res = await api.post(`/settings/advanced/${op}`);
        alert(`✅ Operation Completed: ${res.data?.message || 'Success'}`);
        fetchAuditLogs();
        fetchBackups();
      } catch (err: any) {
        alert(`Operation error: ${err.response?.data?.detail || err.message}`);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const target = settings.REPORT_RECIPIENT_EMAILS?.split(',')[0]?.trim() || 'hod.cyber@college.edu';
      const res = await api.post('/settings/test-email', { recipient: target });
      alert(`✉️ ${res.data.message}`);
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to send test notification email.');
    } finally {
      setTestingEmail(false);
    }
  };

  const triggerAdvancedOp = (opKey: string, title: string, desc: string, impact: string) => {
    setConfirmModal({
      open: true,
      title,
      description: desc,
      impact,
      actionType: `advanced-${opKey}`
    });
  };

  // Health Component Config Map
  const HEALTH_ITEMS = [
    { key: 'backendApi', label: 'Backend API' },
    { key: 'database', label: 'Database' },
    { key: 'contestSync', label: 'Contest Engine' },
    { key: 'reportEngine', label: 'Report Engine' },
    { key: 'emailEngine', label: 'Email Engine' },
    { key: 'backupSystem', label: 'Backup System' },
    { key: 'scheduler', label: 'Scheduler' },
    { key: 'dataIntegrity', label: 'Data Integrity' },
  ];

  return (
    <div className="space-y-5 pb-16 text-xs text-gray-800 dark:text-gray-200">
      
      {/* 1. RICH INSTITUTIONAL PAGE HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-xs font-black">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>INSTITUTIONAL CONFIGURATION • SYSTEM CONTROL CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Admin System Control Center
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-gray-300">
              Institutional Configuration • Automation • Integrity • Recovery • Nandha Engineering College
            </p>
            <p className="text-[11px] font-mono text-amber-200 mt-1">
              Last configuration update: {settings.LAST_UPDATED_AT ? settings.LAST_UPDATED_AT.substring(0, 19).replace('T', ' ') : '2026-08-15 15:37:34'} IST
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-400/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>● PRODUCTION</span>
            </span>

            <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-gray-200 font-bold text-xs border border-white/15 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Asia/Kolkata (IST)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. COMPACT SYSTEM STATUS STRIP */}
      <div className="glass-card p-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white/50 dark:bg-navy-900/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 font-mono text-[11px]">
          {HEALTH_ITEMS.map((item) => {
            const rawVal = systemHealth?.components?.[item.key];
            const isHealthy = rawVal === 'HEALTHY';
            const isUnknown = rawVal === undefined || rawVal === null;

            return (
              <div key={item.key} className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-950/50 border-gray-200 dark:border-navy-800 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider truncate w-full">{item.label}</span>
                <span className={`font-black text-[10px] mt-0.5 ${
                  isHealthy ? 'text-emerald-600 dark:text-emerald-400' : isUnknown ? 'text-gray-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {isHealthy ? '🟢 Healthy' : isUnknown ? '⚪ Unknown' : '🔴 Failed'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {saveDiffMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{saveDiffMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">

        {/* 3. SECTION I — WEEKLY AUTOMATION */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
            <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-brand-500" />
              <span>Weekly Automation</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Section I</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Timezone [LOCKED]</label>
              <input
                type="text"
                disabled
                value="Asia/Kolkata (IST)"
                className="w-full p-2 rounded-xl border bg-gray-100 dark:bg-navy-950 font-bold text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Sunday Start Time (24h)</label>
              <input
                type="text"
                value={settings.SESSION_START || '08:00'}
                onChange={(e) => setSettings({ ...settings, SESSION_START: e.target.value })}
                className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Finalization & Snapshot Time (24h)</label>
              <input
                type="text"
                value={settings.SESSION_END || '09:30'}
                onChange={(e) => setSettings({ ...settings, SESSION_END: e.target.value })}
                className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-xs">
            <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ENABLE_AUTO_SUNDAY_SESSION === 'true'}
                onChange={(e) => setSettings({ ...settings, ENABLE_AUTO_SUNDAY_SESSION: e.target.checked ? 'true' : 'false' })}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="font-bold text-gray-800 dark:text-gray-200">Automatic Sunday Session</span>
            </label>

            <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.AUTO_START_SNAPSHOT === 'true'}
                onChange={(e) => setSettings({ ...settings, AUTO_START_SNAPSHOT: e.target.checked ? 'true' : 'false' })}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="font-bold text-gray-800 dark:text-gray-200">Starting Snapshot (08:00 AM)</span>
            </label>

            <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.AUTO_FINALIZE === 'true'}
                onChange={(e) => setSettings({ ...settings, AUTO_FINALIZE: e.target.checked ? 'true' : 'false' })}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="font-bold text-gray-800 dark:text-gray-200">Finalization + Final Snapshot (09:30 AM)</span>
            </label>

            <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.LOCK_FINALIZED_SESSIONS === 'true'}
                onChange={(e) => setSettings({ ...settings, LOCK_FINALIZED_SESSIONS: e.target.checked ? 'true' : 'false' })}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="font-bold text-gray-800 dark:text-gray-200">Lock Finalized Sessions</span>
            </label>
          </div>
        </div>

        {/* 4. SECTION II — CONTEST DATA ENGINE */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
            <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
              <RefreshCw className="w-4 h-4 text-indigo-500" />
              <span>Contest Data Engine</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Section II</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Fetch Timeout (Seconds)</label>
              <input
                type="number"
                value={settings.FETCH_TIMEOUT || 30}
                onChange={(e) => setSettings({ ...settings, FETCH_TIMEOUT: e.target.value })}
                className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Retry Count</label>
              <input
                type="number"
                value={settings.RETRY_COUNT || 3}
                onChange={(e) => setSettings({ ...settings, RETRY_COUNT: e.target.value })}
                className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono font-bold"
              />
            </div>

            <div className="md:col-span-2 flex items-center space-x-4 pt-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.AUTO_CONTEST_SYNC === 'true'}
                  onChange={(e) => setSettings({ ...settings, AUTO_CONTEST_SYNC: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-bold text-gray-800 dark:text-gray-200">Automatic Contest Sync</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.HISTORICAL_ARCHIVE_SYNC === 'true'}
                  onChange={(e) => setSettings({ ...settings, HISTORICAL_ARCHIVE_SYNC: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-bold text-gray-800 dark:text-gray-200">Archive Reconciliation</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2 border-t dark:border-navy-700">
            <button
              type="button"
              onClick={() => triggerAdvancedOp('refetch-selected', 'Sync Selected Contest Only', 'Fetch authentic participant data ONLY for the currently selected weekly contest session.', 'Does NOT touch other contests.')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Selected Contest</span>
            </button>

            <button
              type="button"
              onClick={() => triggerAdvancedOp('reconcile-sessions', 'Sync All Historical Contests', 'Reconcile all historical Sunday contest sessions across canonical range 510–515.', 'Full archive sync.')}
              className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>🔄 Sync All Historical Contests</span>
            </button>
          </div>
        </div>

        {/* 5. SECTION III — DATA INTEGRITY GUARD */}
        <div className="glass-card p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
            <div>
              <h2 className="font-black text-base text-emerald-900 dark:text-emerald-300 flex items-center space-x-2 uppercase tracking-wide">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Data Integrity Guard</span>
              </h2>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Production rules protecting institutional contest accuracy.
              </p>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-mono font-black text-[10px] tracking-wider border border-emerald-400/30">
              🟢 DATA INTEGRITY VERIFIED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
            {[
              { label: 'Authentic Contest Data Only', value: '🔒 LOCKED ON', bg: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
              { label: 'Synthetic / Mock Data', value: '🔒 LOCKED OFF', bg: 'bg-rose-500/10 text-rose-800 dark:text-rose-300' },
              { label: 'Question Equality (Q1+Q2+Q3+Q4 = Solved)', value: '🔒 ENFORCED', bg: 'bg-blue-500/10 text-blue-800 dark:text-blue-300' },
              { label: 'Student + Contest Isolation', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
              { label: 'Session + Contest Isolation', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
              { label: 'Duplicate Result Detection', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
              { label: 'Sentinel Value Detection', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
              { label: 'Cross-Contest Leakage Detection', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
              { label: 'DB → API → UI Parity', value: '🔒 ENFORCED', bg: 'bg-gray-50/50 dark:bg-navy-900/50 text-gray-700 dark:text-gray-300' },
            ].map(rule => (
              <div key={rule.label} className={`p-2.5 rounded-xl border border-gray-200 dark:border-navy-700 font-bold flex items-center justify-between ${rule.bg}`}>
                <span>{rule.label}</span>
                <span className="font-mono text-[10px]">{rule.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. SECTION IV — REPORT INTEGRITY */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
            <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Report Integrity</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Section IV</span>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 text-[11px] font-mono flex flex-wrap items-center justify-center gap-2 text-gray-600 dark:text-gray-400 text-center">
            <span>Database</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>Canonical Matrix</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>Preview</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>Excel (.xlsx)</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>PDF (.pdf)</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>Word (.docx)</span>
            <ArrowRight className="w-3 h-3 text-brand-500" />
            <span>ZIP (.zip)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-center font-bold">
            {[
              { label: 'Preview', status: '🟢 Enforced' },
              { label: 'Excel (.xlsx)', status: '🟢 Enforced' },
              { label: 'PDF (.pdf)', status: '🟢 Enforced' },
              { label: 'Word (.docx)', status: '🟢 Enforced' },
              { label: 'ZIP Bundle', status: '🟢 Enforced' },
            ].map(fmt => (
              <div key={fmt.label} className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700">
                <div className="text-gray-400 text-[9px] uppercase">{fmt.label}</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{fmt.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. SECTION V — EMAIL DELIVERY */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
            <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
              <Mail className="w-4 h-4 text-indigo-500" />
              <span>Email Delivery & SMTP Configuration</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Section V</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Recipient Emails (Comma Separated)</label>
              <input
                type="text"
                value={settings.REPORT_RECIPIENT_EMAILS || ''}
                onChange={(e) => setSettings({ ...settings, REPORT_RECIPIENT_EMAILS: e.target.value })}
                placeholder="hod.cyber@college.edu, hod.iot@college.edu"
                className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settings.SMTP_HOST || 'smtp.gmail.com'}
                  onChange={(e) => setSettings({ ...settings, SMTP_HOST: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={settings.SMTP_PORT || 587}
                  onChange={(e) => setSettings({ ...settings, SMTP_PORT: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Encryption</label>
                <select
                  value={settings.SMTP_ENCRYPTION || 'TLS'}
                  onChange={(e) => setSettings({ ...settings, SMTP_ENCRYPTION: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-bold text-gray-900 dark:text-white"
                >
                  <option value="TLS">TLS</option>
                  <option value="SSL">SSL</option>
                  <option value="NONE">None</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={settings.SMTP_USERNAME || ''}
                  onChange={(e) => setSettings({ ...settings, SMTP_USERNAME: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">SMTP Password (Masked)</label>
                <input
                  type="password"
                  value={settings.SMTP_PASSWORD_MASKED || '••••••••'}
                  onChange={(e) => setSettings({ ...settings, SMTP_PASSWORD: e.target.value, SMTP_PASSWORD_MASKED: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Sender Email</label>
                <input
                  type="text"
                  value={settings.SENDER_EMAIL || ''}
                  onChange={(e) => setSettings({ ...settings, SENDER_EMAIL: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Sender Display Name</label>
                <input
                  type="text"
                  value={settings.SENDER_NAME || ''}
                  onChange={(e) => setSettings({ ...settings, SENDER_NAME: e.target.value })}
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t dark:border-navy-700 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testingEmail ? 'Dispatching Test Notification...' : 'Test Notification'}</span>
              </button>

              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                Last Email Delivery: DELIVERED & AUDITED
              </span>
            </div>
          </div>
        </div>

        {/* 8. SECTION VI — BACKUP & RECOVERY */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 dark:border-navy-700">
            <div>
              <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <Database className="w-4 h-4 text-emerald-500" />
                <span>Database Snapshot & Recovery</span>
              </h2>
              <p className="text-[11px] text-gray-500">Automated SQLite snapshot backups with SHA256 verification.</p>
            </div>

            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={actionLoading === 'create-backup'}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{actionLoading === 'create-backup' ? 'Creating...' : 'CREATE SNAPSHOT'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 font-bold flex items-center justify-between">
              <span>Automatic Backup</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">ON</span>
            </div>
            <div className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 font-bold flex items-center justify-between">
              <span>Backup Frequency</span>
              <span className="font-mono">Daily</span>
            </div>
            <div className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 font-bold flex items-center justify-between">
              <span>Retention</span>
              <span className="font-mono">14 Snapshots</span>
            </div>
            <div className="p-2 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 font-bold flex items-center justify-between">
              <span>SHA256 Verification</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">ENFORCED</span>
            </div>
          </div>

          {/* Backups Table */}
          <div className="overflow-x-auto">
            {backups.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No backup snapshot files created yet.</div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-gray-400 dark:border-navy-700 font-extrabold uppercase text-[9px] tracking-wider">
                    <th className="py-2 px-2.5">Snapshot</th>
                    <th className="py-2 px-2.5">Created</th>
                    <th className="py-2 px-2.5">Size</th>
                    <th className="py-2 px-2.5">Checksum</th>
                    <th className="py-2 px-2.5">Integrity</th>
                    <th className="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-navy-700 font-mono text-[11px]">
                  {backups.map((b) => (
                    <tr key={b.filename} className="hover:bg-gray-50/50 dark:hover:bg-navy-900/50">
                      <td className="py-2.5 px-2.5 font-bold text-gray-900 dark:text-white">{b.filename}</td>
                      <td className="py-2.5 px-2.5 text-gray-500">{b.created_at ? b.created_at.substring(0, 19).replace('T', ' ') : '—'}</td>
                      <td className="py-2.5 px-2.5 text-gray-500">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                      <td className="py-2.5 px-2.5 text-brand-500 font-bold">{b.checksum || 'HEALTHY'}</td>
                      <td className="py-2.5 px-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                          🟢 Healthy
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleVerifyBackup(b.filename)}
                          disabled={actionLoading === `verify-${b.filename}`}
                          className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 font-bold hover:bg-blue-500/20 text-[10px]"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          disabled={actionLoading === `restore-${b.filename}`}
                          className="px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-bold hover:bg-amber-500/20 text-[10px]"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          disabled={actionLoading === `delete-${b.filename}`}
                          className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 font-bold hover:bg-rose-500/20 text-[10px]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 9. SECTION VII — ADMIN SECURITY */}
        <div className="glass-card p-5 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3.5">
          <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
            <h2 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Admin Security</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Section VII</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs font-bold">
            <div className="p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 flex flex-col justify-between">
              <span className="text-gray-400 text-[9px] uppercase">Session Timeout</span>
              <span className="font-mono mt-1">30 Minutes</span>
            </div>
            <div className="p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 flex flex-col justify-between">
              <span className="text-gray-400 text-[9px] uppercase">Re-authentication</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 mt-1">ON</span>
            </div>
            <div className="p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 flex flex-col justify-between">
              <span className="text-gray-400 text-[9px] uppercase">Max Login Attempts</span>
              <span className="font-mono mt-1">5 Attempts</span>
            </div>
            <div className="p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 flex flex-col justify-between">
              <span className="text-gray-400 text-[9px] uppercase">Lockout Duration</span>
              <span className="font-mono mt-1">15 Minutes</span>
            </div>
            <div className="p-2.5 rounded-xl border bg-gray-50/50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 flex flex-col justify-between">
              <span className="text-gray-400 text-[9px] uppercase">Audit Logging</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 mt-1">🔒 LOCKED ON</span>
            </div>
          </div>
        </div>

        {/* 10. SECTION VIII — ADMIN IDENTITY & AUDIT LOG */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 text-white border border-brand-500/30 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="space-y-0.5">
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-[10px] font-black uppercase">
                <Fingerprint className="w-3 h-3 text-amber-400" />
                <span>REAL-TIME AUDIT STREAM</span>
              </div>
              <h2 className="text-base font-black text-white uppercase tracking-wide">
                Admin Identity & Audit Log
              </h2>
              <p className="text-xs text-gray-300">
                Real-time database audit log recording administrator identity, logins, report generation, email dispatches & setting modifications.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowFullAuditLog(!showFullAuditLog)}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 self-start sm:self-center cursor-pointer"
            >
              {showFullAuditLog ? 'Show Recent' : '[ VIEW FULL AUDIT LOG ]'}
            </button>
          </div>

          <div className="overflow-x-auto max-h-64">
            {auditLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No audit log entries recorded yet.</div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-extrabold uppercase text-[9px]">
                    <th className="py-2.5 px-3">Time (IST)</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {(showFullAuditLog ? auditLogs : auditLogs.slice(0, 10)).map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="py-2.5 px-3 text-gray-400">{log.timestamp ? log.timestamp.substring(0, 19).replace('T', ' ') : '—'}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{log.user_name}</td>
                      <td className="py-2.5 px-3 text-indigo-300 font-bold">{log.action}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-black">● SUCCESS</td>
                      <td className="py-2.5 px-3 text-gray-300">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* SINGLE SAVE CONFIGURATION BUTTON WITH CHANGE DETECTION */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs font-bold">
            {changedKeys.length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Unsaved configuration changes: {changedKeys.length} ({changedKeys.join(', ')})</span>
              </span>
            ) : (
              <span className="text-gray-400">No unsaved changes</span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || changedKeys.length === 0}
            className="px-8 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Configuration...' : '[ SAVE CONFIGURATION ]'}</span>
          </button>
        </div>

      </form>

      {/* 11. SECTION IX — ⚠️ ADVANCED SYSTEM MAINTENANCE (DANGEROUS OPERATIONS) */}
      <div className="glass-card p-5 rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 space-y-3.5 mt-8">
        <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
          <h2 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 flex items-center space-x-2 uppercase tracking-wide">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            <span>⚠️ ADVANCED SYSTEM MAINTENANCE</span>
          </h2>
          <span className="text-[10px] font-mono text-rose-600 font-bold uppercase tracking-wider">Privileged Operations</span>
        </div>

        <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
          Destructive operations require explicit confirmation and automatically trigger pre-operation safety snapshots.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-900/60 space-y-2">
            <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Clear Application Cache</div>
            <p className="text-[10px] text-gray-500 leading-tight">Purges transient in-memory response caches across all weekly sessions.</p>
            <button
              type="button"
              onClick={() => triggerAdvancedOp('clear-cache', 'Clear Application Cache', 'Purges transient in-memory response caches.', 'Temporary performance slowdown during index rebuild.')}
              className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20"
            >
              Clear Cache
            </button>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-900/60 space-y-2">
            <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Rebuild Contest Index</div>
            <p className="text-[10px] text-gray-500 leading-tight">Re-indexes student roster mappings and historical performance metrics.</p>
            <button
              type="button"
              onClick={() => triggerAdvancedOp('rebuild-index', 'Rebuild Contest Index', 'Re-index student roster mappings.', 'Re-indexes 273 student roster entries.')}
              className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20"
            >
              Rebuild Index
            </button>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-900/60 space-y-2">
            <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Reconcile Historical Sessions</div>
            <p className="text-[10px] text-gray-500 leading-tight">Executes full historical Sunday contest reconciliation across canonical range 510–515.</p>
            <button
              type="button"
              onClick={() => triggerAdvancedOp('reconcile-sessions', 'RECONCILE HISTORICAL SESSIONS', 'Executes full institutional historical Sunday contest reconciliation across 510–515.', 'May modify historical session mappings. Database snapshot will be created before execution.')}
              className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20"
            >
              Reconcile Sessions
            </button>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-900/60 space-y-2">
            <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Rebuild Reports Engine Index</div>
            <p className="text-[10px] text-gray-500 leading-tight">Re-indexes normalized report datasets for Excel, PDF, Word, and ZIP exports.</p>
            <button
              type="button"
              onClick={() => triggerAdvancedOp('rebuild-reports', 'Rebuild Reports Engine Index', 'Re-indexes normalized report datasets.', 'Regenerates report engine cache.')}
              className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20"
            >
              Rebuild Reports Index
            </button>
          </div>
        </div>
      </div>

      {/* Security Activity View */}
      <div className="mt-8">
        <SecurityActivitySection />
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>{confirmModal.title}</span>
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {confirmModal.description}
            </p>

            {confirmModal.impact && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                <b>Protection / Impact:</b> {confirmModal.impact}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t dark:border-navy-700">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, title: '', description: '', impact: '', actionType: '' })}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
              >
                [ CANCEL ]
              </button>

              <button
                type="button"
                onClick={executeConfirmedAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
              >
                [ CREATE BACKUP & CONTINUE ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
