import React, { useState, useEffect } from 'react';
import { GlobalAnalyticsFilter, AnalyticsPeriod } from './GlobalAnalyticsFilter';
import { TrendLineChart } from './TrendLineChart';
import { DifficultyDistributionChart } from './DifficultyDistributionChart';
import { ComparisonBarChart } from './ComparisonBarChart';
import api from '../../services/api';
import { Loader2 } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/analytics/dashboard?period=${period}`)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load analytics", err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [period]);

  return (
    <div className="space-y-8 my-10 sm:my-12 animate-fade-in">
      {/* Header card with explicit bottom margin to prevent touching elements below */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 bg-white dark:bg-navy-950 p-6 sm:p-7 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">Graph Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">Visualize historical trends and performance metrics</p>
        </div>
        <GlobalAnalyticsFilter period={period} setPeriod={setPeriod} />
      </div>

      {data?.error ? (
        <div className="flex items-center justify-center h-64 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-800 mt-8 mb-8">
          <p>{data.error}</p>
        </div>
      ) : (
        <div className="space-y-8 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-navy-950 p-6 sm:p-7 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md relative">
              <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-base sm:text-lg">Overall Trend (Rating & Solved)</h3>
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
              )}
              <TrendLineChart 
                data={data?.trend_data || []} 
                xKey="date" 
                lines={[
                  { key: 'avg_rating', name: 'Average Rating', color: '#3b82f6' },
                  { key: 'avg_solved', name: 'Average Solved', color: '#10b981' }
                ]} 
              />
            </div>
            <div className="bg-white dark:bg-navy-950 p-6 sm:p-7 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md relative">
              <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-base sm:text-lg">Difficulty Distribution</h3>
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
              )}
              <DifficultyDistributionChart data={data?.difficulty_distribution || []} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-navy-950 p-6 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md flex flex-col justify-center items-center relative min-h-[140px]">
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              )}
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Acceptance Rate</h4>
              <p className="text-4xl font-display font-bold text-brand-600">{data?.acceptance_rate ?? '-'}</p>
              <p className="text-xs text-slate-400 mt-2">Historical Average</p>
            </div>
            <div className="bg-white dark:bg-navy-950 p-6 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md flex flex-col justify-center items-center relative min-h-[140px]">
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              )}
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Submissions</h4>
              <p className="text-4xl font-display font-bold text-slate-800 dark:text-white">{data?.total_submissions ?? '-'}</p>
              <p className="text-xs text-slate-400 mt-2">All time</p>
            </div>
            <div className="bg-white dark:bg-navy-950 p-6 rounded-2xl border-2 border-slate-200/80 dark:border-navy-700 shadow-md flex flex-col justify-center items-center relative min-h-[140px]">
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              )}
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Solved</h4>
              <p className="text-4xl font-display font-bold text-emerald-600">{data?.total_solved ?? '-'}</p>
              <p className="text-xs text-slate-400 mt-2">All time</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
