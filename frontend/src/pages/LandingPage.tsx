import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CollegeLogo } from '../components/CollegeLogo';
import { Shield, ArrowRight, Trophy, Users, Layers, Activity, Flame, Star, LayoutGrid, List, RefreshCw, CheckCircle2, Clock, AlertCircle, ChevronDown, Building2, GraduationCap, RotateCcw, Filter, Search, X } from 'lucide-react';
import { CountdownTimer } from '../components/CountdownTimer';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import api, { triggerFullSync, getSyncStatus } from '../services/api';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { filterAndSortStudents } from '../utils/filterUtils';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function formatAgo(ts?: string): string {
  if (!ts) return 'Not synced yet';
  const diffMs = Date.now() - parseUtcTime(ts);
  if (diffMs <= 0) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface LandingPageProps {
  summaryData: any;
  onViewDashboard: () => void;
  onOpenLogin: () => void;
  onSelectStudent?: (student: StudentData) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  summaryData,
  onViewDashboard,
  onOpenLogin,
  onSelectStudent
}) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [yearLevel, setYearLevel] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [solvedFilter, setSolvedFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    processed: number;
    successful: number;
    failed: number;
    pending_usernames?: number;
    current_student?: string;
    current_username?: string;
    is_running: boolean;
    last_sync_time?: string;
  } | null>(null);
  const pollTimerRef = useRef<any>(null);

  // Real-time WebSocket streaming subscription for true per-student progress
  useLiveLeaderboard((data) => {
    if (!data) return;

    if (data.type === 'sync_progress') {
      setSyncProgress({
        total: data.total || 300,
        processed: data.processed,
        successful: data.successful,
        failed: data.failed,
        pending_usernames: data.pending,
        current_student: data.current_student,
        current_username: data.current_username,
        is_running: true
      });

      // Update student card progressively in React state without full page reload
      if (data.student_update) {
        const u = data.student_update;
        setStudents(prev => prev.map(st => {
          if (st.id === u.id || (st.reg_no && st.reg_no === u.reg_no)) {
            return {
              ...st,
              username: u.username || st.username,
              stats: {
                ...st.stats,
                total_solved: u.total_solved ?? st.stats?.total_solved,
                easy_solved: u.easy_solved ?? st.stats?.easy_solved,
                medium_solved: u.medium_solved ?? st.stats?.medium_solved,
                hard_solved: u.hard_solved ?? st.stats?.hard_solved,
                contest_rating: u.contest_rating ?? st.stats?.contest_rating,
                sync_status: u.sync_status || st.stats?.sync_status,
                status: u.status || st.stats?.status,
                last_verified_at: new Date().toISOString()
              }
            };
          }
          return st;
        }));
      }
    } else if (data.type === 'SYNC_COMPLETED') {
      const tot = data.summary?.total_students || 300;
      const formattedTime = data.summary?.completed_at_ist || (data.summary?.completed_at ? new Date(data.summary.completed_at.endsWith('Z') ? data.summary.completed_at : data.summary.completed_at + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST' : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST');
      setSyncProgress({
        total: tot,
        processed: tot,
        successful: data.summary?.profile_verified ?? data.summary?.full_dataset_synced ?? tot,
        failed: data.summary?.fetch_failed ?? 0,
        pending_usernames: data.summary?.pending_username ?? 0,
        is_running: false,
        last_sync_time: formattedTime
      });
      setRefreshing(false);
      fetchFilteredStudents();
    }
  });

  useEffect(() => {
    fetchDepartments();
    fetchFilteredStudents();

    // Check if sync is already running or completed on mount
    const checkInitialSync = async () => {
      try {
        const statusData = await getSyncStatus();
        const totalCount = statusData.total_students || statusData.total || 300;
        if (statusData.is_running) {
          setSyncProgress({
            total: totalCount,
            processed: statusData.students_processed ?? statusData.completed ?? 0,
            successful: statusData.successful ?? statusData.success ?? 0,
            failed: statusData.failed ?? 0,
            pending_usernames: statusData.pending_usernames ?? 0,
            current_student: statusData.current_student,
            current_username: statusData.current_username,
            is_running: true,
            last_sync_time: statusData.last_sync_timestamp
          });
          startPollingProgress();
        } else if (statusData.status === 'COMPLETED' || statusData.operation === 'COMPLETED') {
          const compProcessed = statusData.students_processed ?? statusData.completed ?? totalCount;
          setSyncProgress({
            total: totalCount,
            processed: compProcessed,
            successful: statusData.successful ?? statusData.success ?? totalCount,
            failed: statusData.failed ?? 0,
            pending_usernames: statusData.pending_usernames ?? 0,
            current_student: undefined,
            current_username: undefined,
            is_running: false,
            last_sync_time: statusData.last_sync_timestamp
          });
        }
      } catch (err) {
        console.warn("Initial sync status check error:", err);
      }
    };
    checkInitialSync();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchFilteredStudents();
  }, [selectedDept, yearLevel]);

  const startPollingProgress = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let consecutiveErrors = 0;
    let pollCount = 0;

    pollTimerRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const statusData = await getSyncStatus();
        consecutiveErrors = 0;

        const rawComp = statusData.students_processed ?? statusData.completed ?? statusData.processed ?? 0;
        const totalCount = statusData.total_students || statusData.total || 300;
        const currentProcessed = Math.min(totalCount, Math.max(0, rawComp));

        setSyncProgress({
          total: totalCount,
          processed: currentProcessed,
          successful: statusData.successful ?? statusData.success ?? 0,
          failed: statusData.failed ?? 0,
          pending_usernames: statusData.pending_usernames ?? 0,
          current_student: statusData.current_student,
          current_username: statusData.current_username,
          is_running: statusData.is_running,
          last_sync_time: statusData.last_sync_timestamp
        });

        // Re-fetch student roster every 2 seconds during polling so cards update LIVE on screen
        if (pollCount % 2 === 0) {
          fetchFilteredStudents();
        }

        if (!statusData.is_running) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRefreshing(false);
          await fetchFilteredStudents();
          setSyncProgress({
            total: totalCount,
            processed: totalCount,
            successful: statusData.successful ?? statusData.success ?? totalCount,
            failed: statusData.failed ?? 0,
            pending_usernames: statusData.pending_usernames ?? 0,
            current_student: undefined,
            current_username: undefined,
            is_running: false,
            last_sync_time: statusData.last_sync_timestamp
          });
        }
      } catch (err) {
        consecutiveErrors += 1;
        console.warn(`Sync status poll warning (${consecutiveErrors}/5):`, err);
        if (consecutiveErrors >= 5) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRefreshing(false);
        }
      }
    }, 1000);
  };

  const startSyncPolling = startPollingProgress;

  const handleRefreshAll = async () => {
    if (refreshing || syncProgress?.is_running) return;
    setRefreshing(true);
    const initialTotal = students.length > 0 ? students.length : 300;
    setSyncProgress({
      total: initialTotal,
      processed: 0,
      successful: 0,
      failed: 0,
      is_running: true
    });
    try {
      await triggerFullSync('admin');
      startSyncPolling();
    } catch (err) {
      console.error(err);
      setRefreshing(false);
      setSyncProgress(null);
    }
  };

  const handleRefreshStudent = async (studentId: number) => {
    setRefreshingId(studentId);
    try {
      await api.post(`/students/${studentId}/refresh`);
      await fetchFilteredStudents();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  };

  const DEFAULT_DEPARTMENTS = [
    { id: 1, name: 'Computer Science and Engineering (Cyber Security)', code: 'CSE(CS)' },
    { id: 2, name: 'Computer Science and Engineering (IoT)', code: 'CSE(IOT)' }
  ];

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data) && res.data.length >= 2) {
        setDepartments(res.data);
      } else {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    } catch (err) {
      console.warn("Using default department fallback list:", err);
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  };


  const fetchFilteredStudents = async () => {
    try {
      const res = await api.get('/students/leaderboard-fast');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setStudents(res.data);
      } else {
        const res2 = await api.get('/students');
        if (res2.data && Array.isArray(res2.data)) setStudents(res2.data);
      }
    } catch (err) {
      try {
        const res2 = await api.get('/students');
        if (res2.data && Array.isArray(res2.data)) setStudents(res2.data);
      } catch (err2) {
        console.warn("Fallback /students also failed", err2);
      }
    }
  };

  // --- Combined Canonical Filter Pipeline: Dept + Academic Year + Name Search + Performance Range + Sort ---
  const { filteredAndSorted: sortedList, counts: performanceCounts } = useMemo(() => {
    return filterAndSortStudents(students, {
      department: selectedDept,
      academicYear: yearLevel,
      nameSearch,
      performanceRange: solvedFilter,
      sortBy
    });
  }, [students, selectedDept, yearLevel, nameSearch, solvedFilter, sortBy]);

  const handleResetFilters = () => {
    setSelectedDept('all');
    setYearLevel('all');
    setNameSearch('');
    setSolvedFilter('all');
    setSortBy('top_solved');
    setDisplayCount(32);
  };

  return (
    <div className="space-y-8 py-6">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-navy-900 to-indigo-950 text-white p-8 md:p-12 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-2xl bg-white/10 border border-white/20 text-white text-xs font-bold backdrop-blur-md shadow-lg">
            <CollegeLogo size={28} className="w-7 h-7" />
            <span>NANDHA ENGINEERING COLLEGE (AUTONOMOUS) • Official Weekly Tracker & Analytics</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            College LeetCode <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-blue-300 to-indigo-300">
              Weekly Tracker & Leaderboard
            </span>
          </h1>

          <p className="text-sm md:text-base text-gray-100 font-medium max-w-2xl leading-relaxed drop-shadow">
            Real-time automated performance monitoring across Computer Science and Engineering (Cyber Security) and Computer Science and Engineering (IoT) departments. Sunday session tracking, multi-level rankings, official Excel matrix reporting, and automated email dispatch.
          </p>


          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onViewDashboard}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/40 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <span>View Executive Dashboard</span>
              <ArrowRight className="w-4 h-4 text-slate-950 stroke-[3]" />
            </button>

            {(() => {
              const totalStudents = summaryData?.total_students ?? (students.length > 0 ? students.length : null);
              const processedCount = syncProgress?.processed ?? 0;
              const totalProgress = syncProgress?.total ?? totalStudents;

              return (
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshing || syncProgress?.is_running}
                  className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-sm backdrop-blur-md shadow-xl flex items-center space-x-2 transition-all transform hover:scale-105"
                  title="Perform full live synchronization for active student roster"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing || syncProgress?.is_running ? 'animate-spin' : ''}`} />
                  <span>
                    {refreshing || syncProgress?.is_running
                      ? `⏳ FETCHING ${processedCount} / ${totalProgress !== null ? totalProgress : '...'}`
                      : '🔄 FETCH LIVE DATA'}
                  </span>
                </button>
              );
            })()}
            {(() => {
              const totalStudents = summaryData?.total_students ?? (students.length > 0 ? students.length : 300);
              const verifiedCount = summaryData?.verified_profiles ?? students.filter(s =>
                s.stats?.sync_status === 'success' || s.stats?.sync_status === 'OK' || s.stats?.sync_status === 'verified' || s.stats?.sync_status === 'stale' || (s.stats?.total_solved !== null && (s.stats?.total_solved ?? 0) > 0)
              ).length;
              const lastVerifiedTs = students
                .map(s => s.stats?.last_verified_at)
                .filter(Boolean)
                .sort()
                .pop();
              const formattedLastFetched = lastVerifiedTs ? formatAgo(lastVerifiedTs) : 'Just now';

              return (
                <div className={`hidden sm:flex items-center space-x-2 px-4 py-3 rounded-2xl ${
                  verifiedCount > 0
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                    : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                } border font-extrabold text-xs backdrop-blur-md`}>
                  <CheckCircle2 className={`w-4 h-4 ${verifiedCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span>
                    {totalStudents !== null
                      ? (verifiedCount > 0 ? `🟢 ${verifiedCount}/${totalStudents} Verified • ${formattedLastFetched}` : `⏳ ${verifiedCount}/${totalStudents} Verified • Pending Sync`)
                      : '⏳ Loading roster status...'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Next Sunday Session Countdown Timer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Next Sunday Session Timer</span>
          <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Official Window: 08:00 AM – 09:30 AM IST</span>
        </div>
        <CountdownTimer targetSeconds={summaryData?.next_session_countdown_seconds || 86400} isLive={summaryData?.is_session_live} />
      </div>

      {/* Stat Cards Grid — Data-quality-aware */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {(() => {
          const totalStudents = summaryData?.total_students ?? (students.length > 0 ? students.length : null);
          const isVerifiedSt = (s: StudentData) => {
            const st = s.stats?.sync_status;
            const tot = s.stats?.total_solved ?? s.total_solved;
            return st === 'success' || st === 'OK' || st === 'verified' || st === 'stale' || (tot !== null && tot !== undefined);
          };
          const verified = summaryData?.verified_profiles ?? students.filter(isVerifiedSt).length;
          const pending  = summaryData?.pending_sync ?? students.filter(s => !s.stats?.sync_status || s.stats.sync_status === 'pending' || s.stats.sync_status === 'not_started').length;
          const failed   = summaryData?.failed_sync ?? students.filter(s => s.stats?.sync_status === 'failed' || s.stats?.sync_status === 'mismatch').length;
          const activeSolvers = summaryData?.active_students ?? students.filter(s => (s.stats?.total_solved ?? s.total_solved ?? 0) > 0).length;
          const verifiedProblems = summaryData?.total_problems_solved ?? students.reduce((sum, s) => sum + (s.stats?.total_solved ?? s.total_solved ?? 0), 0);


          return (
            <>
              <div className="glass-card p-6 sm:p-7 rounded-2xl space-y-3 border shadow-md">
                <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="text-3xl font-black text-gray-900 dark:text-white">
                  {totalStudents !== null ? totalStudents : 'Loading institutional roster...'}
                </h4>
                <p className="text-sm font-semibold text-gray-500">Total Enrolled Students</p>
              </div>


              <div className="glass-card p-6 rounded-2xl space-y-2 border shadow-md">

                <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white">{verified}</h4>
                <p className="text-xs font-semibold text-gray-500">Verified Profiles</p>
                {(pending > 0 || failed > 0) && (
                  <p className="text-[10px] text-gray-400">
                    ⏳ {pending} Pending{failed > 0 ? ` • 🔴 ${failed} Failed` : ''}
                  </p>
                )}
              </div>

              <div className="glass-card p-6 rounded-2xl space-y-2 border shadow-md">
                <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Trophy className="w-6 h-6" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white">{verifiedProblems.toLocaleString()}</h4>
                <p className="text-xs font-semibold text-gray-500">Verified Problems Solved</p>
                <p className="text-[10px] text-gray-400">from {activeSolvers} active solvers</p>
              </div>

              <div className="glass-card p-6 rounded-2xl space-y-2 border shadow-md">
                <div className="p-3 w-fit rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Trophy className="w-6 h-6 fill-amber-500" />
                </div>
                <h4 className="text-2xl font-black text-amber-500 truncate" title={summaryData?.top_college_ranker || (sortedList.length > 0 ? sortedList[0].name : 'Top Ranker')}>
                  {summaryData?.top_college_ranker || (sortedList.length > 0 ? sortedList[0].name : 'Top Ranker')}
                </h4>
                <p className="text-xs font-semibold text-gray-500">Top College Ranker (#1)</p>
              </div>
            </>
          );
        })()}
      </div>

        {/* Filters Control Bar */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-6">
        
        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Filter className="w-4 h-4 text-brand-500" />
              <span>Student Performance Showcase</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filter student records by Department, Academic Year, and LeetCode Problem Solved Range
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* View Mode Switch */}
            <div className="flex items-center space-x-1 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card Grid</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Roster Table</span>
              </button>
            </div>

            {/* Reset Filters Button */}
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer shadow-sm"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* 5 Filter & Search Controls — Pixel-Perfect Uniform Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
          
          {/* 1. Department Filter */}
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="department-filter" className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Select Department Filter
            </label>
            <div className="relative">
              <select
                id="department-filter"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full h-11 appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-2.5 pl-3 pr-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer truncate"
              >
                <option value="all">All Departments</option>
                <option value="cyber_security">Computer Science and Engineering (Cyber Security)</option>
                <option value="iot">Computer Science and Engineering (IoT)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* 2. Academic Year Filter */}
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="academic-year-filter" className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Select Academic Year
            </label>
            <div className="relative">
              <select
                id="academic-year-filter"
                value={yearLevel}
                onChange={(e) => {
                  setYearLevel(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full h-11 appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-2.5 pl-3 pr-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer truncate"
              >
                <option value="all">All Years</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* 3. Name Search */}
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="landing-name-search" className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Search Student Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                id="landing-name-search"
                type="text"
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setDisplayCount(32);
                }}
                placeholder="Search name, reg no..."
                className="w-full h-11 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-2.5 pl-8 pr-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 truncate"
              />
              {nameSearch && (
                <button
                  onClick={() => { setNameSearch(''); setDisplayCount(32); }}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 4. Performance Range Filter */}
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="performance-range-filter" className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Performance Range
            </label>
            <div className="relative">
              <select
                id="performance-range-filter"
                value={solvedFilter}
                onChange={(e) => {
                  setSolvedFilter(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full h-11 appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-2.5 pl-3 pr-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer truncate"
              >
                <option value="all">All Students ({performanceCounts.total})</option>
                <option value="500_plus">500+ ({performanceCounts.above500})</option>
                <option value="251_500">251–500 ({performanceCounts.between251And500})</option>
                <option value="101_250">101–250 ({performanceCounts.between101And250})</option>
                <option value="1_100">1–100 ({performanceCounts.between1And100})</option>
                <option value="not_started">Not Started ({performanceCounts.notStarted})</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* 5. Sort Students */}
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="sort-students-filter" className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Sort Students
            </label>
            <div className="relative">
              <select
                id="sort-students-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-11 appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-2.5 pl-3 pr-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer truncate"
              >
                <option value="top_solved">Top Solvers</option>
                <option value="low_solved">Low Solvers</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="streak">Highest Streak</option>
                <option value="rating">Highest Contest Rating</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Student Showcase Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-black text-lg text-gray-900 dark:text-white">
            {selectedDept === 'cyber_security'
              ? 'Computer Science and Engineering (Cyber Security)'
              : selectedDept === 'iot'
              ? 'Computer Science and Engineering (IoT)'
              : 'All Departments'}
            {' • '}
            {yearLevel === 'all' || yearLevel === 'ALL'
              ? 'All Years'
              : `${yearLevel} Year`}
            {solvedFilter !== 'all' && solvedFilter !== 'ALL'
              ? ` • ${{
                  '500_plus': '500+',
                  'above_500': '500+',
                  '251_500': '251–500',
                  '250_500': '251–500',
                  '101_250': '101–250',
                  '1_100': '1–100',
                  'less_100': '1–100',
                  'not_started': 'Not Started'
                }[solvedFilter] ?? ''} Solved`
              : ''}
            {` (${sortedList.length} Students)`}
          </h3>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing || syncProgress?.is_running}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              refreshing || syncProgress?.is_running
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || syncProgress?.is_running ? 'animate-spin' : ''}`} />
            <span>
              {syncProgress?.is_running
                ? `Syncing... ${syncProgress.processed} / ${syncProgress.total}`
                : refreshing ? 'Refreshing...' : '🔄 Refresh All LeetCode Stats'
              }
            </span>
          </button>
        </div>

        {/* Premium Live Sync Progress Bar */}
        {syncProgress && (
          <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex justify-between items-end flex-wrap gap-2 relative z-10">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center space-x-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${syncProgress.is_running ? 'animate-spin' : ''}`} />
                  <span>
                    {syncProgress.is_running ? 'Sync Engine Running' : 'Sync Process Complete'}
                  </span>
                </span>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {syncProgress.is_running 
                    ? `Processing Profile: ${syncProgress.current_student || 'Initializing...'}`
                    : `All student statistics are up to date${syncProgress.last_sync_time ? ` • Last synced: ${syncProgress.last_sync_time}` : ''}`
                  }
                </p>
              </div>
              
              <div className="text-right">
                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tighter">
                  {Math.round((syncProgress.processed / Math.max(1, syncProgress.total)) * 100)}%
                </span>
              </div>
            </div>

            <div className="w-full bg-gray-100 dark:bg-navy-950 h-2.5 rounded-full overflow-hidden relative z-10 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${Math.round((syncProgress.processed / Math.max(1, syncProgress.total)) * 100)}%` }}
              >
                {syncProgress.is_running && (
                  <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 relative z-10 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Successful</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{syncProgress.successful}</span>
              </div>
              <div className="flex flex-col border-l border-gray-100 dark:border-gray-800 pl-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pending</span>
                <span className="text-sm font-black text-amber-500">{syncProgress.pending_usernames}</span>
              </div>
              <div className="flex flex-col border-l border-gray-100 dark:border-gray-800 pl-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Failed</span>
                <span className="text-sm font-black text-rose-500">{syncProgress.failed}</span>
              </div>
            </div>
          </div>
        )}

        {sortedList.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-gray-900 dark:text-white">No students found</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                No students match the selected filters. Try changing or resetting the filters.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedList.slice(0, displayCount).map((st, idx) => {
                const isSolver = (st.stats?.total_solved || st.total_solved || 0) > 0;
                const computedRank = (isSolver && sortBy === 'top_solved' && selectedDept === 'all' && (yearLevel === 'ALL' || yearLevel === 'all') && (solvedFilter === 'ALL' || solvedFilter === 'all')) ? idx + 1 : st.college_rank;
                return (
                  <StudentFlipCard
                    key={st.id}
                    student={{ ...st, college_rank: isSolver ? (computedRank ?? (idx + 1)) : undefined }}
                    onSelectStudent={onSelectStudent}
                  />
                );
              })}
            </div>

            {displayCount < sortedList.length && (
              <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                <p className="text-xs text-gray-500 font-semibold">
                  Showing <span className="font-extrabold text-brand-600 dark:text-brand-400">{Math.min(displayCount, sortedList.length)}</span> of <span className="font-extrabold text-gray-900 dark:text-white">{sortedList.length}</span> Students
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setDisplayCount(prev => prev + 32)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all hover:scale-105 cursor-pointer"
                  >
                    <span>👇 Load More Students (+32)</span>
                  </button>
                  <button
                    onClick={() => setDisplayCount(sortedList.length)}
                    className="px-5 py-3 rounded-2xl glass-card hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                  >
                    Show All {sortedList.length} Students
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <LeaderboardTable
            students={sortedList}
            onSelectStudent={onSelectStudent}
            onRefreshStudent={handleRefreshStudent}
          />
        )}
      </div>

    </div>
  );
};
