import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail, Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  Trash2, Plus, Users, ChevronDown, X, Eye, Loader2, RotateCcw,
  FileSpreadsheet, FileText, Play, Pause, Settings, ShieldCheck, Sparkles,
  Filter, Search, Zap, Calendar, ArrowRight, ExternalLink, Check, CheckSquare, Square, Info
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusNotificationModal, NotificationState } from './StatusNotificationModal';

interface EmailRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  receive_weekly_reports: boolean;
  receive_hod_reports: boolean;
  receive_error_reports: boolean;
  created_at: string;
}

interface EmailLog {
  id: number;
  email_id: string;
  session_id: number | null;
  recipient: string;
  role: string;
  subject: string;
  dispatch_type: 'MANUAL' | 'AUTOMATED' | 'TEST' | string;
  provider: string;
  status: 'SENT' | 'QUEUED' | 'SENDING' | 'RETRYING' | 'FAILED' | string;
  attachment_count: number;
  total_attachment_bytes?: number;
  error_message: string | null;
  retry_count: number;
  idempotency_key?: string;
  sent_at: string | null;
  created_at: string;
}

interface WeeklySessionOption {
  sessionId: number;
  sessionDate: string;
  contestName: string;
  status: string;
}

interface ScheduleConfigData {
  schedule: {
    id: number;
    report_name: string;
    day_of_week: string;
    hour: number;
    minute: number;
    time_display: string;
    timezone: string;
    is_enabled: boolean;
    recipients: string[];
    recipients_count: number;
    next_run: string;
    last_run: string;
    last_status: string;
    last_report: string;
    last_email: string;
  };
  scheduler_status: string;
  email_service: string;
  timezone: string;
}

const ROLE_COLORS: Record<string, string> = {
  MANAGEMENT: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300',
  HOD: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300',
  DEPARTMENT_COORDINATOR: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300',
  ADMIN: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300',
  MANUAL: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
};

const STATUS_BADGES: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string; label: string }> = {
  SENT: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Delivered'
  },
  QUEUED: {
    icon: <Clock className="w-3.5 h-3.5 animate-pulse" />,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Queued'
  },
  SENDING: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    bg: 'bg-brand-50 dark:bg-brand-950/40',
    text: 'text-brand-700 dark:text-brand-300',
    border: 'border-brand-200 dark:border-brand-800',
    label: 'Sending'
  },
  RETRYING: {
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    label: 'Retrying'
  },
  FAILED: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    label: 'Failed'
  },
};

