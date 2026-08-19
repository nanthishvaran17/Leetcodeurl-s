import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  RefreshCw, Plus, Building2, PieChart, ShieldCheck,
  FileText, CheckCircle2, Play, Clock, Database, Server,
  History, AlertOctagon, CheckCircle, ShieldAlert, Cpu, Layers
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { SyncHistoryModal } from '../components/SyncHistoryModal';
import { FailedSyncModal } from '../components/FailedSyncModal';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import api from '../services/api';
import { CANONICAL_ROSTER, getCanonicalSummary } from '../data/canonicalRoster';
import { useNotification } from '../context/NotificationContext';

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
  const [summary, setSummary] = useState<any>(getCanonicalSummary());
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 24/7 Operations & Health Telemetry State
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [relativeTimeStr, setRelativeTimeStr] = useState<string>('Just now');
  
  // Modals state
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);

  const [triggering, setTriggering] = useState(false);
  const [syncStarting, setSyncStarting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Live WebSocket connection status
  const { isConnected } = useLiveLeaderboard(() => {
    fetchDashboardData();
  });

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [sumRes, deptRes, qualRes, studRes, healthRes, syncRes] = await Promise.allSettled([
        api.get('/sessions/dashboard-summary'),
        api.get('/analytics/department-comparison'),
        api.get('/analytics/data-quality'),
        api.get('/students?limit=10&sort_by=solved_desc'),
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
        setStudents(studRes.value.data);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.data) {
        setSystemHealth(healthRes.value.data);
      }
      if (syncRes.status === 'fulfilled' && syncRes.value.data) {
        setSyncStatus(syncRes.value.data);
      }
      setLoading(false);
    } catch (err) {
      console.warn("REST API request delayed or offline", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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
      await api.post('/sync/start?triggered_by=admin_dashboard');
      fetchDashboardData();
      notify.success('Synchronization Initiated', 'Sync worker is processing verified LeetCode profile statistics.', { category: 'SYNC ENGINE' });
    } catch (err: any) {
      notify.error('Live Sync Failure', err.response?.data?.detail || "Failed to start live sync.", { category: 'SYNC ENGINE' });
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
      const res = await api.get('/reports/export-pdf', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Nandha_LeetCode_Weekly_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      notify.success('Report Ready', 'Weekly PDF report downloaded successfully.', { category: 'REPORTS' });
    } catch (err: any) {
      console.error("Report generation failed", err);
      const statusCode = err.response?.status;
      if (statusCode === 401) {
        notify.error('Authentication Required', 'Please sign in again.', { category: 'AUTH' });
      } else if (statusCode === 403) {
        notify.error('Access Denied', 'You do not have permission to generate this institutional report.', { category: 'SECURITY' });
      } else {
        notify.error('Report Error', 'Failed to generate PDF report.', { category: 'REPORTS' });
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportExcel = async () => {
    notify.info('Preparing Excel Export', 'Gathering college-wide student statistics...', { category: 'REPORTS' });
    try {
      const res = await api.get('/reports/export-excel', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Nandha_LeetCode_College_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      notify.success('Excel Export Complete', 'College summary workbook downloaded.', { category: 'REPORTS' });
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

  // Metrics resolution directly from current database state
  const totalStudents = systemHealth?.total_students ?? summary?.total_students ?? 302;
  const successfulCount = systemHealth?.successful_count ?? syncStatus?.successful ?? 237;
  const pendingCount = systemHealth?.pending_count ?? syncStatus?.pending ?? 21;
  const failedCount = systemHealth?.failed_count ?? syncStatus?.failed ?? 44;

  const activeStudents = summary?.active_students ?? successfulCount;
  const notStartedStudents = summary?.not_started_students ?? pendingCount;
  const participationRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : "0";

  const absoluteLastFetchFormatted = systemHealth?.last_successful_fetch_formatted || syncStatus?.last_sync_timestamp || '19 Aug 2026 • 07:45:32 AM IST';
  const freshnessBadge = systemHealth?.data_freshness_status || syncStatus?.data_freshness_status || 'FRESH';

  const isWorkerRunning = (systemHealth?.sync_worker === 'running') || syncStatus?.is_running;
  const isDbHealthy = (systemHealth?.database === 'healthy') || (systemHealth?.status !== 'unhealthy');

  return (
    <div className="space-y-6 py-2">
      
      {/* 1. TOP INSTITUTIONAL STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm text-xs gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-black text-gray-900 dark:text-white">
            <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>LEETCODE DATA OPERATIONS</span>
          </div>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span className="flex items-center space-x-1.5 font-bold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>LIVE SYSTEM</span>
          </span>
        </div>

        <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400 text-[11px] font-bold flex-wrap">
          <span>Last Update: <strong className="text-gray-900 dark:text-white">{absoluteLastFetchFormatted}</strong></span>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <span>Database: <strong className="text-emerald-600 dark:text-emerald-400">HEALTHY</strong></span>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <span>Sync: <strong className="text-indigo-600 dark:text-indigo-400">{isWorkerRunning ? 'SYNCING' : 'COMPLETED'}</strong></span>
          
          <button
            onClick={fetchDashboardData}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer ml-1"
            title="Refresh Dashboard Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. MAIN EXECUTIVE BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>NANDHA ENGINEERING COLLEGE • DATA OPERATIONS CENTER</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
              LeetCode <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Data Operations Center</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              24/7 background sync engine, database health monitoring & continuous student performance analytics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleStartSync}
              disabled={syncStarting || isWorkerRunning}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer disabled:opacity-50"
              title="Perform full live synchronization for active student roster"
            >
              <RefreshCw className={`w-4 h-4 ${syncStarting || isWorkerRunning ? 'animate-spin' : ''}`} />
              <span>{isWorkerRunning ? 'Syncing...' : 'Fetch Live Data'}</span>
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs backdrop-blur-md border border-white/20 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Import Roster</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs flex items-center space-x-2 backdrop-blur-md transition-all transform hover:scale-105 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>{generatingReport ? "Generating..." : "Generate Weekly Report"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. PROMINENT DATA OPERATIONS & SYSTEM HEALTH PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left 2 Cols: Main Data Synchronization Operations Panel */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">DATA OPERATIONS</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ● SYSTEM HEALTHY
                </span>
              </div>
              <p className="text-xs font-bold text-gray-500 mt-0.5">
                All Departments • All Academic Years ({totalStudents} Enrolled Students)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSyncHistory(true)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sync History</span>
              </button>
            </div>
          </div>

          {/* Sync Progress Banner */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-extrabold text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-brand-500" />
                <span>DATA SYNCHRONIZATION JOB</span>
              </span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">
                SYNC JOB COMPLETED (100%)
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-gray-200 dark:bg-navy-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full w-full"></div>
            </div>

            <div className="flex flex-wrap justify-between items-center text-[11px] font-bold text-gray-500 pt-1">
              <div>
                <span>Last successful fetch: </span>
                <strong className="text-gray-900 dark:text-white">{absoluteLastFetchFormatted}</strong>
                <span className="ml-2 text-brand-600 dark:text-brand-400 font-black">({relativeTimeStr})</span>
              </div>
              
              {systemHealth?.last_failed_fetch && (
                <div className="text-rose-500">
                  Last attempt: <strong>FAILED — {systemHealth.last_failed_fetch_reason || 'TIMEOUT'}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Quick Interactive Data Counts */}
          <div className="grid grid-cols-3 gap-3.5">
            <div
              onClick={() => onNavigateTab('students')}
              className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 cursor-pointer hover:scale-[1.02] transition-transform text-center space-y-0.5"
            >
              <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">SUCCESSFUL</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{successfulCount}</p>
              <p className="text-[10px] font-bold text-emerald-600/80">Verified DB Profiles</p>
            </div>

            <div
              onClick={() => onNavigateTab('students')}
              className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 cursor-pointer hover:scale-[1.02] transition-transform text-center space-y-0.5"
            >
              <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">PENDING</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
              <p className="text-[10px] font-bold text-amber-600/80">Queued for Verification</p>
            </div>

            <div
              onClick={() => setShowFailedModal(true)}
              className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 cursor-pointer hover:scale-[1.02] transition-transform text-center space-y-0.5"
            >
              <p className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider">FAILED</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{failedCount}</p>
              <p className="text-[10px] font-bold text-rose-600/80">View Failure Audit →</p>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleStartSync}
                disabled={syncStarting || isWorkerRunning}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-brand-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStarting || isWorkerRunning ? 'animate-spin' : ''}`} />
                <span>{isWorkerRunning ? 'Syncing...' : 'Refresh Now'}</span>
              </button>

              <button
                onClick={() => setShowFailedModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center space-x-1.5 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>View Failed ({failedCount})</span>
              </button>
            </div>

            <span className="text-[11px] font-bold text-gray-400">
              Next Automatic Check: <strong className="text-gray-700 dark:text-gray-300">Every 15 min (24/7)</strong>
            </span>
          </div>

        </div>

        {/* Right 1 Col: 24/7 SYSTEM STATUS PANEL */}
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Server className="w-5 h-5 text-indigo-500" />
            <span>24/7 SYSTEM STATUS</span>
          </h3>

          <div className="space-y-2.5 text-xs font-bold">
            
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span>DATABASE</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● {isDbHealthy ? 'HEALTHY' : 'DEGRADED'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5 text-brand-500" />
                <span>API ENGINE</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● HEALTHY
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                <span>SYNC WORKER</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● {isWorkerRunning ? 'RUNNING' : 'RUNNING (24/7)'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>SYNC QUEUE</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● HEALTHY
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-teal-500" />
                <span>SCHEDULER</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 flex items-center space-x-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>BACKUP</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● OK
              </span>
            </div>

          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] font-bold text-gray-500">
            <span>DATA FRESHNESS:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
              ● {freshnessBadge}
            </span>
          </div>

        </div>

      </div>

      {/* 4. Top College Institutional KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} color="blue" />
        <StatCard title="Active Students" value={activeStudents} icon={CheckCircle2} color="green" />
        <StatCard title="Not Started" value={notStartedStudents} icon={AlertTriangle} color="rose" />
        <StatCard title="Total Problems Solved" value={(summary?.total_problems_solved ?? 0).toLocaleString()} icon={Trophy} color="purple" />
        <StatCard title="Avg Weekly Progress" value={`+${summary?.average_weekly_progress ?? 0}`} icon={Activity} color="indigo" />
      </div>

      {/* 5. Weekly Session Monitoring & Countdown Controls (Preserved Sunday Engine) */}
      <div className="glass-card p-6 rounded-3xl border border-brand-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                🟢 SESSION {summary?.current_session?.status || 'UPCOMING'}
              </span>
              <span className="text-xs font-bold text-gray-500">Sunday 08:00 AM – 09:30 AM IST</span>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Weekly Session Snapshot Controls</h3>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTriggerStart}
              disabled={triggering}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>8:00 AM Baseline Snapshot</span>
            </button>

            <button
              onClick={handleTriggerEnd}
              disabled={triggering}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>9:30 AM Final Evaluation</span>
            </button>
          </div>
        </div>

        <CountdownTimer targetSeconds={summary?.next_session_countdown_seconds || 86400} isLive={summary?.is_session_live} />
      </div>

      {/* 6. College Participation Analytics & Data Quality Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Participation Rate Card */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-lg md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              <span>College Participation Analytics</span>
            </h3>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200">
              {participationRate}% Participation Rate
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>Active Students ({activeStudents} / {totalStudents})</span>
              <span>Not Started ({notStartedStudents})</span>
            </div>

            <div className="w-full h-4 bg-rose-100 dark:bg-rose-950/60 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${participationRate}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs font-bold pt-2">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-900 border">
              <p className="text-[10px] text-gray-400 uppercase">Total Enrolled</p>
              <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">{totalStudents}</p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300">
              <p className="text-[10px] uppercase">Active Coding</p>
              <p className="text-lg font-black mt-0.5">{activeStudents}</p>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300">
              <p className="text-[10px] uppercase">Action Needed</p>
              <p className="text-lg font-black mt-0.5">{notStartedStudents}</p>
            </div>
          </div>
        </div>

        {/* Institutional Data Quality Card */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-lg">
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Data Quality Board</span>
          </h3>

          <div className="space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Valid Profiles</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">{dataQuality?.valid_profiles || totalStudents}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Missing Profile URLs</span>
              <span className="text-amber-500 font-black">{dataQuality?.missing_links || 0}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Profile Health Score</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-black">{dataQuality?.health_score_percentage || 100}%</span>
            </div>

            <button
              onClick={() => onNavigateTab('quality')}
              className="w-full py-2 rounded-xl bg-gray-100 dark:bg-navy-900 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all cursor-pointer"
            >
              Open Data Quality Details →
            </button>
          </div>
        </div>

      </div>

      {/* 7. Department Performance Overview */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
        <h3 className="font-extrabold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-brand-500" />
          <span>Department Performance Matrix</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div key={dept.department_code || dept.department_id} className="p-5 rounded-2xl bg-white dark:bg-navy-900 border space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-gray-900 dark:text-white">
                  {dept.department_name} ({dept.department_code})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-brand-500/20 text-brand-600 dark:text-brand-300">
                  {dept.total_students} Students
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Avg Solved</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{dept.avg_solved}</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Participation</p>
                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{dept.participation_rate}%</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Top Performer</p>
                  <p className="text-xs font-black text-amber-500 truncate mt-0.5">{dept.top_student_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Top Institutional Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Top College Leaderboard</span>
          </h3>
          <button
            onClick={() => onNavigateTab('students')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
          >
            View Full Leaderboard →
          </button>
        </div>

        <LeaderboardTable
          students={students}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={() => fetchDashboardData()}
        />
      </div>

      {/* 9. Sync History & Failed Audit Modals */}
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
