import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, Trophy, Shield, Users, TrendingUp, Search, 
  Star, Award, Zap, ChevronLeft, ChevronRight, BarChart3, Filter, ExternalLink, Calendar, Building2, LayoutList
} from 'lucide-react';
import { GlobalFilter } from '../components/GlobalFilter';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { studentLiveStore, useStudentListIds } from '../stores/studentLiveStore';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { sortStudents } from '../utils/filterUtils';
import { useFilters, useFilteredStudents } from '../context/FilterContext';
import { XCircle } from 'lucide-react';

interface PublicLeaderboardPageProps {
  onSelectStudent?: (student: StudentData) => void;
}

export const PublicLeaderboardPage: React.FC<PublicLeaderboardPageProps> = ({ onSelectStudent }) => {
  const { data: initialStudents = [], isLoading: loading } = useStudentsQuery();
  // NOTE: useLiveLeaderboard() is NOT called here — the global singleton in GlobalWebSocketProvider
  // already handles all WebSocket events for the whole app.

  // Reconcile live store with RQ canonical data whenever it changes
  // (Now handled globally in useStudentsQuery)

  // Hook into the live store for reactive re-renders when list changes
  const allIds = useStudentListIds();
  const globalStudents = useFilteredStudents();
  const filters = useFilters();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<'rank' | 'easy' | 'medium' | 'hard'>('rank');

  // Derived sorted list
  const filteredAndSorted = useMemo(() => {
    let list = [...globalStudents];

    if (sortBy === 'rank') {
      list = sortStudents(list, 'top_solved');
    } else {
      list.sort((a, b) => {
        const getStat = (s: any, diff: string) => Number(s.stats?.[`${diff}_solved`] || 0);
        const diffValue = getStat(b, sortBy) - getStat(a, sortBy);
        if (diffValue !== 0) return diffValue;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    return list;
  }, [globalStudents, sortBy]);

  const total = filteredAndSorted.length;
  const top3 = filteredAndSorted.slice(0, 3);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Enforce valid page bounds when filtering changes total count
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [totalPages, page]);

  // Local Pagination
  const filtered = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredAndSorted.slice(start, start + limit);
  }, [filteredAndSorted, page, limit]);

  const students = globalStudents;

  const totalSolved = students.reduce((acc, s) => acc + (s.stats?.total_solved || 0), 0);
  const avgSolved = students.length ? Math.round(totalSolved / students.length) : 0;
  const uniqueYears = [...new Set(students.map(s => s.year_level).filter(Boolean))];
  const uniqueDepts = ['CSE(CS)', 'CSE(IOT)'];

  const MEDAL_CONFIGS = [
    { rank: 2, color: 'from-slate-400 to-slate-500', borderColor: 'border-slate-300', textColor: 'text-slate-300', emoji: '', label: 'SILVER', size: 'scale-90', order: 'order-1' },
    { rank: 1, color: 'from-amber-400 to-yellow-500', borderColor: 'border-amber-400', textColor: 'text-amber-300', emoji: '', label: 'GOLD', size: 'scale-110', order: 'order-2' },
    { rank: 3, color: 'from-orange-500 to-amber-600', borderColor: 'border-orange-400', textColor: 'text-orange-300', emoji: '', label: 'BRONZE', size: 'scale-90', order: 'order-3' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-slide-right">

      {/* ─── HERO BANNER ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 text-white p-8 md:p-10 shadow-lg border border-brand-500/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-xs font-black animate-pulse">
              <Globe className="w-4 h-4" />
              <span>LIVE PUBLIC LEADERBOARD • NANDHA ENGINEERING COLLEGE</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              LeetCode Performance <span className="text-brand-400">Leaderboard</span>
            </h1>
            <p className="text-sm text-gray-300 font-semibold">
              Real-time institutional performance rankings — Academic Departments (Cyber Security &amp; IoT)
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-gray-400 font-mono">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Read-only public view • Suitable for college displays, LinkedIn & placement showcases</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/15 text-center min-w-[90px]">
              <Users className="w-5 h-5 text-brand-400 mx-auto mb-1" />
              <div className="text-2xl font-black text-white">{students.length}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Students</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/15 text-center min-w-[90px]">
              <Zap className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <div className="text-2xl font-black text-emerald-400">{totalSolved.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Solved</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/15 text-center min-w-[90px]">
              <TrendingUp className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
              <div className="text-2xl font-black text-indigo-400">{avgSolved}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Avg / Student</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TOP 3 PODIUM ─── */}
      {top3.length >= 3 && (
        <div className="glass-card p-6 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent shadow-xl">
          <h2 className="text-center font-black text-base text-gray-900 dark:text-white flex items-center justify-center space-x-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>INSTITUTION TOP 3 RANKERS</span>
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
          </h2>

          <div className="flex items-end justify-center gap-4 flex-wrap">
            {MEDAL_CONFIGS.map(cfg => {
              const s = top3[cfg.rank - 1];
              if (!s) return null;
              return (
                <div
                  key={s.id}
                  className={`${cfg.order} ${cfg.size} flex flex-col items-center space-y-3 cursor-pointer group`}
                  onClick={() => onSelectStudent?.(s)}
                >
                  {/* Medal Crown */}
                  <div className={`text-2xl ${cfg.rank === 1 ? 'animate-bounce' : ''}`}>{cfg.emoji}</div>

                  {/* Avatar */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cfg.color} flex items-center justify-center text-white font-black text-xl shadow-xl border-2 ${cfg.borderColor} group-hover:scale-110 transition-transform`}>
                    {s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="text-center space-y-0.5">
                    <div className={`text-xs font-black ${cfg.textColor}`}>{cfg.label}</div>
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate max-w-[120px]">{s.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{s.reg_no}</div>
                    <div className="text-[11px] text-gray-400 font-medium">{s.department?.code} • {s.year_level} Yr</div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/20 mt-1">
                      {s.stats?.total_solved || 0} Solved
                    </div>
                    {s.username && (
                      <a
                        href={`https://leetcode.com/u/${s.username}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[10px] text-brand-500 hover:text-brand-600 font-mono"
                        onClick={e => e.stopPropagation()}
                      >
                        <span>@{s.username}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {/* Podium Stand */}
                  <div className={`w-20 rounded-t-xl ${cfg.rank === 1 ? 'h-10 bg-gradient-to-b from-amber-400 to-amber-500' : cfg.rank === 2 ? 'h-7 bg-gradient-to-b from-slate-400 to-slate-500' : 'h-5 bg-gradient-to-b from-orange-500 to-amber-600'} flex items-center justify-center text-white font-black text-sm`}>
                    #{cfg.rank}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── FILTER & SEARCH BAR ─── */}
      <div className="glass-card p-5 rounded-3xl border border-gray-200 dark:border-navy-700 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, reg no, or username..."
              value={filters.searchQuery}
              onChange={e => filters.setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl border text-xs font-bold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-gray-200 dark:border-navy-700 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
            {filters.searchQuery && (
              <button
                onClick={() => filters.setSearchQuery('')}
                className="absolute right-2 top-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear search"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Year Filter */}
          <GlobalFilter
            value={filters.academicYear}
            onChange={val => filters.setAcademicYear(val)}
            icon={<Calendar className="w-5 h-5" />}
            dropdownWidth="w-56"
            options={[
              { value: 'ALL', label: 'All Years' },
              ...uniqueYears.map((y: any) => ({ value: y, label: `${y} Year` }))
            ]}
          />

          {/* Dept Filter */}
          <GlobalFilter
            value={filters.department}
            onChange={val => filters.setDepartment(val)}
            icon={<Building2 className="w-5 h-5" />}
            dropdownWidth="w-72"
            options={[
              { value: 'ALL', label: 'All Departments' },
              ...uniqueDepts.map((d: any) => ({ value: d, label: d }))
            ]}
          />

          {/* Sort By */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-navy-900 p-1 rounded-2xl border border-gray-200 dark:border-navy-700">
            {(['rank', 'easy', 'medium', 'hard'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  sortBy === s
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-brand-600'
                }`}
              >
                {s === 'rank' ? 'Overall Rank' : `Most ${s.charAt(0).toUpperCase() + s.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
          <span>Showing {filtered.length} of {students.length} students</span>
        </div>
      </div>

      {/* ─── FULL LEADERBOARD TABLE ─── */}
      <LeaderboardTable students={filtered} onSelectStudent={onSelectStudent} />

      {/* ─── SERVER PAGINATION ─── */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl glass-card border border-gray-200 dark:border-navy-700 shadow-xl">
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Showing <span className="text-gray-900 dark:text-white font-black">{Math.min((page - 1) * limit + 1, total)}</span> to <span className="text-gray-900 dark:text-white font-black">{Math.min(page * limit, total)}</span> of <span className="text-gray-900 dark:text-white font-black">{total}</span> students
          </div>
          
          <div className="flex items-center gap-3">
            <GlobalFilter
              value={limit.toString()}
              onChange={val => {
                setLimit(Number(val));
                setPage(1);
              }}
              icon={<LayoutList className="w-4 h-4" />}
              dropdownWidth="w-48"
              options={[
                { value: "50", label: "50 per page" },
                { value: "100", label: "100 per page" },
                { value: "200", label: "200 per page" }
              ]}
            />

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-navy-900 p-1.5 rounded-xl border border-gray-200 dark:border-navy-700">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-navy-800 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-sm font-black text-gray-700 dark:text-gray-200 min-w-[3rem] text-center">
                {page} / {totalPages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-navy-800 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