export const EmailDeliveryTab: React.FC<{ defaultSection?: 'manual' | 'automated' | 'recipients' | 'history' }> = ({
  defaultSection = 'manual'
}) => {
  const { user } = useAuth();
  const isStaff = ['faculty', 'staff'].includes(user?.role?.toLowerCase() || '');

  // Navigation & Data States
  const [activeSection, setActiveSection] = useState<'manual' | 'automated' | 'recipients' | 'history'>(defaultSection);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [sessions, setSessions] = useState<WeeklySessionOption[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfigData | null>(null);
  const [providerInfo, setProviderInfo] = useState<{
    status: string;
    active_provider: string;
    transport: string;
    is_configured: boolean;
    sender_email: string;
    timeout_seconds: number;
    max_retries: number;
    timestamp_ist?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [assignedStudentCount, setAssignedStudentCount] = useState<number | null>(null);

  // Manual Dispatch Form State
  const [selectedReportType, setSelectedReportType] = useState<string>('WEEKLY_CONTEST');
  const [isReportTypeOpen, setIsReportTypeOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState<string>('');

  // Manual Send Workflow Modals & Overlays
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateList, setDuplicateList] = useState<any[]>([]);
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [dispatchProgressStep, setDispatchProgressStep] = useState<number>(0);
  const [dispatchResult, setDispatchResult] = useState<{ status: string; message: string; count?: number } | null>(null);

  // Schedule Settings Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDay, setScheduleDay] = useState('sunday');
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(45);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Delivery Detail Drawer State
  const [selectedLogDetail, setSelectedLogDetail] = useState<EmailLog | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<number | null>(null);

  // Add Recipient Modal State
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('HOD');
  const [newDept, setNewDept] = useState('ALL');
  const [addingRecipient, setAddingRecipient] = useState(false);

  // Test Mode Diagnostics State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [testRecipient, setTestRecipient] = useState(user?.email || 'nanthishvaran17@gmail.com');
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string; provider?: string } | null>(null);

  // Log Table Filter & Search States
  const [logFilterStatus, setLogFilterStatus] = useState<string>('ALL');
  const [isLogFilterStatusOpen, setIsLogFilterStatusOpen] = useState(false);
  const [logFilterDispatchType, setLogFilterDispatchType] = useState<string>('ALL');
  const [isLogFilterTypeOpen, setIsLogFilterTypeOpen] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Dropdown States for Modals
  const [isScheduleDayOpen, setIsScheduleDayOpen] = useState(false);
  const [isScheduleHourOpen, setIsScheduleHourOpen] = useState(false);
  const [isScheduleMinuteOpen, setIsScheduleMinuteOpen] = useState(false);
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [isNewDeptOpen, setIsNewDeptOpen] = useState(false);

  useEffect(() => {
    if (defaultSection) setActiveSection(defaultSection);
  }, [defaultSection]);

  useEffect(() => {
    if (user?.email) {
      setTestRecipient(user.email);
    }
  }, [user?.email]);

  // Main Data Fetching Function
  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [rRes, lRes, sRes, pRes, schedRes] = await Promise.all([
        api.get('/email/recipients').catch(() => ({ data: [] })),
        api.get('/email/logs?limit=200').catch(() => ({ data: [] })),
        api.get('/contests/sessions').catch(() => ({ data: [] })),
        api.get('/email/provider-diagnostics').catch(() => ({ data: null })),
        api.get('/system/schedule').catch(() => ({ data: null })),
      ]);

      let recs: EmailRecipient[] = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.recipients || []);
      
      if (isStaff) {
        api.get('/students', { params: { paginated: true, limit: 1 } })
          .then(res => setAssignedStudentCount(res.data?.total))
          .catch(() => setAssignedStudentCount(null));
        
        // If caller is Staff, ensure staff can ONLY see and send to their own email
        if (user?.email) {
          const userEmailLower = user.email.toLowerCase().trim();
          const existingIdx = recs.findIndex((r: any) => (r.email || '').toLowerCase().trim() === userEmailLower);
          if (existingIdx >= 0) {
            const selfRec = recs[existingIdx];
            recs = [selfRec]; // Drop all other recipients for staff
            setSelectedRecipientEmails(new Set([selfRec.email]));
          } else {
            const selfRec: EmailRecipient = {
              id: 999999,
              name: user.name || user.username || 'My Mentoring Email',
              email: user.email,
              role: 'STAFF',
              department: typeof user.department === 'string' ? user.department : ((user.department as any)?.code || 'CSE'),
              is_active: true,
              receive_weekly_reports: true,
              receive_hod_reports: false,
              receive_error_reports: false,
              created_at: new Date().toISOString()
            };
            recs = [selfRec]; // Drop all other recipients for staff
            setSelectedRecipientEmails(new Set([selfRec.email]));
          }
        }
      } else {
        const activeEmails = new Set<string>(recs.filter((r: any) => r.is_active).map((r: any) => r.email));
        setSelectedRecipientEmails(activeEmails);
      }

      setRecipients(recs);

      const logsData = Array.isArray(lRes.data) ? lRes.data : (lRes.data?.deliveries || []);
      setLogs(logsData);

      const sessData = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.sessions || []);
      setSessions(sessData);
      if (sessData.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessData[0].sessionId);
      }

      if (pRes?.data) setProviderInfo(pRes.data);
      if (schedRes?.data) {
        setScheduleConfig(schedRes.data);
        if (schedRes.data.schedule) {
          setScheduleDay(schedRes.data.schedule.day_of_week.toLowerCase());
          setScheduleHour(schedRes.data.schedule.hour);
          setScheduleMinute(schedRes.data.schedule.minute);
          setScheduleEnabled(schedRes.data.schedule.is_enabled);
        }
      }

      const nowIST = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setLastRefreshedAt(`${nowIST} IST`);
    } catch (err) {
      console.error('Failed to load Email Operations Center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSessionId, isStaff, user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Real KPI Metrics Calculations (Derived strictly from backend data)
  const metrics = useMemo(() => {
    const totalLogs = logs.length;
    const deliveredCount = logs.filter(l => l.status === 'SENT').length;
    const failedCount = logs.filter(l => l.status === 'FAILED').length;
    const pendingCount = logs.filter(l => ['QUEUED', 'SENDING', 'RETRYING'].includes(l.status)).length;
    const activeRecipientsCount = recipients.filter(r => r.is_active).length;

    const completedAttempts = deliveredCount + failedCount;
    const successRate = completedAttempts > 0
      ? ((deliveredCount / completedAttempts) * 100).toFixed(1)
      : '100.0';

    const lastSuccessLog = logs.find(l => l.status === 'SENT');
    const lastFailedLog = logs.find(l => l.status === 'FAILED');

    return {
      totalLogs,
      deliveredCount,
      failedCount,
      pendingCount,
      activeRecipientsCount,
      successRate,
      lastSuccessTime: lastSuccessLog ? (lastSuccessLog.sent_at || lastSuccessLog.created_at) : null,
      lastFailureTime: lastFailedLog ? (lastFailedLog.sent_at || lastFailedLog.created_at) : null,
    };
  }, [logs, recipients]);

  // Format Helper for Timestamps
  const formatTimestampIST = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) + ' IST';
    } catch (_e) {
      return isoString;
    }
  };

  // Toggle Recipient Selection for Manual Dispatch
  const toggleRecipientSelection = (email: string) => {
    setSelectedRecipientEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAllRecipients = () => {
    const activeEmails = recipients.filter(r => r.is_active).map(r => r.email);
    setSelectedRecipientEmails(new Set(activeEmails));
  };

  const clearAllRecipients = () => {
    setSelectedRecipientEmails(new Set());
  };

  // Duplicate Check before Manual Dispatch
  const handleInitiateManualDispatch = async () => {
    if (selectedRecipientEmails.size === 0) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'No Recipients Selected',
        message: 'Please select at least one recipient email address before dispatching.'
      });
      return;
    }

    const emailList = Array.from(selectedRecipientEmails);
    try {
      const res = await api.post('/email/check-duplicate', {
        recipient_emails: emailList,
        session_id: selectedSessionId
      });

      if (res.data?.has_duplicates) {
        setDuplicateList(res.data.duplicates);
        setShowDuplicateModal(true);
      } else {
        setShowConfirmModal(true);
      }
    } catch (_err) {
      setShowConfirmModal(true);
    }
  };

  // Execute Manual Dispatch
  const handleExecuteManualDispatch = async () => {
    setShowConfirmModal(false);
    setShowDuplicateModal(false);
    setIsSendingManual(true);
    setDispatchProgressStep(1);

    const emailList = Array.from(selectedRecipientEmails);

    try {
      await new Promise(r => setTimeout(r, 400));
      setDispatchProgressStep(2); // Generating attachments
      await new Promise(r => setTimeout(r, 400));
      setDispatchProgressStep(3); // Connecting to Brevo

      const res = await api.post('/email/send-manual', {
        session_id: selectedSessionId,
        recipient_emails: emailList,
        custom_message: customMessage || null
      });

      setDispatchProgressStep(4);
      await new Promise(r => setTimeout(r, 300));

      if (res.data?.status === 'failed') {
        setDispatchResult({
          status: 'failed',
          message: res.data.message || 'Email dispatch failed. Please verify API key / network connection.'
        });
      } else {
        setDispatchResult({
          status: 'success',
          message: res.data?.message || `Successfully sent report to ${res.data?.dispatched_count || emailList.length} recipient(s).`,
          count: res.data?.dispatched_count || emailList.length
        });
        setNotification({
          isOpen: true,
          type: 'success',
          title: 'Report Dispatched',
          message: `Manual report email successfully sent to ${emailList.length} recipient(s) via Brevo API.`
        });
      }

      await fetchAllData(true);
    } catch (err: any) {
      const fallbackMsg = providerInfo?.active_provider === 'BREVO_API'
        ? 'Email dispatch failed. Please check Brevo API key and network connectivity.'
        : 'Email dispatch failed. Please check provider settings.';
      setDispatchResult({
        status: 'failed',
        message: err.response?.data?.detail || fallbackMsg
      });
    } finally {
      setIsSendingManual(false);
      setDispatchProgressStep(0);
    }
  };

  // Run Scheduled Job Now (Calls the exact canonical backend scheduler pipeline)
  const handleRunScheduledJobNow = async () => {
    setIsSendingManual(true);
    try {
      const res = await api.post('/system/schedule/test-run', { test_recipient: null });
      if (res.data?.success) {
        setNotification({
          isOpen: true,
          type: 'success',
          title: 'Scheduled Job Executed',
          message: `Canonical Sunday automation pipeline executed successfully! ${res.data.message || ''}`
        });
      } else {
        setNotification({
          isOpen: true,
          type: 'error',
          title: 'Job Execution Note',
          message: res.data?.message || 'Pipeline execution completed with warnings.'
        });
      }
      await fetchAllData(true);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Job Execution Failed',
        message: err.response?.data?.detail || err.message || 'Failed to trigger scheduler pipeline.'
      });
    } finally {
      setIsSendingManual(false);
    }
  };

  // Toggle Automation Pause / Resume
  const handleToggleAutomation = async () => {
    const nextState = !scheduleEnabled;
    try {
      const res = await api.post('/system/schedule/toggle', { is_enabled: nextState });
      setScheduleEnabled(nextState);
      setNotification({
        isOpen: true,
        type: 'success',
        title: nextState ? 'Automation Resumed ' : 'Automation Paused ',
        message: res.data?.message || `Sunday report automation is now ${nextState ? 'ENABLED' : 'PAUSED'}.`
      });
      await fetchAllData(true);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Toggle Failed',
        message: err.response?.data?.detail || 'Failed to update schedule status.'
      });
    }
  };

  // Save Schedule Configuration
  const handleSaveScheduleConfig = async () => {
    setSavingSchedule(true);
    try {
      const activeRecs = recipients.filter(r => r.is_active).map(r => r.email);
      const payload = {
        report_name: "Weekly Executive LeetCode Report",
        day_of_week: scheduleDay,
        hour: scheduleHour,
        minute: scheduleMinute,
        timezone: "Asia/Kolkata",
        recipients: activeRecs.length > 0 ? activeRecs : ["nanthishvaran17@gmail.com"],
        is_enabled: scheduleEnabled
      };

      const res = await api.post('/system/schedule', payload);
      setShowScheduleModal(false);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Schedule Settings Saved ',
        message: `Next automated dispatch: ${res.data?.next_run || 'Sunday 09:45 AM IST'}`
      });
      await fetchAllData(true);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Schedule Save Failed',
        message: err.response?.data?.detail || 'Failed to save schedule configuration.'
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Retry Failed Email Dispatch
  const handleRetryFailedLog = async (logId: number) => {
    setRetryingLogId(logId);
    try {
      const res = await api.post(`/email/retry/${logId}`);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Retry Queued',
        message: res.data?.message || `Queued retry attempt for dispatch #${logId}.`
      });
      await fetchAllData(true);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Retry Failed',
        message: err.response?.data?.detail || 'Could not queue retry for this email.'
      });
    } finally {
      setRetryingLogId(null);
    }
  };

  // Add Recipient Handler
  const handleCreateRecipient = async () => {
    if (!newName.trim() || !newEmail.trim() || !newEmail.includes('@')) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Invalid Input',
        message: 'Please provide a valid recipient name and email address.'
      });
      return;
    }
    setAddingRecipient(true);
    try {
      await api.post('/email/recipients', {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        department: newDept,
        receive_weekly_reports: true,
        receive_hod_reports: true,
        receive_error_reports: true
      });

      setShowAddRecipientModal(false);
      setNewName('');
      setNewEmail('');
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Recipient Added',
        message: `Successfully added ${newEmail} to report recipients.`
      });
      await fetchAllData(true);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Add Recipient',
        message: err.response?.data?.detail || 'Could not save recipient.'
      });
    } finally {
      setAddingRecipient(false);
    }
  };

  // Toggle Recipient Active/Inactive Status
  const handleToggleRecipientActive = async (id: number, currentStatus: boolean) => {
    try {
      await api.patch(`/email/recipients/${id}/status`, { active: !currentStatus });
      await fetchAllData(true);
    } catch (_err) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Status Update Failed',
        message: 'Could not update recipient status.'
      });
    }
  };

  // Delete Recipient Handler
  const handleDeleteRecipient = async (id: number) => {
    try {
      await api.delete(`/email/recipients/${id}`);
      await fetchAllData(true);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Recipient Removed',
        message: 'Recipient deleted successfully.'
      });
    } catch (_err) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to remove recipient.'
      });
    }
  };

  // Diagnostics Test Email Handler
  const handleRunDiagnosticsTest = async (isFullReport = false) => {
    if (!testRecipient.trim()) return;
    setIsTestingProvider(true);
    setTestResult(null);
    try {
      const endpoint = isFullReport ? '/email/send-manual' : '/email/test';
      const payload = isFullReport
        ? { recipient_emails: [testRecipient.trim()], is_safe_test: true, session_id: selectedSessionId }
        : { recipient: testRecipient.trim() };

      const res = await api.post(endpoint, payload);
      setTestResult({
        success: true,
        message: `${isFullReport ? 'Test report email' : 'Provider test email'} sent successfully to ${testRecipient}!`,
        provider: providerInfo?.active_provider || 'BREVO_API'
      });
      await fetchAllData(true);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Diagnostics Test Failed',
        error: err.response?.data?.detail || err.message || 'Connection error'
      });
    } finally {
      setIsTestingProvider(false);
    }
  };

  // Filtered Logs Calculation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logFilterStatus !== 'ALL' && log.status.toUpperCase() !== logFilterStatus.toUpperCase()) {
        return false;
      }
      if (logFilterDispatchType !== 'ALL' && (log.dispatch_type || 'AUTOMATED').toUpperCase() !== logFilterDispatchType.toUpperCase()) {
        return false;
      }
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const rec = (log.recipient || '').toLowerCase();
        const subj = (log.subject || '').toLowerCase();
        const msgId = (log.email_id || '').toLowerCase();
        if (!rec.includes(q) && !subj.includes(q) && !msgId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, logFilterStatus, logFilterDispatchType, logSearchQuery]);

  if (loading && !refreshing) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Loading Email Operations Center telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      
      {/* 1. PROVIDER STATUS BAR (Admins Only) */}
      {!isStaff && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Brevo Official API <span className="text-slate-300 dark:text-slate-600">•</span> HTTPS Port 443
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Active Provider: {providerInfo?.active_provider || 'brevo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Timeout</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">90s</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Retry Policy</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">3 Exponential</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Last Success</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{metrics.lastSuccessTime ? formatTimestampIST(metrics.lastSuccessTime) : 'None'}</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Refreshed</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{lastRefreshedAt || 'Just now'}</div>
              </div>
              <button
                onClick={() => fetchAllData(false)}
                disabled={refreshing}
                className="p-2 rounded-xl bg-slate-50 dark:bg-navy-800 text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 border border-slate-200 dark:border-navy-700 transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh Telemetry"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Mentoring Safe Delivery Banner */}
      {isStaff && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 dark:bg-navy-950 border border-slate-700/50 dark:border-navy-700 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xl relative overflow-hidden group">
          
          <div className="flex items-center space-x-4 relative z-10">
            <div className="p-3.5 rounded-2xl bg-slate-800/80 dark:bg-navy-800/80 text-emerald-400 border border-slate-700 dark:border-navy-700 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="text-base font-black tracking-tight text-white drop-shadow-sm">Staff Mentoring Safe Delivery Desk</h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authenticated Recipient
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 dark:text-slate-400 font-medium leading-relaxed max-w-3xl">
                All manual and scheduled reports are formatted with strictly your <strong className="text-emerald-300 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded">{assignedStudentCount !== null ? assignedStudentCount : '...'} assigned students</strong> and pre-routed to your primary staff email: <strong className="text-white font-mono font-bold tracking-tight bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">{user?.email || 'nanthishvaran17@gmail.com'}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOP KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Delivered */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.deliveredCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Confirmed Dispatches</p>
        </div>

        {/* Pending / Queued */}
        <div className="glass-card p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Pending / Queued</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.pendingCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Queued Jobs</p>
        </div>

        {/* Failed Deliveries */}
        <div className="glass-card p-4 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Failed</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.failedCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Failed Attempts</p>
        </div>

        {/* Active Recipients */}
        <div className="glass-card p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Recipients</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.activeRecipientsCount}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Configured Emails</p>
        </div>

        {/* Success Rate */}
        <div className="glass-card p-4 rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Success Rate</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.successRate}%
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Delivered / Attempts</p>
        </div>

        {/* Automation Status */}
        <div className="glass-card p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent text-left">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Automation</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
            {scheduleEnabled ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black">
                ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black">
                PAUSED
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1.5">Sunday 09:45 AM IST</p>
        </div>
      </div>

      {/* 3. SECTION TAB NAVIGATION */}
      <div className="flex items-center space-x-2 bg-slate-100 dark:bg-navy-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex-wrap gap-1">
        <button
          onClick={() => setActiveSection('manual')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'manual'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>Manual Instant Dispatch</span>
        </button>

        <button
          onClick={() => setActiveSection('automated')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'automated'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Automated Weekly Dispatch</span>
        </button>

        <button
          onClick={() => setActiveSection('recipients')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'recipients'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Report Recipients ({recipients.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'history'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Delivery History &amp; Logs ({logs.length})</span>
        </button>

        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ml-auto ${
            showDiagnostics
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Diagnostics &amp; Test Tools</span>
        </button>
      </div>

      {/* 4. DIAGNOSTICS & TEST TOOLS COLLAPSIBLE PANEL */}
      {showDiagnostics && (
        <div className="glass-card p-6 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-black text-sm">
              <Settings className="w-4 h-4" />
              <span>Provider Diagnostics &amp; Sandbox Test Tools</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              Test Mode Active (Does not alter Sunday schedule)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Test Email Card */}
            <div className="p-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Send Quick Test Email
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Verify Brevo API connectivity and transactional email dispatch to a specific test address.
              </p>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Enter test recipient email..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => handleRunDiagnosticsTest(false)}
                  disabled={isTestingProvider}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isTestingProvider ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Quick Test</span>
                </button>
              </div>
            </div>

            {/* Send Full Test Report Card */}
            <div className="p-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Send Complete Test Report Package
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Generates full multi-sheet Excel + PDF + DOCX report and dispatches to test recipient in safe mode.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRunDiagnosticsTest(true)}
                  disabled={isTestingProvider}
                  className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isTestingProvider ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  <span>Send Full Test Report to {testRecipient}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Test Execution Feedback */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'}`}>
              <div className="flex items-center justify-between">
                <span>{testResult.message}</span>
                {testResult.provider && <span className="text-[10px] uppercase tracking-wider opacity-80">Provider: {testResult.provider}</span>}
              </div>
              {testResult.error && <p className="text-[11px] font-normal mt-1 opacity-90">{testResult.error}</p>}
            </div>
          )}
        </div>
      )}

      {/* 5. MANUAL INSTANT DISPATCH PANEL */}
      {activeSection === 'manual' && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-brand-500/30 shadow-xl space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-black">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>MANUAL DISPATCH WORKFLOW</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Manual Instant Dispatch
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-2xl">
                Send a report immediately to selected recipients. This action runs once and does not modify the recurring Sunday schedule.
              </p>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-right">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Delivery Mode</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Immediate One-Time
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Report Selection & Attachments */}
            <div className="space-y-5 lg:col-span-1">
              <div className="relative z-30">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-2">
                  Select Institutional Report
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setIsReportTypeOpen(!isReportTypeOpen); setIsSessionOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${isReportTypeOpen ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                  >
                    <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {{
                        'WEEKLY_CONTEST': 'Weekly Contest Executive Report (Excel + PDF + Word)',
                        'EXECUTIVE_SUMMARY': 'Executive Performance Summary',
                        'DEPARTMENT_MATRIX': 'Department Contest Performance Matrix'
                      }[selectedReportType] || selectedReportType}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isReportTypeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isReportTypeOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                      {[
                        { value: 'WEEKLY_CONTEST', label: 'Weekly Contest Executive Report (Excel + PDF + Word)', color: 'text-brand-500' },
                        { value: 'EXECUTIVE_SUMMARY', label: 'Executive Performance Summary', color: 'text-indigo-500' },
                        { value: 'DEPARTMENT_MATRIX', label: 'Department Contest Performance Matrix', color: 'text-purple-500' }
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedReportType(opt.value); setIsReportTypeOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedReportType === opt.value ? 'bg-brand-50 dark:bg-brand-900/40' : 'hover:bg-slate-50 dark:hover:bg-navy-800'}`}
                        >
                          <FileText className={`w-4 h-4 shrink-0 ${opt.color}`} />
                          <span className={`text-xs truncate flex-1 ${selectedReportType === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-bold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {selectedReportType === opt.value && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative z-20">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-2">
                  Target Weekly Contest Session
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setIsSessionOpen(!isSessionOpen); setIsReportTypeOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${isSessionOpen ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                  >
                    <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {sessions.find(s => s.sessionId === selectedSessionId) 
                        ? `${sessions.find(s => s.sessionId === selectedSessionId)?.sessionDate} — ${sessions.find(s => s.sessionId === selectedSessionId)?.contestName} (FINALIZED)`
                        : 'Select a session'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isSessionOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isSessionOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                      {sessions.map(s => (
                        <button key={s.sessionId} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedSessionId(s.sessionId); setIsSessionOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedSessionId === s.sessionId ? 'bg-brand-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-navy-800'}`}
                        >
                          <span className={`text-xs truncate flex-1 ${selectedSessionId === s.sessionId ? 'font-bold' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                            {s.sessionDate} — {s.contestName} (FINALIZED)
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Attachment Cards */}
              <div className="p-4 bg-slate-50 dark:bg-navy-950/60 rounded-2xl border border-slate-200 dark:border-navy-800 space-y-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Generated Attachments (Dynamic Bundle)
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <FileSpreadsheet className="w-4 h-4" /> Performance_Report.xlsx
                    </span>
                    <span className="text-[10px] text-slate-400">Excel Multi-Sheet</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <FileText className="w-4 h-4" /> Executive_Summary.pdf
                    </span>
                    <span className="text-[10px] text-slate-400">Printable PDF</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <span className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                      <FileText className="w-4 h-4" /> Institutional_Summary.docx
                    </span>
                    <span className="text-[10px] text-slate-400">Word DOCX</span>
                  </div>
                </div>
              </div>

              {/* Custom Optional Message */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Custom Administrator Note (Optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add an optional note to include in the email body..."
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Right Column: Recipient Selection Grid */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 block">
                    Select Target Recipients
                  </label>
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    {selectedRecipientEmails.size} of {recipients.length} recipients selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllRecipients}
                    className="text-[11px] font-extrabold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                  >
                    Select All Active
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearAllRecipients}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {/* Recipient Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {recipients.map(r => {
                  const isSelected = selectedRecipientEmails.has(r.email);
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleRecipientSelection(r.email)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-brand-500/10 border-brand-500/40 shadow-sm'
                          : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 hover:border-brand-500/30'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="text-brand-600 dark:text-brand-400">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-brand-500" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {r.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {r.email}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${ROLE_COLORS[r.role] || ROLE_COLORS.MANUAL}`}>
                        {r.role}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-brand-400" />
                  <span>Immediate dispatch via Brevo v3 API (HTTPS Port 443)</span>
                </div>

                <button
                  onClick={handleInitiateManualDispatch}
                  disabled={selectedRecipientEmails.size === 0 || isSendingManual}
                  className="px-8 py-3.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-brand-500/25 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSendingManual ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 text-amber-300" />
                  )}
                  <span>Send Report Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. AUTOMATED WEEKLY DISPATCH CONTROL CENTER */}
      {activeSection === 'automated' && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-amber-500/30 shadow-xl space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black">
                <Calendar className="w-3.5 h-3.5" />
                <span>AUTOMATED CRON ENGINE</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Automated Weekly Dispatch Control Center
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-2xl">
                Automatically generate and deliver the institutional executive report every Sunday according to the configured schedule.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {scheduleEnabled ? (
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  AUTOMATION ACTIVE
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black flex items-center gap-1.5">
                  AUTOMATION PAUSED
                </span>
              )}
            </div>
          </div>

          {/* Cards Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Schedule Configuration Overview */}
            <div className="p-5 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-500" /> Schedule Profile
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Frequency:</span>
                  <span className="font-black text-slate-900 dark:text-white">Weekly</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Trigger Day:</span>
                  <span className="font-black text-slate-900 dark:text-white">Sunday</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Trigger Time:</span>
                  <span className="font-black text-brand-600 dark:text-brand-400 font-mono">08:00 AM / 09:45 AM</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Timezone:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">IST — Asia/Kolkata</span>
                </div>
              </div>
            </div>

            {/* Next Automated Run Card */}
            <div className="p-5 bg-gradient-to-br from-brand-500/10 to-indigo-500/10 rounded-3xl border border-brand-500/30 space-y-3">
              <h3 className="text-xs font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4" /> Next Automated Dispatch
              </h3>

              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {scheduleConfig?.schedule?.next_run || 'Sunday, 08:00 AM IST'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                  Strict Asia/Kolkata Execution Window
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-brand-500/20">
                <span className="text-slate-400">Status:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  Scheduled
                </span>
              </div>
            </div>

            {/* Last Execution Run Summary */}
            <div className="p-5 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-500" /> Last Execution Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Last Execution:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {scheduleConfig?.schedule?.last_run || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {scheduleConfig?.schedule?.last_status || 'SUCCESS'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Last Report:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                    {scheduleConfig?.schedule?.last_report || 'Weekly_Report.xlsx'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Automation Control Buttons Bar */}
          <div className="p-5 bg-slate-50 dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-navy-800 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunScheduledJobNow}
                disabled={isSendingManual}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSendingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>▶ Run Scheduled Job Now</span>
              </button>

              <button
                onClick={handleToggleAutomation}
                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  scheduleEnabled
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {scheduleEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{scheduleEnabled ? 'Pause Automation' : '▶ Resume Automation'}</span>
              </button>
            </div>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-5 py-3 bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-900 dark:text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Schedule Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. REPORT RECIPIENTS MANAGEMENT PANEL */}
      {activeSection === 'recipients' && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-teal-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Report Recipients Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Configure authorized management, HOD, and coordinator contact emails for institutional report dispatches.
              </p>
            </div>

            <button
              onClick={() => setShowAddRecipientModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-teal-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Recipient</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipients.map(r => (
              <div
                key={r.id}
                className={`p-5 rounded-3xl border transition-all space-y-3 ${
                  r.is_active
                    ? 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 shadow-md'
                    : 'bg-slate-50 dark:bg-navy-950/60 border-slate-200 dark:border-navy-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {r.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {r.email}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${ROLE_COLORS[r.role] || ROLE_COLORS.MANUAL}`}>
                    {r.role}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400">Department: <strong>{r.department || 'ALL'}</strong></span>
                  <button
                    onClick={() => handleToggleRecipientActive(r.id, r.is_active)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer ${
                      r.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-slate-200 dark:bg-navy-800 text-slate-500'
                    }`}
                  >
                    {r.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleDeleteRecipient(r.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Remove Recipient"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. DELIVERY HISTORY & LOG DRAWER */}
      {activeSection === 'history' && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-purple-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Delivery Audit Logs &amp; Traceability
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Real-time delivery audit logs, retry execution, message IDs, and provider response diagnostics.
              </p>
            </div>

            <button
              onClick={() => fetchAllData(true)}
              className="px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search recipient, subject, or message ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <div className="relative z-20">
                <button
                  type="button"
                  onClick={() => { setIsLogFilterStatusOpen(!isLogFilterStatusOpen); setIsLogFilterTypeOpen(false); }}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${isLogFilterStatusOpen ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                >
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {{
                      'ALL': 'All Statuses',
                      'SENT': 'Delivered',
                      'FAILED': 'Failed',
                      'QUEUED': 'Queued',
                      'RETRYING': 'Retrying'
                    }[logFilterStatus] || logFilterStatus}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isLogFilterStatusOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLogFilterStatusOpen && (
                  <div className="absolute z-[200] top-full left-0 mt-2 w-48 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                    {[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'SENT', label: 'Delivered' },
                      { value: 'FAILED', label: 'Failed' },
                      { value: 'QUEUED', label: 'Queued' },
                      { value: 'RETRYING', label: 'Retrying' }
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setLogFilterStatus(opt.value); setIsLogFilterStatusOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${logFilterStatus === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                      >
                        <span className="text-xs truncate">{opt.label}</span>
                        {logFilterStatus === opt.value && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative z-20">
                <button
                  type="button"
                  onClick={() => { setIsLogFilterTypeOpen(!isLogFilterTypeOpen); setIsLogFilterStatusOpen(false); }}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${isLogFilterTypeOpen ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                >
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {{
                      'ALL': 'All Types',
                      'MANUAL': 'Manual',
                      'AUTOMATED': 'Automated',
                      'TEST': 'Test'
                    }[logFilterDispatchType] || logFilterDispatchType}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isLogFilterTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLogFilterTypeOpen && (
                  <div className="absolute z-[200] top-full left-0 mt-2 w-48 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                    {[
                      { value: 'ALL', label: 'All Types' },
                      { value: 'MANUAL', label: 'Manual' },
                      { value: 'AUTOMATED', label: 'Automated' },
                      { value: 'TEST', label: 'Test' }
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setLogFilterDispatchType(opt.value); setIsLogFilterTypeOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${logFilterDispatchType === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                      >
                        <span className="text-xs truncate">{opt.label}</span>
                        {logFilterDispatchType === opt.value && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-navy-800">
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Report / Subject</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Sent At (IST)</th>
                  <th className="py-3.5 px-4">Provider</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      No delivery logs match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const statusCfg = STATUS_BADGES[log.status] || STATUS_BADGES.QUEUED;
                    const isFailed = log.status === 'FAILED';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-900/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.icon}
                            <span>{statusCfg.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {log.recipient}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-[240px]" title={log.subject}>
                          {log.subject}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                            log.dispatch_type === 'MANUAL' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            log.dispatch_type === 'TEST' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
                            'bg-brand-500/10 text-brand-600 border border-brand-500/20'
                          }`}>
                            {log.dispatch_type || 'AUTOMATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                          {formatTimestampIST(log.sent_at || log.created_at)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          Brevo v3
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedLogDetail(log)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>

                          {isFailed && (
                            <button
                              onClick={() => handleRetryFailedLog(log.id)}
                              disabled={retryingLogId === log.id}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition-all"
                            >
                              {retryingLogId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. DELIVERY DETAIL DRAWER / MODAL */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl max-w-lg w-full p-6 shadow-lg space-y-5 relative">
            <button
              onClick={() => setSelectedLogDetail(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Delivery Diagnostics Detail
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Message ID: {selectedLogDetail.email_id}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Delivery Status:</span>
                <span className={`font-black ${selectedLogDetail.status === 'SENT' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {selectedLogDetail.status === 'SENT' ? 'DELIVERED' : 'FAILED'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Recipient:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedLogDetail.recipient}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Dispatch Type:</span>
                <span className="font-black text-brand-600 dark:text-brand-400">{selectedLogDetail.dispatch_type || 'AUTOMATED'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Provider &amp; Transport:</span>
                <span className="font-mono text-slate-900 dark:text-white">Brevo v3 API (HTTPS Port 443)</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Sent Timestamp:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatTimestampIST(selectedLogDetail.sent_at || selectedLogDetail.created_at)}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Attachments:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedLogDetail.attachment_count} files ({((selectedLogDetail.total_attachment_bytes || 0) / 1024).toFixed(1)} KB)</span>
              </div>

              {selectedLogDetail.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 space-y-1">
                  <span className="font-black block uppercase text-[10px]">Error Details / Diagnostics</span>
                  <p className="font-mono text-[11px]">{selectedLogDetail.error_message}</p>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black hover:bg-slate-200 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. CONFIRMATION & DUPLICATE MODALS */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl max-w-md w-full p-6 shadow-lg space-y-4">
            <div className="flex items-center space-x-3 text-brand-600 dark:text-brand-400">
              <Zap className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm Manual Dispatch</h3>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>You are about to send the manual report immediately to <strong>{selectedRecipientEmails.size} selected recipient(s)</strong>.</p>
              <p className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                Note: This is a manual one-time action and will <strong>NOT</strong> modify or replace the recurring Sunday automation schedule.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteManualDispatch}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-brand-500/25 hover:from-brand-500 hover:to-indigo-500 cursor-pointer"
              >
                Yes, Send Report Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl max-w-md w-full p-6 shadow-lg space-y-4">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Duplicate Delivery Detected</h3>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>This report has already been successfully delivered to target recipients:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2.5 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-navy-800 text-[11px] font-mono">
                {duplicateList.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{d.recipient}</span>
                    <span className="text-slate-400">{formatTimestampIST(d.sent_at)}</span>
                  </div>
                ))}
              </div>
              <p className="font-bold text-amber-700 dark:text-amber-300">
                Do you still want to re-send this report?
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteManualDispatch}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-amber-600/25 cursor-pointer"
              >
                Send Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. SCHEDULE SETTINGS MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl max-w-md w-full p-6 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-500" />
                <span>Automated Schedule Settings</span>
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-black uppercase text-slate-500 mb-1">Automation Status</label>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    scheduleEnabled
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  }`}
                >
                  {scheduleEnabled ? 'AUTOMATION ENABLED' : 'AUTOMATION PAUSED'}
                </button>
              </div>

              <div>
                <label className="block font-black uppercase text-slate-500 mb-1">Trigger Day</label>
                <div className="relative z-40">
                  <button
                    type="button"
                    onClick={() => { setIsScheduleDayOpen(!isScheduleDayOpen); setIsScheduleHourOpen(false); setIsScheduleMinuteOpen(false); }}
                    className={`flex items-center justify-between w-full p-2.5 bg-white dark:bg-navy-950 border rounded-xl text-left transition-all focus:outline-none ${isScheduleDayOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {{
                        'sunday': 'Sunday (Official Weekly Window)',
                        'monday': 'Monday',
                        'saturday': 'Saturday'
                      }[scheduleDay] || scheduleDay}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isScheduleDayOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isScheduleDayOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                      {[
                        { value: 'sunday', label: 'Sunday (Official Weekly Window)' },
                        { value: 'monday', label: 'Monday' },
                        { value: 'saturday', label: 'Saturday' }
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setScheduleDay(opt.value); setIsScheduleDayOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${scheduleDay === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                        >
                          <span className="text-xs truncate">{opt.label}</span>
                          {scheduleDay === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-slate-500 mb-1">Hour (IST)</label>
                  <div className="relative z-30">
                    <button
                      type="button"
                      onClick={() => { setIsScheduleHourOpen(!isScheduleHourOpen); setIsScheduleDayOpen(false); setIsScheduleMinuteOpen(false); }}
                      className={`flex items-center justify-between w-full p-2.5 bg-white dark:bg-navy-950 border rounded-xl text-left transition-all focus:outline-none ${isScheduleHourOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {{
                          8: '08:00 AM IST',
                          9: '09:00 AM IST',
                          10: '10:00 AM IST'
                        }[scheduleHour] || scheduleHour}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isScheduleHourOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isScheduleHourOpen && (
                      <div className="absolute z-[200] top-full left-0 right-0 mt-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                        {[
                          { value: 8, label: '08:00 AM IST' },
                          { value: 9, label: '09:00 AM IST' },
                          { value: 10, label: '10:00 AM IST' }
                        ].map(opt => (
                          <button key={opt.value} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setScheduleHour(opt.value); setIsScheduleHourOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${scheduleHour === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                          >
                            <span className="text-xs truncate">{opt.label}</span>
                            {scheduleHour === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-black uppercase text-slate-500 mb-1">Minute (IST)</label>
                  <div className="relative z-30">
                    <button
                      type="button"
                      onClick={() => { setIsScheduleMinuteOpen(!isScheduleMinuteOpen); setIsScheduleHourOpen(false); setIsScheduleDayOpen(false); }}
                      className={`flex items-center justify-between w-full p-2.5 bg-white dark:bg-navy-950 border rounded-xl text-left transition-all focus:outline-none ${isScheduleMinuteOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {{
                          0: ':00 AM',
                          15: ':15 AM',
                          30: ':30 AM',
                          45: ':45 AM'
                        }[scheduleMinute] || scheduleMinute}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isScheduleMinuteOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isScheduleMinuteOpen && (
                      <div className="absolute z-[200] top-full left-0 right-0 mt-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                        {[
                          { value: 0, label: ':00 AM' },
                          { value: 15, label: ':15 AM' },
                          { value: 30, label: ':30 AM' },
                          { value: 45, label: ':45 AM' }
                        ].map(opt => (
                          <button key={opt.value} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setScheduleMinute(opt.value); setIsScheduleMinuteOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${scheduleMinute === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                          >
                            <span className="text-xs truncate">{opt.label}</span>
                            {scheduleMinute === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-navy-800 text-slate-500">
                Timezone strictly enforced: <strong>Asia/Kolkata (IST)</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveScheduleConfig}
                disabled={savingSchedule}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-brand-500/25 cursor-pointer disabled:opacity-50"
              >
                {savingSchedule ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. ADD RECIPIENT MODAL */}
      {showAddRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-3xl max-w-md w-full p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-500" />
                <span>Add Report Recipient</span>
              </h3>
              <button onClick={() => setShowAddRecipientModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. S. Karthik"
                  className="w-full p-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-black uppercase text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. hod.cse@nandhaengg.org"
                  className="w-full p-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-slate-500 mb-1">Role</label>
                  <div className="relative z-40">
                    <button
                      type="button"
                      onClick={() => { setIsNewRoleOpen(!isNewRoleOpen); setIsNewDeptOpen(false); }}
                      className={`flex items-center justify-between w-full p-2.5 bg-white dark:bg-navy-950 border rounded-xl text-left transition-all focus:outline-none ${isNewRoleOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {{
                          'HOD': 'HOD',
                          'MANAGEMENT': 'MANAGEMENT',
                          'DEPARTMENT_COORDINATOR': 'COORDINATOR',
                          'ADMIN': 'ADMIN'
                        }[newRole] || newRole}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isNewRoleOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isNewRoleOpen && (
                      <div className="absolute z-[200] top-full left-0 right-0 mt-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                        {[
                          { value: 'HOD', label: 'HOD' },
                          { value: 'MANAGEMENT', label: 'MANAGEMENT' },
                          { value: 'DEPARTMENT_COORDINATOR', label: 'COORDINATOR' },
                          { value: 'ADMIN', label: 'ADMIN' }
                        ].map(opt => (
                          <button key={opt.value} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setNewRole(opt.value); setIsNewRoleOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${newRole === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                          >
                            <span className="text-xs truncate">{opt.label}</span>
                            {newRole === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-black uppercase text-slate-500 mb-1">Department</label>
                  <div className="relative z-30">
                    <button
                      type="button"
                      onClick={() => { setIsNewDeptOpen(!isNewDeptOpen); setIsNewRoleOpen(false); }}
                      className={`flex items-center justify-between w-full p-2.5 bg-white dark:bg-navy-950 border rounded-xl text-left transition-all focus:outline-none ${isNewDeptOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {{
                          'ALL': 'ALL (College-wide)',
                          'CSE(CS)': 'CSE(CS)',
                          'CSE(IoT)': 'CSE(IoT)'
                        }[newDept] || newDept}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isNewDeptOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isNewDeptOpen && (
                      <div className="absolute z-[200] top-full left-0 right-0 mt-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                        {[
                          { value: 'ALL', label: 'ALL (College-wide)' },
                          { value: 'CSE(CS)', label: 'CSE(CS)' },
                          { value: 'CSE(IoT)', label: 'CSE(IoT)' }
                        ].map(opt => (
                          <button key={opt.value} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setNewDept(opt.value); setIsNewDeptOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${newDept === opt.value ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-black' : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'}`}
                          >
                            <span className="text-xs truncate">{opt.label}</span>
                            {newDept === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowAddRecipientModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateRecipient}
                disabled={addingRecipient}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-teal-600/25 cursor-pointer disabled:opacity-50"
              >
                {addingRecipient ? 'Adding...' : 'Add Recipient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Status Notification Modal */}
      {notification && (
        <StatusNotificationModal
          notification={notification}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};
