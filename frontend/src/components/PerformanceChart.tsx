import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  BarChart2,
  AlertCircle,
  RefreshCw,
  Trophy,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';
import api from '../services/api';
import { useFilters } from '../context/FilterContext';

export type Timeframe = 'this_week' | 'last_week' | 'this_month' | 'last_month' | '30d' | '90d' | 'academic_year';
export type ViewMetricMode = 'all' | 'problems' | 'students';

interface DataPoint {
  label: string;
  date: string;
  problemsSolved: number;
  activeStudents: number;
}

interface PerformanceMetrics {
  peak_solved: number;
  peak_active: number;
  most_active_date: string | null;
  period_growth: number | null;
  previous_period_solved: number;
}

interface PerformanceChartProps {
  department?: string;
  yearLevel?: string;
  className?: string;
}

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'academic_year', label: 'Academic Year' },
];

const formatNumberMetric = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${Math.round(num / 1_000)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
};

const normalizeChartPoints = (points: DataPoint[]): DataPoint[] => {
  const sortedPoints = [...points]
    .filter(point => point?.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  let lastVerifiedPoint: DataPoint | null = null;
  return sortedPoints.map(point => {
    const problemsSolved = Number.isFinite(Number(point.problemsSolved)) ? Number(point.problemsSolved) : 0;
    const activeStudents = Number.isFinite(Number(point.activeStudents)) ? Number(point.activeStudents) : 0;
    const isMissingSnapshot = problemsSolved === 0 && activeStudents === 0 && lastVerifiedPoint !== null;

    if (isMissingSnapshot && lastVerifiedPoint) {
      return {
        ...point,
        problemsSolved: lastVerifiedPoint.problemsSolved,
        activeStudents: lastVerifiedPoint.activeStudents
      };
    }

    const normalizedPoint = { ...point, problemsSolved, activeStudents };
    if (problemsSolved > 0 || activeStudents > 0) {
      lastVerifiedPoint = normalizedPoint;
    }
    return normalizedPoint;
  });
};

const useSafeFilters = () => {
  try {
    return useFilters();
  } catch {
    return {
      department: 'ALL',
      academicYear: 'ALL',
      attendanceStatus: 'ALL',
      searchQuery: '',
      isFilteringActive: false
    };
  }
};

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  department: propDept,
  yearLevel: propYear,
  className = ''
}) => {
  const globalFilters = useSafeFilters();
  const activeDept = propDept || globalFilters.department;
  const activeYear = propYear || globalFilters.academicYear;

  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [metricMode, setMetricMode] = useState<ViewMetricMode>('all');
  const [data, setData] = useState<DataPoint[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async (signal?: AbortSignal) => {
    if (data.length === 0) {
      setLoading(true);
    } else {
      setIsUpdating(true);
    }
    setError(null);

    try {
      const params: Record<string, any> = { timeframe };
      if (activeDept && activeDept !== 'ALL' && activeDept !== 'all') {
        params.department = activeDept;
      }
      if (activeYear && activeYear !== 'ALL' && activeYear !== 'all') {
        params.year_level = activeYear;
      }

      const response = await api.get('/analytics/performance-chart', {
        params,
        signal
      });

      const resData = response.data;
      const chartPoints = normalizeChartPoints(resData.data || []);
      const apiMetrics: PerformanceMetrics = resData.metrics || {
        peak_solved: chartPoints.length ? Math.max(...chartPoints.map(d => d.problemsSolved)) : 0,
        peak_active: chartPoints.length ? Math.max(...chartPoints.map(d => d.activeStudents)) : 0,
        most_active_date: chartPoints.length ? chartPoints.reduce((m, d) => d.problemsSolved > m.problemsSolved ? d : m).date : null,
        period_growth: null,
        previous_period_solved: 0
      };

      setData(chartPoints);
      setMetrics(apiMetrics);
      setDataAsOf(resData.data_as_of || null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      console.error('Error fetching real-time performance chart:', err);
      setError('Unable to load performance telemetry data.');
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [timeframe, activeDept, activeYear]);

  // Request Race Protection
  useEffect(() => {
    const controller = new AbortController();
    fetchChartData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchChartData]);

  // Listen for Live Sync / Data Refresh Events
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchChartData();
    };

    window.addEventListener('dataRefreshed', handleDataRefresh);
    window.addEventListener('syncCompleted', handleDataRefresh);
    return () => {
      window.removeEventListener('dataRefreshed', handleDataRefresh);
      window.removeEventListener('syncCompleted', handleDataRefresh);
    };
  }, [fetchChartData]);

  // Dynamic KPI Calculations
  const peakSolved = useMemo(() => {
    if (metrics?.peak_solved !== undefined && metrics.peak_solved > 0) return metrics.peak_solved;
    return data.length ? Math.max(...data.map(d => d.problemsSolved)) : 0;
  }, [metrics, data]);

  const peakActive = useMemo(() => {
    if (metrics?.peak_active !== undefined && metrics.peak_active > 0) return metrics.peak_active;
    return data.length ? Math.max(...data.map(d => d.activeStudents)) : 0;
  }, [metrics, data]);

  const formattedMostActiveDate = useMemo(() => {
    const rawDate = metrics?.most_active_date || (data.length ? data.reduce((m, d) => d.problemsSolved > m.problemsSolved ? d : m).date : null);
    if (!rawDate) return 'N/A';
    try {
      return new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return rawDate;
    }
  }, [metrics, data]);

  const periodGrowth = metrics?.period_growth ?? null;
  const latestPoint = data.length ? data[data.length - 1] : null;

  // Custom high-fidelity tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      let formattedLabel = label;
      try {
        formattedLabel = new Date(label).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch {
        formattedLabel = label;
      }

      return (
        <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-navy-700 shadow-2xl bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl space-y-2.5 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2">
            <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              {formattedLabel}
            </span>
            <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/20">
              Live Verified
            </span>
          </div>
          <div className="space-y-2 pt-0.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-white dark:ring-navy-900" style={{ backgroundColor: entry.color }} />
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {Number(entry.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white dark:bg-navy-950 p-5 sm:p-7 shadow-sm border-2 border-slate-200/80 dark:border-navy-800 transition-all ${className}`}>
      
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                  Real-Time Performance Trajectory
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5 shadow-sm"></span>
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Multi-metric institutional throughput, solver consistency & active cohort trajectory
              </p>
            </div>
          </div>
        </div>

        {/* View Switches & Timeframe Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          
          {/* Metric Filter Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200/60 dark:border-navy-800 text-xs font-bold">
            <button
              onClick={() => setMetricMode('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === 'all'
                  ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setMetricMode('problems')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === 'problems'
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-blue-600'
              }`}
            >
              Solved Only
            </button>
            <button
              onClick={() => setMetricMode('students')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === 'students'
                  ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              Active Only
            </button>
          </div>

          {/* Timeframe Filter Selector */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 lg:pb-0 scrollbar-none">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeframe(opt.value)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  timeframe === opt.value
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-500/20'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Section */}
      {!error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-navy-900/50 dark:to-navy-900/20 border border-blue-200/50 dark:border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Peak Solved
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {loading ? '—' : peakSolved.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Cumulative institutional total</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-navy-900/50 dark:to-navy-900/20 border border-emerald-200/50 dark:border-emerald-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Peak Active
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {loading ? '—' : peakActive.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Simultaneous active participants</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-pink-50/40 dark:from-navy-900/50 dark:to-navy-900/20 border border-purple-200/50 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-black text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Most Active Date
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            </div>
            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
              {loading ? '—' : formattedMostActiveDate}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Highest volume recording window</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-navy-900/50 dark:to-navy-900/20 border border-amber-200/50 dark:border-amber-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Period Velocity
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            </div>
            <div>
              {loading ? (
                <span className="text-sm font-bold text-slate-400">Loading...</span>
              ) : periodGrowth !== null ? (
                <div className={`font-mono text-xl sm:text-2xl font-black ${periodGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {periodGrowth > 0 ? '+' : ''}{periodGrowth}%
                </div>
              ) : (
                <div className="text-xs font-black text-slate-600 dark:text-slate-400 mt-1 font-mono">
                  {latestPoint ? `${latestPoint.problemsSolved.toLocaleString()} Solved` : 'Active'}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {dataAsOf ? `Last sync: ${new Date(dataAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Verified database state'}
            </p>
          </div>

        </div>
      )}

      {/* Scope Live Telemetry Status Bar */}
      {!error && !loading && (latestPoint || isUpdating) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-0.5">
          {latestPoint && (
            <div className="inline-flex items-center space-x-2 text-[10.5px] font-extrabold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-navy-900 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-navy-800 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9.5px] font-bold">Scope Live:</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{latestPoint.problemsSolved.toLocaleString()} Solved</span>
              <span className="text-slate-300 dark:text-navy-700">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{latestPoint.activeStudents.toLocaleString()} Active</span>
            </div>
          )}
          {isUpdating && (
            <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-sm flex items-center space-x-1.5 ml-auto">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Syncing Live Telemetry...</span>
            </div>
          )}
        </div>
      )}

      {/* Main Chart Canvas */}
      <div className="h-[340px] sm:h-[380px] w-full relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-navy-950/70 backdrop-blur-sm z-10 rounded-2xl border border-slate-100 dark:border-navy-800"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 animate-pulse">
                  <BarChart2 className="w-8 h-8" />
                </div>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Rendering Live Performance Trajectory...
                </span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50/50 dark:bg-navy-900/30 rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-900/50 p-6 text-center"
            >
              <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{error}</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Unable to retrieve real-time performance trajectory from the backend service.
              </p>
              <button 
                onClick={() => fetchChartData()} 
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer inline-flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50/70 dark:bg-navy-900/30 rounded-2xl border-2 border-dashed border-slate-300 dark:border-navy-700 p-6 text-center"
            >
              <Activity className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                No performance telemetry records found for this scope.
              </p>
              <button 
                onClick={() => fetchChartData()} 
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="chart"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="h-full w-full relative"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 12, right: metricMode !== 'problems' ? 45 : 15, left: metricMode !== 'students' ? 10 : -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorProblemsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="colorStudentsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.12} />

                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    dy={10}
                    minTickGap={28}
                    tickFormatter={(val) => {
                      try {
                        return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      } catch {
                        return val;
                      }
                    }}
                  />

                  {/* Left Y Axis: Problems Solved */}
                  {(metricMode === 'all' || metricMode === 'problems') && (
                    <YAxis 
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tick={{ fontSize: 11, fill: '#2563eb', fontWeight: 800 }}
                      tickFormatter={formatNumberMetric}
                    />
                  )}

                  {/* Right Y Axis: Active Students */}
                  {(metricMode === 'all' || metricMode === 'students') && (
                    <YAxis 
                      yAxisId={metricMode === 'students' ? 'left' : 'right'}
                      orientation={metricMode === 'students' ? 'left' : 'right'}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      tick={{ fontSize: 11, fill: '#10b981', fontWeight: 800 }}
                      tickFormatter={formatNumberMetric}
                    />
                  )}

                  <Tooltip content={<CustomTooltip />} />

                  {(metricMode === 'all' || metricMode === 'problems') && (
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="problemsSolved" 
                      name="Problems Solved"
                      stroke="#2563eb" 
                      strokeWidth={3.5}
                      fillOpacity={1} 
                      fill="url(#colorProblemsGrad)" 
                      activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: '#2563eb' }}
                      connectNulls={true}
                    />
                  )}

                  {(metricMode === 'all' || metricMode === 'students') && (
                    <Area 
                      yAxisId={metricMode === 'students' ? 'left' : 'right'}
                      type="monotone" 
                      dataKey="activeStudents" 
                      name="Active Participants"
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStudentsGrad)" 
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#ffffff', fill: '#10b981' }}
                      connectNulls={true}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info & Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-navy-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 shadow-xs"></span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Total Solved Throughput</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs"></span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Active Daily Solvers</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 font-bold text-slate-600 dark:text-slate-400">
            Smart Dual-Axis Engine
          </span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Auto-Harmonized</span>
        </div>
      </div>

    </div>
  );
};

export default PerformanceChart;



