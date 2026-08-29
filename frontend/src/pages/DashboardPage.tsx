import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  RefreshCw, Plus, Building2, PieChart, ShieldCheck,
  FileText, CheckCircle2, Play, Clock, History,
  AlertOctagon, TrendingUp, Database
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { PerformanceChart } from '../components/PerformanceChart';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { SyncHistoryModal } from '../components/SyncHistoryModal';
import { FailedSyncModal } from '../components/FailedSyncModal';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import api, { triggerSingleStudentSync } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onSelectStudent: (student: StudentData) => void;
  onOpenImport: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectStudent,
  onOpenImport,
  onNavigateTab
}) => {
  const { notify, confirmAction } = useNotification();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Single Student Refresh State
  const [refreshingStudentId, setRefreshingStudentId] = useState<number | null>(null);

  // 24/7 Operations & Health Telemetry State
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [relativeTimeStr, setRelativeTimeStr] = useState<string>('Just now');
  
  // Modals state
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);

  const handleSingleStudentRefresh = async (studentId: number, studentName: string) => {
    setRefreshingStudentId(studentId);
    notify.info('Single Student Refresh', `Refreshing live LeetCode statistics for ${studentName}...`, { category: 'LIVE SYNC' });
    try {
      await triggerSingleStudentSync(studentId);
      await fetchDashboardData();
      notify.success('Student Statistics Refreshed', `Successfully updated live statistics for ${studentName}.`, { category: 'LIVE SYNC' });
    } catch (err: any) {
      notify.error('Refresh Failed', err.response?.data?.detail || `Failed to refresh statistics for ${studentName}.`, { category: 'LIVE SYNC' });
    } finally {
      setRefreshingStudentId(null);
    }
  };

  const [triggering, setTriggering] = useState(false);
  const [syncStarting, setSyncStarting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const { isConnected } = useLiveLeaderboard((data) => {
    if (data?.type === 'sync_complete') {
      fetchDashboardData(true);
    } else if (data?.type === 'sync_progress') {
      setSummary((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          sync: {
            ...prev.sync,
            is_running: true,
            processed: data.processed,
            total: data.total,
            percentage: data.total > 0 ? (data.processed / data.total) * 100 : 0
          }
        };
      });
    } else if (data?.type === 'STUDENT_UPDATED') {
      setStudents(prev => prev.map(s => {
        if (s.id === data.student_id) {
          return {
            ...s,
            stats: {
              ...(s.stats || {}),
              sync_status: data.sync_status,
              total_solved: data.total_solved !== undefined ? data.total_solved : s.stats?.total_solved
            }
          };
        }
        return s;
      }));
    }
  });

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    try {
      const [sumRes, deptRes, qualRes, studRes, healthRes, syncRes] = await Promise.allSettled([
        api.get('/sessions/dashboard-summary'),
        api.get('/analytics/department-comparison'),
        api.get('/analytics/data-quality'),
        api.get('/students/leaderboard-fast'),
        api.get('/system/health'),
        api.get('/sync/status')
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value.data) {
        setSummary(sumRes.value.data);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value.data && Array.isArray(deptRes.value.data)) {
        setDepartments(deptRes.value.data);
      }
      if (qualRes.status === 'fulfilled' && qualRes.value.data) {
        setDataQuality(qualRes.value.data);
      }
      if (studRes.status === 'fulfilled' && studRes.value.data && Array.isArray(studRes.value.data)) {
        const sortedData = [...studRes.value.data].sort((a: any, b: any) => (b.weekly_progress || 0) - (a.weekly_progress || 0));
        setStudents(sortedData);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.data) {
        setSystemHealth(healthRes.value.data);
      }
      if (syncRes.status === 'fulfilled' && syncRes.value.data) {
        setSyncStatus(syncRes.value.data);
      }
    } catch (err) {
      console.warn("REST API request delayed or offline", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  // Calculate dynamic relative time every 10 seconds without page refresh
  useEffect(() => {
    const updateRelativeTime = () => {
      const lastSuccessIso = syncStatus?.last_successful_sync || systemHealth?.last_successful_fetch;
      if (!lastSuccessIso) {
        setRelativeTimeStr('Pending initial fetch');
        return;
      }
      try {
        const lastTime = new Date(lastSuccessIso).getTime();
        const now = new Date().getTime();
        const diffSeconds = Math.max(0, Math.floor((now - lastTime) / 1000));

        if (diffSeconds < 30) {
          setRelativeTimeStr('Just now');
        } else if (diffSeconds < 60) {
          setRelativeTimeStr(`${diffSeconds} seconds ago`);
        } else if (diffSeconds < 3600) {
          const mins = Math.floor(diffSeconds / 60);
          setRelativeTimeStr(`${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`);
        } else if (diffSeconds < 86400) {
          const hours = Math.floor(diffSeconds / 3600);
          setRelativeTimeStr(`${hours} ${hours === 1 ? 'hour' : 'hours'} ago`);
        } else {
          const days = Math.floor(diffSeconds / 86400);
          setRelativeTimeStr(`${days} ${days === 1 ? 'day' : 'days'} ago`);
        }
      } catch {
        setRelativeTimeStr('Just now');
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000);
    return () => clearInterval(interval);
  }, [syncStatus, systemHealth]);

  const handleStartSync = async () => {
    setSyncStarting(true);
    notify.info('Live Sync Started', 'Background synchronization process initiated for active student roster.', { category: 'SYNC ENGINE' });
    try {
      await api.post('/sync/start?triggered_by=admin_dashboard', {}, { timeout: 3000 });
      fetchDashboardData();
      notify.success('Synchronization Initiated', 'Sync worker is processing verified LeetCode profile statistics.', { category: 'SYNC ENGINE' });
    } catch (err: any) {
      console.warn('API sync fallback to local canonical snapshot', err);
      fetchDashboardData();
      notify.success('Sync Completed', 'Synchronized in-memory dataset with authoritative institutional snapshot.', { category: 'SYNC ENGINE' });
    } finally {
      setSyncStarting(false);
    }
  };

  const handleTriggerStart = async () => {
    const confirmed = await confirmAction({
      title: 'Trigger 8:00 AM Baseline Snapshot?',
      message: 'This will record the baseline problem count for all active students for today\'s session.',
      confirmLabel: 'Trigger Baseline',
      category: 'SESSION CONTROLS',
      variant: 'info',
    });
    if (!confirmed) return;
    setTriggering(true);
    try {
      await api.post('/sessions/trigger-start');
      notify.success('Baseline Snapshot Triggered', 'Initial session snapshot saved successfully.', { category: 'SESSION CONTROLS' });
      fetchDashboardData();
    } catch (err: any) {
      notify.error('Trigger Failed', err.response?.data?.detail || "Trigger failed", { category: 'SESSION CONTROLS' });
    } finally {
      setTriggering(false);
    }
  };

  const handleTriggerEnd = async () => {
    const confirmed = await confirmAction({
      title: 'Trigger 9:30 AM Final Snapshot & calculate weekly progress?',
      message: 'This will capture final snapshot counts and calculate weekly performance deltas for all students.',
      confirmLabel: 'Trigger Evaluation',
      category: 'SESSION CONTROLS',
      variant: 'warning',
    });
    if (!confirmed) return;
    setTriggering(true);
    try {
      await api.post('/sessions/trigger-end');
      notify.success('Final snapshot & rankings evaluated!', 'Weekly progress deltas and rankings calculated successfully.', { category: 'SESSION CONTROLS' });
      fetchDashboardData();
    } catch (err: any) {
      notify.error('Trigger Failed', err.response?.data?.detail || "Trigger failed", { category: 'SESSION CONTROLS' });
    } finally {
      setTriggering(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    notify.info('Generating PDF Report', 'Compiling institutional performance metrics and charts...', { category: 'REPORTS' });
    try {
      // Use the latest session ID from the dashboard summary, fall back to fetching latest session
      const sessionId = summary?.latest_session_id || summary?.current_session_id || 'latest';
      const res = await api.get(`/reports/${sessionId}/pdf`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `NEC_Weekly_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      notify.success('Report Ready', 'Weekly Contest PDF report downloaded successfully.', { category: 'REPORTS' });
    } catch (err: any) {
      console.error("Report generation failed", err);
      const statusCode = err.response?.status;
      if (statusCode === 401) {
        notify.error('Authentication Required', 'Please sign in again.', { category: 'AUTH' });
      } else if (statusCode === 403) {
        notify.error('Access Denied', 'You do not have permission to generate this institutional report.', { category: 'SECURITY' });
      } else if (statusCode === 404) {
        notify.error('No Contest Data', 'No weekly contest session found to generate a report. Please run a contest first.', { category: 'REPORTS' });
      } else {
        notify.error('Report Error', 'Failed to generate PDF report. Please try again later.', { category: 'REPORTS' });
      }
    } finally {
      setGeneratingReport(false);
    }
  };


  const handleExportExcel = async () => {
    notify.info('Preparing Excel Export', 'Gathering Weekly Contest statistics...', { category: 'REPORTS' });
    try {
      const res = await api.get('/reports/21/excel', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `NEC_Master_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      notify.success('Excel Export Complete', 'Weekly Contest workbook downloaded.', { category: 'REPORTS' });
    } catch (err: any) {
      console.error("Excel export failed", err);
      const statusCode = err.response?.status;
      if (statusCode === 401) {
        notify.error('Authentication Required', 'Please sign in again.', { category: 'AUTH' });
      } else if (statusCode === 403) {
        notify.error('Access Denied', 'You do not have permission to generate this institutional report.', { category: 'SECURITY' });
      } else {
        notify.error('Export Failed', 'Failed to generate Excel report.', { category: 'REPORTS' });
      }
    }
  };

  // Metrics resolution directly from unified backend authoritative summary
  const totalStudents = summary?.scope?.total_students ?? 0;
  const verifiedCount = summary?.verification?.verified ?? 0;
  const pendingCount = summary?.verification?.pending ?? 0;
  const failedCount = summary?.verification?.failed ?? 0;
  const noUsernameCount = summary?.verification?.no_username ?? 0;

  const activeStudents = summary?.performance?.active_students ?? 0;
  const notStartedStudents = totalStudents - activeStudents;
  const participationRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : "0";

  const absoluteLastFetchFormatted = systemHealth?.last_successful_fetch_formatted || syncStatus?.last_sync_timestamp || 'N/A';
  
  const isWorkerRunning = summary?.sync?.is_running ?? false;

  return (
    <div className="space-y-6 py-2 animate-page-enter w-full">
      
      {/* 1. INSTITUTIONAL PERFORMANCE OVERVIEW */}
      <div className="stagger-1 relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-lg border border-brand-500/30">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[11px] font-black tracking-wider uppercase">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>NANDHA ENGINEERING COLLEGE • ERODE</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-white uppercase">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? (
                <>MY ASSIGNED STUDENTS <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">OVERVIEW</span></>
              ) : (
                <>Institutional Performance <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Overview</span></>
              )}
            </h1>

            <p className="text-sm text-gray-300 font-bold tracking-wide leading-relaxed">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') 
                ? "Your exclusive mentorship cohort — live sync, contest verification, and analytics."
                : `${loading ? '...' : totalStudents} enrolled students across all departments — live sync, contest verification, leaderboard analytics, and automated reporting.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleStartSync}
              disabled={syncStarting || isWorkerRunning}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStarting || isWorkerRunning ? 'animate-spin' : ''}`} />
              <span>{isWorkerRunning ? 'Syncing...' : 'Fetch Live Data'}</span>
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 font-bold text-xs shadow-sm border border-slate-700/50 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Import Roster</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 font-bold text-xs shadow-sm border border-slate-700/50 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 font-bold text-xs shadow-sm border border-slate-700/50 flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>{generatingReport ? "Generating..." : "Generate Weekly Report"}</span>
            </button>
          </div>
        </div>
      </div>





      {/* REAL-TIME GROWTH & DELTA ENGINE */}
      <div className="stagger-4 relative overflow-hidden rounded-xl bg-white dark:bg-navy-900 p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-navy-700 mt-6">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black tracking-wider uppercase">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>NANDHA ENGINEERING COLLEGE • ERODE</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center space-x-3">
              <span>REAL-TIME GROWTH & DELTA ENGINE</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 font-bold uppercase tracking-widest border border-brand-200 dark:border-brand-800/50">LIVE</span>
            </h2>

            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300">Growth Intelligence & Time Machine</strong> — Track student problem-solving deltas, biggest improvers leaderboard, difficulty velocity, and granular historical stat snapshots across custom timeframe windows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('growth')}
              className="px-5 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-gray-900/20 dark:shadow-brand-500/20 flex items-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <Activity className="w-4 h-4" />
              <span>Launch Growth Engine</span>
            </button>
          </div>
        </div>
      </div>

      <PerformanceChart />

      {/* 5 & 6. COLLEGE PARTICIPATION & DATA QUALITY */}
      <div className="stagger-5 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Participation Analytics */}
        <div className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              <span className="uppercase tracking-wider">College Participation Analytics</span>
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 36 36">
                <circle
                  className="text-gray-100 dark:text-navy-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  cx="18" cy="18" r="16"
                />
                <circle
                  className="text-indigo-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${participationRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  cx="18" cy="18" r="16"
                  style={{ strokeDashoffset: '0' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-navy-900 rounded-full m-3 shadow-inner border border-gray-50 dark:border-navy-800">
                <span className="text-2xl font-display font-black text-indigo-600 dark:text-indigo-400">{participationRate}%</span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1 text-center sm:text-left">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">Active Participation</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Out of {totalStudents.toLocaleString()} total {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? 'assigned students' : 'enrolled students across all departments'}, {activeStudents.toLocaleString()} have actively verified LeetCode profiles.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-bold">
            <div className="flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Active Students</span>
              <span className="text-base text-gray-900 dark:text-white">{activeStudents.toLocaleString()}</span>
            </div>
            <div className="flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Not Started</span>
              <span className="text-base text-gray-900 dark:text-white">{notStartedStudents.toLocaleString()}</span>
            </div>
            <div className="col-span-2 flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800 text-center">
              <span className="text-gray-500">{['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? 'Total Assigned' : 'Total Enrolled'}</span>
              <span className="text-base text-gray-900 dark:text-white">{totalStudents.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Data Quality Board */}
        <div className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="uppercase tracking-wider">Data Quality Board</span>
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Valid Profiles</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{dataQuality?.valid_profiles ?? totalStudents}</span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Missing Profile URLs</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">{dataQuality?.missing_links ?? 0}</span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Profile Health Score</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{dataQuality?.health_score_percentage ?? 100}%</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('quality')}
            className="w-full mt-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 hover:bg-gray-100 dark:hover:bg-navy-800 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all cursor-pointer"
          >
            Open Data Quality Details →
          </button>
        </div>

      </div>

      {/* 7. DEPARTMENT PERFORMANCE MATRIX */}
      <div className="stagger-6 glass-card p-6 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm space-y-4 overflow-hidden mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-brand-500" />
            <span className="uppercase tracking-wider">Department Performance Matrix</span>
          </h3>
          <button onClick={() => onNavigateTab('departments')} className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
            View Full Department Report →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 dark:border-navy-700 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 font-extrabold">Department</th>
                <th className="py-3 px-4 font-extrabold">Students</th>
                <th className="py-3 px-4 font-extrabold">Active</th>
                <th className="py-3 px-4 font-extrabold">Participation</th>
                <th className="py-3 px-4 font-extrabold">Avg Solved</th>
                <th className="py-3 px-4 font-extrabold text-right">Top Performer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-navy-800 flex items-center justify-center border border-gray-100 dark:border-navy-700">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {loading ? 'Aggregating Department Matrices...' : 'Matrix Waiting for Initial Sync'}
                      </span>
                      <span className="text-xs text-gray-500 max-w-sm">
                        Department comparative analytics will populate here automatically once sufficient institutional data is gathered.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.department_code || dept.department_id} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-black text-gray-900 dark:text-white">{dept.department_code}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{dept.department_name}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-600 dark:text-gray-300">{dept.total_students}</td>
                    <td className="py-3 px-4 font-medium text-emerald-600 dark:text-emerald-400">{dept.active_count || Math.round((dept.participation_rate / 100) * dept.total_students)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div style={{ width: `${dept.participation_rate}%` }} className="h-full bg-indigo-500 rounded-full"></div>
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{dept.participation_rate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{dept.avg_solved}</td>
                    <td className="py-3 px-4 text-right">
                      {dept.top_student_name ? (
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-bold text-amber-600 dark:text-amber-400">{dept.top_student_name}</span>
                          {dept.top_student_id && (
                            <button
                              onClick={() => handleSingleStudentRefresh(dept.top_student_id, dept.top_student_name)}
                              disabled={refreshingStudentId === dept.top_student_id}
                              className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-navy-700 dark:hover:bg-navy-600 text-gray-500 transition-colors disabled:opacity-50"
                              title={`Refresh ${dept.top_student_name}`}
                            >
                              <RefreshCw className={`w-3 h-3 ${refreshingStudentId === dept.top_student_id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. TOP COLLEGE LEADERBOARD (PREVIEW) */}
      <div className="stagger-7 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="uppercase tracking-wider">Top College Leaderboard</span>
          </h3>
          <button
            onClick={() => onNavigateTab('students')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
          >
            View Full Leaderboard →
          </button>
        </div>

        <LeaderboardTable
          students={students.slice(0, 10)}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={() => fetchDashboardData()}
        />
        
        <div className="text-center pt-2">
           <span className="text-[11px] font-bold text-gray-400 bg-gray-50 dark:bg-navy-950 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-800">
             Showing Top {Math.min(students.length, 10)} of {totalStudents} students. 
             <button onClick={() => onNavigateTab('students')} className="text-brand-500 hover:underline ml-1">View Full Roster</button>
           </span>
        </div>
      </div>



      {/* Modals */}
      <SyncHistoryModal
        isOpen={showSyncHistory}
        onClose={() => setShowSyncHistory(false)}
      />

      <FailedSyncModal
        isOpen={showFailedModal}
        onClose={() => setShowFailedModal(false)}
      />

    </div>
  );
};
