import React, { useState, useEffect } from 'react';
import { GlobalAnalyticsFilter, AnalyticsPeriod } from './GlobalAnalyticsFilter';
import { TrendLineChart } from './TrendLineChart';
import api from '../../services/api';
import { Loader2 } from 'lucide-react';

export const IndividualAnalyticsDashboard: React.FC<{ studentId: number }> = ({ studentId }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/analytics/student/${studentId}?period=${period}`)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load individual analytics", err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [period, studentId]);

  return (
    <div className="space-y-6 animate-fade-in mt-8 border-t border-slate-200 dark:border-navy-700 pt-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Student Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Individual performance over time</p>
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
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Rating Trend</h3>
              <TrendLineChart 
                data={data.trend_data} 
                xKey="date" 
                lines={[{ key: 'rating', name: 'Contest Rating', color: '#3b82f6' }]} 
              />
            </div>
            <div className="bg-white dark:bg-navy-950 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">Total Solved Trend</h3>
              <TrendLineChart 
                data={data.trend_data} 
                xKey="date" 
                lines={[{ key: 'total_solved', name: 'Total Solved', color: '#10b981' }]} 
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
