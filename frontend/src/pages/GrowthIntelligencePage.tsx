import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Filter,
  ArrowUpRight,
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
  RotateCw,
  Target,
  Layers,
  Activity
} from 'lucide-react';
import api from '../services/api';
import { GlobalFilter, GlobalFilterOption } from '../components/GlobalFilter';

interface Improver {
  student_id: number;
  reg_no: string;
  name: string;
  department_code: string;
  year_level: string;
  section_name?: string;
  username?: string;
  profile_url?: string;
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
  const roleClean = (user?.role || '').trim().toLowerCase();
  const isHod = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean);
  const isGlobalRole = ['admin', 'super admin', 'super_admin', 'administrator', 'principal', 'management', 'director'].includes(roleClean);
  const initialDept = useMemo(() => {
    if (isHod && !isGlobalRole) {
      const authCodes: string[] = Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : [];
      if (authCodes.length > 1) {
        return 'ALL'; // Multi-dept HOD defaults to combined view of both departments (150 + 150 = 300)
      }
      if (authCodes.length === 1) {
        return authCodes[0];
      }
      if (typeof user?.department === 'string') return user.department;
      if ((user?.department as any)?.code) return (user?.department as any).code;
    }
    return 'ALL';
  }, [isHod, isGlobalRole, user]);
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [deptFilter, setDeptFilter] = useState<string>(() => initialDept);
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(10);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [sortMode, setSortMode] = useState<'total' | 'growth'>('growth');
  const [deptOpen, setDeptOpen] = useState<boolean>(false);
  const [yearOpen, setYearOpen] = useState<boolean>(false);
  const [improvers, setImprovers] = useState<Improver[]>([]);
  const [leaderboardSearch, setLeaderboardSearch] = useState<string>('');

  const filteredImprovers = useMemo(() => {
    if (!leaderboardSearch.trim()) return improvers;
    const q = leaderboardSearch.trim().toLowerCase();
    return improvers.filter((imp) => {
      const nameMatch = (imp.name || '').toLowerCase().includes(q);
      const regMatch = (imp.reg_no || '').toLowerCase().includes(q);
      const userMatch = (imp.username || '').toLowerCase().includes(q);
      const deptMatch = (imp.department_code || '').toLowerCase().includes(q);
      return nameMatch || regMatch || userMatch || deptMatch;
    });
  }, [improvers, leaderboardSearch]);
  const [collegeDelta, setCollegeDelta] = useState<CollegeDelta | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Time Machine Inline Expansion state (One expanded student at a time)
  const [expandedStudentId, setExpandedStudentId] = useState<number | string | null>(null);
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const [historySnapshots, setHistorySnapshots] = useState<StatSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [activeStudentInfo, setActiveStudentInfo] = useState<any>(null);

  const departmentOptions: GlobalFilterOption[] = useMemo(() => {
    const list: GlobalFilterOption[] = [];
    const authCodes = (Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : []).map(c => String(c).toUpperCase());
    const userDept = ((typeof user?.department === 'string' ? user.department : (user?.department as any)?.code) || '').toUpperCase();

    const allowedDepts = (isHod && !isGlobalRole)
      ? departments.filter(d => authCodes.includes((d.code || '').toUpperCase()) || (userDept && (d.code || '').toUpperCase() === userDept))
      : departments;

    if (!isHod || isGlobalRole) {
      list.push({ value: 'ALL', label: 'All Departments', pillText: 'ALL' });
    } else if (allowedDepts.length > 1) {
      list.push({ value: 'ALL', label: 'All My Authorized Departments', pillText: 'ALL' });
    }

    allowedDepts.forEach((d) => {
      const codeUp = (d.code || '').toUpperCase().trim();
      const nameUp = (d.name || '').toUpperCase().trim();
      if (
        codeUp.startsWith('TEST') ||
        codeUp.includes('_TEST') ||
        codeUp.includes('-TEST') ||
        nameUp.includes('TEST') ||
        nameUp.includes('DEMO')
      ) {
        return;
      }
      list.push({
        value: d.code,
        label: d.name ? `${d.code} - ${d.name}` : d.code,
        pillText: d.code
      });
    });
    return list;
  }, [departments, user, isHod, isGlobalRole]);

  const yearOptions: GlobalFilterOption[] = useMemo(() => {
    const list: GlobalFilterOption[] = [
      { value: 'ALL', label: 'All Academic Years', pillText: 'ALL' }
    ];
    availableYears.forEach((y) => {
      list.push({
        value: y,
        label: `${y} Year`,
        pillText: y
      });
    });
    return list;
  }, [availableYears]);

  useEffect(() => {
    fetchGrowthData();
    const interval = setInterval(() => {
      fetchGrowthData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [period, deptFilter, yearFilter]);

  // Pull-to-refresh listener: reload growth metrics
  useEffect(() => {
    const handlePull = () => {
      fetchGrowthData(false);
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [period, deptFilter, yearFilter]);

  useEffect(() => {
    api.get('/growth/options')
      .then((response) => {
        setDepartments(response.data?.departments || []);
        const rawYears: string[] = response.data?.years || [];
        const orderMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
        const cleanYears = Array.from(new Set(rawYears.map(y => {
          const u = String(y || '').trim().toUpperCase().replace(/ YEAR$/i, '');
          if (u === '1' || u === '1ST' || u === 'I') return 'I';
          if (u === '2' || u === '2ND' || u === 'II') return 'II';
          if (u === '3' || u === '3RD' || u === 'III') return 'III';
          if (u === '4' || u === '4TH' || u === 'IV') return 'IV';
          return u;
        }))).filter(y => ['I', 'II', 'III', 'IV'].includes(y)).sort((a, b) => (orderMap[a] || 99) - (orderMap[b] || 99));

        setAvailableYears(cleanYears.length > 0 ? cleanYears : ['I', 'II', 'III', 'IV']);
        if (user?.role?.toLowerCase() === 'hod' && response.data?.departments?.length === 1) {
          setDeptFilter(response.data.departments[0].code);
        }
      })
      .catch((err) => {
        console.error('Growth filter options fetch error:', err);
        setAvailableYears(['I', 'II', 'III', 'IV']);
      });
  }, [user]);

  const sortImprovers = (data: Improver[], mode = sortMode): Improver[] => [...data].sort((left, right) => {
    if (mode === 'total') {
      return (
        (right.total_solved || 0) - (left.total_solved || 0) ||
        (right.delta_solved || 0) - (left.delta_solved || 0) ||
        (right.delta_hard || 0) - (left.delta_hard || 0) ||
        (right.delta_medium || 0) - (left.delta_medium || 0) ||
        left.name.localeCompare(right.name)
      );
    }
    return (
      (right.delta_solved || 0) - (left.delta_solved || 0) ||
      (right.delta_hard || 0) - (left.delta_hard || 0) ||
      (right.delta_medium || 0) - (left.delta_medium || 0) ||
      (right.delta_easy || 0) - (left.delta_easy || 0) ||
      (right.delta_rating || 0) - (left.delta_rating || 0) ||
      (right.total_solved || 0) - (left.total_solved || 0) ||
      left.name.localeCompare(right.name)
    );
  });

  const fetchGrowthData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=1000&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      const rawData = impRes.data || [];
      const filteredData = rawData;
        
      setImprovers(sortImprovers(filteredData));
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
        api.get(`/growth/improvers?period=${period}&limit=1000&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      const rawData = impRes.data || [];
      const filteredData = rawData;
        
      setImprovers(sortImprovers(filteredData));
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-7 md:p-8 shadow-2xl border border-brand-500/30 backdrop-blur-xl transition-all duration-300">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 space-y-6">
          {/* Header Title Section */}
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 shadow-lg shadow-amber-500/10 mt-0.5 sm:mt-0">
              <BarChart2 className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-x-2.5 leading-tight">
                <span className="whitespace-nowrap">Growth Intelligence</span>
                <span className="text-amber-300 font-extrabold">&amp;</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 whitespace-nowrap">
                  Time Machine
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed mt-1 max-w-3xl">
                Track student problem-solving deltas, biggest improvers leaderboard, difficulty velocity, and granular historical stat snapshots across custom timeframe windows.
              </p>
            </div>
          </div>

          {/* Filters, Timeframe Selector Pills & Live Refresh Button */}
          <div className="pt-4 border-t border-brand-400/20 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
            
            {/* Department & Academic Year Filters - Side-by-side on mobile */}
            <div className="flex flex-row items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0 sm:w-72 sm:flex-none">
                <GlobalFilter
                  options={departmentOptions}
                  value={deptFilter}
                  onChange={(val) => setDeptFilter(val)}
                  icon={<Building2 className="w-3.5 h-3.5 text-brand-400" />}
                  dropdownWidth="w-full sm:w-72"
                  showSearch={false}
                  variant="dark"
                />
              </div>
              <div className="flex-1 min-w-0 sm:w-60 sm:flex-none">
                <GlobalFilter
                  options={yearOptions}
                  value={yearFilter}
                  onChange={(val) => setYearFilter(val)}
                  icon={<GraduationCap className="w-3.5 h-3.5 text-brand-400" />}
                  dropdownWidth="w-full sm:w-60"
                  showSearch={false}
                  variant="dark"
                />
              </div>
            </div>

            {/* Timeframe Selector Pills & Sleek Inline Refresh Button */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full xl:w-auto">
              <div className="flex-1 sm:flex-initial flex items-center bg-navy-900/90 p-1 rounded-xl sm:rounded-2xl border border-slate-700/80 shadow-inner backdrop-blur-md">
                {(['today', '7d', '30d', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 sm:flex-initial whitespace-nowrap px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center ${
                      period === p
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 sm:scale-105'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {p === 'today' ? 'Today' : 
                     p === '7d' ? 'Last 7 Days' : 
                     p === '30d' ? 'Last 30 Days' : 
                     'All Time'}
                  </button>
                ))}
              </div>

              {/* Live Refresh Button */}
              <button
                onClick={handleManualRefresh}
                disabled={loading || isRefreshing}
                title="Refresh Growth Metrics & Solve Deltas"
                className="inline-flex items-center justify-center shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline ml-1.5 font-bold">{isRefreshing ? 'Syncing Live Stats...' : 'Sync Live Stats'}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* College Aggregate Delta Metrics KPI Grid — Luxury 2026 Bento Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. Total Solved Growth */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-[#0a1120] dark:via-[#0c162c] dark:to-[#0a1120] border border-emerald-500/30 dark:border-emerald-500/25 shadow-xl shadow-emerald-500/5 space-y-2 backdrop-blur-xl transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider gap-2">
            <span className="text-emerald-700 dark:text-emerald-300 truncate">Total Solved Growth</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <BarChart2 className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
            {collegeDelta?.delta_total ?? 0}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Problems solved in selected period</p>
        </div>

        {/* 2. Easy Solved */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-[#0a1120] dark:via-[#0c162c] dark:to-[#0a1120] border border-emerald-500/25 dark:border-emerald-500/20 shadow-xl shadow-emerald-500/5 space-y-2 backdrop-blur-xl transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider gap-2">
            <span className="text-emerald-700 dark:text-emerald-300 truncate">Easy Solved</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
            {collegeDelta?.easy_solved ?? 0}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Foundation skill building</p>
        </div>

        {/* 3. Medium Solved */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-[#0a1120] dark:via-[#1c1508] dark:to-[#0a1120] border border-amber-500/25 dark:border-amber-500/20 shadow-xl shadow-amber-500/5 space-y-2 backdrop-blur-xl transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider gap-2">
            <span className="text-amber-700 dark:text-amber-300 truncate">Medium Solved</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
              <Layers className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-amber-600 dark:text-amber-400 font-mono">
            {collegeDelta?.medium_solved ?? 0}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Interview readiness problems</p>
        </div>

        {/* 4. Hard Solved */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-[#0a1120] dark:via-[#1f0e13] dark:to-[#0a1120] border border-rose-500/25 dark:border-rose-500/20 shadow-xl shadow-rose-500/5 space-y-2 backdrop-blur-xl transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider gap-2">
            <span className="text-rose-700 dark:text-rose-300 truncate">Hard Solved</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30 shadow-xs">
              <Target className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-rose-600 dark:text-rose-400 font-mono">
            {collegeDelta?.hard_solved ?? 0}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Advanced DSA mastery</p>
        </div>

      </div>

      {/* Main Section: Top Improvers Leaderboard */}
      <div className="relative overflow-hidden rounded-[2rem] sm:rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0c1322]/95 p-4 sm:p-6 lg:p-7 shadow-2xl backdrop-blur-2xl space-y-5">
        
        {/* Leaderboard Header & Interactive Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30 shadow-md shadow-amber-500/10">
              <Award className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Biggest Improvers Leaderboard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Showing top performance growth for: <span className="font-extrabold text-brand-600 dark:text-brand-400">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            {/* Live Leaderboard Search Box */}
            <div className="relative flex items-center flex-1 sm:flex-initial min-w-0 sm:min-w-[280px]">
              <Search className="w-4 h-4 text-brand-600 dark:text-brand-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 stroke-[2.5]" />
              <input
                type="text"
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
                placeholder="Search solver, reg no, username..."
                style={{ textAlign: 'left', paddingLeft: '2.5rem' }}
                className="w-full text-left pl-10 pr-8 py-2 min-h-[38px] sm:min-h-[42px] text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all shadow-xs"
              />
              {leaderboardSearch && (
                <button
                  type="button"
                  onClick={() => setLeaderboardSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Controls Bar with Smooth Horizontal Overflow on Mobile */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {/* Rank By Sort Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/80 dark:border-white/10 shrink-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1.5 sm:px-2">Rank</span>
                <button
                  onClick={() => { setSortMode('growth'); setImprovers(prev => sortImprovers(prev, 'growth')); }}
                  className={`px-2.5 sm:px-3 py-1.5 min-h-[32px] sm:min-h-[34px] rounded-lg text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                    sortMode === 'growth'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Growth
                </button>
                <button
                  onClick={() => { setSortMode('total'); setImprovers(prev => sortImprovers(prev, 'total')); }}
                  className={`px-2.5 sm:px-3 py-1.5 min-h-[32px] sm:min-h-[34px] rounded-lg text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                    sortMode === 'total'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Total
                </button>
              </div>

              {/* Display Limit Selector Pills */}
              <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/80 dark:border-white/10 shrink-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1.5 sm:px-2">Show</span>
                {[10, 25, 50, 'ALL'].map((limitVal) => (
                  <button
                    key={String(limitVal)}
                    onClick={() => setDisplayLimit(limitVal as any)}
                    className={`px-2 sm:px-2.5 py-1.5 min-h-[32px] sm:min-h-[34px] rounded-lg text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      displayLimit === limitVal
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {limitVal === 'ALL' ? 'All' : limitVal}
                  </button>
                ))}
              </div>

              {/* Active Solvers Pill */}
              <div className="flex items-center justify-center shrink-0 min-h-[36px] sm:min-h-[42px] px-3.5 bg-brand-500/10 border border-brand-500/25 rounded-xl text-brand-700 dark:text-brand-300 font-black text-xs uppercase tracking-wider shadow-xs whitespace-nowrap">
                {collegeDelta?.active_students ?? improvers.length} Solvers
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400 text-sm font-bold animate-pulse space-y-3">
            <BarChart2 className="w-10 h-10 mx-auto text-brand-500 animate-bounce" />
            <p>Calculating verified growth metrics &amp; delta velocity...</p>
          </div>
        ) : filteredImprovers.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs font-semibold bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-dashed border-slate-300 dark:border-white/10 space-y-3">
            <p>{leaderboardSearch ? `No solvers matching "${leaderboardSearch}" found.` : 'No activity found for the selected filters.'}</p>
            {leaderboardSearch && (
              <button
                type="button"
                onClick={() => setLeaderboardSearch('')}
                className="px-4 py-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-black text-xs border border-brand-500/20 hover:bg-brand-500/20 transition-all cursor-pointer"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Leaderboard Cards — Modern High-Density App Design */}
            <div className="block md:hidden space-y-2.5">
              {(displayLimit === 'ALL' ? filteredImprovers : filteredImprovers.slice(0, Number(displayLimit))).map((imp, idx) => {
                const isExpanded = String(expandedStudentId) === String(imp.student_id);
                const initials = (imp.name || 'Student')
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isTop1 = idx === 0;
                const isTop2 = idx === 1;
                const isTop3 = idx === 2;

                return (
                  <div
                    key={imp.student_id}
                    className={`relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#0b1220]/95 border transition-all p-3.5 shadow-xs space-y-2.5 backdrop-blur-xl touch-manipulation ${
                      isExpanded
                        ? 'border-brand-500 ring-2 ring-brand-500/25 bg-brand-500/[0.04] dark:bg-[#0f172a]'
                        : isTop1
                        ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/[0.06] to-transparent dark:from-amber-500/[0.08]'
                        : isTop2
                        ? 'border-slate-300/80 bg-gradient-to-b from-slate-200/[0.06] to-transparent dark:from-white/[0.04]'
                        : isTop3
                        ? 'border-amber-700/60 bg-gradient-to-b from-amber-700/[0.06] to-transparent dark:from-amber-700/[0.08]'
                        : 'border-slate-200/90 dark:border-white/10'
                    }`}
                  >
                    {/* Header Row: Rank, Avatar, Student Credentials & Floating Growth Delta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <div className="shrink-0">
                          {isTop1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black shadow-sm text-xs ring-1 ring-amber-400/60">
                              <Award className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                              <span>#1</span>
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-slate-200 via-white to-slate-300 text-slate-900 font-black shadow-2xs text-xs ring-1 ring-slate-300/60">
                              <span>#2</span>
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-amber-50 font-black shadow-2xs text-xs ring-1 ring-amber-600/60">
                              <span>#3</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center min-w-[30px] px-2 py-1 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-black text-xs">
                              #{idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Initials Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-600 dark:text-brand-300 font-black text-xs flex items-center justify-center border border-brand-500/30 shrink-0 shadow-2xs">
                          {initials}
                        </div>

                        {/* Name & Academic Meta */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {imp.name}
                            </h4>
                            {imp.profile_url && (
                              <a
                                href={imp.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open LeetCode Profile"
                                className="text-slate-400 hover:text-amber-500 transition-colors shrink-0"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                              {imp.reg_no}
                            </span>
                            <span>•</span>
                            <span className="truncate">
                              {imp.department_code} ({imp.year_level}{!imp.year_level.toLowerCase().includes('year') ? ' Yr' : ''})
                            </span>
                            {imp.username && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-400 truncate">@{imp.username}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Growth (+Delta) Floating Pill */}
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs shadow-2xs">
                          {imp.delta_solved > 0 ? (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] text-emerald-500" />
                              <span>+{imp.delta_solved}</span>
                            </>
                          ) : imp.delta_solved < 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">{imp.delta_solved}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </span>
                        <span className="block text-[8px] uppercase font-black text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 tracking-wider">
                          Growth
                        </span>
                      </div>
                    </div>

                    {/* Compact Metrics Row: Total Solved + Easy + Med + Hard in 1 unified grid */}
                    <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-white/[0.03] p-2 rounded-xl border border-slate-200/70 dark:border-white/[0.06] text-center">
                      <div className="space-y-0.5 border-r border-slate-200/60 dark:border-white/[0.06] pr-1">
                        <div className="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">Total</div>
                        <div className="font-mono font-black text-xs text-slate-900 dark:text-white">
                          {imp.total_solved}
                        </div>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200/60 dark:border-white/[0.06] pr-1">
                        <div className="text-[9px] uppercase font-black text-emerald-600 dark:text-emerald-400">Easy</div>
                        <div className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                          {imp.easy_solved} <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold">(+{imp.delta_easy})</span>
                        </div>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200/60 dark:border-white/[0.06] pr-1">
                        <div className="text-[9px] uppercase font-black text-amber-600 dark:text-amber-400">Med</div>
                        <div className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                          {imp.medium_solved} <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold">(+{imp.delta_medium})</span>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9px] uppercase font-black text-rose-600 dark:text-rose-400">Hard</div>
                        <div className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                          {imp.hard_solved} <span className="text-[9px] text-rose-600 dark:text-rose-400 font-extrabold">(+{imp.delta_hard})</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Action Trigger Button */}
                    <button
                      type="button"
                      onClick={(e) => handleFetchStudentHistory(String(imp.student_id), imp.name, e)}
                      className={`w-full py-1.5 min-h-[34px] text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer touch-manipulation active:scale-[0.98] ${
                        isExpanded
                          ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                          : 'bg-slate-100 hover:bg-brand-500/10 dark:bg-white/[0.06] dark:hover:bg-brand-500/20 text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-300 border border-slate-200/80 dark:border-white/10'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-brand-500" />
                      <span>{isExpanded ? 'Close Timeline Drawer' : 'Time Machine Timeline'}</span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {/* Expanded Time Machine Details on Mobile */}
                    {isExpanded && (
                      <div className="pt-3.5 border-t border-slate-200/80 dark:border-white/[0.08] space-y-4 animate-in fade-in slide-in-from-top-2">
                        {/* Header & Details Strip */}
                        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0a1120] border border-slate-200 dark:border-white/10 shadow-xs">
                          <div className="space-y-0.5">
                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              Time Window
                            </h5>
                            <p className="text-xs text-brand-600 dark:text-brand-400 font-black uppercase">
                              {period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpandedStudentId(null); }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-rose-500 hover:text-white transition-all text-xs font-black"
                          >
                            Close
                          </button>
                        </div>

                        {/* Snapshot History Table on Mobile */}
                        <div className="space-y-2 max-w-full overflow-hidden">
                          <h6 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-brand-500" />
                            <span>Time Machine Snapshots</span>
                          </h6>

                          {historyLoading ? (
                            <div className="p-6 text-center text-xs font-bold text-slate-500 animate-pulse">
                              Loading history snapshots...
                            </div>
                          ) : historySnapshots.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0a1120] max-w-full overflow-hidden shadow-xs">
                              <table className="w-full text-left text-[11px] table-fixed">
                                <thead className="bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 uppercase font-black text-[9px] border-b border-slate-200/80 dark:border-white/10">
                                  <tr>
                                    <th className="py-2.5 px-3 w-[38%]">Date</th>
                                    <th className="py-2.5 px-2 text-center w-[20%]">Solved</th>
                                    <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400 w-[20%]">Delta</th>
                                    <th className="py-2.5 px-3 text-right w-[22%]">Rating</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06] font-mono text-[10px]">
                                  {historySnapshots.map((snap) => (
                                    <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                                      <td className="py-2.5 px-3 font-sans font-bold text-slate-800 dark:text-slate-200 truncate">
                                        {new Date(snap.captured_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                      <td className="py-2.5 px-2 text-center font-black text-slate-900 dark:text-white">{snap.total_solved}</td>
                                      <td className="py-2.5 px-2 text-center font-black text-emerald-600 dark:text-emerald-400">
                                        {snap.delta_total > 0 ? `+${snap.delta_total}` : snap.delta_total === snap.total_solved ? 'Base' : '0'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-bold truncate">
                                        {snap.contest_rating && Number(snap.contest_rating) > 0 && Math.round(Number(snap.contest_rating)) !== 1500 ? Math.round(Number(snap.contest_rating)) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold text-center">
                              No history snapshots available yet.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block table-responsive-container overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 uppercase font-black text-[11px] border-b border-slate-200 dark:border-slate-800 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 text-center"># Rank</th>
                    <th className="py-3.5 px-4 text-left">Student</th>
                    <th className="py-3.5 px-4 text-center">Dept / Year</th>
                    <th className="py-3.5 px-4 text-center">Total Solved</th>
                    <th className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">Growth (+Delta)</th>
                    <th className="py-3.5 px-4 text-center">Difficulty Breakdown</th>
                    <th className="py-3.5 px-4 text-center">Rating Delta</th>
                    <th className="py-3.5 px-4 text-right">Time Machine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:border-slate-800 dark:divide-gray-800/80 bg-white dark:bg-navy-950 font-medium">
                  {(displayLimit === 'ALL' ? filteredImprovers : filteredImprovers.slice(0, Number(displayLimit))).map((imp, idx) => {
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
                          <td className="py-4 px-4 text-center font-black text-slate-900 dark:text-white">
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
                          <td className="py-4 px-4 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                                {imp.name}
                              </span>
                              {imp.profile_url && (
                                <a
                                  href={imp.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Open ${imp.username || imp.name}'s LeetCode Profile`}
                                  className="text-slate-400 hover:text-amber-500 transition-colors p-0.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800 inline-flex items-center"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                                {imp.reg_no}
                              </span>
                              {imp.username && (
                                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                  @{imp.username}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Department / Year Pill */}
                          <td className="py-4 px-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-extrabold text-xs">
                              {imp.department_code} • {imp.year_level}{!imp.year_level.toLowerCase().includes('year') ? ' Year' : ''}
                            </span>
                          </td>

                          {/* Total Solved */}
                          <td className="py-4 px-4 text-center font-black text-sm text-slate-900 dark:text-white">
                            {imp.total_solved}
                          </td>

                          {/* Growth Delta */}
                          <td className="py-4 px-4 text-center">
                            {imp.delta_solved > 0 ? (
                              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-black text-sm shadow-sm">
                                <span>+{imp.delta_solved}</span>
                              </span>
                            ) : imp.delta_solved < 0 ? (
                              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-black text-sm shadow-sm">
                                <span>{imp.delta_solved}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-800 font-black text-sm shadow-sm">
                                <span>0</span>
                              </span>
                            )}
                          </td>

                          {/* Difficulty Breakdown */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-black">
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
                          <td className="py-4 px-4 text-center">
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
                              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all flex items-center space-x-1.5 shadow-md ml-auto cursor-pointer ${
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
                                        {imp.department_code} • {imp.year_level}{!imp.year_level.toLowerCase().includes('year') ? ' Year' : ''}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-semibold">
                                      Active Filter Time Window: <strong className="text-brand-600 dark:text-brand-400 uppercase tracking-wide">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</strong>
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setExpandedStudentId(null); }}
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-rose-500 hover:text-white transition-colors text-xs font-bold flex items-center space-x-1 cursor-pointer"
                                  >
                                    <span>Close Details</span>
                                  </button>
                                </div>

                                {/* Growth Breakdown Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-sm">
                                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Total Solved</span>
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
                                      <table className="w-full text-left text-xs min-w-[500px]">
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
                                              <td className="py-2.5 px-3.5 font-bold text-slate-700 dark:text-slate-300">{snap.contest_rating && Number(snap.contest_rating) > 0 && Math.round(Number(snap.contest_rating)) !== 1500 ? Math.round(Number(snap.contest_rating)) : '—'}</td>
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
          </>
        )}
      </div>

    </div>
  );
};

