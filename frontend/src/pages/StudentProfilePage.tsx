// million-ignore
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Trophy, Flame, Award, Lightbulb, RefreshCw, FileText, Edit3, Trash2, X, BarChart2, Activity, BookOpen, Medal, TrendingUp, Target, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../services/api';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { BadgeShelf } from '../components/BadgeShelf';
import { DownloadState } from '../services/download/downloadTypes';
import { ExportStatus } from '../components/ExportStatus';

import { IDCardGenerator } from '../components/IDCardGenerator';
const StudentEditOverlay = React.lazy(() => import('../components/StudentEditOverlay').then(m => ({ default: m.StudentEditOverlay })));
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
// triggerDownload used by downloadManager internally
import { downloadManager } from '../services/download/downloadManager';

type TabId = 'overview' | 'analytics' | 'contests' | 'activity' | 'reports';

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ student, onBack }) => {
  const { notify, confirmAction } = useNotification();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [detail, setDetail] = useState<any>(student);
  const [insights, setInsights] = useState<any>(null);
  const [isLiveFetching, setIsLiveFetching] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [liveFetchError, setLiveFetchError] = useState<string | null>(null);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

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
  const handleDownloadForensicCert = async () => {
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

      const dlResult = await downloadManager.downloadJob({
        report_type: 'CERTIFICATE_FORENSIC_PDF',
        format: 'pdf',
        filters: { student_id: targetId },
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
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-navy-950 rounded-3xl">
      
      {/* Header Bar with Close Button & Actions — restored from reference commit structure */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 shrink-0 relative z-50 shadow-xl">
        <div className="flex items-center space-x-3 sm:space-x-4 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onBack()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white border border-slate-700/80 transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-bold shadow-md hover:scale-105 shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 text-white shrink-0" />
            <span className="font-bold text-white">Back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-white truncate">{detail?.name || student?.name}</h2>
            <p className="text-[10px] sm:text-xs text-brand-300 font-mono font-bold mt-0.5 truncate max-w-sm">
              {detail?.reg_no || student?.reg_no} • {detail?.department?.name || detail?.department?.code || student?.department?.code} {detail?.year_level ? `• ${String(detail.year_level).replace(/\s*Yr\s*/gi, '').replace(/\s*Year\s*/gi, '').trim()} Year` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:flex sm:items-center sm:gap-2.5 w-full md:w-auto shrink-0">
            {/* 1. EDIT */}
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="min-h-[38px] px-2 sm:px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-amber-500/30 transition-all hover:scale-105 min-w-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">Edit</span>
            </button>

            {/* 2. SYNC */}
            <button
              type="button"
              onClick={handleLiveFetch}
              disabled={isLiveFetching}
              className={`min-h-[38px] px-2 sm:px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md transition-all hover:scale-105 min-w-0 disabled:opacity-50 cursor-pointer ${
                syncSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
              }`}
            >
              {syncSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">Synced</span>
                </>
              ) : (
                <>
                  <RefreshCw className={`w-3.5 h-3.5 text-white shrink-0 ${isLiveFetching ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isLiveFetching ? 'Syncing...' : 'Sync'}</span>
                </>
              )}
            </button>

            {/* 3. CERTIFICATE */}
            <button
              type="button"
              onClick={handleGenerateCert}
              disabled={downloadingCert}
              className="min-h-[38px] px-2 sm:px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-amber-600/30 transition-all hover:scale-105 disabled:opacity-50 min-w-0 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">{downloadingCert ? '...' : <><span className="sm:hidden">Cert</span><span className="hidden sm:inline">Certificate</span></>}</span>
            </button>

            {/* 4. AUDIT */}
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="min-h-[38px] px-2 sm:px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-105 min-w-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">Audit</span>
            </button>

            {/* 5. DELETE / DEACTIVATE */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="min-h-[38px] px-2 sm:px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-rose-600/30 transition-all hover:scale-105 min-w-0 disabled:opacity-50 cursor-pointer"
              title="Deactivate Student"
            >
              <Trash2 className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">{isDeleting ? '...' : <><span className="sm:hidden">Deact</span><span className="hidden sm:inline">Deactivate</span></>}</span>
            </button>
        </div>
      </div>
      
      {liveFetchError && (
        <div className="mx-5 sm:mx-6 mt-4 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 animate-fade-in shadow-sm">
          {liveFetchError}
        </div>
      )}


      {/* Custom Tab Navigation - High Contrast & Color Vibrancy */}
      <div className="w-full border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-navy-900/80 shrink-0 relative z-10 shadow-xs">
        <div className="grid grid-cols-5 w-full px-1 sm:px-4">
          {[
            { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" /> },
            { id: 'contests', label: 'Contests', icon: <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" /> },
            { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> },
            { id: 'reports', label: 'Reports', icon: <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" /> }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-2.5 sm:px-3 sm:py-3.5 text-xs sm:text-sm transition-all outline-none text-center cursor-pointer min-w-0 border-b-2 ${
                  isActive
                    ? 'border-brand-600 text-slate-900 dark:text-white bg-white dark:bg-navy-950 font-black shadow-xs'
                    : 'border-transparent text-slate-800 dark:text-slate-100 font-extrabold hover:text-slate-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-800/60'
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
      <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-6 custom-scrollbar pt-2">

      {activeTab === 'overview' && (
        <>
      {/* PREMIUM BENTO GRID FOR STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Section: Rankings & Activity (7 columns) */}
        <div className="lg:col-span-7 bg-white dark:bg-navy-900/40 rounded-3xl border border-slate-200 dark:border-navy-700 p-5 sm:p-6 shadow-sm relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 p-32 bg-brand-500/5 dark:bg-brand-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex items-center space-x-2 mb-5 relative z-10">
            <Trophy className="w-4 h-4 text-brand-500 shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Rankings & Activity</h4>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-1.5 rounded-lg bg-brand-500/15 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">College Rank</p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">#{detail?.college_rank || '—'}</h3>
            </div>

            <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <Medal className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Dept Rank</p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">#{detail?.dept_rank || '—'}</h3>
            </div>

            <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Weekly Progress</p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">+{detail?.weekly_progress || 0}</h3>
            </div>

            <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Active Streak</p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{detail?.lc_activity?.current_streak || detail?.streak_count || 0} <span className="text-sm font-black text-amber-700 dark:text-amber-300">Days</span></h3>
            </div>
          </div>
        </div>

        {/* Right Section: Contest Metrics (5 columns) */}
        <div className="lg:col-span-5 bg-white dark:bg-navy-900/40 rounded-3xl border border-slate-200 dark:border-navy-700 p-5 sm:p-6 shadow-sm relative overflow-hidden backdrop-blur-xl flex flex-col">
          <div className="absolute bottom-0 right-0 p-32 bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl rounded-full translate-y-1/3 translate-x-1/3"></div>
          
          <div className="flex items-center space-x-2 mb-5 relative z-10">
            <Target className="w-4 h-4 text-indigo-500 shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Contest Performance</h4>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4 relative z-10">
            {/* Rating Highlight */}
            <div className="bg-gradient-to-br from-indigo-600 via-brand-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-brand-500/20 transform transition-transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-black text-white uppercase tracking-wider">Global Rating</p>
                <Award className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-white">
                {(detail?.lc_contest_standing?.contest_rating || detail?.stats?.contest_rating) ? (detail.lc_contest_standing?.contest_rating || detail.stats?.contest_rating).toLocaleString('en-US', { minimumFractionDigits: 1 }) : 'Unrated'}
              </h3>
            </div>

            {/* Official / Virtual Split */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">Official</p>
                <h3 className="text-2xl font-black text-slate-950 dark:text-white">{detail?.lc_contest_standing?.attended_count || detail?.stats?.official_contests || 0}</h3>
              </div>
              <div className="bg-slate-100/80 dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700 transition-transform hover:scale-[1.02] shadow-2xs">
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">Virtual</p>
                <h3 className="text-2xl font-black text-slate-950 dark:text-white">{detail?.stats?.virtual_contests || (detail?.has_virtual ? 1 : 0)}</h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Radar & Digital Student Pass */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkillRadarChart totalSolved={detail?.stats?.total_solved || 0} />
        <IDCardGenerator
          studentName={detail?.name || ''}
          regNo={detail?.reg_no || ''}
          deptName={detail?.department?.name || 'Department'}
          yearLevel={detail?.year_level || 'III'}
          totalSolved={detail?.stats?.total_solved || 0}
          collegeRank={detail?.college_rank || 1}
          streakCount={detail?.streak_count || 0}
          leetcodeUsername={detail?.username || detail?.leetcode_username || ''}
          contestRating={detail?.stats?.contest_rating || 0}
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
        
        {/* Pie Chart */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Problem Difficulty Breakdown</h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
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
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-700 dark:text-emerald-300">
              Easy: {easy}
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 font-bold text-amber-700 dark:text-amber-300">
              Med: {medium}
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 font-bold text-rose-700 dark:text-rose-300">
              Hard: {hard}
            </div>
          </div>
        </div>

        {/* Weak Topic AI Insights */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 bg-gradient-to-br from-amber-900/10 to-indigo-900/10 shadow-xl">
          <div className="flex items-center space-x-2 text-amber-500">
            <Lightbulb className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">AI Focus Recommendation</h3>
          </div>

          {insights ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase">Trajectory:</span>
                <span className="ml-2 font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {insights.trajectory}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">Recommended Weak Focus Areas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {insights.focus_areas.map((area: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 leading-relaxed">
                {insights.recommendation}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Loading topic insights...</p>
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
            studentName={student.name}
            regNo={student.reg_no || student.register_number}
            deptName={student?.department?.name || student?.department?.code || student.dept || 'Department'}
          />
        )}
      </React.Suspense>
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

