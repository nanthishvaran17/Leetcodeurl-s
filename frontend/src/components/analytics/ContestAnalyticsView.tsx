import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Trophy, Target, Award, User, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ContestAnalyticsProps {
  studentId?: number;
  period?: string;
  deptId?: number | null;
  yearLevel?: string | null;
}

export const ContestAnalyticsView: React.FC<ContestAnalyticsProps> = ({ 
  studentId, 
  period = '30d', 
  deptId, 
  yearLevel 
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    let url = `/analytics/contest/aggregate?period=${period}`;
    if (studentId) url += `&student_id=${studentId}`;
    if (deptId) url += `&dept_id=${deptId}`;
    if (yearLevel && yearLevel !== 'ALL') url += `&year_level=${yearLevel}`;

    api.get(url)
      .then((res) => {
        if (isMounted) {
          if (res.data.error) {
            setError(res.data.error);
          } else {
            setData(res.data);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.response?.data?.detail || "Failed to load contest analytics.");
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [studentId, period, deptId, yearLevel]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-500" />
        <p className="text-sm">Loading contest analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <AlertCircle className="w-12 h-12 mb-4 opacity-30 text-red-500" />
        <p className="font-bold text-lg text-slate-500">Data Unavailable</p>
        <p className="text-sm">{error || "No contest data found for the selected period."}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, trend, top_performers } = data;

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    color: '#f8fafc',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  };

  return (
    <div className="space-y-6 animate-fade-in mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl mr-4">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Contests</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary.total_contests}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl mr-4">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Rank</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary.avg_rank ? Number(summary.avg_rank).toFixed(1) : '-'}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl mr-4">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Best Rank</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary.best_rank || '-'}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl mr-4">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Solved</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary.avg_solved ? Number(summary.avg_solved).toFixed(1) : 0}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Rating & Rank Trend</h3>
          {trend && trend.length > 0 ? (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" reversed axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="avg_rating" name="Rating" stroke="#3b82f6" strokeWidth={3} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_rank" name="Rank" stroke="#f59e0b" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700 h-[300px]">
              <p className="text-slate-400 dark:text-navy-400 font-medium">No trend data available.</p>
            </div>
          )}
        </div>

        {/* Top Performers Table (Only useful globally, but ok for single student it'll just show them) */}
        {!studentId && (
          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4">Top Performers</h3>
            <div className="flex-1 overflow-auto pr-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700">Student</th>
                    <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700 text-right">Rating</th>
                    <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700 text-right">Best Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {top_performers && top_performers.length > 0 ? (
                    top_performers.map((p: any) => (
                      <tr key={p.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="py-3 px-2">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.reg_no}</p>
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-brand-600">{p.rating ? Math.round(p.rating) : '-'}</td>
                        <td className="py-3 px-2 text-right font-medium text-slate-600 dark:text-slate-300">{p.best_rank || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-sm">No top performers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
