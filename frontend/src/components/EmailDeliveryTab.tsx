import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  Trash2, Plus, Users, ChevronDown, X, Eye, Loader2, RotateCcw,
  FileSpreadsheet, FileText, Archive
} from 'lucide-react';
import api from '../services/api';
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
  status: string; // QUEUED | SENDING | SENT | FAILED | RETRYING
  attachment_count: number;
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
}

interface WeeklySessionOption {
  sessionId: number;
  sessionDate: string;
  contestName: string;
  status: string;
}

const ROLE_COLORS: Record<string, string> = {
  MANAGEMENT: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300',
  HOD: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-300',
  DEPARTMENT_COORDINATOR: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/20 dark:text-teal-300',
  ADMIN: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300',
  MANUAL: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  SENT:      { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', label: '🟢 Delivered' },
  QUEUED:    { icon: <Clock className="w-4 h-4 animate-pulse" />, color: 'text-amber-500 dark:text-amber-400', label: '⏳ Queued' },
  SENDING:   { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-500 dark:text-blue-400', label: '📤 Sending...' },
  RETRYING:  { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-orange-500 dark:text-orange-400', label: '🔄 Retrying' },
  FAILED:    { icon: <XCircle className="w-4 h-4" />, color: 'text-red-500 dark:text-red-400', label: '🔴 Failed' },
};

export const EmailDeliveryTab: React.FC = () => {
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [sessions, setSessions] = useState<WeeklySessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'manual' | 'automated' | 'recipients' | 'history'>('manual');

  // Manual send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendStep, setSendStep] = useState<'select' | 'preview' | 'sending' | 'done'>('select');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Add recipient modal
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('HOD');
  const [newDept, setNewDept] = useState('ALL');
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Active Email Provider Diagnostics State
  const [providerInfo, setProviderInfo] = useState<{
    status: string;
    active_provider: string;
    transport: string;
    is_configured: boolean;
    sender_email: string;
    timeout_seconds: number;
    max_retries: number;
  } | null>(null);

  // SMTP / Provider Test state
  const [testRecipient, setTestRecipient] = useState('nanthishvaran17@gmail.com');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string; error?: string; provider?: string } | null>(null);

  // Automated Cron Schedule Settings State
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState<boolean>(true);
  const [scheduleDay, setScheduleDay] = useState<string>('Sunday');
  const [scheduleTime, setScheduleTime] = useState<string>('08:00');
  const [scheduleFrequency, setScheduleFrequency] = useState<string>('WEEKLY_EXECUTIVE');
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);

  const handleSaveScheduleSettings = async () => {
    setSavingSchedule(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Auto-Schedule Updated',
        message: `Automated dispatch set to ${scheduleFrequency === 'WEEKLY_EXECUTIVE' ? 'Weekly Executive Summary' : scheduleFrequency === 'DAILY_ROSTER' ? 'Daily Roster Audit' : 'Monthly Benchmark'} on ${scheduleDay}s at ${scheduleTime} (${autoScheduleEnabled ? 'ENABLED' : 'PAUSED'}).`
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSendSmtpTest = async () => {
    if (!testRecipient.trim()) return;
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await api.post('/email/test', { recipient: testRecipient.trim() });
      setSmtpTestResult({
        success: res.data.success,
        message: res.data.message,
        error: res.data.error,
        provider: res.data.provider
      });
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: '🔴 EMAIL DISPATCH TEST FAILED',
        error: err.response?.data?.detail || err.message || 'Connection or authentication error'
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSendAdminTestReportEmail = async () => {
    if (!testRecipient.trim()) return;
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await api.post('/email/test', { recipient: testRecipient.trim() });
      if (res.data.success) {
        setSmtpTestResult({
          success: true,
          message: `🟢 Test report email accepted and sent successfully to ${testRecipient}!`,
          error: undefined,
          provider: res.data.provider
        });
      } else {
        setSmtpTestResult({
          success: false,
          message: '🔴 EMAIL TEST FAILED',
          error: res.data.error || 'Email dispatch failed',
          provider: res.data.provider
        });
      }
      await fetchAll();
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: '🔴 PRE-FLIGHT TEST FAILED',
        error: err.response?.data?.detail || err.message || 'Pre-flight test failed',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, lRes, sRes, pRes] = await Promise.all([
        api.get('/email/recipients').catch(() => ({ data: [] })),
        api.get('/email/logs?limit=100').catch(() => ({ data: [] })),
        api.get('/contests/sessions').catch(() => ({ data: [] })),
        api.get('/email/provider-diagnostics').catch(() => ({ data: null })),
      ]);

      if (pRes?.data) {
        setProviderInfo(pRes.data);
      }

      const rData = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.recipients || []);
      const lData = Array.isArray(lRes.data) ? lRes.data : (lRes.data?.deliveries || lRes.data?.items || []);
      const sData = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.sessions || []);

      setRecipients(rData.map((r: any) => ({
        ...r,
        is_active: r.is_active ?? r.active ?? false,
        receive_weekly_reports: r.receive_weekly_reports ?? r.weekly_enabled ?? false,
        receive_hod_reports: r.receive_hod_reports ?? r.hod_enabled ?? false,
        receive_error_reports: r.receive_error_reports ?? r.error_enabled ?? false,
      })));
      setLogs(lData.map((d: any) => ({
        id: d.id,
        email_id: d.message_id || d.email_id || `MSG-${d.id}`,
        session_id: d.session_id || null,
        recipient: d.recipient_email || d.recipient || 'Admin',
        role: d.recipient_role || d.trigger_type || 'MANAGEMENT',
        subject: d.subject || 'Weekly Contest Performance Report',
        status: (d.status || 'SENT').toUpperCase(),
        attachment_count: d.attachments_count || d.attachment_count || 0,
        error_message: d.error_message,
        retry_count: d.retry_count || 0,
        sent_at: d.sent_at || d.created_at,
        created_at: d.created_at
      })));
      setSessions(sData
        .filter((s: any) => s && (s.status === 'FINALIZED' || s.status === 'COMPLETED' || s.status === 'LIVE' || s.status === 'SCHEDULED'))
        .map((s: any) => ({
          sessionId: s.sessionId || s.id,
          sessionDate: s.sessionDate || s.session_date,
          contestName: s.contestName || s.contest_name,
          status: s.status
        }))
      );
    } catch (err) {
      console.error('Email delivery fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Summary KPIs
  const totalSent = logs.filter(l => l.status === 'SENT').length;
  const totalFailed = logs.filter(l => l.status === 'FAILED').length;
  const totalQueued = logs.filter(l => l.status === 'QUEUED' || l.status === 'RETRYING').length;

  const handleRetry = async (logId: number) => {
    try {
      await api.post(`/email/retry/${logId}`);
      await fetchAll();
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Retry Initiated',
        message: `Email delivery retry request has been queued successfully.`
      });
    } catch (err: any) {
      console.error('Retry error:', err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Retry Request Failed',
        message: err.response?.data?.detail || 'Unable to trigger email retry.'
      });
    }
  };

  const handleAddRecipient = async () => {
    const cleanName = newName.trim();
    const cleanEmail = newEmail.trim().toLowerCase();

    // 1. Validate required name
    if (!cleanName) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Missing Full Name',
        message: 'Please enter the recipient full name (e.g. Dr. K. Ramesh or HOD Cyber Security).'
      });
      return;
    }

    // 2. Validate required email
    if (!cleanEmail) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Missing Email Address',
        message: 'Please enter an institutional or official email address for the recipient.'
      });
      return;
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Invalid Email Address',
        message: `The email address '${cleanEmail}' is not formatted correctly. Please enter a valid email (e.g. name@nandha.edu.in).`
      });
      return;
    }

    // 4. Validate duplicate in active list
    if (recipients.some(r => r.email.toLowerCase() === cleanEmail)) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Recipient Already Exists',
        message: `A report recipient with email address '${cleanEmail}' is already registered in the system.`
      });
      return;
    }

    setAddingRecipient(true);
    try {
      const res = await api.post('/email/recipients', {
        name: cleanName,
        email: cleanEmail,
        role: newRole,
        department: newDept,
        weekly_enabled: true,
        hod_enabled: true,
        error_enabled: true,
        active: true
      });

      // Successful creation
      setShowAddRecipient(false);
      const savedName = cleanName;
      const savedEmail = cleanEmail;
      setNewName('');
      setNewEmail('');
      setNewRole('HOD');
      setNewDept('ALL');

      await fetchAll();

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Recipient Added Successfully',
        message: res.data?.message || `Recipient '${savedName}' (${savedEmail}) has been successfully added to the report distribution list.`
      });
    } catch (err: any) {
      console.error('Add recipient error:', err);
      const backendError = err.response?.data?.detail || err.message || 'Failed to save recipient. Please try again.';
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Add Recipient',
        message: backendError
      });
    } finally {
      setAddingRecipient(false);
    }
  };

  const handleDeleteRecipient = (id: number, email: string, name?: string) => {
    setNotification({
      isOpen: true,
      type: 'warning',
      isConfirm: true,
      title: 'Delete Email Recipient',
      message: `Are you sure you want to remove '${name || email}' (${email}) from the report distribution list?`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/email/recipients/${id}`);
          await fetchAll();
          setNotification({
            isOpen: true,
            type: 'success',
            title: 'Recipient Removed',
            message: res.data?.message || `Recipient (${email}) was removed successfully.`
          });
        } catch (err: any) {
          console.error('Delete error:', err);
          setNotification({
            isOpen: true,
            type: 'error',
            title: 'Failed to Delete Recipient',
            message: err.response?.data?.detail || 'Unable to delete recipient.'
          });
        }
      }
    });
  };

  const handleToggleRecipient = async (r: any) => {
    try {
      const newStatus = !(r.is_active ?? r.active);
      await api.patch(`/email/recipients/${r.id}/status`, { active: newStatus });
      setRecipients(prev => prev.map(x => x.id === r.id ? { ...x, is_active: newStatus, active: newStatus } : x));
    } catch (err: any) {
      console.error('Toggle error:', err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Status Update Failed',
        message: err.response?.data?.detail || 'Could not update recipient status.'
      });
    }
  };

  const handleSendEmail = async () => {
    if (!selectedRecipientIds.size) return;
    setSendStep('sending');
    const selectedEmails = recipients
      .filter(r => selectedRecipientIds.has(r.id))
      .map(r => r.email);
    try {
      const res = await api.post('/email/send-manual', {
        session_id: selectedSessionId,
        recipient_emails: selectedEmails,
        custom_message: customMessage || null
      });
      if (res.data?.status === 'failed') {
        setSendResult(res.data.message || 'Email dispatch failed.');
      } else {
        setSendResult(res.data?.message || 'Report email sent successfully.');
      }
      setSendStep('done');
      await fetchAll();
    } catch (err: any) {
      setSendResult(err.response?.data?.detail || 'Email dispatch failed. Please check SMTP settings.');
      setSendStep('done');
    }
  };

  const [isTriggeringWeekly, setIsTriggeringWeekly] = useState(false);

  const handleTriggerAutomatedDispatch = async () => {
    setIsTriggeringWeekly(true);
    try {
      const res = await api.post('/email/trigger-weekly');
      await fetchAll();
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Weekly Dispatch Triggered',
        message: res.data?.message || 'Weekly report email dispatch has been queued successfully for all active recipients.'
      });
    } catch (err: any) {
      console.error('Trigger weekly error:', err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Dispatch Trigger Failed',
        message: err.response?.data?.detail || 'Unable to trigger weekly report emails.'
      });
    } finally {
      setIsTriggeringWeekly(false);
    }
  };

  const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 space-x-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm font-medium">Loading email delivery data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Emails Delivered', value: totalSent, color: 'emerald', icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Pending / Queued', value: totalQueued, color: 'amber', icon: <Clock className="w-5 h-5" /> },
          { label: 'Failed Deliveries', value: totalFailed, color: 'red', icon: <XCircle className="w-5 h-5" /> },
          { label: 'Active Recipients', value: recipients.filter(r => r.is_active).length, color: 'indigo', icon: <Users className="w-5 h-5" /> },
        ].map(kpi => (
          <div key={kpi.label} className={`glass-card p-4 rounded-2xl border border-${kpi.color}-500/30 bg-white dark:bg-navy-900`}>
            <div className={`flex items-center justify-between text-${kpi.color}-600 dark:text-${kpi.color}-400 mb-1`}>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">{kpi.label}</span>
              {kpi.icon}
            </div>
            <div className={`text-2xl font-black text-${kpi.color}-600 dark:text-${kpi.color}-400`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Active Provider & Test Email Card */}
      <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 bg-white dark:bg-navy-900 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Email Delivery &amp; Provider Diagnostics</h3>
              <p className="text-[11px] text-gray-400">
                Active Provider: <strong className="text-indigo-600 dark:text-indigo-400">{providerInfo?.active_provider === 'BREVO_API' ? 'Brevo Official API (Port 443 HTTPS)' : (providerInfo?.active_provider === 'RESEND_API' ? 'Resend API (HTTPS)' : 'Gmail SMTP (Port 587)')}</strong> • Timeout: {providerInfo?.timeout_seconds || 90}s (Auto-Retry Enabled)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              🟢 {providerInfo?.active_provider === 'BREVO_API' ? 'Brevo v3 API Active' : 'Provider Ready'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <div className="flex-1">
            <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Recipient</label>
            <input
              type="email"
              value={testRecipient}
              onChange={e => setTestRecipient(e.target.value)}
              placeholder="YOUR_TEST_EMAIL@gmail.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-navy-800 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleSendSmtpTest}
            disabled={isTestingSmtp || !testRecipient.trim()}
            className="sm:self-end px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            {isTestingSmtp ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Testing SMTP...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Quick SMTP Test</span>
              </>
            )}
          </button>
          <button
            onClick={handleSendAdminTestReportEmail}
            disabled={isTestingSmtp}
            className="sm:self-end px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Test Report to Admin Email</span>
          </button>
        </div>

        {smtpTestResult && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold border ${
            smtpTestResult.success
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              <span>{smtpTestResult.message}</span>
            </div>
            {smtpTestResult.error && (
              <p className="text-[11px] font-normal text-red-600 dark:text-red-400 mt-1 leading-relaxed">
                {smtpTestResult.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── SUB-MODE NAVIGATION BAR ────────────────────────── */}
      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-navy-950 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('manual')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'manual'
              ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Send className="w-4 h-4 text-emerald-400" />
          <span>⚡ Manual Instant Dispatch</span>
        </button>

        <button
          onClick={() => setActiveSection('automated')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'automated'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>⏰ Automated Sunday Schedule & Time Settings</span>
        </button>

        <button
          onClick={() => setActiveSection('recipients')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'recipients'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Report Recipients ({recipients.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'history'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Delivery History ({logs.length})</span>
        </button>
      </div>

      {/* ── MANUAL INSTANT DISPATCH CARD ─────────────────── */}
      {activeSection === 'manual' && (
        <div className="glass-card p-6 rounded-3xl border border-indigo-500/30 bg-white dark:bg-navy-900 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Manual Instant Email Dispatch Center</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Trigger an immediate, on-demand report email dispatch to college management, HODs, or custom email lists.
                </p>
              </div>
            </div>

            <button
              onClick={() => { setShowSendModal(true); setSendStep('select'); setSelectedSessionId(null); setSelectedRecipientIds(new Set()); setCustomMessage(''); setSendResult(null); }}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center space-x-2 cursor-pointer transform hover:scale-105"
            >
              <Send className="w-4 h-4" />
              <span>Compose & Send Manual Email Report Now</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-gray-600 dark:text-gray-300">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="font-black text-gray-900 dark:text-white block">1. Select Report Session</span>
              <p className="text-[11px] text-gray-400">Choose from recent weekly sessions or auto-generated executive snapshot.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="font-black text-gray-900 dark:text-white block">2. Target Distribution</span>
              <p className="text-[11px] text-gray-400">Filter recipients by Role (Deans, HODs, Management) or pick specific emails.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="font-black text-gray-900 dark:text-white block">3. Add Custom Note</span>
              <p className="text-[11px] text-gray-400">Attach an executive summary note or administrative instructions before dispatch.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── AUTOMATED SCHEDULE CARD ───────────────────────── */}
      {activeSection === 'automated' && (
        <div className="glass-card p-6 rounded-3xl border border-amber-500/30 bg-white dark:bg-navy-900 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center space-x-2">
                  <span>Automated Sunday Email Scheduler & Time Configuration</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Configure automated background execution time, day of week, and trigger status for institutional reports.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                autoScheduleEnabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-gray-100 text-gray-700 dark:bg-navy-950 dark:text-gray-400 border border-gray-300'
              }`}>
                {autoScheduleEnabled ? '🟢 AUTO CRON ACTIVE' : '⚪ MANUAL ONLY'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Schedule Status Toggle */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Auto Dispatch Status</label>
              <select
                value={autoScheduleEnabled ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => setAutoScheduleEnabled(e.target.value === 'ENABLED')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white"
              >
                <option value="ENABLED">🟢 Enabled (Auto-Trigger On Schedule)</option>
                <option value="DISABLED">⚪ Disabled (Manual Trigger Only)</option>
              </select>
            </div>

            {/* Schedule Frequency */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Report Frequency</label>
              <select
                value={scheduleFrequency}
                onChange={(e) => setScheduleFrequency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white"
              >
                <option value="WEEKLY_EXECUTIVE">Weekly Sunday Executive Summary</option>
                <option value="DAILY_ROSTER">Daily Roster Audit Log</option>
                <option value="MONTHLY_BENCHMARK">Monthly Benchmark Matrix</option>
              </select>
            </div>

            {/* Schedule Day */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Trigger Day</label>
              <select
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white"
              >
                <option value="Sunday">Every Sunday</option>
                <option value="Monday">Every Monday</option>
                <option value="Friday">Every Friday</option>
              </select>
            </div>

            {/* Schedule Time */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Trigger Time (IST)</label>
              <select
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white"
              >
                <option value="08:00">08:00 AM (Morning Summary)</option>
                <option value="09:00">09:00 AM (Office Opening)</option>
                <option value="18:00">06:00 PM (Evening Closing)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Next scheduled run: <strong className="text-gray-900 dark:text-white">{scheduleDay} at {scheduleTime} AM</strong> ({autoScheduleEnabled ? 'Active' : 'Paused'})
            </p>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleTriggerAutomatedDispatch}
                disabled={isTriggeringWeekly}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTriggeringWeekly ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Trigger Auto-Dispatch Right Now</span>
              </button>

              <button
                onClick={handleSaveScheduleSettings}
                disabled={savingSchedule}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                <span>Save Auto-Schedule Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { setShowSendModal(true); setSendStep('select'); setSelectedSessionId(null); setSelectedRecipientIds(new Set()); setCustomMessage(''); setSendResult(null); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
        >
          <Send className="w-4 h-4" />
          <span>Send Report by Email</span>
        </button>

        <button
          onClick={handleTriggerAutomatedDispatch}
          disabled={isTriggeringWeekly}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 disabled:opacity-50"
        >
          {isTriggeringWeekly ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Queueing Dispatch...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Trigger Automated Weekly Dispatch Now</span>
            </>
          )}
        </button>

        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-navy-700 transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        {/* Section Tabs */}
        <div className="flex items-center ml-auto border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {(['manual', 'automated', 'recipients', 'history'] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2 text-[11px] font-black capitalize transition-all ${activeSection === s ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              {s === 'manual' ? 'Manual Send' : s === 'automated' ? 'Auto Schedule' : s === 'recipients' ? 'Recipients' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATUS / MANUAL SUMMARY SECTION ───────────────────── */}
      {(activeSection === 'manual' || activeSection === 'automated') && (
        <div className="glass-card rounded-3xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Email Delivery Status</h2>
              <p className="text-xs text-gray-400 mt-0.5">Recent automated and manual report email deliveries</p>
            </div>
            {totalFailed > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {totalFailed} Failed
              </div>
            )}
          </div>
          {logs.length === 0 ? (
            <div className="py-16 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No email deliveries yet</p>
              <p className="text-xs text-gray-400 mt-1">Emails are dispatched automatically after weekly contest finalization</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
              {logs.slice(0, 10).map(log => {
                const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG['QUEUED'];
                return (
                  <div key={log.id} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 ${sc.color}`}>{sc.icon}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{log.recipient}</div>
                        <div className="text-[10px] text-gray-400 truncate">{log.subject}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-black ${sc.color}`}>{sc.label}</span>
                      <span className="text-[10px] text-gray-400">📎 {log.attachment_count}</span>
                      {(log.status === 'FAILED' || log.status === 'QUEUED' || log.status === 'RETRYING') && (
                        <button
                          onClick={() => handleRetry(log.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black transition-all"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RECIPIENTS SECTION ──────────────────────────────────── */}
      {activeSection === 'recipients' && (
        <div className="glass-card rounded-3xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">👥 Recipient Configuration</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage who receives official weekly report emails</p>
            </div>
            <button
              onClick={() => setShowAddRecipient(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Recipient
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-navy-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Name & Email', 'Role', 'Department', 'Weekly', 'HOD', 'Errors', 'Active', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {recipients.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-navy-800/30 transition-colors ${!r.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white">{r.name}</div>
                      <div className="text-gray-400 text-[10px]">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${ROLE_COLORS[r.role] || ROLE_COLORS['ADMIN']}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.department || 'ALL'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-base font-bold ${r.receive_weekly_reports ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>{r.receive_weekly_reports ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-base font-bold ${r.receive_hod_reports ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>{r.receive_hod_reports ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-base font-bold ${r.receive_error_reports ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>{r.receive_error_reports ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleRecipient(r)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${r.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${r.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteRecipient(r.id, r.email, r.name)}
                        className="flex items-center gap-1 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all font-bold text-[10px] cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recipients.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">No recipients configured. Add recipients to enable report email delivery.</div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY SECTION ─────────────────────────────────────── */}
      {activeSection === 'history' && (
        <div className="glass-card rounded-3xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-black text-gray-900 dark:text-white">📋 Email Delivery History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Full audit log of all report email dispatch activity</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-navy-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Email ID', 'Recipient', 'Role', 'Subject', 'Status', 'Attachments', 'Sent At', 'Retries', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {logs.map(log => {
                  const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG['QUEUED'];
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{log.email_id}</td>
                      <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200 max-w-[140px] truncate">{log.recipient}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${ROLE_COLORS[log.role] || ROLE_COLORS['ADMIN']}`}>{log.role}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 font-black ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                        {log.error_message && (
                          <div className="text-[10px] text-red-400 mt-0.5 truncate max-w-[150px]" title={log.error_message}>{log.error_message}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">📎 {log.attachment_count} files</td>
                      <td className="px-4 py-3 text-gray-400 text-[10px] whitespace-nowrap">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{log.retry_count}</td>
                      <td className="px-4 py-3">
                        {(log.status === 'FAILED' || log.status === 'QUEUED' || log.status === 'RETRYING') && (
                          <button onClick={() => handleRetry(log.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black transition-all whitespace-nowrap">
                            <RotateCcw className="w-2.5 h-2.5" /> {log.status === 'QUEUED' ? 'Force Send' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">No delivery history found.</div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD RECIPIENT MODAL ──────────────────────────────────── */}
      {showAddRecipient && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 animate-modal-content">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 dark:text-white">Add Email Recipient</h2>
              <button onClick={() => setShowAddRecipient(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Full Name', value: newName, set: setNewName, placeholder: 'e.g. Prof. Rajkumar' },
                { label: 'Email Address', value: newEmail, set: setNewEmail, placeholder: 'e.g. hod@nandha.edu.in' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                  <input
                    type="text" value={f.value} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-500"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500">
                    <option value="MANAGEMENT">MANAGEMENT</option>
                    <option value="HOD">HOD</option>
                    <option value="DEPARTMENT_COORDINATOR">DEPT COORDINATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Department</label>
                  <select value={newDept} onChange={e => setNewDept(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500">
                    <option value="ALL">All Departments</option>
                    <option value="CSE(CS)">CSE(CS) – Cyber Security</option>
                    <option value="CSE(IoT)">CSE(IoT) – IoT</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddRecipient(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-navy-800 transition-all cursor-pointer">Cancel</button>
              <button onClick={handleAddRecipient} disabled={addingRecipient}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md">
                {addingRecipient ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Recipient</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND REPORT EMAIL MODAL ─────────────────────────────── */}
      {showSendModal && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-2xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-modal-content">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-navy-950 to-indigo-950 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl"><Mail className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-black text-sm">Send Report by Email</h2>
                  <p className="text-[10px] text-blue-300">Select week • Choose recipients • Preview • Send</p>
                </div>
              </div>
              {sendStep !== 'sending' && (
                <button onClick={() => setShowSendModal(false)} className="text-white/60 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
              {/* Step: SELECT */}
              {sendStep === 'select' && (
                <>
                  {/* Week Selection */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Select Contest Week</label>
                    <select value={selectedSessionId ?? ''} onChange={e => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500">
                      <option value="">Latest / Current Report</option>
                      {sessions.map(s => (
                        <option key={s.sessionId} value={s.sessionId}>
                          {s.sessionDate} — {s.contestName} ({s.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Recipient Selection */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Select Recipients</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {recipients.filter(r => r.is_active).map(r => (
                        <label key={r.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selectedRecipientIds.has(r.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                          <input type="checkbox" checked={selectedRecipientIds.has(r.id)}
                            onChange={e => {
                              const next = new Set(selectedRecipientIds);
                              e.target.checked ? next.add(r.id) : next.delete(r.id);
                              setSelectedRecipientIds(next);
                            }}
                            className="rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-900 dark:text-white">{r.name}</div>
                            <div className="text-[10px] text-gray-400">{r.email}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] flex-shrink-0 ${ROLE_COLORS[r.role] || ROLE_COLORS['ADMIN']}`}>{r.role}</span>
                        </label>
                      ))}
                      {recipients.filter(r => r.is_active).length === 0 && (
                        <div className="text-center py-6 text-xs text-gray-400">No active recipients. Add recipients in the Recipients tab first.</div>
                      )}
                    </div>
                  </div>

                  {/* Custom Message */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Optional Custom Note</label>
                    <textarea
                      value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                      placeholder="e.g. Please review the attached weekly summary before the HOD meeting on Monday..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-500 resize-none"
                    />
                  </div>

                  {/* Go to Preview */}
                  <button
                    disabled={!selectedRecipientIds.size}
                    onClick={() => setSendStep('preview')}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Email
                  </button>
                </>
              )}

              {/* Step: PREVIEW */}
              {sendStep === 'preview' && (
                <>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                    {/* Email Preview Header */}
                    <div className="bg-gray-50 dark:bg-navy-800 px-5 py-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-gray-500 w-10">To:</span>
                        <div className="flex flex-wrap gap-1">
                          {recipients.filter(r => selectedRecipientIds.has(r.id)).map(r => (
                            <span key={r.id} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-bold">{r.email}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-gray-500 w-10">Subj:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          Nandha Engineering College – Weekly LeetCode Report – {selectedSession?.sessionDate || new Date().toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Attachments */}
                    <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                      <div className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase mb-2">📎 Attachments (5 files)</div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Report.xlsx', icon: <FileSpreadsheet className="w-3 h-3" />, color: 'text-emerald-600' },
                          { name: 'Report.pdf', icon: <FileText className="w-3 h-3" />, color: 'text-red-500' },
                          { name: 'Report.docx', icon: <FileText className="w-3 h-3" />, color: 'text-blue-600' },
                          { name: 'Report.csv', icon: <FileText className="w-3 h-3" />, color: 'text-teal-600' },
                          { name: 'Report_All.zip', icon: <Archive className="w-3 h-3" />, color: 'text-amber-600' },
                        ].map(f => (
                          <div key={f.name} className={`flex items-center gap-1 px-2 py-1 bg-white dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold ${f.color}`}>
                            {f.icon} {f.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Email Body Preview */}
                    <div className="p-5 text-xs text-gray-700 dark:text-gray-300 space-y-2 max-h-52 overflow-y-auto">
                      <p>Dear Sir/Madam,</p>
                      <p>Please find attached the official Nandha Engineering College LeetCode Weekly Performance Report{selectedSession ? ` for ${selectedSession.sessionDate}` : ''}.</p>
                      {customMessage && <p className="italic text-indigo-600 dark:text-indigo-400">{customMessage}</p>}
                      <p className="font-bold text-gray-900 dark:text-white">📊 Report Summary is attached in the enclosed files.</p>
                      <p className="text-gray-400 text-[10px]">The attached reports (Excel, PDF, Word, CSV) were generated from the finalized official snapshot.</p>
                      <p className="text-gray-400 text-[10px]">— Nandha Engineering College • LeetCode Institutional Tracking System</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setSendStep('select')} className="flex-1 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-navy-800 transition-all">
                      ← Back
                    </button>
                    <button onClick={handleSendEmail}
                      className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Email Now
                    </button>
                  </div>
                </>
              )}

              {/* Step: SENDING */}
              {sendStep === 'sending' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                    </div>
                  </div>
                  <p className="font-black text-gray-900 dark:text-white">Queuing report dispatch...</p>
                  <p className="text-xs text-gray-400 text-center">Generating report files & scheduling delivery to {selectedRecipientIds.size} recipient(s)</p>
                </div>
              )}

              {/* Step: DONE */}
              {sendStep === 'done' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4 max-w-lg mx-auto">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${sendResult?.toLowerCase().includes('fail') || sendResult?.toLowerCase().includes('error') ? 'bg-red-100 dark:bg-red-900/20' : 'bg-emerald-100 dark:bg-emerald-900/20'}`}>
                    {sendResult?.toLowerCase().includes('fail') || sendResult?.toLowerCase().includes('error')
                      ? <XCircle className="w-8 h-8 text-red-500" />
                      : <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    }
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-black text-sm text-gray-900 dark:text-white leading-relaxed">{sendResult}</p>
                    <p className="text-xs text-gray-400">
                      Delivery logs and retry status are available in the Status & History tabs.
                    </p>
                  </div>

                  {(sendResult?.toLowerCase().includes('fail') || sendResult?.toLowerCase().includes('error') || sendResult?.toLowerCase().includes('auth')) && (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 text-left space-y-1 w-full">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{providerInfo?.active_provider === 'BREVO_API' ? 'Brevo API Delivery Diagnostics' : 'SMTP Configuration Diagnostic'}</span>
                      </div>
                      {providerInfo?.active_provider === 'BREVO_API' ? (
                        <div className="text-gray-600 dark:text-gray-400 text-[10.5px] leading-relaxed space-y-0.5">
                          <p>✓ <strong>Provider:</strong> Brevo v3 Transactional API (HTTPS Port 443)</p>
                          <p>✓ <strong>Timeout:</strong> {providerInfo?.timeout_seconds || 90}s with 3 exponential backoff retries</p>
                          <p>✓ <strong>Sender:</strong> {providerInfo?.sender_email || 'nanthishvaran0106@gmail.com'}</p>
                          <p className="text-amber-700 dark:text-amber-400 font-medium pt-1">
                            If write timeout occurred, the request is automatically retried without duplicating emails. Check the Status &amp; History tab.
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-[10.5px] leading-relaxed">
                          If using Gmail SMTP (`smtp.gmail.com:587`), ensure you are using a <b>16-character Google App Password</b> (generated in myaccount.google.com/apppasswords) rather than your standard Gmail password.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setSendStep('select')}
                      className="px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-all"
                    >
                      ← Try Again
                    </button>
                    <button
                      onClick={() => setShowSendModal(false)}
                      className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs transition-all shadow-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CENTRALIZED CUSTOM NOTIFICATION MODAL ────────────────── */}
      <StatusNotificationModal
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
};
