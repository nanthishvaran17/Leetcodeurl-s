import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import {
  TrendingUp,
  Award,
  Zap,
  Calendar,
  Filter,
  Flame,
  ArrowUpRight,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronDown,
  Check,
  Building2,
  GraduationCap,
  Search,
  UserCheck,
  CheckCircle2,
  BarChart2,
  X,
  RotateCw
} from 'lucide-react';
import api from '../services/api';

interface Improver {
  student_id: number;
  reg_no: string;
  name: string;
  department_code: string;
  year_level: string;
  section_name?: string;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number;
  delta_solved: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  delta_rating: number;
}

interface CollegeDelta {
  period: string;
  total_students?: number;
  active_students?: number;
  active_solvers?: number;
  total_solved?: number;
  delta_total?: number;
  delta_easy?: number;
  delta_medium?: number;
  delta_hard?: number;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  total_delta_solved?: number;
  total_delta_easy?: number;
  total_delta_medium?: number;
  total_delta_hard?: number;
}

interface StatSnapshot {
  id: number;
  student_id: number;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number;
  captured_at: string;
  delta_total: number;
  source?: string;
}

import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export const GrowthIntelligencePage: React.FC = () => {
  const { notify } = useNotification();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(10);
  const [sortMode, setSortMode] = useState<'total' | 'growth'>('total');
  const [deptOpen, setDeptOpen] = useState<boolean>(false);
  const [yearOpen, setYearOpen] = useState<boolean>(false);
  const [improvers, setImprovers] = useState<Improver[]>([]);
  const [collegeDelta, setCollegeDelta] = useState<CollegeDelta | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Time Machine Inline Expansion state (One expanded student at a time)
  const [expandedStudentId, setExpandedStudentId] = useState<number | string | null>(null);
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const [historySnapshots, setHistorySnapshots] = useState<StatSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [activeStudentInfo, setActiveStudentInfo] = useState<any>(null);

  useEffect(() => {
    fetchGrowthData();
    const interval = setInterval(() => {
      fetchGrowthData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [period, deptFilter, yearFilter]);

  useEffect(() => {
    api.get('/growth/options')
      .then((response) => {
        setDepartments(response.data?.departments || []);
        setAvailableYears(response.data?.years || []);
        if (user?.role?.toLowerCase() === 'hod' && response.data?.departments?.length === 1) {
          setDeptFilter(response.data.departments[0].code);
        }
      })
      .catch((err) => console.error('Growth filter options fetch error:', err));
  }, [user]);

  const sortImprovers = (data: Improver[], mode = sortMode): Improver[] => [...data].sort((left, right) => {
    if (mode === 'total') {
      return (
        right.total_solved - left.total_solved ||
        right.delta_solved - left.delta_solved ||
        right.delta_hard - left.delta_hard ||
        right.delta_medium - left.delta_medium ||
        left.name.localeCompare(right.name)
      );
    }
    return (
      right.delta_solved - left.delta_solved ||
      right.delta_hard - left.delta_hard ||
      right.delta_medium - left.delta_medium ||
      right.delta_easy - left.delta_easy ||
      right.delta_rating - left.delta_rating ||
      right.total_solved - left.total_solved ||
      left.name.localeCompare(right.name)
    );
  });

  const fetchGrowthData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=200&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      setImprovers(sortImprovers(impRes.data || []));
      setCollegeDelta(deltaRes.data || null);
    } catch (err) {
      console.error("Growth data fetch error:", err);
      if (!isBackground) setError('Unable to load student analytics. Please try again.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=200&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      setImprovers(sortImprovers(impRes.data || []));
      setCollegeDelta(deltaRes.data || null);
      notify.success('Growth Telemetry Refreshed', 'Successfully synchronized 100% verified solve deltas and performance velocity.', { category: 'GROWTH ENGINE' });
    } catch (err) {
      console.error("Refresh error:", err);
      setError('Unable to load student analytics. Please try again.');
      notify.error('Refresh Failed', 'Unable to reach backend telemetry engine.', { category: 'GROWTH ENGINE' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const calculateTargetTopY = (e?: React.MouseEvent) => {
    if (!e) return null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const modalEstHeight = 550;
    let targetTop = rect.top - 20;
    if (targetTop + modalEstHeight > vh - 20) {
      targetTop = Math.max(70, vh - modalEstHeight - 20);
    }
    if (targetTop < 70) targetTop = 70;
    return targetTop;
  };

  const handleFetchStudentHistory = async (identifier: string, fallbackName?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!identifier || (typeof identifier === 'string' && !identifier.trim())) return;

    // Toggle collapse if clicking the currently expanded student
    if (String(expandedStudentId) === String(identifier)) {
      setExpandedStudentId(null);
      return;
    }

    setExpandedStudentId(identifier);
    setSelectedStudentName(fallbackName || `Student: ${identifier}`);
    setHistorySnapshots([]);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/history/${encodeURIComponent(identifier.trim())}?limit=50`);
      if (res.data && Array.isArray(res.data)) {
        setHistorySnapshots(res.data);
        setSelectedStudentName(fallbackName || `Student: ${identifier}`);
        setActiveStudentInfo(null);
      } else if (res.data && res.data.snapshots) {
        setHistorySnapshots(res.data.snapshots || []);
        setSelectedStudentName(res.data.student?.name || fallbackName || `Student: ${identifier}`);
        setActiveStudentInfo(res.data.student);
      }
    } catch (err: any) {
      console.error("Fetch history error:", err);
      notify.warning('Timeline Records Not Found', `Could not find history snapshots for '${identifier}'. Please check Register Number or LeetCode handle.`, { category: 'TIME MACHINE' });
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-8 py-2 pb-16 animate-slideUp">

      {/* Executive Header Banner */}
      <div className={`relative rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-brand-500/30 ${deptOpen || yearOpen ? 'z-50' : 'z-10'}`}>
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>REAL-TIME GROWTH & DELTA ENGINE</span>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 shadow-lg shadow-emerald-500/10">
                <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5]" />
              </div>
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight">
                Growth Intelligence & <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">Time Machine</span>
              </h1>
            </div>

            <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
              Track student problem-solving deltas, biggest improvers leaderboard, difficulty velocity, and granular historical stat snapshots across custom timeframe windows.
            </p>
          </div>

          {/* Filters, Timeframe Selector Pills & Live Refresh Button */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Department Custom Dropdown */}
            <div className={`relative ${deptOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setDeptOpen(p => !p); setYearOpen(false); }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-navy-900/90 text-white text-xs font-bold border backdrop-blur-md shadow-inner transition-all focus:outline-none ${
                  deptOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-700/80 hover:border-brand-500'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                  {deptFilter}
                </span>
                <span className="truncate max-w-[120px]">
                  {deptFilter === 'ALL' ? 'All Departments' : departments.find(d => d.code === deptFilter)?.name || deptFilter}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${deptOpen ? 'rotate-180' : ''}`} />
              </button>

              {deptOpen && (
                <div className="absolute z-[200] top-full left-0 mt-1 min-w-[220px] bg-navy-900 border border-slate-700 rounded-2xl shadow-lg max-h-64 overflow-y-auto divide-y divide-navy-800">
                  {user?.role?.toLowerCase() !== 'hod' && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setDeptFilter('ALL'); setDeptOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                        deptFilter === 'ALL' ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-slate-300 hover:bg-navy-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">ALL</span>
                        <span className="truncate">All Departments</span>
                      </div>
                      {deptFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                    </button>
                  )}
                  {departments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setDeptFilter(d.code); setDeptOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                        deptFilter === d.code ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-slate-300 hover:bg-navy-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{d.code}</span>
                        <span className="truncate">{d.name || d.code}</span>
                      </div>
                      {deptFilter === d.code && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Academic Year Custom Dropdown */}
            <div className={`relative ${yearOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setYearOpen(p => !p); setDeptOpen(false); }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-navy-900/90 text-white text-xs font-bold border backdrop-blur-md shadow-inner transition-all focus:outline-none ${
                  yearOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-700/80 hover:border-brand-500'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                  {yearFilter}
                </span>
                <span className="truncate">
                  {yearFilter === 'ALL' ? 'All Academic Years' : `${yearFilter} Year`}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${yearOpen ? 'rotate-180' : ''}`} />
              </button>

              {yearOpen && (
                <div className="absolute z-[200] top-full left-0 mt-1 min-w-[200px] bg-navy-900 border border-slate-700 rounded-2xl shadow-lg max-h-64 overflow-y-auto divide-y divide-navy-800">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setYearFilter('ALL'); setYearOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                      yearFilter === 'ALL' ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-slate-300 hover:bg-navy-800 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">ALL</span>
                      <span className="truncate">All Academic Years</span>
                    </div>
                    {yearFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                  </button>
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setYearFilter(year); setYearOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                        yearFilter === year ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-slate-300 hover:bg-navy-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">{year}</span>
                        <span className="truncate">{year} Year</span>
                      </div>
                      {yearFilter === year && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Timeframe Selector Pills */}
            <div className="flex items-center space-x-1 bg-navy-900/90 p-1.5 rounded-2xl border border-slate-700/80 shadow-inner backdrop-blur-md">
              {(['today', '7d', '30d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    period === p
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
            </div>

            {/* Live Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              title="Refresh Growth Metrics & Solve Deltas"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* College Aggregate Delta Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        
        <div className="glass-card p-5 rounded-3xl border border-emerald-500/30 bg-white dark:bg-navy-950 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Total Solved Growth</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            +{collegeDelta?.delta_total ?? 0}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Problems solved in selected period</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-emerald-500/20 bg-white dark:bg-navy-950 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Easy Solved</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            +{collegeDelta?.easy_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Foundation skill building</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-amber-500/20 bg-white dark:bg-navy-950 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span className="text-amber-600 dark:text-amber-400">Medium Solved</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            +{collegeDelta?.medium_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Interview readiness problems</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-rose-500/20 bg-white dark:bg-navy-950 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span className="text-rose-600 dark:text-rose-400">Hard Solved</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            +{collegeDelta?.hard_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Advanced DSA mastery</p>
        </div>

      </div>

      {/* Main Section: Top Improvers Leaderboard */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 shadow-lg space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Flame className="w-6 h-6 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Biggest Improvers Leaderboard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing top performance growth for: <span className="font-extrabold text-brand-600 dark:text-brand-400">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            {/* Rank By Sort Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 font-mono">Rank By:</span>
              <button
                onClick={() => { setSortMode('total'); setImprovers(prev => sortImprovers(prev, 'total')); }}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  sortMode === 'total'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Total Solved 
              </button>
              <button
                onClick={() => { setSortMode('growth'); setImprovers(prev => sortImprovers(prev, 'growth')); }}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  sortMode === 'growth'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Growth (+Delta) 
              </button>
            </div>

            {/* Display Limit Selector Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-navy-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 font-mono">Show:</span>
              {[10, 25, 50, 100, 'ALL'].map((limitVal) => (
                <button
                  key={String(limitVal)}
                  onClick={() => setDisplayLimit(limitVal as any)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    displayLimit === limitVal
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-800'
                  }`}
                >
                  {limitVal === 'ALL' ? 'All' : limitVal}
                </button>
              ))}
            </div>

            <span className="px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-navy-950 text-slate-800 dark:text-slate-200 font-black text-xs border border-slate-200 dark:border-slate-800">
              {collegeDelta?.active_students ?? 0} Active Solvers
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm font-bold animate-pulse space-y-2">
            <BarChart2 className="w-8 h-8 mx-auto text-brand-500 animate-bounce" />
            <p>Calculating growth metrics & delta velocity...</p>
          </div>
        ) : improvers.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs font-semibold bg-slate-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            No activity found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 uppercase font-black text-[11px] border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4"># Rank</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Dept / Year</th>
                  <th className="py-3.5 px-4">Total Solved</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Growth (+Delta)</th>
                  <th className="py-3.5 px-4">Difficulty Breakdown</th>
                  <th className="py-3.5 px-4">Rating Delta</th>
                  <th className="py-3.5 px-4 text-right">Time Machine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:border-slate-800 dark:divide-gray-800/80 bg-white dark:bg-navy-950 font-medium">
                {(displayLimit === 'ALL' ? improvers : improvers.slice(0, Number(displayLimit))).map((imp, idx) => {
                  const isExpanded = String(expandedStudentId) === String(imp.student_id);
                  return (
                    <React.Fragment key={imp.student_id}>
                      <tr
                        onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded
                            ? 'bg-brand-50/80 dark:bg-navy-800/90 border-l-4 border-l-brand-500'
                            : 'hover:bg-slate-50 dark:hover:bg-navy-800/60'
                        }`}
                      >
                        
                        {/* Rank Badge */}
                        <td className="py-4 px-4 font-black text-slate-900 dark:text-white">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/30 text-xs">
                              #1
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 font-black shadow-sm text-xs">
                              #2
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-black shadow-sm text-xs">
                              #3
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                              #{idx + 1}
                            </span>
                          )}
                        </td>

                        {/* Student Info */}
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                            {imp.name}
                          </div>
                          <div className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 mt-0.5">
                            {imp.reg_no}
                          </div>
                        </td>

                        {/* Department / Year Pill */}
                        <td className="py-4 px-4">
                          <span className="inline-block px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-extrabold text-xs">
                            {imp.department_code} • {imp.year_level} Yr
                          </span>
                        </td>

                        {/* Total Solved */}
                        <td className="py-4 px-4 font-black text-sm text-slate-900 dark:text-white">
                          {imp.total_solved}
                        </td>

                        {/* Growth Delta */}
                        <td className="py-4 px-4">
                          {imp.delta_solved === imp.total_solved ? (
                            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 font-black text-sm shadow-sm" title="Initial Baseline">
                              <span>—</span>
                            </span>
                          ) : imp.delta_solved > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-black text-sm shadow-sm">
                              <span>+{imp.delta_solved}</span>
                            </span>
                          ) : imp.delta_solved < 0 ? (
                            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-black text-sm shadow-sm">
                              <span>{imp.delta_solved}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-800 font-black text-sm shadow-sm">
                              <span>—</span>
                            </span>
                          )}
                        </td>

                        {/* Difficulty Breakdown */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2 text-xs font-black">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {imp.easy_solved} E (+{imp.delta_easy})
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {imp.medium_solved} M (+{imp.delta_medium})
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {imp.hard_solved} H (+{imp.delta_hard})
                            </span>
                          </div>
                        </td>

                        {/* Rating Delta */}
                        <td className="py-4 px-4">
                          {imp.delta_rating !== 0 ? (
                            <span className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                              imp.delta_rating > 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {imp.delta_rating > 0 ? `+${imp.delta_rating}` : imp.delta_rating}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">—</span>
                          )}
                        </td>

                        {/* Time Machine Timeline Toggle Button */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                            className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all flex items-center space-x-1.5 shadow-md ml-auto ${
                              isExpanded
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Close' : 'Timeline'}</span>
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* INLINE EXPANDED DETAILS PANEL */}
                      {isExpanded && (
                        <tr key={`expanded-${imp.student_id}`} className="bg-slate-50/90 dark:bg-navy-950/90">
                          <td colSpan={8} className="p-4 sm:p-6 border-b-2 border-brand-500/30">
                            <div className="space-y-6">
                              
                              {/* Header & Details Strip */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-sm">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="text-base font-black text-slate-900 dark:text-white">{imp.name}</h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                                      {imp.reg_no}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300">
                                      {imp.department_code} • {imp.year_level} Yr
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-semibold">
                                    Active Filter Time Window: <strong className="text-brand-600 dark:text-brand-400 uppercase tracking-wide">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</strong>
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setExpandedStudentId(null); }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-rose-500 hover:text-white transition-colors text-xs font-bold flex items-center space-x-1"
                                >
                                  <span>Close Details</span>
                                </button>
                              </div>

                              {/* Growth Breakdown Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-sm">
                                  <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Solved</span>
                                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{imp.total_solved}</div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
                                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Easy Solved</span>
                                  <div className="text-lg font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                                    {imp.easy_solved} <span className="text-xs font-bold text-emerald-600">(+{imp.delta_easy})</span>
                                  </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 shadow-sm">
                                  <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Medium Solved</span>
                                  <div className="text-lg font-black text-amber-900 dark:text-amber-100 mt-0.5">
                                    {imp.medium_solved} <span className="text-xs font-bold text-amber-600">(+{imp.delta_medium})</span>
                                  </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 shadow-sm">
                                  <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Hard Solved</span>
                                  <div className="text-lg font-black text-rose-900 dark:text-rose-100 mt-0.5">
                                    {imp.hard_solved} <span className="text-xs font-bold text-rose-600">(+{imp.delta_hard})</span>
                                  </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 shadow-sm col-span-2 sm:col-span-1">
                                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Period Delta</span>
                                  <div className="text-lg font-black text-indigo-900 dark:text-indigo-100 mt-0.5">+{imp.delta_solved}</div>
                                </div>
                              </div>

                              {/* Compact Area Chart */}
                              {historySnapshots.length > 1 && (
                                <div className="p-4 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                                      <BarChart2 className="w-4 h-4 text-brand-500" />
                                      <span>Solve Growth Trajectory</span>
                                    </h5>
                                    <span className="text-[11px] font-mono text-slate-400">{historySnapshots.length} Data Points</span>
                                  </div>
                                  <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={[...historySnapshots].reverse()}>
                                        <defs>
                                          <linearGradient id={`colorSolved-${imp.student_id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                          </linearGradient>
                                        </defs>
                                        <XAxis
                                          dataKey="captured_at"
                                          tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                          tick={{ fontSize: 10, fill: '#64748b' }}
                                        />
                                        <YAxis domain={['dataMin', 'dataMax']} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip
                                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                                          labelFormatter={(val) => new Date(val).toLocaleString()}
                                        />
                                        <Area type="monotone" dataKey="total_solved" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill={`url(#colorSolved-${imp.student_id})`} />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}

                              {/* Snapshot History Table */}
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                                    <Clock className="w-4 h-4 text-brand-500" />
                                    <span>Time Machine Historical Log</span>
                                  </h5>
                                </div>

                                {historyLoading ? (
                                  <div className="p-6 text-center text-xs font-bold text-slate-500 animate-pulse">
                                    Loading historical snapshots...
                                  </div>
                                ) : historySnapshots.length > 0 ? (
                                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 uppercase font-black text-[10px] border-b border-slate-200 dark:border-navy-800">
                                        <tr>
                                          <th className="py-2.5 px-3.5">Captured At</th>
                                          <th className="py-2.5 px-3.5">Total</th>
                                          <th className="py-2.5 px-3.5 text-emerald-600">Easy</th>
                                          <th className="py-2.5 px-3.5 text-amber-600">Medium</th>
                                          <th className="py-2.5 px-3.5 text-rose-600">Hard</th>
                                          <th className="py-2.5 px-3.5">Rating</th>
                                          <th className="py-2.5 px-3.5 text-emerald-600">Delta</th>
                                          <th className="py-2.5 px-3.5">Source</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200 dark:divide-navy-800 font-mono text-xs">
                                        {historySnapshots.map((snap) => (
                                          <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                                            <td className="py-2.5 px-3.5 font-sans font-bold text-slate-800 dark:text-slate-200">
                                              {new Date(snap.captured_at).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-2.5 px-3.5 font-black text-slate-900 dark:text-white">{snap.total_solved}</td>
                                            <td className="py-2.5 px-3.5 font-bold text-emerald-600 dark:text-emerald-400">{snap.easy_solved}</td>
                                            <td className="py-2.5 px-3.5 font-bold text-amber-600 dark:text-amber-400">{snap.medium_solved}</td>
                                            <td className="py-2.5 px-3.5 font-bold text-rose-600 dark:text-rose-400">{snap.hard_solved}</td>
                                            <td className="py-2.5 px-3.5 font-bold text-slate-700 dark:text-slate-300">{snap.contest_rating ?? '—'}</td>
                                            <td className="py-2.5 px-3.5">
                                              {snap.delta_total === snap.total_solved ? (
                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400 font-black text-[11px]" title="Initial Baseline Snapshot">
                                                  — Baseline
                                                </span>
                                              ) : snap.delta_total > 0 ? (
                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[11px]">
                                                  +{snap.delta_total}
                                                </span>
                                              ) : snap.delta_total < 0 ? (
                                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black text-[11px]">
                                                  {snap.delta_total}
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400 font-black text-[11px]">
                                                  +0
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3.5 text-[10px] font-sans font-bold text-slate-400">{snap.source || 'leetcode_sync'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold text-center">
                                    Historical snapshot data unavailable for this student yet.
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

