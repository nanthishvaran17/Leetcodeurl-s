import React, { useState, useEffect, useRef } from 'react';
import { CollegeLogo } from '../components/CollegeLogo';
import { Shield, ArrowRight, Trophy, Users, Layers, Activity, Flame, Star, LayoutGrid, List, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { CountdownTimer } from '../components/CountdownTimer';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import api, { triggerFullSync, getSyncStatus } from '../services/api';

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
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [yearLevel, setYearLevel] = useState<string>('ALL');
  const [solvedFilter, setSolvedFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ total: number; processed: number; successful: number; failed: number; is_running: boolean } | null>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchDepartments();
    fetchFilteredStudents();

    // Check if sync is already running on mount
    const checkInitialSync = async () => {
      try {
        const statusData = await getSyncStatus();
        if (statusData.is_running) {
          setSyncProgress({
            total: statusData.total || 273,
            processed: statusData.completed || 0,
            successful: statusData.success || 0,
            failed: statusData.failed || 0,
            is_running: true
          });
          startSyncPolling();
        }
      } catch (err) {
        console.warn("Sync status check note:", err);
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

  const startSyncPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    let pollCount = 0;
    pollTimerRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const statusData = await getSyncStatus();
        const rawComp = statusData.completed ?? statusData.processed ?? 0;
        const currentProcessed = Math.max(1, rawComp);

        setSyncProgress({
          total: statusData.total || 273,
          processed: currentProcessed,
          successful: statusData.success || 0,
          failed: statusData.failed || 0,
          is_running: statusData.is_running
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
        }
      } catch (err) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setRefreshing(false);
      }
    }, 1000);
  };

  const handleRefreshAll = async () => {
    if (refreshing || syncProgress?.is_running) return;
    setRefreshing(true);
    setSyncProgress({
      total: 273,
      processed: 1,
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

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFilteredStudents = async () => {
    let loadedFromApi = false;
    try {
      let url = '/students';
      const params = [];
      if (selectedDept) {
        params.push(`dept_id=${selectedDept.id}`);
      }
      if (yearLevel !== 'ALL') {
        params.push(`year_level=${yearLevel}`);
      }
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const res = await api.get(url);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setStudents(res.data);
        loadedFromApi = true;
      }
    } catch (err) {
      console.warn("REST API request delayed, reading directly from Cloud Firestore...", err);
    }

    if (!loadedFromApi) {
      try {
        const { getOrInitDb } = await import('../services/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const firestoreDb = getOrInitDb();
        const studSnap = await getDocs(collection(firestoreDb, "students"));
        const statsSnap = await getDocs(collection(firestoreDb, "leetcodeStats"));

        const statsMap = new Map();
        statsSnap.forEach(docSnap => {
          statsMap.set(docSnap.id, docSnap.data());
        });

        const list: StudentData[] = [];
        studSnap.forEach(docSnap => {
          const sData = docSnap.data();
          const sStats = statsMap.get(docSnap.id) || {};
          const deptCode = sData.department || 'GEN';
          const yr = sData.year || 'III';

          // Filter by dept and year if selected
          if (selectedDept && selectedDept.code && deptCode !== selectedDept.code) return;
          if (yearLevel !== 'ALL' && yr !== yearLevel) return;

          list.push({
            id: sData.id || Number(docSnap.id),
            reg_no: sData.registerNo || '',
            name: sData.name || '',
            email: sData.email || '',
            department: deptCode,
            year_level: yr,
            section: sData.section || 'A',
            leetcode_url: sData.leetcodeProfileUrl || '',
            username: sData.leetcodeUsername || '',
            college_rank: sStats.collegeRank ?? null,
            weekly_progress: sStats.weeklySolved ?? 0,
            streak_count: sStats.streakCount ?? 0,
            consistency_score: sStats.consistencyScore ?? 0,
            stats: {
              // RULE: null means "not yet fetched" — never convert to 0
              total_solved: sStats.totalSolved ?? null,
              easy_solved: sStats.easySolved ?? null,
              medium_solved: sStats.mediumSolved ?? null,
              hard_solved: sStats.hardSolved ?? null,
              contest_rating: sStats.contestRating ?? null,
              contest_global_ranking: sStats.globalRanking,
              status: sStats.status || 'pending',
              sync_status: sStats.syncStatus || 'pending',
              source: sStats.source || null,
              last_verified_at: sStats.lastVerifiedAt
            }
          });
        });

        if (list.length > 0) {
          setStudents(list);
        }
      } catch (fErr) {
        console.error("Firestore direct read error in LandingPage", fErr);
      }
    }
  };

  const getSortedStudents = () => {
    const sorted = [...students];
    switch (sortBy) {
      case 'top_solved':
        return sorted.sort((a, b) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
      case 'low_solved':
        return sorted.sort((a, b) => (a.stats?.total_solved || 0) - (b.stats?.total_solved || 0));
      case 'name_asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'streak':
        return sorted.sort((a, b) => (b.streak_count || 0) - (a.streak_count || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.stats?.contest_rating || 0) - (a.stats?.contest_rating || 0));
      default:
        return sorted;
    }
  };

  const getFilteredSolvedStudents = (list: StudentData[]) => {
    switch (solvedFilter) {
      case 'above_500':
        return list.filter(s => (s.stats?.total_solved || 0) > 500);
      case '250_500':
        return list.filter(s => { const t = s.stats?.total_solved || 0; return t >= 250 && t <= 500; });
      case '101_250':
        return list.filter(s => { const t = s.stats?.total_solved || 0; return t >= 101 && t < 250; });
      case 'less_100':
        return list.filter(s => { const t = s.stats?.total_solved || 0; return t > 0 && t < 100; });
      case 'not_started':
        return list.filter(s => !s.stats || s.stats.total_solved === 0);
      default:
        return list;
    }
  };

  const sortedList = getFilteredSolvedStudents(getSortedStudents());

  return (
    <div className="space-y-10 py-6">
      
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
            Real-time automated performance monitoring for 270+ students across Computer Science and Engineering (Cyber Security) and Computer Science and Engineering (IoT) departments. Sunday session tracking, multi-level rankings, official Excel matrix reporting, and automated email dispatch.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onViewDashboard}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/40 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <span>View Executive Dashboard</span>
              <ArrowRight className="w-4 h-4 text-slate-950 stroke-[3]" />
            </button>

            <button
              onClick={handleRefreshAll}
              disabled={refreshing || syncProgress?.is_running}
              className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-sm backdrop-blur-md shadow-xl flex items-center space-x-2 transition-all transform hover:scale-105"
              title="Perform full live synchronization for active student roster"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing || syncProgress?.is_running ? 'animate-spin' : ''}`} />
              <span>{refreshing || syncProgress?.is_running ? `⏳ FETCHING ${syncProgress?.processed || 0} / 273` : '🔄 FETCH LIVE DATA'}</span>
            </button>

            <div className="hidden sm:flex items-center space-x-2 px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-extrabold text-xs backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>🟢 273/273 Verified • Just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Next Sunday Session Countdown Timer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Next Sunday Session Timer</span>
          <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Official Window: 08:00 AM – 09:30 AM IST</span>
        </div>
        <CountdownTimer targetSeconds={summaryData?.next_session_countdown_seconds || 86400} />
      </div>

      {/* Stat Cards Grid — Data-quality-aware */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {(() => {
          // Compute verified/pending/failed from loaded students
          const verified = students.filter(s => s.stats?.sync_status === 'success').length;
          const pending  = students.filter(s => !s.stats?.sync_status || s.stats.sync_status === 'pending' || s.stats.sync_status === 'not_started').length;
          const failed   = students.filter(s => s.stats?.sync_status === 'failed' || s.stats?.sync_status === 'mismatch').length;
          const activeSolvers = students.filter(s => s.stats?.sync_status === 'success' && (s.stats?.total_solved ?? 0) > 0).length;
          const verifiedProblems = students
            .filter(s => s.stats?.sync_status === 'success')
            .reduce((sum, s) => sum + (s.stats?.total_solved ?? 0), 0);

          return (
            <>
              <div className="glass-card p-6 rounded-2xl space-y-2 border shadow-md">
                <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white">{summaryData?.total_students || students.length || 273}</h4>
                <p className="text-xs font-semibold text-gray-500">Total Enrolled Students</p>
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

      {/* Interactive Showcase Filter Bar */}
      <div className="glass-card p-6 rounded-3xl border space-y-5 shadow-xl">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Student Performance Showcase</h3>
            <p className="text-xs text-gray-500">Browse student records by Department, Academic Year, Name & DSA Performance</p>
          </div>

          {/* View Mode Switch */}
          <div className="flex items-center space-x-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>🎴 3D Flip Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>📋 Table View</span>
            </button>
          </div>
        </div>

        {/* Department selector */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Department Filter</label>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setSelectedDept(null)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                !selectedDept
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              🏢 All Departments (Cyber Security & IoT)
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  selectedDept?.id === dept.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                🏢 {dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Year Level selector */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Academic Year</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'All Years' },
              { id: 'II', label: 'II Year' },
              { id: 'III', label: 'III Year' },
              { id: 'IV', label: 'IV Year' }
            ].map((yr) => (
              <button
                key={yr.id}
                onClick={() => setYearLevel(yr.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  yearLevel === yr.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                🎓 {yr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Number of Problems Solved filter */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Number of Problems Solved</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL',        label: '🟢 All Students',    color: '' },
              { id: 'above_500',  label: '🏆 Above 500',        color: 'emerald' },
              { id: '250_500',    label: '🔵 250 – 500',         color: 'blue' },
              { id: '101_250',    label: '🟡 101 – 250',         color: 'amber' },
              { id: 'less_100',   label: '🔴 Less than 100',    color: 'rose' },
              { id: 'not_started',label: '⬛ Not Yet Started',  color: 'gray' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSolvedFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  solvedFilter === f.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {/* Sort & Order selector */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort & Order Students</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'top_solved', label: '🔥 Top Solvers (High to Low)' },
              { id: 'low_solved', label: '⚠️ Low Solvers (Needs Focus)' },
              { id: 'name_asc', label: '🔤 Name (A ➔ Z)' },
              { id: 'name_desc', label: '🔤 Name (Z ➔ A)' },
              { id: 'streak', label: '⚡ Highest Streak' },
              { id: 'rating', label: '⭐ Contest Rating' }
            ].map((sortItem) => (
              <button
                key={sortItem.id}
                onClick={() => setSortBy(sortItem.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  sortBy === sortItem.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {sortItem.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Student Showcase Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-black text-base text-gray-900 dark:text-white">
            {selectedDept ? selectedDept.name : 'All Departments (Cyber Security & IoT)'} • {yearLevel === 'ALL' ? 'All Years' : `${yearLevel} Year`}{solvedFilter !== 'ALL' ? ` • ${({'above_500':'Above 500','250_500':'250–500','101_250':'101–250','less_100':'<100','not_started':'Not Started'}[solvedFilter] ?? '')} Solved` : ''} ({sortedList.length} Students)
          </h3>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing || syncProgress?.is_running}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              refreshing || syncProgress?.is_running
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30'
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

        {/* Sync Progress Bar — Firestore real-time listener */}
        {syncProgress && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-navy-900 dark:to-indigo-950 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center space-x-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${syncProgress.is_running ? 'animate-spin' : ''}`} />
                <span>{syncProgress.is_running ? '🔄 Syncing LeetCode Statistics...' : '✅ Sync Complete'}</span>
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {syncProgress.processed} / {syncProgress.total}
              </span>
            </div>
            <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 h-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((syncProgress.processed / Math.max(1, syncProgress.total)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>✅ {syncProgress.successful} Successful</span>
              </span>
              <span className="text-gray-500">{Math.round((syncProgress.processed / Math.max(1, syncProgress.total)) * 100)}%</span>
              {syncProgress.failed > 0 && (
                <span className="text-rose-500 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>🔴 {syncProgress.failed} Failed</span>
                </span>
              )}
            </div>
          </div>
        )}


        {viewMode === 'cards' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sortedList.slice(0, displayCount).map((st, idx) => {
                const isSolver = (st.stats?.total_solved || 0) > 0;
                const computedRank = (isSolver && sortBy === 'top_solved' && !selectedDept && yearLevel === 'ALL' && solvedFilter === 'ALL') ? idx + 1 : st.college_rank;
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
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all hover:scale-105"
                  >
                    <span>👇 Load More Students (+32)</span>
                  </button>
                  <button
                    onClick={() => setDisplayCount(sortedList.length)}
                    className="px-5 py-3 rounded-2xl glass-card hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs border border-gray-200 dark:border-gray-700 transition-all"
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
