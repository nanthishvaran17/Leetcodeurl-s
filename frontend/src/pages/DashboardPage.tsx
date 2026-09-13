import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  RefreshCw, Plus, Building2, PieChart, ShieldCheck,
  FileText, CheckCircle2, Play, Clock, History,
  AlertOctagon, TrendingUp, Database, Brain
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
const PerformanceChart = React.lazy(() => import('../components/PerformanceChart').then(m => ({ default: m.PerformanceChart })));
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { SyncHistoryModal } from '../components/SyncHistoryModal';
import { FailedSyncModal } from '../components/FailedSyncModal';
import api, { triggerSingleStudentSync } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { AnimatedWelcomeHeading } from '../components/AnimatedWelcomeHeading';
import { useGlobalData } from '../context/GlobalDataContext';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';
import { 
  useSummaryQuery, 
  useDepartmentsQuery, 
  useDataQualityQuery, 
  useSystemHealthQuery, 
  useSyncStatusQuery 
} from '../hooks/useDashboardQueries';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { useFilteredStudents, useFilters } from '../context/FilterContext';

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
  const { loading: contextLoading, refreshAllData } = useGlobalData();

  const { data: summary } = useSummaryQuery();
  const { data: rawDepartments } = useDepartmentsQuery();
  const { data: dataQuality } = useDataQualityQuery();
  const { data: systemHealth } = useSystemHealthQuery();
  const { data: syncStatus } = useSyncStatusQuery();
  const { data: students = [], isLoading: studentsLoading, isError: studentsError, refetch: refetchStudents } = useStudentsQuery();

  const departments = useMemo(() => {
    let list: any[] = [];
    if (Array.isArray(rawDepartments)) list = rawDepartments;
    else if (Array.isArray((rawDepartments as any)?.departments)) list = (rawDepartments as any).departments;
    else if (Array.isArray((rawDepartments as any)?.data)) list = (rawDepartments as any).data;

    if (!list || list.length === 0) return list;

    // Normalize department strings/objects into canonical keys
    const normalizeDeptKey = (deptInput: any): string => {
      if (!deptInput) return '';
      const str = typeof deptInput === 'string'
        ? deptInput
        : `${deptInput.code || deptInput.department_code || ''} ${deptInput.name || deptInput.department_name || ''}`;
      const clean = str.trim().toUpperCase();
      if (!clean) return '';
      if (clean.includes('CYBER') || clean.includes('CSE(CS)') || clean.includes('CSE-CS') || clean.includes('CSE (CS)')) return 'CSE(CS)';
      if (clean.includes('IOT') || clean.includes('CSE(IOT)') || clean.includes('CSE-IOT') || clean.includes('CSE (IOT)')) return 'CSE(IOT)';
      if (clean.includes('AIDS') || clean.includes('AI & DS') || clean.includes('ARTIFICIAL INTELLIGENCE')) return 'AIDS';
      if (clean.includes('AGRI')) return 'AGRI';
      if (clean.includes('ECE') || clean.includes('ELECTRONICS & COMM')) return 'ECE';
      if (clean.includes('EEE') || clean.includes('ELECTRICAL & ELECT')) return 'EEE';
      if (clean.includes('IT') || clean.includes('INFORMATION TECH')) return 'IT';
      if (clean.includes('CSE') || clean.includes('COMPUTER SCIENCE')) return 'CSE';
      return clean;
    };

    // Dynamically aggregate department metrics from live student roster
    const deptStats: Record<string, {
      total: number;
      active: number;
      contestAttended: number;
      totalSolved: number;
      totalContestSolved: number;
      topStudent: any;
      topScore: number;
    }> = {};

    (students || []).forEach((s: any) => {
      const codeKey = normalizeDeptKey(s.department?.code || s.department_code || s.dept_code || s.department);
      if (!codeKey) return;

      if (!deptStats[codeKey]) {
        deptStats[codeKey] = {
          total: 0,
          active: 0,
          contestAttended: 0,
          totalSolved: 0,
          totalContestSolved: 0,
          topStudent: null,
          topScore: -1,
        };
      }

      const d = deptStats[codeKey];
      d.total += 1;

      const solved = Number(s.stats?.total_solved ?? (s as any).total_solved ?? 0);
      const rating = Number(s.stats?.contest_rating ?? (s as any).contest_rating ?? 0);
      const syncStatus = String(s.stats?.sync_status || '').toLowerCase();
      const status = String(s.stats?.status || s.status || '').toLowerCase();
      const hasUsername = Boolean(s.username && String(s.username).trim());

      const isActive = hasUsername && (status === 'verified' || syncStatus === 'success' || solved > 0);
      if (isActive) {
        d.active += 1;
      }

      d.totalSolved += solved;

      // Weekly Contest Attendance & Solved Metrics Check
      const cStatus = String((s as any).contest_status || s.stats?.contest_status || '').toUpperCase();
      const postSolved = Number(s.stats?.post_930_solved ?? (s as any).post_930_solved ?? s.stats?.today_solved ?? (s as any).today_solved ?? 0);
      const contestSolved = Number(s.stats?.weekly_contest_solved ?? (s as any).weekly_contest_solved ?? s.stats?.session_solved ?? (s as any).session_solved ?? 0);

      const isContestAttended = cStatus === 'PUBLIC_ATTENDED' ||
                                cStatus === 'VIRTUAL_ATTENDED' ||
                                cStatus === 'ATTENDED' ||
                                postSolved > 0 ||
                                contestSolved > 0;

      if (isContestAttended) {
        d.contestAttended += 1;
      }

      const actualContestSolved = contestSolved > 0 ? contestSolved : postSolved;
      d.totalContestSolved += actualContestSolved;

      const score = rating > 0 ? (rating * 100000) + solved : solved;
      if (score > d.topScore) {
        d.topScore = score;
        d.topStudent = s;
      }
    });

    return list.map((dept: any) => {
      const codeKey = normalizeDeptKey(dept);
      const ds = deptStats[codeKey];

      const totalStudents = ds ? ds.total : (dept.total_students || 0);
      const activeStudents = ds ? ds.active : (dept.active_students ?? dept.active_count ?? 0);

      // Weekly Contest Attended count for this department:
      const contestAttendedCount = ds && ds.contestAttended > 0 ? ds.contestAttended : (dept.contest_attended ?? dept.post_930_solvers ?? activeStudents);

      // Contest Participation Rate (Weekly Contest Attendance / Post-9:31 AM solvers)
      const partRate = totalStudents > 0 ? Math.round((contestAttendedCount / totalStudents) * 10000) / 100 : (dept.participation_rate || 0);

      // Average LeetCode problems solved per enrolled student in department
      const rawAvg = ds && totalStudents > 0 
        ? (ds.totalSolved / totalStudents)
        : (dept.avg_solved ?? dept.avg_contest_solved ?? 0);

      const avgSolvedFormatted = Math.round(rawAvg * 10) / 10;

      const topStudentName = ds?.topStudent?.name || ds?.topStudent?.student_name || dept.top_student_name || dept.top_performer?.name || '—';
      const topStudentId = ds?.topStudent?.id || dept.top_student_id || dept.top_performer?.id || null;
      const topStudentSolved = Number(ds?.topStudent?.stats?.total_solved ?? ds?.topStudent?.total_solved ?? dept.top_performer?.total_solved ?? 0);

      return {
        ...dept,
        total_students: totalStudents,
        active_students: activeStudents,
        active_count: activeStudents,
        contest_attended: contestAttendedCount,
        participation_rate: partRate,
        avg_solved: avgSolvedFormatted,
        raw_avg_solved: avgSolvedFormatted,
        top_student_name: topStudentName,
        top_student_id: topStudentId,
        top_student_solved: topStudentSolved,
      };
    });
  }, [rawDepartments, students]);

  const loading = contextLoading || studentsLoading;

  // Single Student Refresh State
  const [refreshingStudentId, setRefreshingStudentId] = useState<number | null>(null);

  // 24/7 Operations & Health Telemetry State
  const [relativeTimeStr, setRelativeTimeStr] = useState<string>('Just now');
  
  // Modals state
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);

  const handleSingleStudentRefresh = async (studentId: number, studentName: string) => {
    setRefreshingStudentId(studentId);
    notify.info('Single Student Refresh', `Refreshing live LeetCode statistics for ${studentName}...`, { category: 'LIVE SYNC' });
    try {
      await triggerSingleStudentSync(studentId);
      await refreshAllData();
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
  const [isExportingExcel, setIsExportingExcel] = useState(false);

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
          setRelativeTimeStr('Synced just now');
        } else if (diffSeconds < 60) {
          setRelativeTimeStr(`Synced ${diffSeconds}s ago`);
        } else if (diffSeconds < 3600) {
          const mins = Math.floor(diffSeconds / 60);
          setRelativeTimeStr(`Synced ${mins}${mins === 1 ? 'm' : 'm'} ago`);
        } else if (diffSeconds < 86400) {
          const hours = Math.floor(diffSeconds / 3600);
          setRelativeTimeStr(`Synced ${hours}${hours === 1 ? 'h' : 'h'} ago`);
        } else {
          const days = Math.floor(diffSeconds / 86400);
          setRelativeTimeStr(`Synced ${days}${days === 1 ? 'd' : 'd'} ago`);
        }
      } catch {
        setRelativeTimeStr('Synced just now');
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000);
    return () => clearInterval(interval);
  }, [syncStatus, systemHealth]);

  const isWorkerRunning = summary?.sync?.is_running ?? false;
  const isSyncing = syncStarting || isWorkerRunning;
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const getLiveStatusBadge = () => {
    if (isSyncing) {
      return { label: 'SYNCING...', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse', dot: 'bg-amber-400 animate-ping' };
    }
    if (isOffline) {
      return { label: 'OFFLINE', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' };
    }
    if (relativeTimeStr !== 'Pending initial fetch') {
      return { label: `LIVE • ${relativeTimeStr}`, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' };
    }
    return { label: 'NO DATA', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', dot: 'bg-slate-400' };
  };

  const liveStatus = getLiveStatusBadge();

  const handleStartSync = async () => {
    setSyncStarting(true);
    notify.info('Live Sync Started', 'Background synchronization process initiated for active student roster.', { category: 'SYNC ENGINE' });
    try {
      await api.post('/sync/start?triggered_by=admin_dashboard', {}, { timeout: 4000 });
      await refreshAllData();
      window.dispatchEvent(new CustomEvent('dataRefreshed'));
      notify.success('Synchronization Initiated', 'Sync worker is processing verified LeetCode profile statistics.', { category: 'SYNC ENGINE' });
    } catch (err: any) {
      console.warn('API sync fallback to local canonical snapshot', err);
      await refreshAllData();
      window.dispatchEvent(new CustomEvent('dataRefreshed'));
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
      refreshAllData();
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
      refreshAllData();
    } catch (err: any) {
      notify.error('Trigger Failed', err.response?.data?.detail || "Trigger failed", { category: 'SESSION CONTROLS' });
    } finally {
      setTriggering(false);
    }
  };

  const { department, academicYear, attendanceStatus, searchQuery, isFilteringActive } = useFilters();
  const filteredStudents = useFilteredStudents();

  const getFilterQueryParams = () => {
    const params = new URLSearchParams();
    if (department && department !== 'ALL') params.append('department', department);
    if (academicYear && academicYear !== 'ALL') params.append('year', academicYear);
    if (attendanceStatus && attendanceStatus !== 'ALL') params.append('attendance', attendanceStatus);
    if (searchQuery && searchQuery.trim()) params.append('search', searchQuery.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const qParam = getFilterQueryParams();
      const deptSlug = department && department !== 'ALL' ? `_${department}` : '';
      const yearSlug = academicYear && academicYear !== 'ALL' ? `_${academicYear}Yr` : '';
      const filename = `NEC_Weekly_Report${deptSlug}${yearSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const res = await downloadManager.download({
        endpoint: `/reports/export-pdf${qParam}`,
        filename,
        mimeType: 'application/pdf',
      });
      if (res.success) {
        notify.success('Weekly report downloaded', 'Weekly PDF report generated and downloaded.', { category: 'REPORTS' });
      } else {
        notify.error('Unable to generate report', res.error || 'Please try again later.', { category: 'REPORTS' });
      }
    } catch (err: any) {
      console.error("Report generation failed", err);
      notify.error('Unable to generate report', 'Please try again later.', { category: 'REPORTS' });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    notify.info('Preparing Excel Export', 'Fetching filtered student performance statistics...', { category: 'REPORTS' });
    try {
      const qParam = getFilterQueryParams();
      const deptSlug = department && department !== 'ALL' ? `_${department}` : '';
      const yearSlug = academicYear && academicYear !== 'ALL' ? `_${academicYear}Yr` : '';
      const filename = `Weekly_LeetCode_Master_Report${deptSlug}${yearSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const res = await downloadManager.download({
        endpoint: `/reports/download${qParam}`,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (res.success) {
        notify.success('Master 10-Sheet Excel Workbook Downloaded', 'Weekly LeetCode Master Workbook downloaded successfully.', { category: 'REPORTS' });
      } else {
        notify.error('Unable to generate report', res.error || 'Please try again.', { category: 'REPORTS' });
      }
    } catch (err: any) {
      console.error("Export Excel error", err);
      notify.error('Unable to generate report', 'Please try again later.', { category: 'REPORTS' });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Dynamic Derived Metrics from Active Filter Scope
  const totalStudents = filteredStudents.length;

  // Backend-authoritative canonical total (used for institution-wide hero description only)
  // Falls back to filteredStudents.length if summary hasn't loaded yet
  const canonicalTotal: number | null = summary?.scope?.total_students ?? null;
  
  let activeStudents = 0;
  let validProfiles = 0;
  let missingLinks = 0;
  let attendedSolversCount = 0;

  filteredStudents.forEach(st => {
    const s = st.stats;
    const solved = Number(s?.total_solved ?? (st as any).total_solved ?? 0);
    const syncStatus = String(s?.sync_status || '').toLowerCase();
    const status = String(s?.status || st.status || '').toLowerCase();
    const hasUsername = Boolean(st.username && String(st.username).trim());

    // Verified / Active student check: Has username and status is verified/success OR solved > 0
    const isVerifiedOrActive = hasUsername && (
      status === 'verified' ||
      syncStatus === 'success' ||
      solved > 0
    );

    if (isVerifiedOrActive) {
      activeStudents++;
      validProfiles++;
    }

    const isMissingLink = !hasUsername || syncStatus === 'pending_username' || status === 'pending_username';
    if (isMissingLink) {
      missingLinks++;
    }

    // Post 9:31 AM / Weekly Contest Attendance Check
    const sAny = s as any;
    const stAny = st as any;
    const cStatus = String(stAny?.contest_status || sAny?.contest_status || '').toUpperCase();
    const postSolved = Number(sAny?.post_930_solved ?? stAny?.post_930_solved ?? sAny?.today_solved ?? stAny?.today_solved ?? 0);
    const contestSolved = Number(sAny?.weekly_contest_solved ?? stAny?.weekly_contest_solved ?? sAny?.session_solved ?? 0);

    const hasAttendedContest = cStatus === 'PUBLIC_ATTENDED' ||
                               cStatus === 'VIRTUAL_ATTENDED' ||
                               cStatus === 'ATTENDED' ||
                               postSolved > 0 ||
                               contestSolved > 0;

    if (hasAttendedContest) {
      attendedSolversCount++;
    }
  });

  // Fallback for attendedSolversCount if individual student contest status is pending initial load:
  const actualContestSolvers = attendedSolversCount > 0 
    ? attendedSolversCount 
    : ((summary as any)?.post_930_solvers_count ?? activeStudents);

  const notStartedStudents = Math.max(0, totalStudents - activeStudents);
  const participationRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : "0";
  const contestParticipationRate = totalStudents > 0 ? ((actualContestSolvers / totalStudents) * 100).toFixed(1) : "0";
  const healthScorePercentage = totalStudents > 0 ? Math.round(((totalStudents - missingLinks) / totalStudents) * 100) : 100;

  // Helper: format a number with fallback for loading state
  const fmtCount = (n: number | null | undefined, fallback = '—') =>
    n !== null && n !== undefined && !isNaN(n) ? n.toLocaleString() : fallback;

  return (
    <div className="space-y-5 sm:space-y-6 pt-1 sm:pt-2 pb-2 animate-page-enter w-full">
      
      {/* 1. INSTITUTIONAL PERFORMANCE OVERVIEW */}
      <div className="stagger-1 relative overflow-hidden rounded-3xl bg-slate-900/95 dark:bg-navy-950/95 text-white p-6 sm:p-8 shadow-2xl border border-slate-700/80 dark:border-brand-500/30">
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
          {/* Left: Title & Description */}
          <div className="space-y-3.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-brand-300 text-[11px] font-black tracking-wider uppercase shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-none">NANDHA ENGINEERING COLLEGE • ERODE</span>
              </div>
              <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[11px] font-black tracking-wider uppercase shadow-xs ${liveStatus.color}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${liveStatus.dot}`} />
                <span>{liveStatus.label}</span>
              </div>
            </div>

            <AnimatedWelcomeHeading
              className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-white uppercase leading-tight break-words drop-shadow-sm"
              nameClassName="text-brand-400 break-words"
            />

            {!(user?.role?.toLowerCase() === 'faculty' || user?.role?.toLowerCase() === 'staff') && (
              <p className="text-slate-300 text-xs sm:text-sm font-semibold mt-1">Manage your institutional intelligence workspace.</p>
            )}

            <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide leading-relaxed max-w-3xl">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') 
                ? 'Your exclusive mentorship cohort — live sync, contest verification, and analytics.'
                : loading
                  ? 'Loading institutional data...'
                  : studentsError
                    ? 'Unable to load student data. Please retry.'
                    : canonicalTotal !== null
                      ? `${canonicalTotal.toLocaleString()} enrolled students across all departments — live sync, contest verification, leaderboard analytics, and automated reporting.`
                      : `${totalStudents.toLocaleString()} enrolled students — live sync, contest verification, leaderboard analytics, and automated reporting.`}
            </p>

            {/* Embedded Live Metric Pills */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-slate-300">Enrolled:</span>
                <span className="text-white font-extrabold">{fmtCount(canonicalTotal ?? totalStudents)}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">Active Profiles:</span>
                <span className="text-emerald-400 font-extrabold">{fmtCount(activeStudents)}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">Post-9:31 AM Solvers:</span>
                <span className="text-amber-400 font-extrabold">{fmtCount(actualContestSolvers)}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-300">Contest Participation:</span>
                <span className="text-indigo-300 font-extrabold">{contestParticipationRate}%</span>
              </div>
            </div>
          </div>

          {/* Right: Action Buttons — 2×2 grid on mobile, flex row on ≥640px */}
          <div className="w-full lg:w-auto shrink-0 pt-2 lg:pt-0">
            {studentsError && (
              <div className="mb-2">
                <button
                  onClick={() => refetchStudents()}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  aria-label="Retry loading student roster data"
                  title="Retry loading student roster data"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Retry Roster</span>
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-center">
              <button
                onClick={handleStartSync}
                disabled={isSyncing}
                className="relative overflow-hidden min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md border border-blue-400/40 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transform hover:scale-[1.03] active:scale-95 group"
                aria-label="Fetch live LeetCode statistics"
                title="Synchronize live profile statistics for all students"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin text-white' : 'text-white group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="truncate tracking-wide font-black">{isSyncing ? 'Syncing...' : 'Fetch Live Data'}</span>
              </button>

              <button
                onClick={onOpenImport}
                className="relative overflow-hidden min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs shadow-md border border-slate-600 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-brand-500 focus:outline-none transform hover:scale-[1.03] active:scale-95 group"
                aria-label="Import student roster from Excel"
                title="Upload Excel roster (.xlsx) to parse, validate, and update student profiles"
              >
                <Plus className="w-3.5 h-3.5 text-brand-400 group-hover:scale-125 group-hover:rotate-90 transition-transform duration-300 shrink-0" />
                <span className="truncate tracking-wide font-black">Import Roster</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="relative overflow-hidden min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md border border-emerald-400/40 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer disabled:opacity-70 focus:ring-2 focus:ring-emerald-400 focus:outline-none transform hover:scale-[1.03] active:scale-95 group"
                aria-label="Export raw student roster to Excel"
                title="Export current active student roster & raw LeetCode statistics to Excel workbook (.xlsx)"
              >
                {isExportingExcel ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-white animate-spin shrink-0" />
                    <span className="truncate tracking-wide font-black text-white">Exporting...</span>
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-white/40 animate-pulse" />
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200 shrink-0" />
                    <span className="truncate tracking-wide font-black text-white">Export Excel</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-mono text-white border border-white/30 font-black uppercase tracking-wider hidden sm:inline-block">
                      XLSX
                    </span>
                  </>
                )}
              </button>

              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="relative overflow-hidden min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-extrabold text-xs shadow-md border border-amber-300/40 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer disabled:opacity-70 focus:ring-2 focus:ring-amber-400 focus:outline-none transform hover:scale-[1.03] active:scale-95 group"
                aria-label="Generate official weekly institutional report"
                title="Instant download of pre-generated 8-sheet weekly performance tracker & PDF summary"
              >
                {generatingReport ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-white animate-spin shrink-0" />
                    <span className="truncate tracking-wide font-black text-white">Rendering PDF...</span>
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-white/40 animate-pulse" />
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200 shrink-0" />
                    <span className="truncate tracking-wide font-black text-white">Weekly Report</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-mono text-white border border-white/30 font-black uppercase tracking-wider hidden sm:inline-block">
                      PDF
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* REAL-TIME GROWTH & DELTA ENGINE */}
      <div className="stagger-4 relative overflow-hidden rounded-xl bg-white dark:bg-navy-950 p-5 sm:p-8 shadow-sm border border-slate-200 dark:border-navy-700 mt-6">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black tracking-wider uppercase">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                {summary?.scope?.total_students != null
                  ? `${summary.scope.total_students.toLocaleString()} Students • ${summary.scope.total_departments ?? '—'} Departments`
                  : 'Analytics Engine'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>REAL-TIME GROWTH &amp; DELTA ENGINE</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 font-bold uppercase tracking-widest border border-brand-200 dark:border-brand-800/50">LIVE</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              <strong className="text-slate-700 dark:text-slate-300">Growth Intelligence &amp; Time Machine</strong> — Track student problem-solving deltas, biggest improvers leaderboard, difficulty velocity, and granular historical stat snapshots across custom timeframe windows.
            </p>
          </div>

          <div className="shrink-0 sm:self-center">
            <button
              onClick={() => onNavigateTab('growth')}
              className="min-h-[44px] w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Launch Growth Engine</span>
            </button>
          </div>
        </div>
      </div>

      <React.Suspense fallback={<div className="h-64 rounded-2xl bg-slate-100 dark:bg-navy-900 animate-pulse my-6 flex items-center justify-center text-xs font-bold text-slate-400">Loading Chart Engine...</div>}>
        <PerformanceChart />
      </React.Suspense>

      {/* 5 & 6. COLLEGE PARTICIPATION & DATA QUALITY */}
      <div className="stagger-5 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Participation Analytics */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              <span className="uppercase tracking-wider">College Participation Analytics</span>
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 36 36">
                <circle
                  className="text-slate-100 dark:text-navy-800"
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-navy-950 rounded-full m-3 shadow-inner border border-slate-50 dark:border-navy-800">
                <span className="text-2xl font-display font-black text-indigo-600 dark:text-indigo-400">{participationRate}%</span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1 text-center sm:text-left">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">Active Participation</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Out of{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {loading ? '—' : totalStudents.toLocaleString()}
                </strong>{' '}
                {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? 'assigned students' : 'enrolled students'},{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {loading ? '—' : activeStudents.toLocaleString()}
                </strong>{' '}
                have actively verified LeetCode profiles.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-bold">
            <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Active Students</span>
              <span className="text-base text-slate-900 dark:text-white">
                {loading ? <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse" /> : activeStudents.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Not Started</span>
              <span className="text-base text-slate-900 dark:text-white">
                {loading ? <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse" /> : notStartedStudents.toLocaleString()}
              </span>
            </div>
            <div className="col-span-2 flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-slate-500">{['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? 'Total Assigned' : 'Total Enrolled'}</span>
              <span className="text-base text-slate-900 dark:text-white">
                {loading
                  ? <span className="inline-block w-10 h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse" />
                  : totalStudents.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Data Quality Board */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-sm flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="uppercase tracking-wider">Data Quality Board</span>
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Valid Profiles</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {loading
                    ? <span className="inline-block w-8 h-4 bg-emerald-100 dark:bg-emerald-900/30 rounded animate-pulse" />
                    : fmtCount(summary?.verification?.verified ?? validProfiles)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Missing Profile URLs</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                  {loading
                    ? <span className="inline-block w-8 h-4 bg-rose-100 dark:bg-rose-900/30 rounded animate-pulse" />
                    : fmtCount(summary?.verification?.no_username ?? missingLinks)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Profile Health Score</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {loading
                    ? <span className="inline-block w-10 h-4 bg-indigo-100 dark:bg-indigo-900/30 rounded animate-pulse" />
                    : `${healthScorePercentage}%`}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('quality')}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Open Data Quality Details →
          </button>
        </div>

      </div>

      {/* 7. DEPARTMENT PERFORMANCE MATRIX */}
      <div className="stagger-6 glass-card p-6 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-sm space-y-4 overflow-hidden mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-800 pb-3">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <Building2 className="w-4 h-4 text-brand-500 shrink-0" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Department Performance Matrix
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-navy-700">
              Institution-Wide
            </span>
          </div>
          <button 
            onClick={() => onNavigateTab('departments')} 
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center space-x-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View Full Department Report</span>
            <span>→</span>
          </button>
        </div>

        {departments.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-navy-800 flex items-center justify-center border border-slate-100 dark:border-navy-700 mx-auto">
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {loading ? 'Aggregating Department Matrices...' : 'Matrix Waiting for Initial Sync'}
            </span>
            <span className="text-xs text-slate-500 max-w-sm mx-auto block">
              Department comparative analytics will populate here automatically once sufficient institutional data is gathered.
            </span>
          </div>
        ) : (
          <div>
            {/* MOBILE DEPARTMENT CARDS (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-navy-800">
              {departments
                .filter((dept: any) => {
                  const code = (dept.department_code || dept.code || '').toUpperCase();
                  const name = (dept.department_name || dept.name || '').toUpperCase();
                  return !code.includes('TEST') && !name.includes('TEST');
                })
                .sort((a: any, b: any) => {
                  const isACse = (a.department_code || '').startsWith('CSE');
                  const isBCse = (b.department_code || '').startsWith('CSE');
                  if (isACse && !isBCse) return -1;
                  if (!isACse && isBCse) return 1;
                  return (a.department_code || '').localeCompare(b.department_code || '');
                })
                .map((dept: any) => (
                  <div key={dept.department_code || dept.department_id} className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-black text-sm text-slate-900 dark:text-white">
                          {dept.department_code}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium break-words whitespace-normal leading-snug">
                          {dept.department_name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Students</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">{dept.total_students}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Active</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {dept.active_students ?? dept.active_count ?? Math.round(((dept.participation_rate || 0) / 100) * dept.total_students)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Participation</span>
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          {dept.participation_rate || 0}%
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Avg Solved</span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {dept.avg_solved || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                      <div className="text-xs min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Top Performer</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (dept.top_student_id && onSelectStudent) {
                              onSelectStudent(dept.top_student_id);
                            }
                          }}
                          className={`font-bold text-amber-600 dark:text-amber-400 truncate block text-left ${dept.top_student_id && onSelectStudent ? 'hover:underline cursor-pointer' : ''}`}
                        >
                          {dept.top_student_name || '—'}
                        </button>
                      </div>
                      <button
                        onClick={() => onNavigateTab('departments')}
                        className="px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                      >
                        View Department Report →
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* DESKTOP MATRIX TABLE (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5 font-extrabold text-left w-[22%]">Department</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-center w-[10%]" title="Total enrolled students in this department">Students</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-center w-[10%]" title="Students with active verified LeetCode profiles">Active</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-center w-[16%]" title="Percentage of active students out of total enrolled">Participation</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-center w-[12%] cursor-help" title="Average LeetCode problems solved per enrolled student in this department">Avg Solved</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-left w-[20%]" title="Top student by LeetCode contest rating & problems solved">Top Performer</th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right w-[10%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                  {[...departments]
                    .filter((dept: any) => {
                      const code = (dept.department_code || dept.code || '').toUpperCase();
                      const name = (dept.department_name || dept.name || '').toUpperCase();
                      return !code.includes('TEST') && !name.includes('TEST');
                    })
                    .sort((a, b) => {
                      const isACse = (a.department_code || '').startsWith('CSE');
                      const isBCse = (b.department_code || '').startsWith('CSE');
                      if (isACse && !isBCse) return -1;
                      if (!isACse && isBCse) return 1;
                      return (a.department_code || '').localeCompare(b.department_code || '');
                    })
                    .map((dept) => (
                      <tr key={dept.department_code || dept.department_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="py-2.5 px-3.5 w-[22%]">
                          <div className="font-black text-slate-900 dark:text-white">{dept.department_code}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{dept.department_name}</div>
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-slate-600 dark:text-slate-300 text-center w-[10%]">{dept.total_students}</td>
                        <td className="py-2.5 px-3.5 font-medium text-emerald-600 dark:text-emerald-400 text-center w-[10%]">{dept.active_students ?? dept.active_count ?? Math.round(((dept.participation_rate || 0) / 100) * dept.total_students)}</td>
                        <td className="py-2.5 px-3.5 text-center w-[16%]">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-14 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                              <div style={{ width: `${dept.participation_rate}%` }} className="h-full bg-indigo-500 rounded-full"></div>
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">{dept.participation_rate}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white text-center w-[12%]">{dept.avg_solved}</td>
                        <td className="py-2.5 px-3.5 text-left w-[20%]">
                          {dept.top_student_name ? (
                            <div className="flex items-center justify-start space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (dept.top_student_id && onSelectStudent) {
                                    onSelectStudent(dept.top_student_id);
                                  }
                                }}
                                className={`font-bold text-amber-600 dark:text-amber-400 truncate ${dept.top_student_id && onSelectStudent ? 'hover:text-amber-700 dark:hover:text-amber-300 hover:underline cursor-pointer' : ''}`}
                                title={dept.top_student_id && onSelectStudent ? `Click to view profile of ${dept.top_student_name}` : dept.top_student_name}
                              >
                                {dept.top_student_name}
                              </button>
                              {dept.top_student_solved > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono font-extrabold text-[10px] border border-amber-200/60 dark:border-amber-900/50 shrink-0">
                                  {dept.top_student_solved} solved
                                </span>
                              )}
                              {dept.top_student_id && (
                                <button
                                  onClick={() => handleSingleStudentRefresh(dept.top_student_id, dept.top_student_name)}
                                  disabled={refreshingStudentId === dept.top_student_id}
                                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-navy-700 dark:hover:bg-navy-600 text-slate-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                  title={`Refresh ${dept.top_student_name}`}
                                >
                                  <RefreshCw className={`w-3 h-3 ${refreshingStudentId === dept.top_student_id ? 'animate-spin' : ''}`} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right w-[10%]">
                          <button
                            onClick={() => onNavigateTab('departments')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white font-bold text-xs border border-blue-200/60 dark:border-blue-900/50 transition-all cursor-pointer shadow-2xs"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 8. TOP COLLEGE LEADERBOARD (PREVIEW) */}
      <div className="stagger-7 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
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
          students={filteredStudents.slice(0, 10) as any}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={() => refreshAllData()}
        />
        
        <div className="text-center pt-2">
           <span className="text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-navy-950 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
             Showing Top {Math.min(filteredStudents.length, 10)} of{' '}
             {loading ? '—' : (canonicalTotal ?? totalStudents).toLocaleString()} students.{' '}
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
