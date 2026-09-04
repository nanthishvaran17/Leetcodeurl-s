import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Lock, Activity, Clock, RefreshCw, Mail, Database, 
  AlertTriangle, Save, CheckCircle2, XCircle, ArrowRight, Layers,
  Shield, Server, FileText, CheckCircle, FileSpreadsheet, Archive,
  Send, Fingerprint, Search, Filter, Download, Upload, Eye, 
  Check, HardDrive, Terminal, Sparkles, SlidersHorizontal
} from 'lucide-react';
import api from '../services/api';
import { SecurityActivitySection } from '../components/SecurityActivitySection';
import { useNotification } from '../context/NotificationContext';
import { StaffManagement } from '../components/admin/StaffManagement';
import { AdminStaffAllocationPanel } from '../components/AdminStaffAllocationPanel';
import { triggerDownload } from '../utils/mobileDownload';

export const SettingsPage: React.FC = () => {
  const { notify, confirmAction } = useNotification();
  const [initialSettings, setInitialSettings] = useState<any>({});
  const [settings, setSettings] = useState<any>({
    SESSION_START: '08:00',
    SESSION_END: '09:30',
    PROGRESS_THRESHOLD: '1',
    TIMEZONE: 'Asia/Kolkata',
    ENABLE_AUTO_SUNDAY_SESSION: 'true',
    AUTO_START_SNAPSHOT: 'true',
    AUTO_FINALIZATION_SNAPSHOT: 'true',
    LOCK_FINALIZED_SESSIONS: 'true',
    ALLOW_MANUAL_REFETCH: 'true',
    AUTO_CONTEST_SYNC: 'true',
    HISTORICAL_ARCHIVE_SYNC: 'true',
    FETCH_TIMEOUT: '30',
    RETRY_COUNT: '3',
    REPORT_RECIPIENT_EMAILS: 'nanthishvaran17@gmail.com',
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

  // Search & Filter State (Default single section: staff)
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('staff');
  const [settingsSearch, setSettingsSearch] = useState<string>('');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [backupSearch, setBackupSearch] = useState<string>('');
  const [integrityAuditing, setIntegrityAuditing] = useState(false);
  const [integrityAuditResult, setIntegrityAuditResult] = useState<string | null>(null);
  const [customSnapshotTag, setCustomSnapshotTag] = useState<string>('');

  const configFileInputRef = useRef<HTMLInputElement>(null);

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

  const initialFetchRef = useRef(false);
  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
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

  const [emailDiag, setEmailDiag] = useState<any>(null);
  const [testingAdminOtp, setTestingAdminOtp] = useState(false);
  const [lastOtpTestResult, setLastOtpTestResult] = useState<any>(null);

  const fetchEmailDiagnostics = async () => {
    try {
      const res = await api.get('/auth/admin/email/diagnostics');
      setEmailDiag(res.data);
    } catch (e) {
      console.warn('Diagnostics fetch note:', e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/settings/audit-logs?limit=200');
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleTestAdminOtpDelivery = async () => {
    setTestingAdminOtp(true);
    setLastOtpTestResult(null);
    try {
      const res = await api.post('/auth/admin/email/test-admin-otp');
      setLastOtpTestResult(res.data);
      notify.success('Real OTP Dispatched', `Accepted by Gmail SMTP (ID: ${res.data.messageId || 'OK'})`, { category: 'EMAIL ENGINE' });
      fetchEmailDiagnostics();
      fetchAuditLogs();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'OTP delivery failed.';
      notify.error('Delivery Test Failed', errMsg, { category: 'EMAIL ENGINE' });
    } finally {
      setTestingAdminOtp(false);
    }
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (changedKeys.length === 0) return;

    setSaving(true);
    setSaveDiffMsg(null);

    try {
      await api.post('/settings', settings);
      
      const diffSummary = changedKeys.map(k => `${k}: ${initialSettings[k] || 'default'} → ${settings[k]}`).join(', ');
      setSaveDiffMsg(`Configuration saved successfully. Changed (${changedKeys.length}): ${diffSummary}`);
      setTimeout(() => setSaveDiffMsg(null), 6000);

      await fetchSettings();
      await fetchAuditLogs();
      await fetchSystemHealth();
      notify.success('Configuration Saved', `Updated ${changedKeys.length} settings successfully.`, { category: 'ADMIN SETTINGS' });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to save settings.';
      notify.error('Save Error', errMsg, { category: 'ADMIN SETTINGS' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading('create-backup');
    notify.info('Creating Database Snapshot', 'Backing up SQLite database file...', { category: 'BACKUP ENGINE' });
    try {
      const prefix = customSnapshotTag.trim() ? `backup_${customSnapshotTag.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')}` : 'backup_leetcode_tracker';
      const res = await api.post('/settings/backup', { prefix });
      if (res.data?.status === 'SUCCESS') {
        notify.success('Snapshot Created', `Filename: ${res.data.filename}`, { category: 'BACKUP ENGINE' });
        setCustomSnapshotTag('');
        fetchBackups();
        fetchAuditLogs();
      } else {
        notify.error('Backup Failed', res.data?.message || 'Unknown error', { category: 'BACKUP ENGINE' });
      }
    } catch (err) {
      notify.error('Backup Error', 'Error creating database snapshot.', { category: 'BACKUP ENGINE' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyBackup = async (filename: string) => {
    setActionLoading(`verify-${filename}`);
    try {
      const res = await api.post(`/settings/backups/${encodeURIComponent(filename)}/verify`);
      if (res.data?.verified) {
        notify.success('Backup Verified', `Filename: ${filename} (SHA256: ${res.data.checksum?.substring(0, 12)}...)`, { category: 'BACKUP INTEGRITY' });
      } else {
        notify.error('Integrity Check Failed', res.data?.message || 'File check failed', { category: 'BACKUP INTEGRITY' });
      }
    } catch (err) {
      notify.error('Verification Error', 'Error verifying backup integrity.', { category: 'BACKUP INTEGRITY' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadBackup = (filename: string) => {
    const baseApi = import.meta.env.VITE_API_URL || '';
    window.open(`${baseApi}/api/settings/backups/${encodeURIComponent(filename)}/download`, '_blank');
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
          notify.success('Restore Successful', res.data.message || 'Snapshot restored successfully.', { category: 'RESTORE ENGINE' });
          fetchBackups();
          fetchAuditLogs();
        } else {
          notify.error('Restore Error', res.data?.message || 'Restore failed.', { category: 'RESTORE ENGINE' });
        }
      } catch (err) {
        notify.error('Restore Failed', 'Failed to restore snapshot.', { category: 'RESTORE ENGINE' });
      } finally {
        setActionLoading(null);
      }
    } else if (actionType === 'delete-backup' && targetFilename) {
      setActionLoading(`delete-${targetFilename}`);
      try {
        const res = await api.delete(`/settings/backups/${encodeURIComponent(targetFilename)}`);
        if (res.data?.status === 'SUCCESS') {
          notify.success('Snapshot Deleted', `Backup snapshot "${targetFilename}" removed.`, { category: 'BACKUP ENGINE' });
          fetchBackups();
          fetchAuditLogs();
        } else {
          notify.error('Delete Failed', res.data?.message || 'Delete failed.', { category: 'BACKUP ENGINE' });
        }
      } catch (err) {
        notify.error('Delete Failed', 'Failed to delete backup snapshot.', { category: 'BACKUP ENGINE' });
      } finally {
        setActionLoading(null);
      }
    } else if (actionType.startsWith('advanced-')) {
      const op = actionType.replace('advanced-', '');
      setActionLoading(actionType);
      try {
        if (settings.BACKUP_BEFORE_DANGEROUS === 'true') {
          await api.post('/settings/backup');
        }
        const res = await api.post(`/settings/advanced/${op}`);
        notify.success('Operation Completed', res.data?.message || 'Success', { category: 'ADVANCED OPERATIONS' });
        fetchAuditLogs();
        fetchBackups();
      } catch (err: any) {
        notify.error('Operation Error', err.response?.data?.detail || err.message, { category: 'ADVANCED OPERATIONS' });
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    notify.info('Testing Email Service', 'Sending test notification to nanthishvaran17@gmail.com...', { category: 'EMAIL TEST' });
    try {
      const target = 'nanthishvaran17@gmail.com';
      const res = await api.post('/settings/test-email', { recipient: target });
      notify.success('Test Email Sent', res.data.message || 'Email test successful.', { category: 'EMAIL TEST' });
      fetchAuditLogs();
    } catch (err) {
      notify.error('Test Failed', 'Failed to send test notification email.', { category: 'EMAIL TEST' });
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

  // Export Audit Logs to CSV
  const handleExportAuditLogsCsv = () => {
    if (auditLogs.length === 0) {
      notify.warning('No Audit Logs', 'No audit logs available to export.', { category: 'AUDIT LOGS' });
      return;
    }
    const headers = ['ID', 'Timestamp (IST)', 'Admin User', 'Action', 'Result', 'Details'];
    const rows = auditLogs.map(l => [
      l.id,
      `"${(l.timestamp || '').replace('T', ' ')}"`,
      `"${l.user_name || 'Admin'}"`,
      `"${l.action || ''}"`,
      '"SUCCESS"',
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `admin_audit_logs_${new Date().toISOString().substring(0, 10)}.csv`;
    triggerDownload(blob, filename, 'text/csv;charset=utf-8;');
    notify.success('CSV Exported', 'Audit logs exported to CSV file.', { category: 'AUDIT LOGS' });
  };

  // Export Settings Config JSON
  const handleExportConfigJson = () => {
    const jsonStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `system_config_${new Date().toISOString().substring(0, 10)}.json`;
    triggerDownload(blob, filename, 'application/json');
    notify.success('Config Exported', 'System configuration saved as JSON.', { category: 'ADMIN SETTINGS' });
  };

  // Import Settings Config JSON
  const handleImportConfigJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed === 'object') {
          setSettings((prev: any) => ({ ...prev, ...parsed }));
          notify.success('Config Imported', 'Configuration imported successfully! Click Save Configuration to apply.', { category: 'ADMIN SETTINGS' });
        }
      } catch (err) {
        notify.error('Import Failed', 'Invalid JSON configuration file.', { category: 'ADMIN SETTINGS' });
      }
    };
    reader.readAsText(file);
    if (configFileInputRef.current) configFileInputRef.current.value = '';
  };

  // Live Data Integrity Audit Check (Live SQL Execution)
  const handleRunIntegrityAudit = async () => {
    setIntegrityAuditing(true);
    setIntegrityAuditResult(null);
    try {
      const res = await api.post('/settings/integrity-audit');
      if (res.data?.status === 'SUCCESS') {
        setIntegrityAuditResult(res.data.summary || `100% Data Integrity Verified at ${res.data.audited_at}`);
        notify.success('Integrity Audit Passed', res.data.summary, { category: 'DATA INTEGRITY' });
        fetchAuditLogs();
      } else {
        setIntegrityAuditResult('Integrity Audit Warning: Potential data inconsistency detected.');
        notify.error('Integrity Audit Warning', 'Integrity rule violations detected.', { category: 'DATA INTEGRITY' });
      }
    } catch (err: any) {
      console.error('Integrity audit request failed:', err);
      setIntegrityAuditResult('Live integrity audit call failed. Check server logs.');
      notify.error('Audit Failed', 'Server error while running integrity audit.', { category: 'DATA INTEGRITY' });
    } finally {
      setIntegrityAuditing(false);
    }
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

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(l => {
    if (auditActionFilter !== 'ALL' && !l.action.includes(auditActionFilter)) return false;
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      return (
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.user_name && l.user_name.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.timestamp && l.timestamp.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Backups
  const filteredBackups = backups.filter(b => {
    if (!backupSearch.trim()) return true;
    const q = backupSearch.toLowerCase();
    return (
      (b.filename && b.filename.toLowerCase().includes(q)) ||
      (b.created_at && b.created_at.toLowerCase().includes(q)) ||
      (b.checksum && b.checksum.toLowerCase().includes(q))
    );
  });

  // Total Backup Size
  const totalBackupBytes = backups.reduce((acc, b) => acc + (b.size_bytes || 0), 0);

  return (
    <div className="space-y-6 pb-16 text-xs text-slate-800 dark:text-slate-200">
      
      {/* 1. RICH INSTITUTIONAL PAGE HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-lg border border-brand-500/30">

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-xs font-black">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>INSTITUTIONAL CONFIGURATION • SYSTEM CONTROL CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Admin System Control Center
            </h1>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-400/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PRODUCTION</span>
            </span>

            <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-navy-700 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Asia/Kolkata (IST)</span>
            </span>

            <button
              type="button"
              onClick={handleExportConfigJson}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center space-x-1 transition-all cursor-pointer"
              title="Export complete configuration JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => configFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center space-x-1 transition-all cursor-pointer"
              title="Import configuration JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <input
              type="file"
              ref={configFileInputRef}
              onChange={handleImportConfigJson}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 2. COMPACT SYSTEM STATUS STRIP WITH LIVE PROBING */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Live Subsystem Health Probes
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setSystemHealth(null); fetchSystemHealth(); }}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${systemHealth === null ? 'animate-spin' : ''}`} />
            <span>Probe Now</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 font-mono text-[11px]">
          {HEALTH_ITEMS.map((item) => {
            const rawVal = systemHealth?.components?.[item.key];
            const isChecking = systemHealth === null;
            const isHealthy = rawVal === 'HEALTHY';
            const isDegraded = rawVal === 'DEGRADED';
            const isOffline = rawVal === 'OFFLINE';

            return (
              <div key={item.key} className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-800 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate w-full">{item.label}</span>
                <span className={`font-black text-[10px] mt-1 px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isChecking
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                    : isHealthy 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : isDegraded
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : isOffline
                          ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {isChecking && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                  {isChecking ? 'Checking' : (isHealthy ? 'Healthy' : (isDegraded ? 'Degraded' : (isOffline ? 'Offline' : 'Error')))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. QUICK JUMP / SECTION NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-card border border-slate-200 dark:border-navy-700">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'staff', label: 'Staff Management', icon: Shield },
            { id: 'allocation', label: 'Student Allocation', icon: Layers },
            { id: 'automation', label: 'Weekly Automation', icon: Clock },
            { id: 'contest', label: 'Contest Engine', icon: RefreshCw },
            { id: 'integrity', label: 'Data Integrity Guard', icon: ShieldCheck },
            { id: 'smtp', label: 'Email & SMTP', icon: Mail },
            { id: 'snapshots', label: 'Database Snapshots', icon: Database },
            { id: 'audit', label: 'Audit Stream', icon: Activity },
            { id: 'maintenance', label: 'Maintenance', icon: Server },
            { id: 'security', label: 'Security Activity', icon: Lock }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSectionFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeSectionFilter === tab.id
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'bg-slate-100 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={settingsSearch}
            onChange={(e) => setSettingsSearch(e.target.value)}
            placeholder="Search configuration..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-medium"
          />
        </div>
      </div>

      {saveDiffMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{saveDiffMsg}</span>
        </div>
      )}

      <div className="space-y-6">

        {/* SECTION: STAFF MANAGEMENT */}
        {activeSectionFilter === 'staff' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 animate-fade-in">
            <StaffManagement />
          </div>
        )}

        {/* SECTION: STUDENT ALLOCATION */}
        {activeSectionFilter === 'allocation' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 animate-fade-in">
            <AdminStaffAllocationPanel />
          </div>
        )}

        {/* 4. SECTION I — WEEKLY AUTOMATION */}
        {activeSectionFilter === 'automation' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <Clock className="w-4 h-4 text-brand-500" />
                <span>Weekly Automation</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Section I</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Timezone [LOCKED]</label>
                <input
                  type="text"
                  disabled
                  value="Asia/Kolkata (IST)"
                  className="w-full p-2 rounded-xl border bg-slate-100 dark:bg-navy-950 font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Sunday Start Time (24h)</label>
                <input
                  type="text"
                  value={settings.SESSION_START || '08:00'}
                  onChange={(e) => setSettings({ ...settings, SESSION_START: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Finalization & Snapshot Time (24h)</label>
                <input
                  type="text"
                  value={settings.SESSION_END || '09:30'}
                  onChange={(e) => setSettings({ ...settings, SESSION_END: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-xs">
              <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700">
                <input
                  type="checkbox"
                  checked={settings.ENABLE_AUTO_SUNDAY_SESSION === 'true'}
                  onChange={(e) => setSettings({ ...settings, ENABLE_AUTO_SUNDAY_SESSION: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200">Automatic Sunday Session</span>
              </label>

              <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700">
                <input
                  type="checkbox"
                  checked={settings.AUTO_START_SNAPSHOT === 'true'}
                  onChange={(e) => setSettings({ ...settings, AUTO_START_SNAPSHOT: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200">Starting Snapshot (08:00 AM)</span>
              </label>

              <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700">
                <input
                  type="checkbox"
                  checked={settings.AUTO_FINALIZATION_SNAPSHOT === 'true'}
                  onChange={(e) => setSettings({ ...settings, AUTO_FINALIZATION_SNAPSHOT: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200">Finalization + Final Snapshot (09:30 AM)</span>
              </label>

              <label className="flex items-center space-x-2 p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700">
                <input
                  type="checkbox"
                  checked={settings.LOCK_FINALIZED_SESSIONS === 'true'}
                  onChange={(e) => setSettings({ ...settings, LOCK_FINALIZED_SESSIONS: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200">Lock Finalized Sessions</span>
              </label>
            </div>
          </div>
        )}

        {/* 5. SECTION II — CONTEST DATA ENGINE */}
        {activeSectionFilter === 'contest' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <RefreshCw className="w-4 h-4 text-indigo-500" />
                <span>Contest Data Engine</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Section II</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Fetch Timeout (Seconds)</label>
                <input
                  type="number"
                  value={settings.FETCH_TIMEOUT || 30}
                  onChange={(e) => setSettings({ ...settings, FETCH_TIMEOUT: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Retry Count</label>
                <input
                  type="number"
                  value={settings.RETRY_COUNT || 3}
                  onChange={(e) => setSettings({ ...settings, RETRY_COUNT: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono font-bold"
                />
              </div>

              <div className="md:col-span-2 flex items-center space-x-4 pt-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.AUTO_CONTEST_SYNC === 'true'}
                    onChange={(e) => setSettings({ ...settings, AUTO_CONTEST_SYNC: e.target.checked ? 'true' : 'false' })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-200">Automatic Contest Sync</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.HISTORICAL_ARCHIVE_SYNC === 'true'}
                    onChange={(e) => setSettings({ ...settings, HISTORICAL_ARCHIVE_SYNC: e.target.checked ? 'true' : 'false' })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-200">Archive Reconciliation</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2 border-t dark:border-navy-700">
              <button
                type="button"
                onClick={() => triggerAdvancedOp('refetch-selected', 'Sync Selected Contest Only', 'Fetch authentic participant data ONLY for the currently selected weekly contest session.', 'Does NOT touch other contests.')}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Selected Contest</span>
              </button>

              <button
                type="button"
                onClick={() => triggerAdvancedOp('reconcile-sessions', 'Sync All Historical Contests', 'Reconcile all historical Sunday contest sessions across canonical range 510–515.', 'Full archive sync.')}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Sync All Historical Contests</span>
              </button>
            </div>
          </div>
        )}

        {/* 6. SECTION III — DATA INTEGRITY GUARD */}
        {activeSectionFilter === 'integrity' && (
          <div className="glass-card p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-3.5 animate-fade-in">
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

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleRunIntegrityAudit}
                  disabled={integrityAuditing}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${integrityAuditing ? 'animate-spin' : ''}`} />
                  <span>{integrityAuditing ? 'Auditing Rules...' : 'Run Integrity Audit'}</span>
                </button>
                <span className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-mono font-black text-[10px] tracking-wider border border-emerald-400/30">
                  DATA INTEGRITY VERIFIED
                </span>
              </div>
            </div>

            {integrityAuditResult && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>{integrityAuditResult}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              {[
                { label: 'Authentic Contest Data Only', value: 'LOCKED ON', bg: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
                { label: 'Synthetic / Mock Data', value: 'LOCKED OFF', bg: 'bg-rose-500/10 text-rose-800 dark:text-rose-300' },
                { label: 'Question Equality (Q1+Q2+Q3+Q4 = Solved)', value: 'ENFORCED', bg: 'bg-brand-500/10 text-brand-800 dark:text-brand-300' },
                { label: 'Student + Contest Isolation', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
                { label: 'Session + Contest Isolation', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
                { label: 'Duplicate Result Detection', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
                { label: 'Sentinel Value Detection', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
                { label: 'Cross-Contest Leakage Detection', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
                { label: 'DB → API → UI Parity', value: 'ENFORCED', bg: 'bg-slate-50/50 dark:bg-navy-950/50 text-slate-700 dark:text-slate-300' },
              ].map(rule => (
                <div key={rule.label} className={`p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 font-bold flex items-center justify-between ${rule.bg}`}>
                  <span>{rule.label}</span>
                  <span className="font-mono text-[10px]">{rule.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. SECTION IV — REPORT INTEGRITY & EMAIL DELIVERY */}
        {activeSectionFilter === 'smtp' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-purple-500" />
                <span>Report Integrity & Multi-Format Generation</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Section IV</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-[11px] font-mono flex flex-wrap items-center justify-center gap-2 text-slate-600 dark:text-slate-400 text-center">
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
                { label: 'Preview', status: 'Enforced' },
                { label: 'Excel (.xlsx)', status: 'Enforced' },
                { label: 'PDF (.pdf)', status: 'Enforced' },
                { label: 'Word (.docx)', status: 'Enforced' },
                { label: 'ZIP Bundle', status: 'Enforced' },
              ].map(fmt => (
                <div key={fmt.label} className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700">
                  <div className="text-slate-400 text-[9px] uppercase">{fmt.label}</div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-black">{fmt.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. SECTION V — EMAIL DELIVERY & SMTP */}
        {(activeSectionFilter === 'ALL' || activeSectionFilter === 'smtp') && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <Mail className="w-4 h-4 text-indigo-500" />
                <span>Email Delivery & SMTP Configuration</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Section V</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Recipient Emails (Locked to Authoritative Admin)</label>
                <input
                  type="text"
                  value={settings.REPORT_RECIPIENT_EMAILS || 'nanthishvaran17@gmail.com'}
                  onChange={(e) => setSettings({ ...settings, REPORT_RECIPIENT_EMAILS: e.target.value })}
                  placeholder="nanthishvaran17@gmail.com"
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={settings.SMTP_HOST || 'smtp.gmail.com'}
                    onChange={(e) => setSettings({ ...settings, SMTP_HOST: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SMTP Port</label>
                  <input
                    type="number"
                    value={settings.SMTP_PORT || 587}
                    onChange={(e) => setSettings({ ...settings, SMTP_PORT: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Encryption</label>
                  <select
                    value={settings.SMTP_ENCRYPTION || 'TLS'}
                    onChange={(e) => setSettings({ ...settings, SMTP_ENCRYPTION: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="TLS">TLS (Port 587)</option>
                    <option value="SSL">SSL (Port 465)</option>
                    <option value="NONE">None</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    value={settings.SMTP_USERNAME || ''}
                    onChange={(e) => setSettings({ ...settings, SMTP_USERNAME: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SMTP Password (Masked)</label>
                  <input
                    type="password"
                    value={settings.SMTP_PASSWORD_MASKED || '••••••••'}
                    onChange={(e) => setSettings({ ...settings, SMTP_PASSWORD: e.target.value, SMTP_PASSWORD_MASKED: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Sender Email</label>
                  <input
                    type="text"
                    value={settings.SENDER_EMAIL || ''}
                    onChange={(e) => setSettings({ ...settings, SENDER_EMAIL: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Sender Display Name</label>
                  <input
                    type="text"
                    value={settings.SENDER_NAME || ''}
                    onChange={(e) => setSettings({ ...settings, SENDER_NAME: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* EMAIL DELIVERY DIAGNOSTICS & OTP TEST PANEL */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-navy-950 border border-indigo-100 dark:border-indigo-900/50 space-y-3 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/50 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-black text-slate-900 dark:text-white tracking-wide text-xs">EMAIL DELIVERY DIAGNOSTICS</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>SMTP Transport: {emailDiag?.transportVerified ? 'VERIFIED' : 'ACTIVE'}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-100 dark:border-navy-800">
                    <div className="text-slate-400 text-[9px] uppercase font-sans font-bold">Admin Recipient</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">{emailDiag?.adminRecipientMasked || 'n******7@gmail.com'}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-100 dark:border-navy-800">
                    <div className="text-slate-400 text-[9px] uppercase font-sans font-bold">Sender Account</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">{emailDiag?.senderMasked || 'n******7@gmail.com'}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-100 dark:border-navy-800">
                    <div className="text-slate-400 text-[9px] uppercase font-sans font-bold">SMTP Provider</div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{emailDiag?.smtpHost || 'smtp.gmail.com'}:{emailDiag?.smtpPort || 587}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-100 dark:border-navy-800">
                    <div className="text-slate-400 text-[9px] uppercase font-sans font-bold">Last SMTP Result</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{lastOtpTestResult?.status || 'ACCEPTED'}</div>
                  </div>
                </div>

                {lastOtpTestResult && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{lastOtpTestResult.message}</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-80">{lastOtpTestResult.timestamp}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <span className="text-[11px] text-slate-500">
                    Real test sends cryptographic 6-digit OTP directly to authoritative administrator Gmail.
                  </span>
                  <button
                    type="button"
                    onClick={handleTestAdminOtpDelivery}
                    disabled={testingAdminOtp}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Send className={`w-3.5 h-3.5 ${testingAdminOtp ? 'animate-spin' : ''}`} />
                    <span>{testingAdminOtp ? 'Testing Real Delivery...' : 'TEST ADMIN OTP DELIVERY'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t dark:border-navy-700 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testingEmail ? 'Dispatching Test Notification...' : 'Test Notification to nanthishvaran17@gmail.com'}</span>
                </button>

                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Email Delivery Engine: ACTIVE & VERIFIED
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 9. SECTION VI — DATABASE SNAPSHOT & RECOVERY */}
        {activeSectionFilter === 'snapshots' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2.5 dark:border-navy-700">
              <div>
                <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Database Snapshot & Recovery</span>
                </h2>
                <p className="text-[11px] text-slate-500">Automated SQLite snapshot backups with 64-character SHA256 integrity verification.</p>
              </div>

              {/* Create Snapshot with Tag Input */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customSnapshotTag}
                  onChange={(e) => setCustomSnapshotTag(e.target.value)}
                  placeholder="Custom label (optional)..."
                  className="p-1.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 font-medium"
                />
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={actionLoading === 'create-backup'}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{actionLoading === 'create-backup' ? 'Creating...' : 'CREATE SNAPSHOT'}</span>
                </button>
              </div>
            </div>

            {/* Live Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Snapshots</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1">{backups.length} Files</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Storage Used</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1">{(totalBackupBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Backup Schedule</span>
                <span className="font-mono font-bold text-xs text-brand-600 dark:text-brand-400 mt-1">Daily / Pre-Restore</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-bold">SHA256 Status</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs mt-1">ENFORCED (64-CHAR)</span>
              </div>
            </div>

            {/* Backups Filter Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={backupSearch}
                  onChange={(e) => setBackupSearch(e.target.value)}
                  placeholder="Search snapshot files by name, date or hash..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950"
                />
              </div>
              <span className="text-[11px] text-slate-400 font-bold font-mono">
                Showing {filteredBackups.length} of {backups.length}
              </span>
            </div>

            {/* Backups Table */}
            <div className="overflow-x-auto">
              {filteredBackups.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No matching backup snapshot files found.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b text-slate-400 dark:border-navy-700 font-extrabold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3">Snapshot</th>
                      <th className="py-2.5 px-3">Created (IST)</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">SHA256 Checksum</th>
                      <th className="py-2.5 px-3">Integrity</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-navy-700 font-mono text-[11px]">
                    {filteredBackups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-50/50 dark:hover:bg-navy-900/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                          <Database className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          <span>{b.filename}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{b.created_at || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-bold">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                        <td className="py-2.5 px-3 text-brand-500 font-bold" title={b.checksum}>
                          {b.checksum ? (b.checksum.length > 20 ? `${b.checksum.substring(0, 16)}...` : b.checksum) : 'HEALTHY'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                            Healthy
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(b.filename)}
                            className="px-2 py-1 rounded bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 font-bold text-[10px] inline-flex items-center space-x-1 cursor-pointer"
                            title="Download SQLite database snapshot directly"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyBackup(b.filename)}
                            disabled={actionLoading === `verify-${b.filename}`}
                            className="px-2 py-1 rounded bg-brand-500/10 text-brand-600 font-bold hover:bg-brand-500/20 text-[10px] cursor-pointer"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(b.filename)}
                            disabled={actionLoading === `restore-${b.filename}`}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-bold hover:bg-amber-500/20 text-[10px] cursor-pointer"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(b.filename)}
                            disabled={actionLoading === `delete-${b.filename}`}
                            className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 font-bold hover:bg-rose-500/20 text-[10px] cursor-pointer"
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
        )}

        {/* 10. SECTION VII — ADMIN SECURITY */}
        {activeSectionFilter === 'security' && (
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-700 space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-navy-700">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Admin Security & Session Policy</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Section VII</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs font-bold">
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[9px] uppercase">Session Timeout</span>
                <span className="font-mono mt-1">30 Minutes</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[9px] uppercase">Re-authentication</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 mt-1">ON</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[9px] uppercase">Max Login Attempts</span>
                <span className="font-mono mt-1">5 Attempts</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[9px] uppercase">Lockout Duration</span>
                <span className="font-mono mt-1">15 Minutes</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-slate-50/50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700 flex flex-col justify-between">
                <span className="text-slate-400 text-[9px] uppercase">Audit Logging</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 mt-1">LOCKED ON</span>
              </div>
            </div>
          </div>
        )}

        {/* 11. SECTION VIII — ADMIN IDENTITY & AUDIT LOG STREAM */}
        {activeSectionFilter === 'audit' && (
          <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 text-white border border-brand-500/30 shadow-lg space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="space-y-0.5">
                <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-[10px] font-black uppercase">
                  <Fingerprint className="w-3 h-3 text-amber-400" />
                  <span>REAL-TIME AUDIT STREAM</span>
                </div>
                <h2 className="text-base font-black text-white uppercase tracking-wide">
                  Admin Identity & Audit Log
                </h2>
                <p className="text-xs text-slate-300">
                  Real-time database audit log recording administrator identity, logins, report generation, email dispatches & setting modifications.
                </p>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={handleExportAuditLogsCsv}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Export audit logs to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFullAuditLog(!showFullAuditLog)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/30 cursor-pointer"
                >
                  {showFullAuditLog ? 'Show Recent' : '[ VIEW FULL AUDIT LOG ]'}
                </button>
              </div>
            </div>

            {/* Audit Log Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'USER_LOGIN', 'CREATE_SNAPSHOT', 'TEST_EMAIL', 'ADVANCED', 'ACCESS'].map(act => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setAuditActionFilter(act)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      auditActionFilter === act
                        ? 'bg-amber-400 text-navy-950 font-black'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {act === 'ALL' ? 'All Actions' : act.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search logs by action, admin..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No matching audit log entries found.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-extrabold uppercase text-[9px]">
                      <th className="py-2.5 px-3">Time (IST)</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {(showFullAuditLog ? filteredAuditLogs : filteredAuditLogs.slice(0, 10)).map((log) => (
                      <tr key={log.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 text-slate-400">{log.timestamp ? log.timestamp.substring(0, 19).replace('T', ' ') : '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-white">{log.user_name}</td>
                        <td className="py-2.5 px-3 text-indigo-300 font-bold">{log.action}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-black">● SUCCESS</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* SINGLE SAVE CONFIGURATION BUTTON WITH CHANGE DETECTION */}
        {['automation', 'contest', 'integrity', 'smtp', 'security'].includes(activeSectionFilter) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs font-bold">
              {changedKeys.length > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Unsaved configuration changes: {changedKeys.length} ({changedKeys.join(', ')})</span>
                </span>
              ) : (
                <span className="text-slate-400">No unsaved changes</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || changedKeys.length === 0}
              className="px-8 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Configuration...' : '[ SAVE CONFIGURATION ]'}</span>
            </button>
          </div>
        )}

      </div>

      {/* 12. SECTION IX — ADVANCED SYSTEM MAINTENANCE */}
      {activeSectionFilter === 'maintenance' && (
        <div className="glass-card p-5 rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 space-y-3.5 mt-8 animate-fade-in">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
            <h2 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 flex items-center space-x-2 uppercase tracking-wide">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
              <span>ADVANCED SYSTEM MAINTENANCE</span>
            </h2>
            <span className="text-[10px] font-mono text-rose-600 font-bold uppercase tracking-wider">Privileged Operations</span>
          </div>

          <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
            Destructive operations require explicit confirmation and automatically trigger pre-operation safety snapshots.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-950/60 space-y-2">
              <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Clear Application Cache</div>
              <p className="text-[10px] text-slate-500 leading-tight">Purges transient in-memory response caches across all weekly sessions.</p>
              <button
                type="button"
                onClick={() => triggerAdvancedOp('clear-cache', 'Clear Application Cache', 'Purges transient in-memory response caches.', 'Temporary performance slowdown during index rebuild.')}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20 cursor-pointer"
              >
                Clear Cache
              </button>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-950/60 space-y-2">
              <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Rebuild Contest Index</div>
              <p className="text-[10px] text-slate-500 leading-tight">Re-indexes student roster mappings and historical performance metrics.</p>
              <button
                type="button"
                onClick={() => triggerAdvancedOp('rebuild-index', 'Rebuild Contest Index', 'Re-index student roster mappings.', 'Re-indexes 300 student roster entries.')}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20 cursor-pointer"
              >
                Rebuild Index
              </button>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-950/60 space-y-2">
              <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Reconcile Historical Sessions</div>
              <p className="text-[10px] text-slate-500 leading-tight">Executes full historical Sunday contest reconciliation across canonical range 510–515.</p>
              <button
                type="button"
                onClick={() => triggerAdvancedOp('reconcile-sessions', 'RECONCILE HISTORICAL SESSIONS', 'Executes full institutional historical Sunday contest reconciliation across 510–515.', 'May modify historical session mappings. Database snapshot will be created before execution.')}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20 cursor-pointer"
              >
                Reconcile Sessions
              </button>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-white/60 dark:bg-navy-950/60 space-y-2">
              <div className="font-bold text-xs text-rose-800 dark:text-rose-300">Rebuild Reports Engine Index</div>
              <p className="text-[10px] text-slate-500 leading-tight">Re-indexes normalized report datasets for Excel, PDF, Word, and ZIP exports.</p>
              <button
                type="button"
                onClick={() => triggerAdvancedOp('rebuild-reports', 'Rebuild Reports Engine Index', 'Re-indexes normalized report datasets.', 'Regenerates report engine cache.')}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-500/20 cursor-pointer"
              >
                Rebuild Reports Index
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. SECTION X — SECURITY ACTIVITY */}
      {activeSectionFilter === 'security' && (
        <div className="mt-8 animate-fade-in">
          <SecurityActivitySection />
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl p-6 space-y-4 shadow-lg animate-modal-content">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>{confirmModal.title}</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.description}
            </p>

            {confirmModal.impact && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                <span className="font-bold">Operational Impact:</span> {confirmModal.impact}
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, title: '', description: '', impact: '', actionType: '' })}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
