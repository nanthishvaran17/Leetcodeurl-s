import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  delta_solved: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  delta_rating: number;
  current_contest_rating?: number;
}

interface CollegeDelta {
  period: string;
  delta_total: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  total_students: number;
  active_students: number;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
}

interface StatSnapshot {
  id: number;
  student_id: number;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating?: number;
  delta_total: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  delta_rating: number;
  captured_at: string;
  sync_run_id?: string;
  source?: string;
}

import { useNotification } from '../context/NotificationContext';

export const GrowthIntelligencePage: React.FC = () => {
  const { notify } = useNotification();
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [deptOpen, setDeptOpen] = useState<boolean>(false);
  const [yearOpen, setYearOpen] = useState<boolean>(false);
  const [improvers, setImprovers] = useState<Improver[]>([]);
  const [collegeDelta, setCollegeDelta] = useState<CollegeDelta | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Time Machine state
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const [historySnapshots, setHistorySnapshots] = useState<StatSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [activeStudentInfo, setActiveStudentInfo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTopY, setModalTopY] = useState<number | null>(null);

  useEffect(() => {
    fetchGrowthData();
  }, [period, deptFilter, yearFilter]);

  useEffect(() => {
    api.get('/growth/options')
      .then((response) => {
        setDepartments(response.data?.departments || []);
        setAvailableYears(response.data?.years || []);
      })
      .catch((err) => console.error('Growth filter options fetch error:', err));
  }, []);

  const fetchGrowthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=25&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      setImprovers(sortImprovers(impRes.data || []));
      setCollegeDelta(deltaRes.data || null);
    } catch (err) {
      console.error("Growth data fetch error:", err);
      setError('Unable to load student analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sortImprovers = (data: Improver[]): Improver[] => [...data].sort((left, right) =>
    right.delta_solved - left.delta_solved ||
    right.delta_hard - left.delta_hard ||
    right.delta_medium - left.delta_medium ||
    right.delta_easy - left.delta_easy ||
    right.delta_rating - left.delta_rating ||
    right.total_solved - left.total_solved ||
    left.name.localeCompare(right.name)
  );

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=25&dept=${deptFilter}&year=${yearFilter}`),
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
    if (!identifier || (typeof identifier === 'string' && !identifier.trim())) return;
    setSelectedStudentName(fallbackName || `Student: ${identifier}`);
    setHistorySnapshots([]);
    setHistoryLoading(true);
    setIsModalOpen(true); // Open modal immediately on click
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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      if (window.scrollY === 0 && currentScrollY > 0) {
        window.scrollTo(0, currentScrollY);
      }
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setIsModalOpen(false);
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = prevOverflow || '';
        if (currentScrollY > 0) {
          window.scrollTo(0, currentScrollY);
        }
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [isModalOpen]);

  return (
    <div className="space-y-8 py-2 pb-16 animate-slideUp">

      {/* Executive Header Banner */}
      <div className={`relative rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30 ${deptOpen || yearOpen ? 'z-50' : 'z-10'}`}>
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

            <p className="text-xs md:text-sm text-gray-300 font-medium leading-relaxed">
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
                  deptOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-gray-700/80 hover:border-brand-500'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                  {deptFilter}
                </span>
                <span className="truncate max-w-[120px]">
                  {deptFilter === 'ALL' ? 'All Departments' : departments.find(d => d.code === deptFilter)?.name || deptFilter}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${deptOpen ? 'rotate-180' : ''}`} />
              </button>

              {deptOpen && (
                <div className="absolute z-[200] top-full left-0 mt-1 min-w-[220px] bg-navy-900 border border-gray-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-navy-800">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setDeptFilter('ALL'); setDeptOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                      deptFilter === 'ALL' ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-gray-300 hover:bg-navy-800 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">ALL</span>
                      <span className="truncate">All Departments</span>
                    </div>
                    {deptFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                  </button>
                  {departments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setDeptFilter(d.code); setDeptOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                        deptFilter === d.code ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-gray-300 hover:bg-navy-800 font-bold'
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
                  yearOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-gray-700/80 hover:border-brand-500'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                  {yearFilter}
                </span>
                <span className="truncate">
                  {yearFilter === 'ALL' ? 'All Academic Years' : `${yearFilter} Year`}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${yearOpen ? 'rotate-180' : ''}`} />
              </button>

              {yearOpen && (
                <div className="absolute z-[200] top-full left-0 mt-1 min-w-[200px] bg-navy-900 border border-gray-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-navy-800">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setYearFilter('ALL'); setYearOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                      yearFilter === 'ALL' ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-gray-300 hover:bg-navy-800 font-bold'
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
                        yearFilter === year ? 'bg-brand-950/80 text-brand-300 font-black' : 'text-gray-300 hover:bg-navy-800 font-bold'
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
            <div className="flex items-center space-x-1 bg-navy-900/90 p-1.5 rounded-2xl border border-gray-700/80 shadow-inner backdrop-blur-md">
              {(['today', '7d', '30d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    period === p
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 scale-105'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
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
        
        <div className="glass-card p-5 rounded-3xl border border-emerald-500/30 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Total Solved Growth</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">
            +{collegeDelta?.delta_total ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Problems solved in selected period</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-emerald-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Easy Solved</span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            +{collegeDelta?.easy_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Foundation skill building</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-amber-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-amber-600 dark:text-amber-400">Medium Solved</span>
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            +{collegeDelta?.medium_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Interview readiness problems</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-rose-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-rose-600 dark:text-rose-400">Hard Solved</span>
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            +{collegeDelta?.hard_solved ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Advanced DSA mastery</p>
        </div>

      </div>

      {/* Main Section: Top Improvers Leaderboard */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-2xl space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Flame className="w-6 h-6 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Biggest Improvers Leaderboard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Showing top performance growth for: <span className="font-extrabold text-brand-600 dark:text-brand-400">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</span>
              </p>
            </div>
          </div>

          <span className="px-4 py-1.5 rounded-2xl bg-gray-100 dark:bg-navy-950 text-gray-800 dark:text-gray-200 font-black text-xs border border-gray-200 dark:border-gray-800 self-start md:self-auto">
            {collegeDelta?.active_students ?? 0} Active Solvers in Period
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm font-bold animate-pulse space-y-2">
            <BarChart2 className="w-8 h-8 mx-auto text-brand-500 animate-bounce" />
            <p>Calculating growth metrics & delta velocity...</p>
          </div>
        ) : improvers.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-xs font-semibold bg-gray-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
            No activity found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 dark:bg-navy-950 text-gray-700 dark:text-gray-300 uppercase font-black text-[11px] border-b border-gray-200 dark:border-gray-800 tracking-wider">
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
              <tbody className="divide-y divide-gray-200 dark:border-gray-800 dark:divide-gray-800/80 bg-white dark:bg-navy-900 font-medium">
                {improvers.map((imp, idx) => (
                  <tr key={imp.student_id} className="hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors">
                    
                    {/* Rank Badge */}
                    <td className="py-4 px-4 font-black text-gray-900 dark:text-white">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/30 text-xs">
                          🥇 #1
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-slate-200 to-gray-300 text-slate-900 font-black shadow-sm text-xs">
                          🥈 #2
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-black shadow-sm text-xs">
                          🥉 #3
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs">
                          #{idx + 1}
                        </span>
                      )}
                    </td>

                    {/* Student Info */}
                    <td className="py-4 px-4">
                      <div
                        onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                        className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition-colors"
                        title={`Click to view historical timeline for ${imp.name}`}
                      >
                        {imp.name}
                      </div>
                      <div
                        onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                        className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 mt-0.5 hover:underline cursor-pointer"
                        title={`Click to view historical timeline for ${imp.reg_no}`}
                      >
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
                    <td className="py-4 px-4 font-black text-sm text-gray-900 dark:text-white">
                      {imp.total_solved}
                    </td>

                    {/* Growth Delta */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-black text-sm shadow-sm">
                        <span>+{imp.delta_solved}</span>
                      </span>
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
                        <span className="text-gray-400 font-bold">—</span>
                      )}
                    </td>

                    {/* Time Machine Timeline Button */}
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                        className="px-3.5 py-2 text-xs font-black rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all flex items-center space-x-1.5 shadow-md shadow-brand-600/30 ml-auto transform hover:scale-105"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Time Machine Historical Inspection Section */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-2xl space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Student Historical Time Machine
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Inspect historical stat snapshots, difficulty shifts, and granular solve velocity for any student.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Register No, Name, or Handle (e.g. 732224CC031)..."
                value={searchStudentId}
                onChange={(e) => setSearchStudentId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchStudentId.trim()) {
                    handleFetchStudentHistory(searchStudentId);
                  }
                }}
                className="bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-bold rounded-2xl pl-10 pr-4 py-2.5 w-full focus:outline-none focus:border-brand-500 shadow-inner"
              />
            </div>
            <button
              onClick={() => handleFetchStudentHistory(searchStudentId)}
              disabled={!searchStudentId.trim() || historyLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 shrink-0"
            >
              {historyLoading ? 'Loading...' : 'Inspect Timeline'}
            </button>
          </div>
        </div>

        {selectedStudentName && (
          <div className="text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 p-3 rounded-2xl border border-brand-200 dark:border-brand-800/60 flex items-center justify-between">
            <span>Viewing historical timeline for: <span className="text-gray-900 dark:text-white font-black text-sm">{selectedStudentName}</span></span>
            <span className="text-[11px] font-mono text-gray-500">Total Snapshots: {historySnapshots.length}</span>
          </div>
        )}

        {historySnapshots.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 dark:bg-navy-950 text-gray-700 dark:text-gray-300 uppercase font-black text-[11px] border-b border-gray-200 dark:border-gray-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Captured At</th>
                  <th className="py-3.5 px-4">Total Solved</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Easy</th>
                  <th className="py-3.5 px-4 text-amber-600 dark:text-amber-400">Medium</th>
                  <th className="py-3.5 px-4 text-rose-600 dark:text-rose-400">Hard</th>
                  <th className="py-3.5 px-4">Contest Rating</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Delta Solved</th>
                  <th className="py-3.5 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 bg-white dark:bg-navy-900 font-mono font-medium">
                {historySnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors">
                    <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 font-sans font-bold">
                      {new Date(snap.captured_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-black text-sm text-gray-900 dark:text-white">{snap.total_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">{snap.easy_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-amber-600 dark:text-amber-400">{snap.medium_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-rose-600 dark:text-rose-400">{snap.hard_solved}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-800 dark:text-gray-200">{snap.contest_rating ?? 'Unrated'}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black">
                        +{snap.delta_total}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] font-sans font-bold text-gray-500 dark:text-gray-400">{snap.source || 'leetcode_public_profile'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-xs font-semibold bg-gray-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
            Select a student from the leaderboard or enter a Student ID above to view snapshot history timeline.
          </div>
        )}
      </div>

      {/* Interactive Student Time Machine Timeline Modal — Mounted via Portal to document.body */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Historical Timeline for ${selectedStudentName}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="modal-container-responsive max-w-6xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl animate-modal-content"
            style={{
              margin: 'auto',
              maxHeight: 'calc(100dvh - 4rem)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-brand-500/20 border border-brand-400/30 text-brand-400">
                  <Clock className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-black tracking-tight">{selectedStudentName}</h3>
                    {activeStudentInfo && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 border border-brand-400/30 text-brand-300">
                        {activeStudentInfo.reg_no}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 font-medium">
                    Granular Historical Solve Snapshots & Timeline Analytics
                    {activeStudentInfo && ` • ${activeStudentInfo.department} Year ${activeStudentInfo.year}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6 custom-scrollbar">
              
              {/* Snapshot KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Latest Solved</span>
                  <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
                    {historySnapshots[0]?.total_solved ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Rating Trajectory</span>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">
                    {historySnapshots[0]?.contest_rating ?? 'Unrated'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Period Delta</span>
                  <div className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mt-1">
                    +{historySnapshots.reduce((acc, s) => acc + (s.delta_total || 0), 0)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
                  <span className="text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400">Total Snapshots</span>
                  <div className="text-2xl font-black text-purple-900 dark:text-purple-100 mt-1">
                    {historySnapshots.length}
                  </div>
                </div>
              </div>

              {/* Timeline Snapshot Records Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span>Snapshot History Logs</span>
                  <span>Descending Order (Newest First)</span>
                </h4>

                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-navy-950 text-gray-700 dark:text-gray-300 uppercase font-black text-[10px] border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Captured Timestamp</th>
                        <th className="py-3 px-4">Total</th>
                        <th className="py-3 px-4 text-emerald-600">Easy</th>
                        <th className="py-3 px-4 text-amber-600">Medium</th>
                        <th className="py-3 px-4 text-rose-600">Hard</th>
                        <th className="py-3 px-4">Rating</th>
                        <th className="py-3 px-4 text-emerald-600">Delta</th>
                        <th className="py-3 px-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-xs">
                      {historySnapshots.map((snap) => (
                        <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-gray-800 dark:text-gray-200">
                            {new Date(snap.captured_at).toLocaleString([], {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4 font-black text-gray-900 dark:text-white">{snap.total_solved}</td>
                          <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{snap.easy_solved}</td>
                          <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">{snap.medium_solved}</td>
                          <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">{snap.hard_solved}</td>
                          <td className="py-3 px-4 font-bold text-gray-700 dark:text-gray-300">{snap.contest_rating ?? '—'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[11px]">
                              +{snap.delta_total}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[10px] font-sans font-bold text-gray-400">{snap.source || 'leetcode_sync'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-gray-500 font-medium">
                Single Source of Truth Grounded Timeline Records
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-navy-800 text-gray-800 dark:text-gray-200 text-xs font-black hover:bg-gray-300 dark:hover:bg-navy-700 transition-all"
              >
                Close Timeline
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

