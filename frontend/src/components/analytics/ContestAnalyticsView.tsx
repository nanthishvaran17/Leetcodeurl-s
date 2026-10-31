import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
  Loader2, Trophy, Target, Award, AlertCircle, Zap, 
  CheckCircle2, TrendingUp, TrendingDown, Clock, Search, 
  Calendar, Sparkles, Minus, ArrowUpDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ContestRecord {
  id: number;
  contest_name: string;
  contest_type: 'Weekly' | 'Biweekly';
  date: string | null;
  formatted_date: string | null;
  problems_solved: number;
  total_problems: number;
  contest_rank: number | null;
  rating_after: number | null;
  rating_change: number | null;
  finish_time: string | null;
  attended: boolean;
  is_best_rank?: boolean;
}

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

  // Table filters & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Weekly' | 'Biweekly'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Newest first by default
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  const rawContests: ContestRecord[] = useMemo(() => {
    return (data?.contests || []) as ContestRecord[];
  }, [data]);

  // Filtered & sorted contests
  const filteredContests = useMemo(() => {
    let list = [...rawContests];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        (c.contest_name && c.contest_name.toLowerCase().includes(q)) ||
        (c.formatted_date && c.formatted_date.toLowerCase().includes(q)) ||
        (c.date && c.date.includes(q))
      );
    }

    if (typeFilter !== 'ALL') {
      list = list.filter(c => c.contest_type === typeFilter);
    }

    if (sortOrder === 'asc') {
      // Oldest first
      list = [...list].reverse();
    }

    return list;
  }, [rawContests, searchQuery, typeFilter, sortOrder]);

  const totalPages = Math.ceil(filteredContests.length / pageSize) || 1;
  const paginatedContests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContests.slice(start, start + pageSize);
  }, [filteredContests, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, sortOrder]);

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

  const { summary = {}, trend = [], top_performers = [] } = data;

  const weeklyCount = rawContests.filter(c => c.contest_type === 'Weekly').length;
  const biweeklyCount = rawContests.filter(c => c.contest_type === 'Biweekly').length;

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    color: '#f8fafc',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
    padding: '10px 14px'
  };

  const currentRating = summary.current_rating || (rawContests.length > 0 && rawContests[0]?.rating_after ? Math.round(rawContests[0].rating_after) : null);

  return (
    <div className="space-y-6 animate-fade-in mt-4">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Rating */}
        <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center col-span-2 sm:col-span-1">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl mr-3.5 shrink-0">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Rating</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {currentRating && Number(currentRating) > 0 ? Math.round(Number(currentRating)).toLocaleString('en-US') : 'Unrated'}
            </p>
          </div>
        </div>

        {/* 2. Total Contests */}
        <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl mr-3.5 shrink-0">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Contests</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {summary.total_contests ? Number(summary.total_contests).toLocaleString('en-US') : '0'}
            </p>
          </div>
        </div>

        {/* 3. Best Rank */}
        <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl mr-3.5 shrink-0">
            <Award className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Best Rank</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              {summary.best_rank && !isNaN(Number(summary.best_rank)) ? `#${Number(summary.best_rank).toLocaleString('en-US')}` : summary.best_rank || '-'}
            </p>
          </div>
        </div>

        {/* 4. Avg Rank */}
        <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl mr-3.5 shrink-0">
            <Target className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Avg Rank</p>
            <p 
              className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate cursor-pointer"
              title={summary.avg_rank ? `Exact Avg Rank: #${Number(summary.avg_rank).toFixed(1)}` : undefined}
            >
              {summary.avg_rank && !isNaN(Number(summary.avg_rank)) ? `#${Math.round(Number(summary.avg_rank)).toLocaleString('en-US')}` : '-'}
            </p>
          </div>
        </div>

        {/* 5. Avg Solved */}
        <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl mr-3.5 shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Avg Solved</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {summary.avg_solved ? Number(summary.avg_solved).toFixed(1) : 0} <span className="text-xs text-slate-400 font-medium">/ 4</span>
            </p>
          </div>
        </div>
      </div>

      {/* Charts & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500" />
              Rating & Rank Progression
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {trend.length} Recorded Contests
            </span>
          </div>

          {trend && trend.length > 0 ? (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} minTickGap={35} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" reversed axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="avg_rating" name="Rating" stroke="#3b82f6" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_rank" name="Rank" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700 h-[300px]">
              <p className="text-slate-400 dark:text-navy-400 font-medium">No trend data available.</p>
            </div>
          )}
        </div>

        {/* Contest Summary Box (For single student) OR Top Performers (Global) */}
        {studentId ? (
          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Contest Performance Highlights
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Overview of participation consistency, problem solving distribution, and ranking peak.
              </p>

              <div className="grid grid-cols-2 gap-3.5 mb-5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Contests Attended</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{rawContests.length}</span>
                    <span className="text-xs text-slate-400">({weeklyCount} Weekly / {biweeklyCount} Biweekly)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Problems Solved</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {summary.problems_solved || rawContests.reduce((acc, c) => acc + (c.problems_solved || 0), 0)}
                    </span>
                    <span className="text-xs text-slate-400">problems</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Peak Standing</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-amber-500">
                      {summary.best_rank ? `#${Number(summary.best_rank).toLocaleString('en-US')}` : '-'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">All-time best</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Solved Per Contest</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-indigo-500">
                      {summary.avg_solved ? Number(summary.avg_solved).toFixed(1) : 0}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">avg out of 4</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/50 dark:border-brand-800/30 rounded-xl flex items-center justify-between text-xs text-brand-700 dark:text-brand-300">
              <span className="font-medium">Scroll down to view detailed each-week solve count, rating, and rank.</span>
              <span className="font-bold underline cursor-pointer" onClick={() => {
                const el = document.getElementById('weekly-contest-breakdown-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>View List ↓</span>
            </div>
          </div>
        ) : (
          /* Multi-student Top Performers */
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
                        <td className="py-3 px-2 text-right font-medium text-slate-600 dark:text-slate-300">
                          {p.best_rank && !isNaN(Number(p.best_rank)) ? `#${Number(p.best_rank).toLocaleString('en-US')}` : p.best_rank || '-'}
                        </td>
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

      {/* Weekly Contest Breakdown Section (Requested by User) */}
      {(studentId || rawContests.length > 0) && (
        <div id="weekly-contest-breakdown-section" className="bg-white dark:bg-navy-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-navy-800 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Weekly & Biweekly Contest Breakdown
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30">
                  {rawContests.length} Total Contests
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detailed record of each week's contest: questions solved, rating progression, and global rank.
              </p>
            </div>

            {/* Filter buttons & sort toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-navy-800 p-1 rounded-xl border border-slate-200/60 dark:border-navy-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${typeFilter === 'ALL' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  All ({rawContests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('Weekly')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${typeFilter === 'Weekly' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Weekly ({weeklyCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('Biweekly')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${typeFilter === 'Biweekly' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Biweekly ({biweeklyCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                title={`Sorting: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by contest name (e.g., Weekly Contest 412, Biweekly Contest 135)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-800/70 border border-slate-200 dark:border-navy-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
            />
          </div>

          {/* Table Container */}
          {filteredContests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-800/30 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="font-semibold text-sm">No contests match your search or filter.</p>
              <button 
                onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3.5 rounded-l-lg">Contest / Week</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5 text-center">Questions Solved</th>
                    <th className="py-3 px-3.5 text-right">Contest Rating</th>
                    <th className="py-3 px-3.5 text-right">Global Rank</th>
                    <th className="py-3 px-3.5 text-right rounded-r-lg">Finish Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-sm">
                  {paginatedContests.map((c) => {
                    const solved = c.problems_solved || 0;
                    const total = c.total_problems || 4;
                    const ratingDelta = c.rating_change;

                    return (
                      <tr 
                        key={c.id || c.contest_name} 
                        className={`hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors ${c.is_best_rank ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
                      >
                        {/* Contest Name */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {c.contest_name}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                              c.contest_type === 'Biweekly' 
                                ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30' 
                                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30'
                            }`}>
                              {c.contest_type}
                            </span>
                            {c.is_best_rank && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                <Trophy className="w-3 h-3 text-amber-500" />
                                Best Rank
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.formatted_date || c.date || '-'}</span>
                          </div>
                        </td>

                        {/* Solved Count with Visual Blocks */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-1">
                              {[1, 2, 3, 4].map((idx) => {
                                const isSolved = idx <= solved;
                                return (
                                  <div
                                    key={idx}
                                    title={`Q${idx}: ${isSolved ? 'Solved' : 'Unsolved'}`}
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold transition-all ${
                                      isSolved
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : 'bg-slate-200 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    {isSolved ? '✓' : idx}
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              <span className="font-bold text-slate-900 dark:text-white">{solved}</span> / {total} Solved
                            </span>
                          </div>
                        </td>

                        {/* Rating & Rating Delta */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          {c.rating_after ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                {Math.round(c.rating_after).toLocaleString('en-US')}
                              </span>
                              {ratingDelta !== null && ratingDelta !== undefined && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  ratingDelta > 0 
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                    : ratingDelta < 0 
                                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                      : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                                }`}>
                                  {ratingDelta > 0 && <TrendingUp className="w-2.5 h-2.5" />}
                                  {ratingDelta < 0 && <TrendingDown className="w-2.5 h-2.5" />}
                                  {ratingDelta === 0 && <Minus className="w-2.5 h-2.5" />}
                                  {ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Unrated</span>
                          )}
                        </td>

                        {/* Global Rank */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          {c.contest_rank && c.contest_rank > 0 ? (
                            <span className={`font-mono font-bold ${c.is_best_rank ? 'text-amber-500 text-sm sm:text-base' : 'text-slate-700 dark:text-slate-200'}`}>
                              #{Number(c.contest_rank).toLocaleString('en-US')}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Finish Time */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                          {c.finish_time ? (
                            <div className="inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{c.finish_time}</span>
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-navy-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredContests.length)} of {filteredContests.length} contests
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-bold text-slate-700 dark:text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ContestAnalyticsView;