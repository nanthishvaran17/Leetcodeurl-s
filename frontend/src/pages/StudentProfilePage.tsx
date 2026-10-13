// million-ignore
import React, { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Trophy, Flame, Award, Lightbulb, RefreshCw, FileText, Edit3, Trash2, X, BarChart2, Activity, BookOpen, Medal, TrendingUp, Target, CheckCircle2, AlertCircle, PieChart as LucidePieChart } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { BadgeShelf } from '../components/BadgeShelf';
import { DownloadState } from '../services/download/downloadTypes';
import { ExportStatus } from '../components/ExportStatus';
import { deriveYearLevelFromRegNo, formatDepartmentCode, deriveDepartmentFromRegNo } from '../utils/filterUtils';

import { IDCardGenerator } from '../components/IDCardGenerator';
import { StudentEditOverlay } from '../components/StudentEditOverlay';
const StudentAuditModal = React.lazy(() => import('../components/StudentAuditModal').then(m => ({ default: m.StudentAuditModal })));
const IndividualAnalyticsDashboard = React.lazy(() => import('../components/analytics/IndividualAnalyticsDashboard').then(m => ({ default: m.IndividualAnalyticsDashboard })));
const ContestAnalyticsView = React.lazy(() => import('../components/analytics/ContestAnalyticsView').then(m => ({ default: m.ContestAnalyticsView })));
const ActivityAnalyticsView = React.lazy(() => import('../components/analytics/ActivityAnalyticsView').then(m => ({ default: m.ActivityAnalyticsView })));
const ReportsAnalyticsView = React.lazy(() => import('../components/analytics/ReportsAnalyticsView').then(m => ({ default: m.ReportsAnalyticsView })));

interface StudentProfilePageProps {
  student: any;
  onBack: () => void;
}

import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
// triggerDownload used by downloadManager internally
import { downloadManager } from '../services/download/downloadManager';

