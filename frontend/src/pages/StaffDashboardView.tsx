import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, AlertTriangle, RefreshCw, BarChart3, CheckCircle2, Search,
  ShieldCheck, Award, TrendingUp, TrendingDown, Minus, Eye, Bell,
  FileText, Clock, AlertCircle, ArrowRight, Download, Zap, Sparkles,
  ChevronDown, Check, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AnimatedWelcomeHeading } from '../components/AnimatedWelcomeHeading';
import api, { clearApiCache } from '../services/api';
import { StaffMentoringDetailModal } from '../components/StaffMentoringDetailModal';
import { useNotification } from '../context/NotificationContext';
import { LiveContestPanel } from '../components/contest/LiveContestPanel';

export const StaffDashboardView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [summary, setSummary] = useState<any>(null);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [priorityStudents, setPriorityStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveSyncing, setLiveSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'IN_PROGRESS' | 'ATTENTION' | 'AT_RISK'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isStudentSelectOpen, setIsStudentSelectOpen] = useState<boolean>(false);
  const [studentSelectSearch, setStudentSelectSearch] = useState<string>('');
  const [sortField, setSortField] = useState<'name' | 'reg_no' | 'total_solved' | 'progress' | 'contest_rating' | 'status'>('total_solved');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchMentoringData();
  }, []);

  const fetchMentoringData = async () => {
    setLoading(true);
    try {
      clearApiCache();
      const [sumRes, studRes, prioRes, alertRes] = await Promise.all([
        api.get(`/faculty-assignments/my-mentoring-summary?_t=${Date.now()}`),
        api.get(`/faculty-assignments/my-students?_t=${Date.now()}`),
        api.get(`/faculty-assignments/priority-students?_t=${Date.now()}`),
        api.get(`/faculty-assignments/alerts?_t=${Date.now()}`)
      ]);

      const rawList = Array.isArray(studRes.data?.students)
        ? studRes.data.students
        : (Array.isArray(studRes.data) ? studRes.data : []);

      const studentList = rawList.map((s: any) => {
        const solved = Number(s.stats?.total_solved ?? s.total_solved ?? s.totalSolved ?? 0);
        const streak = Number(s.stats?.max_streak ?? s.max_streak ?? s.streak_count ?? 0);
        const rating = Number(s.stats?.contest_rating ?? s.contest_rating ?? s.rating ?? 0);
        const days = Number(s.days_inactive ?? s.daysInactive ?? 0);
        
        let statusCode = s.status_code;
        let statusLabel = s.status_label;
        let badgeColor = s.badge_color;

        if (!statusCode) {
          if (days >= 8 || solved === 0 || !s.username) {
            statusCode = 'AT_RISK';
            statusLabel = 'At Risk';
            badgeColor = 'red';
          } else if (solved < 30 || days >= 4) {
            statusCode = 'NEEDS_IMPROVEMENT';
            statusLabel = 'Needs Improvement';
            badgeColor = 'yellow';
          } else if (solved >= 100 || streak >= 7 || rating >= 1400) {
            statusCode = 'EXCELLENT';
            statusLabel = 'Excellent';
            badgeColor = 'emerald';
          } else {
            statusCode = 'IMPROVING';
            statusLabel = 'Improving';
            badgeColor = 'blue';
          }
        }

        return {
          ...s,
          total_solved: solved,
          max_streak: streak,
          contest_rating: rating,
          status_code: statusCode,
          status_label: statusLabel || (statusCode === 'AT_RISK' ? 'At Risk' : statusCode === 'EXCELLENT' ? 'Excellent' : 'Improving'),
          badge_color: badgeColor || (statusCode === 'AT_RISK' ? 'red' : statusCode === 'EXCELLENT' ? 'emerald' : 'yellow'),
          days_inactive: days
        };
      });

      if (sumRes.data) {
        setSummary(sumRes.data);
      }
      setMyStudents(studentList);
      setPriorityStudents(prioRes.data || []);
      setAlerts(alertRes.data || []);
    } catch (err) {
      console.error('Error fetching mentoring dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLiveSync = async () => {
    if (liveSyncing) return;
    setLiveSyncing(true);
    setSyncStatusMsg(`FETCHING LIVE DATA... Checking ${myStudents.length || 30} assigned profiles from LeetCode...`);
    notify.info('Live Sync Started', `Fetching live LeetCode data strictly for your ${myStudents.length || 30} assigned students...`);
    try {
      const res = await api.post('/faculty-assignments/live-sync');
      if (res.data?.status === 'ALREADY_RUNNING') {
        notify.warning('Sync In Progress', res.data.message || 'Live sync already in progress.');
        setSyncStatusMsg(res.data.message);
      } else {
        const successCnt = res.data?.success_count || 0;
        const unavailCnt = res.data?.unavailable_count || 0;
        const failedCnt = res.data?.failed_count || 0;
        const totalChecked = res.data?.total_assigned || myStudents.length;
        const nowFormatted = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        setLastSyncTime(nowFormatted);
        setSyncStatusMsg(`LIVE SYNC COMPLETED • ${totalChecked} Students Checked (${successCnt} Updated, ${unavailCnt} Unavailable, ${failedCnt} Failed)`);
        notify.success('Live Sync Complete', `Updated ${successCnt} profiles successfully.`);
        // Clear GET cache so fresh data loads immediately — not 60s stale data
        clearApiCache();
        await fetchMentoringData();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to complete live sync.';
      notify.error('Live Sync Error', errMsg);
      setSyncStatusMsg(`Sync error: ${errMsg}`);
    } finally {
      setLiveSyncing(false);
    }
  };

  // Strict helper predicates for classification to guarantee 100% exact match between KPI card counts and filtered list
  const isCompletedStudent = useCallback((s: any) => {
    const solved = Number(s.stats?.total_solved ?? s.total_solved ?? s.totalSolved ?? 0);
    const sc = (s.status_code || '').toUpperCase();
    const sl = (s.status_label || '').toUpperCase();
    return solved >= 100 || sc === 'EXCELLENT' || sc === 'COMPLETED' || sl.includes('EXCELLENT') || sl.includes('COMPLETED');
  }, []);

  const isAtRiskStudent = useCallback((s: any) => {
    if (isCompletedStudent(s)) return false;
    const solved = Number(s.stats?.total_solved ?? s.total_solved ?? s.totalSolved ?? 0);
    const days = Number(s.days_inactive ?? s.daysInactive ?? 0);
    const sc = (s.status_code || '').toUpperCase();
    const sl = (s.status_label || '').toUpperCase();
    return sc === 'AT_RISK' || sc === 'RISK' || sc === 'PENDING_USERNAME' || sl.includes('AT RISK') || sl.includes('RISK') || days >= 8 || solved === 0 || !s.username;
  }, [isCompletedStudent]);

  const isAttentionStudent = useCallback((s: any) => {
    if (isCompletedStudent(s)) return false;
    if (isAtRiskStudent(s)) return false;
    return true;
  }, [isCompletedStudent, isAtRiskStudent]);

  const isActiveStudent = useCallback((s: any) => {
    const solved = Number(s.stats?.total_solved ?? s.total_solved ?? s.totalSolved ?? 0);
    return solved > 0;
  }, []);

  // Exact KPI calculations strictly matching assigned portfolio
  const totalAssignedCount = myStudents.length;
  const activeCount = myStudents.filter(isActiveStudent).length;
  const completedCount = myStudents.filter(isCompletedStudent).length;
  const attentionCount = myStudents.filter(isAttentionStudent).length;
  const atRiskCount = myStudents.filter(isAtRiskStudent).length;
  
  // Progress calculations based on 100 Target
  const totalSolvedSum = myStudents.reduce((acc: number, s: any) => acc + Number(s.stats?.total_solved ?? s.total_solved ?? 0), 0);
  const avgSolvedProblems = summary?.weekly_progress_avg ?? (myStudents.length > 0 ? (totalSolvedSum / myStudents.length).toFixed(1) : 0);
  const totalCappedSolvedSum = myStudents.reduce((acc: number, s: any) => acc + Math.min(Number(s.stats?.total_solved ?? s.total_solved ?? 0), 100), 0);
  const targetProgressPct = summary?.target_progress_pct ?? (myStudents.length > 0 ? (totalCappedSolvedSum / myStudents.length).toFixed(1) : '0');
  const avgSolvedProgress = targetProgressPct;

  // Filter ONLY inside assigned students set based on active student filter + status filter + search query
  const filteredStudents = useMemo(() => {
    return myStudents.filter((s: any) => {
      // 1. Specific Student Filter dropdown
      if (selectedStudentFilter !== 'ALL' && selectedStudentFilter !== '') {
        const studentIdMatch = String(s.id) === String(selectedStudentFilter);
        const regNoMatch = String(s.reg_no || '').toLowerCase() === String(selectedStudentFilter).toLowerCase();
        if (!studentIdMatch && !regNoMatch) {
          return false;
        }
      }

      // 2. Status Category Filter
      if (filterStatus === 'ACTIVE') {
        if (!isActiveStudent(s)) return false;
      } else if (filterStatus === 'COMPLETED') {
        if (!isCompletedStudent(s)) return false;
      } else if (filterStatus === 'IN_PROGRESS') {
        if (isCompletedStudent(s)) return false;
      } else if (filterStatus === 'ATTENTION') {
        if (!isAttentionStudent(s)) return false;
      } else if (filterStatus === 'AT_RISK') {
        if (!isAtRiskStudent(s)) return false;
      }

      // 3. Text Search Filter (Case-insensitive matching Name, Reg No, Username, Dept)
      const q = search.toLowerCase().trim();
      if (q) {
        const matchesName = Boolean(s.name && s.name.toLowerCase().includes(q));
        const matchesRegNo = Boolean(s.reg_no && s.reg_no.toLowerCase().includes(q));
        const matchesUsername = Boolean(s.username && s.username.toLowerCase().includes(q));
        const matchesDept = Boolean(s.department && s.department.toLowerCase().includes(q));

        if (!matchesName && !matchesRegNo && !matchesUsername && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [myStudents, selectedStudentFilter, filterStatus, search, isActiveStudent, isCompletedStudent, isAttentionStudent, isAtRiskStudent]);

  const handleSort = (field: 'name' | 'reg_no' | 'total_solved' | 'progress' | 'contest_rating' | 'status') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' || field === 'reg_no' ? 'asc' : 'desc');
    }
  };

  const sortedFilteredStudents = useMemo(() => {
    return [...filteredStudents].sort((a: any, b: any) => {
      let valA: any;
      let valB: any;

      if (sortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'reg_no') {
        valA = a.reg_no || '';
        valB = b.reg_no || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'progress') {
        valA = Math.min(a.total_solved || 0, 100);
        valB = Math.min(b.total_solved || 0, 100);
      } else if (sortField === 'contest_rating') {
        valA = a.contest_rating || 0;
        valB = b.contest_rating || 0;
      } else if (sortField === 'status') {
        valA = a.status_code || '';
        valB = b.status_code || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = a.total_solved || 0;
        valB = b.total_solved || 0;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredStudents, sortField, sortOrder]);

  const handleCardFilterClick = (status: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'IN_PROGRESS' | 'ATTENTION' | 'AT_RISK') => {
    setFilterStatus(status);
    setSelectedStudentFilter('ALL');
    setSearch('');

    if (status === 'IN_PROGRESS') {
      setSortField('progress');
      setSortOrder('asc');
    } else {
      setSortField('total_solved');
      setSortOrder('desc');
    }

    // Smooth scroll down to table section
    setTimeout(() => {
      const tableEl = document.getElementById('assigned-students-table-section');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      <LiveContestPanel />

      {/* Staff Mentoring Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-indigo-500/30">

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-400/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>MY MENTORING DASHBOARD</span>
            </div>
            <AnimatedWelcomeHeading
              className="text-2xl md:text-3xl font-black text-white leading-tight break-words uppercase"
              nameClassName="text-indigo-300 break-words"
            />
            <p className="text-sm md:text-base text-slate-300 font-medium">Your mentoring dashboard is ready.</p>
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <span>Restricted Portfolio • Monitoring {totalAssignedCount === 0 ? '0' : totalAssignedCount} Assigned Students</span>
              {lastSyncTime && (
                <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Last Live Sync: {lastSyncTime} IST
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={liveSyncing}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-black shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${liveSyncing ? 'animate-bounce text-amber-400' : 'text-amber-300'}`} />
              <span>{liveSyncing ? 'Fetching Live Data...' : 'FETCH LIVE DATA'}</span>
            </button>

            <button
              type="button"
              onClick={fetchMentoringData}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Portfolio</span>
            </button>
          </div>
        </div>

        {/* Live Sync Status Banner */}
        {syncStatusMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-white/10 border border-white/15 text-xs font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
            <button 
              type="button"
              onClick={() => setSyncStatusMsg(null)}
              className="text-slate-400 hover:text-white text-[10px] ml-2 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Interactive Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">

        {/* 1. Assigned (All) */}
        <div 
          onClick={() => handleCardFilterClick('ALL')}
          title="Click to view all assigned students"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'ALL'
              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-indigo-300 dark:hover:border-indigo-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              My Assigned
            </span>
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalAssignedCount}
            </h3>
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">Students</span>
          </div>
          <div className="mt-2.5 flex items-center">
            <span className={`text-[10px] font-black tracking-wide px-2 py-0.5 rounded-lg border ${
              totalAssignedCount === (summary?.max_capacity || 30)
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : (totalAssignedCount > (summary?.max_capacity || 30)
                    ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800')
            }`}>
              {totalAssignedCount === 0 ? 'NO ASSIGNMENTS' : (summary?.workload_status || (totalAssignedCount === (summary?.max_capacity || 30) ? 'AT CAPACITY' : 'WITHIN CAPACITY'))}
            </span>
          </div>
        </div>

        {/* 2. Active Solvers */}
        <div 
          onClick={() => handleCardFilterClick('ACTIVE')}
          title="Click to filter active solvers"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'ACTIVE'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-emerald-300 dark:hover:border-emerald-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              Active
            </span>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {activeCount}
            </h3>
          </div>
          <p className="mt-2.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <span>Active Solvers</span>
            {filterStatus === 'ACTIVE' && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">(Filtered)</span>}
          </p>
        </div>

        {/* 3. Completed (Target Achieved) */}
        <div 
          onClick={() => handleCardFilterClick('COMPLETED')}
          title="Click to filter students with 100+ solved"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'COMPLETED'
              ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-purple-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-purple-300 dark:hover:border-purple-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              Completed
            </span>
            <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {completedCount}
            </h3>
          </div>
          <p className="mt-2.5 text-xs font-extrabold text-purple-700 dark:text-purple-300 flex items-center gap-1">
            <span>Target Achieved</span>
            {filterStatus === 'COMPLETED' && <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black">(Filtered)</span>}
          </p>
        </div>

        {/* 4. Attention (Needs Action) */}
        <div 
          onClick={() => handleCardFilterClick('ATTENTION')}
          title="Click to filter students needing attention"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'ATTENTION'
              ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-amber-300 dark:hover:border-amber-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              Attention
            </span>
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {attentionCount}
            </h3>
          </div>
          <p className="mt-2.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <span>Needs Action</span>
            {filterStatus === 'ATTENTION' && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">(Filtered)</span>}
          </p>
        </div>

        {/* 5. At Risk */}
        <div 
          onClick={() => handleCardFilterClick('AT_RISK')}
          title="Click to filter at-risk students"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'AT_RISK'
              ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/40 shadow-rose-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-rose-300 dark:hover:border-rose-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              At Risk
            </span>
            <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {atRiskCount}
            </h3>
          </div>
          <p className="mt-2.5 text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1">
            <span>Immediate Follow-Up</span>
            {filterStatus === 'AT_RISK' && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-black">(Filtered)</span>}
          </p>
        </div>

        {/* 6. Avg Progress */}
        <div 
          onClick={() => handleCardFilterClick('IN_PROGRESS')}
          title="Click to filter students in progress towards 100 target"
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            filterStatus === 'IN_PROGRESS'
              ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-500 ring-2 ring-sky-500/40 shadow-sky-500/10'
              : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-700/80 hover:border-sky-300 dark:hover:border-sky-600'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              Avg Progress
            </span>
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {targetProgressPct}%
            </h3>
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">/ 100 Target</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Number(targetProgressPct) || 0, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center justify-between">
              <span>Goal: 100 Solved</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                {filterStatus === 'IN_PROGRESS' ? '(Filtered: <100)' : `Avg: ${avgSolvedProblems}`}
              </span>
            </p>
          </div>
        </div>

      </div>

      {/* POST-9:30 AM ACTIVITY NOTIFICATION BANNER FOR STAFF */}
      {summary?.post_930_solvers_count > 0 && (
        <div className="glass-card p-5 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-900/40 to-indigo-950/40 flex items-center justify-between flex-wrap gap-4 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center space-x-2">
                <span>Post-Session Activity Detected</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {summary.post_930_solvers_count} Students
                </span>
              </h4>
              <p className="text-xs text-slate-300">
                {summary.post_930_solvers_count} of your assigned students solved +{summary.post_930_total_solves} problems after 09:30 AM IST lock time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S PRIORITY SECTION */}
      {priorityStudents.length > 0 && (
        <div className="bg-amber-50/40 dark:bg-amber-950/20 p-6 rounded-3xl border border-amber-300/80 dark:border-amber-700/40 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Today's Priority — ({priorityStudents.length} Students Need Attention)
              </h3>
            </div>
            <span className="text-xs text-amber-800 dark:text-amber-300 font-black bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-300/80 dark:border-amber-800/60">
              Restricted to your assigned portfolio
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {priorityStudents.slice(0, 3).map((st: any) => (
              <div 
                key={st.id} 
                className="p-4 rounded-2xl bg-white dark:bg-navy-950 border border-amber-200/90 dark:border-amber-900/60 shadow-sm flex flex-col justify-between transition-all hover:border-amber-400 hover:shadow-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white truncate" title={st.name}>
                      {st.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 whitespace-nowrap shrink-0">
                      {st.status_label || 'Needs Attention'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">Reg: {st.reg_no}</span> • <span className="font-bold text-slate-900 dark:text-white">{st.department || 'CSE'}</span> ({(st.year_level || '').replace(/year/gi, '').trim() || 'III'} Year)
                  </p>
                  <div className="space-y-1.5 pt-1 min-h-[44px]">
                    {st.priority_reasons && st.priority_reasons.length > 0 ? (
                      st.priority_reasons.map((r: string, idx: number) => (
                        <p key={idx} className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">{r}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Low activity / Needs review</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-100 dark:border-navy-800 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white text-xs font-black transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Inspect Student</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MY STUDENTS MAIN SECTION */}
      <div id="assigned-students-table-section" className="glass-card p-6 rounded-3xl border space-y-6 shadow-xl scroll-mt-6">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-500" />
              <span>
                My Assigned Students ({filteredStudents.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Only students strictly assigned to your mentorship allocation are fetched.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">

            {/* Premium Student Dropdown Filter */}
            {(() => {
              const selectedStudentObj = myStudents.find(
                (st: any) => String(st.id) === String(selectedStudentFilter) || String(st.reg_no).toLowerCase() === String(selectedStudentFilter).toLowerCase()
              );

              const searchedStudents = myStudents
                .slice()
                .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                .filter((st: any) => {
                  if (!studentSelectSearch.trim()) return true;
                  const q = studentSelectSearch.toLowerCase().trim();
                  return (
                    (st.name || '').toLowerCase().includes(q) ||
                    (st.reg_no || '').toLowerCase().includes(q) ||
                    (st.username || '').toLowerCase().includes(q)
                  );
                });

              return (
                <div
                  className="relative shrink-0 min-w-[220px] sm:w-72"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsStudentSelectOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsStudentSelectOpen((prev) => !prev)}
                    className={`w-full h-10 flex items-center justify-between gap-2 bg-white dark:bg-navy-950 px-3.5 rounded-2xl border shadow-xs transition-all hover:border-brand-400 dark:hover:border-brand-500 focus:outline-none cursor-pointer ${
                      isStudentSelectOpen
                        ? 'border-brand-500 ring-2 ring-brand-500/20 dark:border-brand-400'
                        : selectedStudentFilter !== 'ALL'
                        ? 'border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-950/30'
                        : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="p-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      
                      {selectedStudentObj ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {selectedStudentObj.name}
                          </span>
                          <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 shrink-0">
                            {selectedStudentObj.reg_no}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            All Students
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                            {myStudents.length}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {selectedStudentFilter !== 'ALL' && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentFilter('ALL');
                          }}
                          className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition cursor-pointer"
                          title="Clear Student Filter"
                        >
                          ✕
                        </span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          isStudentSelectOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isStudentSelectOpen && (
                    <div className="absolute z-50 top-full left-0 mt-2 w-full sm:w-80 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-2 animate-in fade-in zoom-in-95">
                      {/* Search Bar inside Dropdown */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          autoFocus
                          value={studentSelectSearch}
                          onChange={(e) => setStudentSelectSearch(e.target.value)}
                          onMouseDown={(e) => e.stopPropagation()}
                          placeholder="Search student or reg no..."
                          className="w-full h-9 pl-9 pr-7 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                        />
                        {studentSelectSearch && (
                          <button
                            type="button"
                            onClick={() => setStudentSelectSearch('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Header Row / All Students Button */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedStudentFilter('ALL');
                            setIsStudentSelectOpen(false);
                            setStudentSelectSearch('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            selectedStudentFilter === 'ALL'
                              ? 'bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-black'
                              : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-brand-500 shrink-0" />
                            <span className="text-xs">All Students</span>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                            {myStudents.length} Students
                          </span>
                        </button>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-navy-800 my-1" />

                      {/* Student Options List */}
                      <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                        {searchedStudents.length === 0 ? (
                          <div className="p-4 text-center text-xs font-medium text-slate-400 italic">
                            No students found
                          </div>
                        ) : (
                          searchedStudents.map((st: any) => {
                            const isSelected = String(st.id) === String(selectedStudentFilter);
                            const solved = st.total_solved || 0;
                            const initials = (st.name || 'S')
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase();

                            return (
                              <button
                                key={st.id || st.reg_no}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedStudentFilter(String(st.id));
                                  setFilterStatus('ALL');
                                  setIsStudentSelectOpen(false);
                                  setStudentSelectSearch('');
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800'
                                    : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {/* Initials Avatar */}
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                    st.badge_color === 'emerald' || solved >= 100
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                      : st.badge_color === 'red' || st.status_code === 'AT_RISK'
                                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                  }`}>
                                    {initials}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs truncate ${isSelected ? 'font-black text-brand-700 dark:text-brand-300' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                                      {st.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono font-medium truncate">
                                      {st.reg_no} • {solved} solved
                                    </p>
                                  </div>
                                </div>

                                {isSelected && (
                                  <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Premium Status Category Filter Dropdown */}
            {(() => {
              type FilterVal = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'IN_PROGRESS' | 'ATTENTION' | 'AT_RISK';
              const filterOpts: { value: FilterVal; label: string; code: string; color: string }[] = [
                { value: 'ALL',         label: 'All Statuses',              code: 'ALL',    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
                { value: 'ACTIVE',      label: 'Active Solvers',            code: 'ACTIVE', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' },
                { value: 'COMPLETED',   label: 'Target Achieved (100+)',    code: 'DONE',   color: 'text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300' },
                { value: 'IN_PROGRESS', label: 'In Progress (<100 Target)', code: 'PROG',   color: 'text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300' },
                { value: 'ATTENTION',   label: 'Needs Attention',           code: 'ATTN',   color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300' },
                { value: 'AT_RISK',     label: 'At Risk',                   code: 'RISK',   color: 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300' },
              ];
              const sel = filterOpts.find(o => o.value === filterStatus) || filterOpts[0];
              return (
                <div className="relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFilterOpen(false); }}>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(p => !p)}
                    className={`h-10 flex items-center gap-2 bg-white dark:bg-navy-950 px-3.5 rounded-2xl border shadow-xs text-left transition-all hover:border-indigo-400 dark:hover:border-indigo-500 focus:outline-none cursor-pointer ${
                      isFilterOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-400' : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-navy-300">
                      Status:
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${sel.color}`}>
                      {sel.code}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                      {sel.label}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ml-0.5 ${isFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isFilterOpen && (
                    <div className="absolute z-50 top-full right-0 sm:left-0 mt-2 w-64 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl overflow-hidden p-1 space-y-0.5">
                      {filterOpts.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setFilterStatus(opt.value); setIsFilterOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800 ${
                            filterStatus === opt.value ? 'bg-indigo-50/80 dark:bg-indigo-950/60' : ''
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${opt.color}`}>{opt.code}</span>
                          <span className={`text-xs truncate flex-1 ${filterStatus === opt.value ? 'text-indigo-700 dark:text-indigo-300 font-black' : 'font-bold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {filterStatus === opt.value && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Search inside assigned set strictly */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (selectedStudentFilter !== 'ALL') setSelectedStudentFilter('ALL');
                }}
                placeholder="Search assigned students..."
                className="w-full h-10 pl-10 pr-8 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition shadow-xs placeholder:font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Indicator Pill if any filter is applied */}
        {(selectedStudentFilter !== 'ALL' || filterStatus !== 'ALL' || search.trim() !== '') && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex-wrap">
              <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Active Filter:
                {selectedStudentFilter !== 'ALL' && (
                  <span className="ml-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-black">
                    Student: {myStudents.find(s => String(s.id) === String(selectedStudentFilter))?.name || selectedStudentFilter}
                  </span>
                )}
                {filterStatus !== 'ALL' && (
                  <span className="ml-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-black">
                    Status: {filterStatus.replace('_', ' ')}
                  </span>
                )}
                {search.trim() !== '' && (
                  <span className="ml-1 px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 font-black">
                    Search: "{search.trim()}"
                  </span>
                )}
                <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                  — Showing {filteredStudents.length} of {myStudents.length} students
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudentFilter('ALL');
                setFilterStatus('ALL');
                setSearch('');
              }}
              className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition-all cursor-pointer shadow-sm shrink-0"
            >
              Clear All Filters ✕
            </button>
          </div>
        )}

        {/* MOBILE CARDS VIEW (md:hidden) - ZERO horizontal scroll on phone/small screens */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold animate-pulse">
              Loading your assigned students...
            </div>
          ) : sortedFilteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">
              No students found matching your filters.
            </div>
          ) : (
            sortedFilteredStudents.map((st: any) => {
              const solved = st.total_solved || 0;
              const targetPct = Math.min(Math.round((solved / 100) * 100), 100);
              const statusLabel = st.status_label || (solved >= 100 ? 'Excellent' : (solved >= 30 ? 'Improving' : 'Needs Improvement'));
              const badgeColor = st.badge_color || (statusLabel === 'Excellent' ? 'emerald' : 'amber');
              const cleanYr = (st.year_level || '').replace(/year/gi, '').trim();

              return (
                <div
                  key={st.id}
                  className="bg-white dark:bg-navy-900 rounded-2xl p-4 border border-slate-200 dark:border-navy-700 shadow-sm space-y-3 transition-all hover:shadow-md"
                >
                  {/* Header: Name, Reg No, Dept & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {st.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        <span className="font-mono font-bold">{st.reg_no}</span> • {st.department || 'CSE'} ({cleanYr || 'III'} Year)
                      </p>
                      <p className="text-xs font-bold text-brand-600 dark:text-brand-400 mt-0.5 truncate">
                        {st.username ? `@${st.username}` : 'Not Linked'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                        badgeColor === 'emerald'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : badgeColor === 'red'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : badgeColor === 'yellow'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                      }`}>
                        {statusLabel}
                      </span>
                      {badgeColor === 'red' && st.days_inactive !== undefined && st.days_inactive > 0 && (
                        <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400">
                          Inactive {st.days_inactive}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar & Stats Row */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-700 dark:text-slate-300">Target Progress</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {targetPct}% ({Math.min(solved, 100)}/100)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-navy-700/60">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          solved >= 100
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : solved >= 50
                            ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                            : solved >= 20
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-rose-500 to-red-600'
                        }`}
                        style={{ width: `${targetPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Numbers & Inspect Button */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-navy-800">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Solved</span>
                        <span className="font-black text-slate-900 dark:text-white">{solved}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Rating</span>
                        <span className="font-bold text-amber-500">{st.contest_rating ? Math.round(st.contest_rating) : 'N/A'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStudent(st)}
                      className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-xs font-black inline-flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800 relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-200 font-black uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-navy-700 select-none">
              <tr>
                <th onClick={() => handleSort('name')} className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-navy-800 transition whitespace-nowrap">
                  <div className="flex items-center space-x-1">
                    <span>Student Name</span>
                    {sortField === 'name' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-30">↕</span>}
                  </div>
                </th>
                <th onClick={() => handleSort('reg_no')} className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-navy-800 transition whitespace-nowrap">
                  <div className="flex items-center space-x-1">
                    <span>Reg No</span>
                    {sortField === 'reg_no' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-30">↕</span>}
                  </div>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Dept / Class</th>
                <th className="px-3 py-3 whitespace-nowrap">LeetCode Handle</th>
                <th onClick={() => handleSort('progress')} className="px-3 py-3 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-950/80 transition whitespace-nowrap">
                  <div className="flex items-center space-x-1 text-sky-600 dark:text-sky-400 font-black">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Target Progress</span>
                    {sortField === 'progress' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-40">↕</span>}
                  </div>
                </th>
                <th onClick={() => handleSort('total_solved')} className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-navy-800 transition whitespace-nowrap text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span>Total Solved</span>
                    {sortField === 'total_solved' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-30">↕</span>}
                  </div>
                </th>
                <th onClick={() => handleSort('contest_rating')} className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-navy-800 transition whitespace-nowrap text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span>Contest Rating</span>
                    {sortField === 'contest_rating' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-30">↕</span>}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-navy-800 transition whitespace-nowrap">
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' ? (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>) : <span className="opacity-30">↕</span>}
                  </div>
                </th>
                <th className="px-3 py-3 sticky right-0 z-20 bg-slate-100 dark:bg-navy-900 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] whitespace-nowrap text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold animate-pulse">
                    Loading your assigned students...
                  </td>
                </tr>
              ) : sortedFilteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-navy-800 text-slate-400">
                        <Search className="w-6 h-6 text-indigo-500" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">No students found</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                        Try changing the selected student or search term.
                      </p>
                      {(selectedStudentFilter !== 'ALL' || search || filterStatus !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentFilter('ALL');
                            setSearch('');
                            setFilterStatus('ALL');
                          }}
                          className="mt-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedFilteredStudents.map((st: any) => {
                  const solved = st.total_solved || 0;
                  const targetPct = Math.min(Math.round((solved / 100) * 100), 100);
                  const statusLabel = st.status_label || (solved >= 100 ? 'Excellent' : (solved >= 30 ? 'Improving' : 'Needs Improvement'));
                  const badgeColor = st.badge_color || (statusLabel === 'Excellent' ? 'emerald' : 'amber');
                  const cleanYr = (st.year_level || '').replace(/year/gi, '').trim();

                  return (
                    <tr key={st.id} className="group hover:bg-slate-50/80 dark:hover:bg-navy-850 transition-colors">
                      <td className="px-3 py-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        {st.name}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                        {st.reg_no}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 dark:text-white">{st.department || 'CSE'}</span>{' '}
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                          ({cleanYr || 'III'} Year)
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        {st.username ? `@${st.username}` : 'Not Linked'}
                      </td>
                      {/* Target Progress Bar Column */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 min-w-[100px] max-w-[130px]">
                          <div className="flex items-center justify-between text-xs font-black">
                            <span className="text-slate-900 dark:text-white font-mono">
                              {targetPct}%
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                              {Math.min(solved, 100)}/100
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-navy-700/60">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                solved >= 100
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : solved >= 50
                                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                                  : solved >= 20
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                  : 'bg-gradient-to-r from-rose-500 to-red-600'
                              }`}
                              style={{ width: `${targetPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-black text-slate-900 dark:text-white text-center whitespace-nowrap">
                        {solved}
                      </td>
                      <td className="px-3 py-3 font-bold text-amber-500 text-center whitespace-nowrap">
                        {st.contest_rating ? Math.round(st.contest_rating) : 'N/A'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            badgeColor === 'emerald'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : badgeColor === 'red'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : badgeColor === 'yellow'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                          }`}>
                            {statusLabel}
                          </span>
                          {badgeColor === 'red' && st.days_inactive !== undefined && st.days_inactive > 0 && (
                            <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 ml-1">
                              Inactive {st.days_inactive}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 sticky right-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-navy-950 dark:group-hover:bg-navy-850 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] transition-colors whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(st)}
                          className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold inline-flex items-center space-x-1.5 transition-all text-[11px] shadow-sm cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Mentoring Detail Modal */}
      {selectedStudent && (
        <StaffMentoringDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onRefresh={fetchMentoringData}
        />
      )}

    </div>
  );
};
