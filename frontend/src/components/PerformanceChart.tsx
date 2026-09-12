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
import { Activity, BarChart2, AlertCircle, RefreshCw, Trophy, Users, Calendar, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { useFilters } from '../context/FilterContext';

export type Timeframe = 'this_week' | 'last_week' | 'this_month' | 'last_month' | '30d' | '90d' | 'academic_year';

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

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  department: propDept,
  yearLevel: propYear,
  className = ''
}) => {
  const globalFilters = useSafeFilters();
  const activeDept = propDept || globalFilters.department;
  const activeYear = propYear || globalFilters.academicYear;

  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
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
      const chartPoints: DataPoint[] = resData.data || [];
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
      setError('Unable to load performance data.');
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [timeframe, activeDept, activeYear]);

  // Request Race Protection via AbortController
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

  // Dynamic Metrics Calculations
  const peakSolved = useMemo(() => {
    if (metrics?.peak_solved !== undefined) return metrics.peak_solved;
    return data.length ? Math.max(...data.map(d => d.problemsSolved)) : 0;
  }, [metrics, data]);

  const peakActive = useMemo(() => {
    if (metrics?.peak_active !== undefined) return metrics.peak_active;
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      let formattedLabel = label;
      try {
        formattedLabel = new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        formattedLabel = label;
      }

      return (
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-xl bg-white/95 dark:bg-navy-950/95 backdrop-blur-md space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2">
            <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-500" />
              {formattedLabel}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 uppercase tracking-widest">
              Live Record
            </span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                  <span className="font-medium text-slate-600 dark:text-slate-300">
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
    <div className={`relative overflow-hidden rounded-3xl bg-white dark:bg-navy-950 p-5 sm:p-7 shadow-sm border border-slate-200 dark:border-navy-800 mt-6 ${className}`}>
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
              Real-Time Performance Trajectory
            </h3>
            
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5 shadow-sm"></span>
              ● LIVE DATA
            </span>

            {dataAsOf && (
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Last updated: {new Date(dataAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Institutional problem solving throughput & active participant metrics from live backend data
          </p>
        </div>

        {/* Timeframe Filter Selector */}
        <div className="flex items-center gap-1.5 flex-wrap self-stretch md:self-auto">
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeframe(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === opt.value
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Section */}
      {!error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6 bg-slate-50/70 dark:bg-navy-900/40 rounded-2xl p-4 border border-slate-100 dark:border-navy-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <Trophy className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Peak Solved</p>
            </div>
            <p className="font-mono text-xl font-black text-brand-600 dark:text-brand-400">
              {loading ? '—' : peakSolved.toLocaleString()}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Peak Active</p>
            </div>
            <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              {loading ? '—' : peakActive.toLocaleString()}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Most Active</p>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {loading ? '—' : formattedMostActiveDate}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Period Growth</p>
            </div>
            {loading ? (
              <p className="text-sm font-bold text-slate-400">Loading...</p>
            ) : periodGrowth !== null ? (
              <p className={`font-mono text-xl font-black ${periodGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {periodGrowth > 0 ? '+' : ''}{periodGrowth}%
              </p>
            ) : (
              <p className="text-xs font-bold text-slate-400 mt-1">No comparison data</p>
            )}
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="h-[300px] w-full relative">
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
                <BarChart2 className="w-8 h-8 text-brand-600 animate-bounce" />
                <span className="text-xs font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                  Fetching Live Performance Data...
                </span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50/50 dark:bg-navy-900/30 rounded-2xl border border-dashed border-rose-300 dark:border-rose-900/50 p-6 text-center"
            >
              <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{error}</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Unable to retrieve real-time performance trajectory from the backend service.
              </p>
              <button 
                onClick={() => fetchChartData()} 
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center space-x-2"
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
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50/70 dark:bg-navy-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-navy-700 p-6 text-center"
            >
              <Activity className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                No performance data available for the selected period.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                No active student problem solving snapshot records found for this scope.
              </p>
              <button 
                onClick={() => fetchChartData()} 
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center space-x-1.5"
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
              transition={{ duration: 0.4 }}
              className="h-full w-full relative"
            >
              {isUpdating && (
                <div className="absolute top-2 right-2 z-20 px-3 py-1 rounded-full bg-brand-600/90 text-white text-[10px] font-extrabold shadow-md backdrop-blur-sm flex items-center space-x-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Updating live data...</span>
                </div>
              )}

              {latestPoint && (
                <div className="absolute top-2 left-2 z-20 hidden sm:flex items-center space-x-2 text-[10px] font-extrabold text-slate-500 bg-white/80 dark:bg-navy-900/80 px-3 py-1 rounded-full border border-slate-200/80 dark:border-navy-800 backdrop-blur-sm">
                  <span className="text-slate-400 uppercase tracking-widest">Latest:</span>
                  <span className="text-brand-600 dark:text-brand-400 font-mono">{latestPoint.problemsSolved.toLocaleString()} solved</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">{latestPoint.activeStudents.toLocaleString()} active</span>
                </div>
              )}

              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 25, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.15} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    dy={10}
                    tickFormatter={(val) => {
                      try {
                        return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#0284c7', fontWeight: 700 }}
                    dx={-5}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#10b981', fontWeight: 700 }}
                    dx={5}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="problemsSolved" 
                    name="Problems Solved"
                    stroke="#0284c7" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProblems)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#0284c7' }}
                    connectNulls={true}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="activeStudents" 
                    name="Active Participants"
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorStudents)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                    connectNulls={true}
                  />

                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export { PerformanceChart };
export default PerformanceChart;