type TabId = 'overview' | 'analytics' | 'contests' | 'activity' | 'reports';

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ student, onBack }) => {
  const { notify, confirmAction } = useNotification();
  const { user, isAuthenticated } = useAuth();
  const isSuperAdmin = user?.role?.toLowerCase() === 'super admin' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [detail, setDetail] = useState<any>(student);
  const [insights, setInsights] = useState<any>(null);
  const [isLiveFetching, setIsLiveFetching] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [liveFetchError, setLiveFetchError] = useState<string | null>(null);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [isChartsReady, setIsChartsReady] = useState(false);

  const [isPending, startTransition] = useTransition();

  const resolveTargetId = () => {
    return (
      detail?.id ||
      detail?.student_id ||
      detail?.reg_no ||
      detail?.register_no ||
      detail?.register_number ||
      student?.id ||
      student?.student_id ||
      student?.reg_no ||
      student?.register_no ||
      student?.register_number ||
      null
    );
  };

  const resolveLeetCodeUsername = () => {
    return (
      detail?.username ||
      detail?.leetcode_username ||
      detail?.leetcode_handle ||
      detail?.handle ||
      detail?.canonical_username ||
      student?.username ||
      student?.leetcode_username ||
      student?.leetcode_handle ||
      student?.handle ||
      student?.canonical_username ||
      ''
    ).trim();
  };

  const resolveLeetCodeUrl = (): string | null => {
    const rawUrl = (
      detail?.leetcode_url ||
      detail?.profile_url ||
      detail?.url ||
      student?.leetcode_url ||
      student?.profile_url ||
      student?.url ||
      ''
    ).trim();

    if (rawUrl) {
      if (/^https?:\/\/(www\.)?leetcode\.com\//i.test(rawUrl)) {
        return rawUrl;
      }
      if (/^(www\.)?leetcode\.com\//i.test(rawUrl)) {
        return `https://${rawUrl.replace(/^(www\.)?/, '')}`;
      }
      if (rawUrl.startsWith('@')) {
        const cleanName = rawUrl.substring(1).trim();
        if (cleanName) return `https://leetcode.com/u/${encodeURIComponent(cleanName)}/`;
      }
    }

    const u = resolveLeetCodeUsername().replace(/^@/, '').trim();
    if (u) {
      if (/^https?:\/\/(www\.)?leetcode\.com\//i.test(u)) {
        return u;
      }
      if (/^(www\.)?leetcode\.com\//i.test(u)) {
        return `https://${u.replace(/^(www\.)?/, '')}`;
      }
      const extractedMatch = u.match(/(?:leetcode\.com\/(?:u\/)?)?([a-zA-Z0-9_-]+)/i);
      const cleanHandle = extractedMatch ? extractedMatch[1] : u;
      if (cleanHandle) {
        return `https://leetcode.com/u/${encodeURIComponent(cleanHandle)}/`;
      }
    }

    return null;
  };

  useEffect(() => {
    if (student) {
      setDetail(student);
    }
    const targetId = resolveTargetId();
    if (targetId) {
      fetchStudentDetail();
    }
    
    const handleStudentUpdated = (e: any) => {
      const updated = e.detail;
      const tId = resolveTargetId();
      if (updated && (String(updated.id) === String(tId) || String(updated.reg_no).toUpperCase() === String(tId).toUpperCase())) {
        setDetail(updated);
        fetchStudentDetail();
      }
    };
    window.addEventListener('student_updated', handleStudentUpdated);

    // Defer heavy chart rendering to prevent modal opening scroll lag
    const timer = setTimeout(() => setIsChartsReady(true), 150);
    return () => {
      window.removeEventListener('student_updated', handleStudentUpdated);
      clearTimeout(timer);
    };
  }, [student]);

  const fetchStudentDetail = async () => {
    const targetId = resolveTargetId();
    if (!targetId) return;
    try {
      // 1. Fetch fast student details immediately to unblock UI
      const stRes = await api.get(`/students/${encodeURIComponent(targetId)}`);
      if (stRes.data) {
        setDetail(stRes.data);
      }
      
      // 2. Fetch heavy AI insights in the background without blocking the modal
      api.get(`/analytics/compare-students?ids=${encodeURIComponent(targetId)}`)
        .then(insRes => {
          if (insRes.data && insRes.data.length > 0) {
            setInsights(insRes.data[0].insights);
          }
        })
        .catch(err => {
          console.warn("Failed to load background insights:", err);
        });
    } catch (err) {
      console.error("Failed to load student detail:", err);
    }
  };

  const [downloadingCert, setDownloadingCert] = useState(false);
  const [downloadingForensic, setDownloadingForensic] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);

  // 1. LEETCODE — resolved URL for <a> tag (native navigation, no popup blocker)
  const leetCodeUrl = resolveLeetCodeUrl();

  // 2. EDIT BUTTON HANDLER
  const handleDeleteStudent = async () => {
    const targetId = resolveTargetId();
    if (!targetId) return;
    
    const confirmed = await confirmAction({
      title: 'Delete Student',
      message: `Are you sure you want to permanently delete this student record? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Student'
    });

    if (confirmed) {
      setIsDeleting(true);
      try {
        await api.post('/students/bulk-delete', { student_ids: [targetId], soft_delete: false });
        notify.success('Student Deleted', 'Student record has been permanently deleted from the database.', { category: 'STUDENT PROFILE' });
        onBack(); // Close modal
      } catch (err: any) {
        notify.error('Delete Failed', err.response?.data?.detail || 'Failed to delete student.', { category: 'STUDENT PROFILE' });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // 2. EDIT BUTTON HANDLER
  const handleOpenEditModal = () => {
    setShowEditOverlay(true);
  };


  // 4. CERTIFICATE BUTTON HANDLER
  const handleGenerateCert = async () => {
    const targetId = resolveTargetId();
    if (!targetId || downloadingCert) {
      if (!targetId) notify.error('Certificate Error', 'No valid student identifier found.', { category: 'CERTIFICATE ENGINE' });
      return;
    }
    setDownloadingCert(true);
    notify.info('Generating Certificate', 'Creating official performance certificate PDF...', { category: 'CERTIFICATE ENGINE' });
    try {
      const cleanReg = (detail?.reg_no || student?.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
      const res = await api.post('/certificates/generate', {
        student_id: targetId,
        register_no: cleanReg || targetId,
        cert_type: "Top Performer"
      });
      const certId = res.data?.verification_id || `CERT-${cleanReg}-EXCELLENCE`;
      const filename = `Certificate_${cleanReg || certId}.pdf`;

      const dlResult = await downloadManager.download({
        endpoint: `/certificates/${encodeURIComponent(certId)}/download-pdf`,
        filename,
        mimeType: 'application/pdf',
      });
      if (dlResult.success) {
        notify.success('Certificate Downloaded', `Certificate ${filename} generated successfully.`, { category: 'CERTIFICATE ENGINE' });
      } else {
        notify.error('Certificate Error', dlResult.error || 'Failed to generate certificate.', { category: 'CERTIFICATE ENGINE' });
      }
    } catch (err: any) {
      console.error("Certificate error:", err);
      notify.error('Certificate Error', err.response?.data?.detail || err.message || "Failed to generate certificate.", { category: 'CERTIFICATE ENGINE' });
    } finally {
      setDownloadingCert(false);
    }
  };

  // FORENSIC PDF EXPORT
  const handleDownloadForensicCert = async (sessionIdParam?: number | string | null) => {
    const targetId = resolveTargetId();
    if (!targetId || downloadingForensic) {
      if (!targetId) notify.error('Forensic Error', 'No valid student identifier found.', { category: 'FORENSIC AUDIT' });
      return;
    }
    setDownloadingForensic(true);
    notify.dismissCategory('FORENSIC AUDIT');
    try {
      const cleanReg = (detail?.reg_no || student?.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
      const reportTargetId = cleanReg ? `CERT-${cleanReg}-FORENSIC` : `CERT-${targetId}-FORENSIC`;
      const filename = `Forensic_Audit_Report_${reportTargetId}.pdf`;

      const filtersPayload: Record<string, any> = { student_id: targetId };
      if (sessionIdParam) {
        filtersPayload.session_id = sessionIdParam;
      }

      const dlResult = await downloadManager.downloadJob({
        report_type: 'CERTIFICATE_FORENSIC_PDF',
        format: 'pdf',
        filters: filtersPayload,
        filename,
        onStateChange: (state) => setDownloadState(state)
      });
      if (!dlResult.success) {
        notify.error('Forensic Error', dlResult.error || 'Failed to download report.', { category: 'FORENSIC AUDIT' });
      }
    } catch (err: any) {
      console.error("Forensic report error:", err);
      notify.error('Forensic Error', 'Failed to download Official LeetCode Contest Forensic Verification Audit Report.', { category: 'FORENSIC AUDIT' });
    } finally {
      setDownloadingForensic(false);
    }
  };

  // 3. SYNC BUTTON HANDLER
  const handleLiveFetch = async () => {
    const targetId = resolveTargetId();
    if (!targetId || isLiveFetching) {
      if (!targetId) notify.error('Sync Error', 'No valid student record ID found.', { category: 'LIVE SYNC' });
      return;
    }
    
    setIsLiveFetching(true);
    setSyncSuccess(false);
    setLiveFetchError(null);
    notify.info('Live Sync Started', 'Fetching latest data from LeetCode...', { category: 'LIVE SYNC' });
    try {
      await api.post(`/sync/student/${targetId}`);
      const refreshed = await api.get(`/students/${encodeURIComponent(targetId)}`);
      setDetail(refreshed.data);
      setSyncSuccess(true);
      notify.success('Sync Complete', 'LeetCode data synced successfully.', { category: 'LIVE SYNC' });
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err: any) {
      console.error("Live fetch error:", err);
      const status = err.response?.status;
      let errMsg = "Failed to fetch live statistics from LeetCode.";
      if (status === 401) errMsg = "Session expired. Please log in again to sync.";
      else if (status === 403) errMsg = "Access denied. Insufficient permissions to trigger student sync.";
      else if (status === 404) errMsg = "Student record or LeetCode profile not found.";
      else if (status === 429) errMsg = "LeetCode rate-limit reached. Please try again in a few moments.";
      else if (err.response?.data?.detail) errMsg = err.response.data.detail;
      else if (err.message) errMsg = err.message;
      
      setLiveFetchError(errMsg);
      notify.error('Sync Failed', errMsg, { category: 'LIVE SYNC' });
    } finally {
      setIsLiveFetching(false);
    }
  };

  // 6. DELETE BUTTON HANDLER
  const handleDelete = async () => {
    const targetId = resolveTargetId();
    if (!targetId || isDeleting) return;
    const targetName = detail?.name || student?.name || 'Student';
    const targetReg = detail?.reg_no || student?.reg_no || '';

    const confirmed = await confirmAction({
      title: 'Deactivate Student Record?',
      message: `Are you sure you want to deactivate the student record for "${targetName}" (${targetReg})?`,
      confirmLabel: 'Deactivate Record',
      category: 'STUDENT PROFILE',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await api.delete(`/students/${encodeURIComponent(targetId)}?soft_delete=true`);
      notify.success('Student Deactivated', `Student "${targetName}" (${targetReg}) deactivated successfully.`, { category: 'STUDENT PROFILE' });
      window.dispatchEvent(new Event('refresh_dashboard_summary'));
      onBack();
    } catch (err: any) {
      const status = err.response?.status;
      let errMsg = 'Failed to deactivate student record.';
      if (status === 401) errMsg = 'Authentication required. Session may have expired.';
      else if (status === 403) errMsg = 'Permission denied. Only authorized staff or administrators can delete records.';
      else if (status === 404) errMsg = 'Student record not found or already deactivated.';
      else if (err.response?.data?.detail) errMsg = err.response.data.detail;

      notify.error('Delete Failed', errMsg, { category: 'STUDENT PROFILE' });
    } finally {
      setIsDeleting(false);
    }
  };

  const easy = detail?.stats?.easy_solved || 0;
  const medium = detail?.stats?.medium_solved || 0;
  const hard = detail?.stats?.hard_solved || 0;

  const pieData = [
    { name: 'Easy', value: easy, color: '#10B981' },
    { name: 'Medium', value: medium, color: '#F59E0B' },
    { name: 'Hard', value: hard, color: '#EF4444' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-navy-950 rounded-3xl isolate">
      
      {/* Header Bar with Close Button & Actions — Ultra-modern 2026 Glassmorphic Header */}
      <div className="relative p-4 sm:p-5 bg-gradient-to-br from-[#0a0f1d] via-[#0f172a] to-[#070b14] text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/[0.08] shrink-0 shadow-2xl rounded-t-2xl sm:rounded-t-3xl overflow-hidden">
        {/* Ambient Radial Mesh Glow */}
        <div className="absolute top-0 right-1/4 -mt-16 w-80 h-80 rounded-full bg-brand-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center space-x-3 sm:space-x-4 w-full md:w-auto justify-between md:justify-start relative z-10">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <button
              type="button"
              onClick={() => onBack()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:bg-white/[0.05] text-white border border-white/10 transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-bold shadow-md active:scale-95 shrink-0 backdrop-blur-md touch-manipulation"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-white shrink-0" />
              <span className="font-bold text-white">Back</span>
            </button>
            
            {/* Student Avatar */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-600 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0 border border-white/20 font-display">
              {(detail?.name || student?.name || 'S').charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white font-display tracking-tight leading-tight truncate">
                {detail?.name || student?.name || student?.student_name || "Unknown Student"}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 font-mono text-[10px] font-bold">
                  {detail?.reg_no || student?.reg_no}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-[10px] font-bold whitespace-nowrap">
                  {formatDepartmentCode(detail?.department?.code || detail?.department?.name || student?.department?.code || student?.department || student?.dept) ||
                    deriveDepartmentFromRegNo(detail?.reg_no || student?.reg_no) ||
                    (detail?.department?.code || student?.department?.code || student?.dept || 'DEPT')}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10 text-slate-300 text-[10px] font-bold">
                  {deriveYearLevelFromRegNo(detail?.reg_no || student?.reg_no, detail?.year_level || student?.year_level || student?.year)} Year
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onBack()}
            className="md:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-slate-300 hover:text-white border border-white/10 shrink-0 cursor-pointer transition active:scale-95 touch-manipulation"
            title="Close modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Action Buttons Row — 2026 Sleek Luminous Glass Pills */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2.5 w-full md:w-auto shrink-0 relative z-10">
          {/* 1. SYNC */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleLiveFetch();
            }}
            disabled={isLiveFetching}
            className={`min-h-[42px] px-4 py-2 rounded-2xl font-black text-xs flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 sm:hover:scale-105 min-w-0 disabled:opacity-50 cursor-pointer touch-manipulation select-none border backdrop-blur-xl ${
              syncSuccess
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-400/40 shadow-lg shadow-emerald-500/25'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white border-blue-400/30 shadow-lg shadow-indigo-600/30'
            }`}
          >
            {syncSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                <span className="truncate tracking-wide font-sans">Synced</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 text-white shrink-0 ${isLiveFetching ? 'animate-spin' : ''}`} />
                <span className="truncate tracking-wide font-sans">{isLiveFetching ? 'Syncing...' : 'Sync Live'}</span>
              </>
            )}
          </button>

          {/* 2. CERTIFICATE */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleGenerateCert();
            }}
            disabled={downloadingCert}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white border border-amber-300/40 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/25 transition-all duration-200 active:scale-95 sm:hover:scale-105 disabled:opacity-50 min-w-0 cursor-pointer touch-manipulation select-none"
          >
            <Award className="w-4 h-4 text-white shrink-0" />
            <span className="truncate tracking-wide font-sans">{downloadingCert ? 'Generating...' : <><span className="sm:hidden">Cert</span><span className="hidden sm:inline">Certificate</span></>}</span>
          </button>

          {/* 3. AUDIT */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowAuditModal(true);
            }}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-600 to-emerald-700 hover:from-teal-400 hover:to-emerald-600 text-white border border-emerald-300/40 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-600/25 transition-all duration-200 active:scale-95 sm:hover:scale-105 min-w-0 cursor-pointer touch-manipulation select-none"
          >
            <FileText className="w-4 h-4 text-white shrink-0" />
            <span className="truncate tracking-wide font-sans">Audit</span>
          </button>
        </div>
      </div>
      
      {liveFetchError && (
        <div className="mx-5 sm:mx-6 mt-4 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 animate-fade-in shadow-sm">
          {liveFetchError}
        </div>
      )}

      {/* Floating Segmented Tab Navigation — Clean 2026 Style */}
      <div className="w-full bg-slate-50 dark:bg-navy-950 p-1.5 sm:p-2 border-b border-slate-200/80 dark:border-navy-800 shrink-0 relative z-10 shadow-xs">
        <div className="grid grid-cols-5 w-full gap-1 sm:gap-2 max-w-4xl mx-auto">
          {[
            { id: 'overview', label: 'Overview', icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5 shrink-0" /> },
            { id: 'contests', label: 'Contests', icon: <Trophy className="w-3.5 h-3.5 shrink-0" /> },
            { id: 'activity', label: 'Activity', icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
            { id: 'reports', label: 'Reports', icon: <BookOpen className="w-3.5 h-3.5 shrink-0" /> }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.id as TabId))}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-black transition-all outline-none text-center cursor-pointer min-w-0 min-h-[42px] touch-manipulation active:scale-95 select-none ${
                  isActive
                    ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-300 shadow-sm border border-slate-200/80 dark:border-navy-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-900/50'
                }`}
              >
                {tab.icon}
                <span className="truncate max-w-full tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        <ExportStatus 
          state={downloadState} 
          onClose={() => setDownloadState(null)} 
        />
      </div>

      {/* Scrollable Body Content */}
      <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0 space-y-6 custom-scrollbar pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="space-y-6 w-full"
          >
      {activeTab === 'overview' && (
        <>
          {(() => {
            const syncStatus = (detail?.stats?.sync_status || detail?.stats?.status || detail?.sync_state || '').toLowerCase();
            const is404 = syncStatus.includes('invalid') || syncStatus.includes('404') || syncStatus.includes('not_found');
            if (!is404) return null;
            return (
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-4 flex items-center justify-between text-rose-800 dark:text-rose-200 font-bold text-xs mb-5 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-rose-900 dark:text-rose-100">LeetCode Profile Not Found (404 Error)</p>
                    <p className="font-medium text-rose-700 dark:text-rose-300 text-xs mt-0.5">
                      The handle <span className="font-mono font-bold">@{detail?.username || 'unknown'}</span> was not found on LeetCode. No static/fake counts are generated; only genuine verified solved counts are displayed.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Section: Rankings & Activity (7 columns) */}
        <div className="lg:col-span-7 bg-white/80 dark:bg-slate-900/70 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 sm:p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/40 relative overflow-hidden backdrop-blur-xl transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-amber-500/10 via-indigo-500/10 to-transparent blur-3xl rounded-full pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Rankings & Activity</h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Institutional standing & cadence</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/10">
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 relative z-10">
            {/* College Rank */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-amber-500/5 via-amber-500/[0.02] to-transparent dark:from-amber-500/10 dark:via-transparent dark:to-transparent rounded-2xl p-4 border border-amber-200/60 dark:border-amber-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">College Rank</span>
                <div className="p-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 font-mono">#</span>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {detail?.college_rank || '—'}
                </h3>
              </div>
            </div>

            {/* Dept Rank */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-500/5 via-indigo-500/[0.02] to-transparent dark:from-indigo-500/10 dark:via-transparent dark:to-transparent rounded-2xl p-4 border border-indigo-200/60 dark:border-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Dept Rank</span>
                <div className="p-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Medal className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 font-mono">#</span>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {detail?.dept_rank || '—'}
                </h3>
              </div>
            </div>

            {/* Weekly Progress */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/5 via-emerald-500/[0.02] to-transparent dark:from-emerald-500/10 dark:via-transparent dark:to-transparent rounded-2xl p-4 border border-emerald-200/60 dark:border-emerald-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Weekly Progress</span>
                <div className="p-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                +{detail?.weekly_progress || 0}
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1.5 font-sans">solved</span>
              </h3>
            </div>

            {/* Active Streak */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500/5 via-orange-500/[0.02] to-transparent dark:from-orange-500/10 dark:via-transparent dark:to-transparent rounded-2xl p-4 border border-orange-200/60 dark:border-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">Active Streak</span>
                <div className="p-1 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 animate-pulse">
                  <Flame className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-orange-600 dark:text-orange-400">
                  {detail?.lc_activity?.current_streak || detail?.streak_count || 0}
                </h3>
                <span className="text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">Days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Contest Metrics (5 columns) */}
        <div className="lg:col-span-5 bg-white/80 dark:bg-slate-900/70 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 sm:p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/40 relative overflow-hidden backdrop-blur-xl flex flex-col justify-between transition-all duration-300">
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-600/15 blur-3xl rounded-full pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Contest Arena</h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Global competitive index</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3.5 relative z-10">
            {/* Rating Highlight */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl p-5 text-white shadow-xl shadow-indigo-600/25 border border-indigo-400/30 group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
              <div className="flex items-center justify-between mb-1.5 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Global Contest Rating</span>
                <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-md">
                  <Award className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 
                className="text-3xl sm:text-4xl font-black text-white tracking-tight cursor-pointer font-sans" 
                title={(() => {
                  const r = detail?.stats?.contest_rating ?? detail?.lc_contest_standing?.contest_rating ?? (detail as any)?.contest_rating;
                  return r != null && !isNaN(Number(r)) ? `Exact Rating: ${Number(r).toFixed(3)}` : undefined;
                })()}
              >
                {(() => {
                  const r = detail?.stats?.contest_rating ?? detail?.lc_contest_standing?.contest_rating ?? (detail as any)?.contest_rating;
                  const attended = detail?.lc_contest_standing?.attended_count ?? detail?.stats?.official_contests ?? 0;
                  if (r == null || Number(r) <= 0 || Number(r) === 1500 || Math.round(Number(r)) === 1500 || attended === 0) return 'Unrated';
                  return Math.round(Number(r)).toLocaleString('en-US');
                })()}
              </h3>
            </div>

            {/* Official / Virtual Split */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="relative bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/5 transition-all duration-200 hover:-translate-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Official Contests</span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {detail?.lc_contest_standing?.attended_count || detail?.stats?.official_contests || 0}
                </h3>
              </div>
              <div className="relative bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/5 transition-all duration-200 hover:-translate-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Virtual Contests</span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {detail?.stats?.virtual_contests || 0}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Radar & Digital Student Pass */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isChartsReady ? (
          <SkillRadarChart totalSolved={detail?.stats?.total_solved || 0} />
        ) : (
          <div className="h-[350px] bg-slate-100/50 dark:bg-navy-900/50 rounded-3xl animate-pulse flex items-center justify-center">
            <span className="text-slate-400 font-bold text-xs">Loading Radar...</span>
          </div>
        )}
        <IDCardGenerator
          studentName={detail?.name || ''}
          regNo={detail?.reg_no || ''}
          deptName={detail?.department?.name || 'Department'}
          yearLevel={detail?.year_level || 'III'}
          totalSolved={detail?.stats?.total_solved || 0}
          collegeRank={detail?.college_rank || 1}
          streakCount={detail?.lc_activity?.current_streak ?? detail?.streak_count ?? 0}
          leetcodeUsername={detail?.username || detail?.leetcode_username || ''}
          contestRating={detail?.stats?.contest_rating || 0}
          easySolved={detail?.stats?.easy_solved || 0}
          mediumSolved={detail?.stats?.medium_solved || 0}
          hardSolved={detail?.stats?.hard_solved || 0}
          lastVerifiedAt={detail?.stats?.last_verified_at || detail?.last_verified_at || null}
          officialContests={detail?.lc_contest_standing?.attended_count ?? detail?.stats?.official_contests ?? 0}
          virtualContests={detail?.stats?.virtual_contests ?? 0}
          verificationSource="LEETCODE API"
        />
      </div>

      {/* Achievement Badge Shelf */}
      <BadgeShelf
        solvedCount={detail?.stats?.total_solved || 0}
        streakCount={detail?.streak_count || 0}
        rating={detail?.stats?.contest_rating || 0}
      />

      {/* Problem Distribution & AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart / Difficulty Architecture */}
        <div className="bg-white/80 dark:bg-slate-900/70 p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex flex-col justify-between backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <LucidePieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Difficulty Breakdown</h3>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Problem composition spectrum</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-black text-slate-900 dark:text-white px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              {(easy + medium + hard)} Solved
            </span>
          </div>

          <div className="h-60 w-full min-w-0 relative z-10">
            {isChartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-slate-100/50 dark:bg-navy-900/50 rounded-full animate-pulse flex items-center justify-center scale-75">
                <span className="text-slate-400 font-bold text-xs">Loading Breakdown...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center text-xs relative z-10 pt-2">
            <div className="p-3 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Easy</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{easy}</p>
            </div>
            <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Medium</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{medium}</p>
            </div>
            <div className="p-3 rounded-2xl bg-gradient-to-b from-rose-500/10 to-transparent border border-rose-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Hard</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{hard}</p>
            </div>
          </div>
        </div>

        {/* Weak Topic AI Insights */}
        <div className="bg-white/80 dark:bg-slate-900/70 p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex flex-col justify-between backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">AI Focus Recommendation</h3>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Personalized algorithmic guidance</p>
              </div>
            </div>
            {insights && (
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                {insights.trajectory}
              </span>
            )}
          </div>

          {insights ? (
            <div className="space-y-3.5 text-xs relative z-10">
              <div>
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recommended Focus Topics</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {insights.focus_areas.map((area: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {insights.recommendation}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-medium text-slate-400">Loading topic insights...</div>
          )}
        </div>
      </div>
      </>
    )}

      <React.Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading view module...</div>}>
        {activeTab === 'analytics' && (
          <IndividualAnalyticsDashboard studentId={resolveTargetId()} />
        )}

        {activeTab === 'contests' && (
          <ContestAnalyticsView studentId={resolveTargetId()} />
        )}

        {activeTab === 'activity' && (
          <ActivityAnalyticsView studentId={resolveTargetId()} />
        )}

        {activeTab === 'reports' && (
          <ReportsAnalyticsView 
            studentId={resolveTargetId()} 
            studentName={detail?.name || student?.name}
            regNo={detail?.reg_no || student?.reg_no || student?.register_number}
            deptName={
              formatDepartmentCode(detail?.department?.code || detail?.department?.name || student?.department?.code || student?.department?.name || student?.department || student?.dept) ||
              deriveDepartmentFromRegNo(detail?.reg_no || student?.reg_no) ||
              'CSE'
            }
          />
        )}
      </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </div>

      <React.Suspense fallback={null}>
        {showEditOverlay && (
          <StudentEditOverlay
            isOpen={showEditOverlay}
            student={detail || student}
            onClose={() => setShowEditOverlay(false)}
            onSaveSuccess={(updated) => {
              setDetail(updated);
              fetchStudentDetail();
              window.dispatchEvent(new Event('refresh_dashboard_summary'));
            }}
          />
        )}

        {showAuditModal && (
          <StudentAuditModal
            isOpen={showAuditModal}
            studentId={resolveTargetId()}
            studentName={detail?.name || student?.name}
            regNo={detail?.reg_no || student?.reg_no}
            onClose={() => setShowAuditModal(false)}
            onDownloadForensic={handleDownloadForensicCert}
          />
        )}
      </React.Suspense>
    </div>
  );
};

