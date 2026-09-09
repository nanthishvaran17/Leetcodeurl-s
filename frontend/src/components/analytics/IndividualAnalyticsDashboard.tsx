import React, { useState, useEffect, useMemo } from 'react';
import { GlobalAnalyticsFilter, AnalyticsPeriod } from './GlobalAnalyticsFilter';
import api, { getCachedData, setCachedData } from '../../services/api';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export const IndividualAnalyticsDashboard: React.FC<{ studentId: number }> = ({ studentId }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const cacheKey = `individual_analytics_${studentId}_${period}`;
    const url = `/analytics/student/${studentId}?period=${period}`;
    
    // 1. Check client cache first for instant load
    const cached = getCachedData(cacheKey, url);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.get(url)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setCachedData(cacheKey, res.data); // 2. Set cache on success
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load individual analytics", err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [period, studentId]);

  // Derived Data Calculations
  const trendData = data?.trend_data || [];
  const contestData = data?.contest_data || [];

  const activityData = useMemo(() => {
    if (!trendData.length) return [];
    return trendData.map((d: any, i: number, arr: any[]) => {
      if (i === 0) return { date: d.date, submissions: 0 };
      const diff = d.total_solved - arr[i - 1].total_solved;
      return { date: d.date, submissions: diff > 0 ? diff : 0 };
    });
  }, [trendData]);

  const weekComparison = useMemo(() => {
    if (trendData.length < 2) return null;
    
    // Simple heuristic: get total solved now, 7 days ago, and 14 days ago from the trend array
    // Since we don't have guaranteed daily snapshots, we estimate by taking the last snapshot,
    // the snapshot roughly 7 items back, etc. A real implementation would parse dates.
    const sorted = [...trendData].reverse(); // newest first
    const now = sorted[0]?.total_solved || 0;
    
    // Find item ~7 days ago
    const nowTime = new Date(sorted[0].date).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    let sevenDaysAgoItem = sorted.find((d: any) => new Date(d.date).getTime() <= nowTime - sevenDays);
    let fourteenDaysAgoItem = sorted.find((d: any) => new Date(d.date).getTime() <= nowTime - (sevenDays * 2));
    
    if (!sevenDaysAgoItem) return null; // Not enough history
    
    const sevenDaysAgo = sevenDaysAgoItem.total_solved;
    const fourteenDaysAgo = fourteenDaysAgoItem ? fourteenDaysAgoItem.total_solved : sevenDaysAgoItem.total_solved;
    
    const thisWeek = now - sevenDaysAgo;
    const lastWeek = sevenDaysAgo - fourteenDaysAgo;
    
    let diff = thisWeek - lastWeek;
    let percent = lastWeek === 0 ? 100 : (diff / lastWeek) * 100;
    
    return { thisWeek, lastWeek, diff, percent };
  }, [trendData]);

  const EmptyState = ({ message = "No historical data available for this period." }) => (
    <div className="w-full flex items-center justify-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-700 h-[300px]">
      <p className="text-slate-400 dark:text-navy-400 font-medium">{message}</p>
    </div>
  );

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    color: '#f8fafc',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  };

  return (
    <div className="space-y-6 animate-fade-in mt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-navy-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">Performance Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Comprehensive historical data view</p>
        </div>
        <GlobalAnalyticsFilter period={period} setPeriod={setPeriod} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : data?.error ? (
        <div className="flex items-center justify-center h-64 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-800">
          <p>{data.error}</p>
        </div>
      ) : (
        <div className="space-y-6 pb-6">
          
          {/* Week Comparison Summary Card */}
          <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-5 sm:p-6 rounded-2xl text-white shadow-lg">
            <h3 className="font-bold text-brand-100 mb-4 uppercase tracking-wider text-xs">This Week vs Last Week</h3>
            {weekComparison ? (
              <div className="flex flex-wrap items-center gap-8">
                <div>
                  <p className="text-brand-200 text-sm">Solved This Week</p>
                  <p className="text-4xl font-black mt-1">{weekComparison.thisWeek}</p>
                </div>
                <div>
                  <p className="text-brand-200 text-sm">Solved Last Week</p>
                  <p className="text-2xl font-bold mt-1 text-indigo-200">{weekComparison.lastWeek}</p>
                </div>
                <div className={`flex items-center px-3 py-1.5 rounded-lg font-bold text-sm ${weekComparison.diff > 0 ? 'bg-emerald-500/20 text-emerald-300' : weekComparison.diff < 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white'}`}>
                  {weekComparison.diff > 0 ? <TrendingUp className="w-4 h-4 mr-1.5" /> : weekComparison.diff < 0 ? <TrendingDown className="w-4 h-4 mr-1.5" /> : <Minus className="w-4 h-4 mr-1.5" />}
                  {Math.abs(weekComparison.percent).toFixed(1)}% {weekComparison.diff > 0 ? 'Increase' : weekComparison.diff < 0 ? 'Decrease' : 'No Change'}
                </div>
              </div>
            ) : (
              <p className="text-brand-200 text-sm">Insufficient historical data to compare weekly performance.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Rating Trend */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Rating Trend</h3>
              {trendData.length > 0 ? (
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="rating" name="Contest Rating" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState />}
            </div>

            {/* 2. Problems Solved Trend */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Problems Solved Trend</h3>
              {trendData.length > 0 ? (
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSolved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="total_solved" name="Total Solved" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSolved)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState />}
            </div>

            {/* 3. Submission Activity (Delta proxy) */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col lg:col-span-2">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Submission Activity (Solved per Day)</h3>
              {activityData.length > 1 ? (
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData.slice(1)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#334155', opacity: 0.1 }} />
                      <Bar dataKey="submissions" name="New Solved" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState message="Not enough daily snapshot data to compute activity." />}
            </div>

            {/* 4. Contest Performance */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col lg:col-span-2">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Contest Performance</h3>
              {contestData.length > 0 ? (
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={contestData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} reversed />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar yAxisId="left" dataKey="solved" name="Questions Solved" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                      <Line yAxisId="right" type="monotone" dataKey="rank" name="Global Rank" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState message="No contest participation recorded in this period." />}
            </div>

            {/* 5. Difficulty Progression */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Difficulty Progression</h3>
              {trendData.length > 0 ? (
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area type="monotone" dataKey="hard" stackId="1" name="Hard" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="medium" stackId="1" name="Medium" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="easy" stackId="1" name="Easy" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState />}
            </div>

            {/* 6. Acceptance Rate Trend */}
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Acceptance Rate Trend</h3>
              <EmptyState message="No historical data available. Acceptance rate tracking is not currently supported." />
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
