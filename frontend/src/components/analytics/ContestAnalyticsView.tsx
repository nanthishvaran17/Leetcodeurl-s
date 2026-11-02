import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { 
  Loader2, Trophy, Target, Award, AlertCircle, Zap, 
  CheckCircle2, TrendingUp, TrendingDown, Clock, Search, 
  Calendar, Sparkles, Minus, ArrowUpDown, ChevronLeft, ChevronRight, X,
  Flame, Check, Layers, ChevronDown
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
  score?: number | null;
  q1?: number | null;
  q2?: number | null;
  q3?: number | null;
  q4?: number | null;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
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
  const [viewMetric, setViewMetric] = useState<'both' | 'rating' | 'rank'>('both');
  // Week/Contest Scope: 'ALL' (overall total/average) or specific contest id
  const [selectedContestId, setSelectedContestId] = useState<number | 'ALL'>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && isDropdownOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, isDropdownOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const diffY = e.touches[0].clientY - touchStartY.current;
      if (diffY > 60) {
        setIsDropdownOpen(false);
        touchStartY.current = null;
      }
    }
  };
  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  // Close custom dropdown on outside click for desktop
  useEffect(() => {
    if (!isMobile) {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobile]);
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

  const selectedContest = useMemo(() => {
    if (selectedContestId === 'ALL') return null;
    return rawContests.find(c => c.id === selectedContestId) || null;
  }, [rawContests, selectedContestId]);

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

  // Clean and prepare continuous trend data (carries forward previous ratings if unrated, provides short names)
  const formattedTrend = useMemo(() => {
    const rawTrend = data?.trend || [];
    let prevRating: number | null = null;
    return rawTrend.map((t: any, idx: number) => {
      const cName = t.contest_name || t.date || `Contest ${idx + 1}`;
      const shortName = t.short_name || cName
        .replace(/^Weekly Contest /i, 'W')
        .replace(/^Biweekly Contest /i, 'BW')
        .replace(/^Weekly /i, 'W')
        .replace(/^Biweekly /i, 'BW');

      const rVal = (t.avg_rating !== null && t.avg_rating !== undefined) ? Number(t.avg_rating) : prevRating;
      if (t.avg_rating !== null && t.avg_rating !== undefined) {
        prevRating = Number(t.avg_rating);
      }

      return {
        ...t,
        contest_name: cName,
        short_name: shortName,
        avg_rating: rVal,
        avg_rank: (t.avg_rank !== null && t.avg_rank !== undefined && Number(t.avg_rank) > 0) ? Number(t.avg_rank) : null
      };
    });
  }, [data?.trend]);

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

  const currentRating = summary.current_rating || (rawContests.length > 0 && rawContests[0]?.rating_after ? Math.round(rawContests[0].rating_after) : null);

  const CustomContestTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const cName = item.contest_name || item.date || '';
    const fDate = item.formatted_date;
    const ratingVal = item.avg_rating;
    const rankVal = item.avg_rank;
    const solved = item.problems_solved;

    return (
      <div className="bg-slate-900/95 dark:bg-navy-950/95 backdrop-blur-md border border-slate-700/80 dark:border-navy-700 p-3 rounded-xl shadow-2xl text-white text-xs space-y-2 min-w-[200px]">
        <div className="border-b border-slate-800 dark:border-navy-800 pb-1.5">
          <p className="font-bold text-slate-100 text-sm leading-snug">{cName}</p>
          {fDate && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{fDate}</p>}
        </div>
        <div className="space-y-1.5 font-mono">
          {ratingVal !== null && ratingVal !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs"></span>
                Rating:
              </span>
              <span className="font-black text-blue-400 text-xs">
                {Math.round(ratingVal).toLocaleString()}
              </span>
            </div>
          )}
          {rankVal !== null && rankVal !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
                Rank:
              </span>
              <span className="font-black text-amber-400 text-xs">
                #{Number(rankVal).toLocaleString()}
              </span>
            </div>
          )}
          {solved !== undefined && solved !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
                Solved:
              </span>
              <span className="font-black text-emerald-400 text-xs">
                {solved} / 4
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in mt-4">
      {/* Contest Scope & Week Selector */}
      <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Active Status & Context */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 shrink-0">
            {selectedContest ? <Trophy className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {selectedContest ? selectedContest.contest_name : 'All Contests Performance'}
              </h3>
              {selectedContest ? (
                <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
                  selectedContest.contest_type === 'Biweekly' 
                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60' 
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                }`}>
                  {selectedContest.contest_type}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60">
                  Full Portfolio • {rawContests.length} Weeks
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {selectedContest 
                ? `Official session on ${selectedContest.formatted_date || selectedContest.date}${selectedContest.finish_time ? ` • Finish Time: ${selectedContest.finish_time}` : ''}`
                : `Aggregated lifetime averages, totals, and question clearance across all ${rawContests.length} attended contests`}
            </p>
          </div>
        </div>

        {/* Right Side: Sleek Custom Popover Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700/80 border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs transition-all cursor-pointer min-w-[240px] sm:min-w-[280px]"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedContest ? (
                  <>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedContest.contest_type === 'Biweekly' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                    <span className="truncate">{selectedContest.contest_name}</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-extrabold shrink-0">
                      ({selectedContest.score ?? (selectedContest.problems_solved * 4)} pts)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-500 shrink-0">⭐</span>
                    <span className="truncate">All Contests ({rawContests.length} Weeks)</span>
                  </>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {selectedContestId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedContestId('ALL')}
                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="Reset to All Contests View"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">All</span>
              </button>
            )}
          </div>

          {/* Desktop Floating Dropdown Menu */}
          {isDropdownOpen && !isMobile && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 p-2.5 z-50 space-y-2 animate-scale-in">
              {/* Quick Search inside dropdown */}
              <div className="relative px-0.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter contest (e.g. 525, 194, Biweekly)..."
                  value={dropdownSearch}
                  onChange={(e) => setDropdownSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>

              {/* Scrollable list */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {/* 1. All Contests Option */}
                {(!dropdownSearch || 'all contests portfolio'.includes(dropdownSearch.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedContestId('ALL'); setIsDropdownOpen(false); setDropdownSearch(''); }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      selectedContestId === 'ALL'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 shadow-2xs'
                        : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-amber-500 text-sm">⭐</span>
                      <div>
                        <p className="font-extrabold">All Contests (Overall Portfolio)</p>
                        <p className="text-[10px] text-slate-400 font-normal">Aggregated stats of all {rawContests.length} attended weeks</p>
                      </div>
                    </div>
                    {selectedContestId === 'ALL' && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                  </button>
                )}

                {/* Individual Contests */}
                {rawContests
                  .filter(c => {
                    if (!dropdownSearch) return true;
                    const q = dropdownSearch.toLowerCase().trim();
                    return (
                      c.contest_name.toLowerCase().includes(q) ||
                      (c.formatted_date && c.formatted_date.toLowerCase().includes(q)) ||
                      (c.date && c.date.includes(q)) ||
                      c.contest_type.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const isSelected = selectedContestId === c.id;
                    const pts = c.score ?? (c.problems_solved * 4);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedContestId(c.id); setIsDropdownOpen(false); setDropdownSearch(''); }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 shadow-2xs'
                            : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${c.contest_type === 'Biweekly' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{c.contest_name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{c.formatted_date || c.date || 'Contest'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                            {c.problems_solved}/4
                          </span>
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/50">
                            {pts} pts
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 ml-0.5" />}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Mobile Bottom Sheet Drawer */}
          {isDropdownOpen && isMobile && createPortal(
            <div className="fixed inset-0 z-[10000000] flex flex-col justify-end isolate">
              <div 
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs transition-opacity animate-fade-in"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div 
                className="relative z-10 w-full max-h-[85dvh] bg-white dark:bg-navy-950 rounded-t-[32px] border-t border-slate-200/90 dark:border-navy-800 shadow-[0_-12px_45px_rgba(0,0,0,0.35)] flex flex-col animate-slide-up-drawer overflow-hidden"
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 20px))' }}
              >
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="pt-3 pb-1 flex flex-col items-center cursor-grab active:cursor-grabbing select-none shrink-0"
                >
                  <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-navy-700" />
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-navy-800/80 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/50">
                      <Trophy size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-base text-slate-900 dark:text-white truncate">
                        Select Contest Week
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {rawContests.length} attended weeks recorded
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-4 pt-3 pb-2 shrink-0">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Search contest (e.g. 525, Biweekly)..."
                      className="w-full pl-9 pr-8 py-2.5 text-xs font-semibold rounded-2xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-brand-500"
                    />
                    {dropdownSearch && (
                      <button 
                        type="button" 
                        onClick={() => setDropdownSearch('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-y-auto px-4 py-2 space-y-2 overscroll-contain flex-1">
                  {(!dropdownSearch || 'all contests portfolio'.includes(dropdownSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setSelectedContestId('ALL'); setIsDropdownOpen(false); setDropdownSearch(''); }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                        selectedContestId === 'ALL'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                          : 'text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-navy-900/60 border border-slate-200/70 dark:border-navy-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">⭐</span>
                        <div className="text-left">
                          <p className="font-extrabold text-xs">All Contests (Overall Portfolio)</p>
                          <p className={`text-[10px] ${selectedContestId === 'ALL' ? 'text-amber-100' : 'text-slate-400'}`}>
                            Aggregated stats of all {rawContests.length} attended weeks
                          </p>
                        </div>
                      </div>
                      {selectedContestId === 'ALL' && <Check size={18} strokeWidth={3} />}
                    </button>
                  )}

                  {rawContests
                    .filter(c => {
                      if (!dropdownSearch) return true;
                      const q = dropdownSearch.toLowerCase().trim();
                      return (
                        c.contest_name.toLowerCase().includes(q) ||
                        (c.formatted_date && c.formatted_date.toLowerCase().includes(q)) ||
                        (c.date && c.date.includes(q)) ||
                        c.contest_type.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => {
                      const isSelected = selectedContestId === c.id;
                      const pts = c.score ?? (c.problems_solved * 4);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedContestId(c.id); setIsDropdownOpen(false); setDropdownSearch(''); }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30'
                              : 'text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-navy-900/60 border border-slate-200/70 dark:border-navy-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.contest_type === 'Biweekly' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                            <div className="min-w-0 text-left">
                              <p className="truncate font-extrabold text-xs">{c.contest_name}</p>
                              <p className={`text-[10px] ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                                {c.formatted_date || c.date || 'Contest'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {c.problems_solved}/4
                            </span>
                            <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            }`}>
                              {pts} pts
                            </span>
                            {isSelected && <Check size={18} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* KPI Cards Grid - Conditionally rendered based on Single Week vs All Contests */}
      {selectedContest ? (
        /* SINGLE WEEK VIEW (8 Detailed Metric Cards) */
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* 1. Contest Rating */}
            <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl mr-3 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Rating</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white truncate">
                    {selectedContest.rating_after ? Math.round(selectedContest.rating_after).toLocaleString('en-US') : 'Unrated'}
                  </span>
                  {selectedContest.rating_change !== null && selectedContest.rating_change !== undefined && (
                    <span className={`text-[11px] font-black ${selectedContest.rating_change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {selectedContest.rating_change >= 0 ? `+${selectedContest.rating_change}` : selectedContest.rating_change}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Contest Rank */}
            <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl mr-3 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Global Rank</p>
                <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                  {selectedContest.contest_rank && selectedContest.contest_rank > 0 ? `#${selectedContest.contest_rank.toLocaleString('en-US')}` : '—'}
                </p>
              </div>
            </div>

            {/* 3. Contest Score */}
            <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl mr-3 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Contest Score</p>
                <p className="text-xl sm:text-2xl font-display font-bold text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                  {selectedContest.score ?? (selectedContest.problems_solved * 4)} <span className="text-xs text-slate-400 font-medium">/ 18 pts</span>
                </p>
              </div>
            </div>

            {/* 4. Solved Total */}
            <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl mr-3 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Solved</p>
                <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                  {selectedContest.problems_solved || 0} <span className="text-xs text-slate-400 font-medium">/ {selectedContest.total_problems || 4}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Problem-wise Solved Breakdown (Q1, Q2, Q3, Q4) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Q1 Easy */}
            {(() => {
              const isQ1Solved = (selectedContest.q1 ?? (selectedContest.problems_solved >= 1 ? 1 : 0)) === 1;
              return (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isQ1Solved 
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200' 
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Q1 (Easy)</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">3 pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isQ1Solved ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold">{isQ1Solved ? 'Solved' : 'Not Solved'}</span>
                  </div>
                </div>
              );
            })()}

            {/* Q2 Medium */}
            {(() => {
              const isQ2Solved = (selectedContest.q2 ?? (selectedContest.problems_solved >= 2 ? 1 : 0)) === 1;
              return (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isQ2Solved 
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200' 
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Q2 (Medium)</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">4 pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isQ2Solved ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold">{isQ2Solved ? 'Solved' : 'Not Solved'}</span>
                  </div>
                </div>
              );
            })()}

            {/* Q3 Medium */}
            {(() => {
              const isQ3Solved = (selectedContest.q3 ?? (selectedContest.problems_solved >= 3 ? 1 : 0)) === 1;
              return (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isQ3Solved 
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200' 
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Q3 (Medium)</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">5 pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isQ3Solved ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold">{isQ3Solved ? 'Solved' : 'Not Solved'}</span>
                  </div>
                </div>
              );
            })()}

            {/* Q4 Hard */}
            {(() => {
              const isQ4Solved = (selectedContest.q4 ?? (selectedContest.problems_solved >= 4 ? 1 : 0)) === 1;
              return (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isQ4Solved 
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200' 
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Q4 (Hard)</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">6 pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isQ4Solved ? (
                      <CheckCircle2 className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold">{isQ4Solved ? 'Solved' : 'Not Solved'}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* ALL CONTESTS (TOTAL WEEKS OVERVIEW - 6 Focused KPI Cards) */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* 1. Rating */}
          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
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

          {/* 3. Avg Score */}
          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl mr-3.5 shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Avg Score</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                {summary.avg_score != null ? Number(summary.avg_score).toFixed(1) : (Number(summary.avg_solved || 0) * 4).toFixed(1)} <span className="text-xs text-slate-400 font-medium">/ 18</span>
              </p>
            </div>
          </div>

          {/* 4. Easy Solved Breakdown */}
          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl mr-3.5 shrink-0">
              <Check className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">Easy Solved</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {summary.total_easy ?? 0} <span className="text-xs text-slate-400 font-medium">({summary.avg_easy != null ? Number(summary.avg_easy).toFixed(1) : 0}/c)</span>
              </p>
            </div>
          </div>

          {/* 5. Medium Solved Breakdown */}
          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl mr-3.5 shrink-0">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">Medium Solved</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {summary.total_medium ?? 0} <span className="text-xs text-slate-400 font-medium">({summary.avg_medium != null ? Number(summary.avg_medium).toFixed(1) : 0}/c)</span>
              </p>
            </div>
          </div>

          {/* 6. Hard Solved Breakdown */}
          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl mr-3.5 shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">Hard Solved</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {summary.total_hard ?? 0} <span className="text-xs text-slate-400 font-medium">({summary.avg_hard != null ? Number(summary.avg_hard).toFixed(1) : 0}/c)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts & Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Rating & Rank Progression
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Official contest performance timeline ({formattedTrend.length} contests)
              </p>
            </div>

            {/* Metric Mode Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-navy-800 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMetric('both')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewMetric === 'both' ? 'bg-white dark:bg-navy-700 text-brand-600 dark:text-brand-300 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => setViewMetric('rating')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewMetric === 'rating' ? 'bg-white dark:bg-navy-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
              >
                Rating
              </button>
              <button
                type="button"
                onClick={() => setViewMetric('rank')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewMetric === 'rank' ? 'bg-white dark:bg-navy-700 text-amber-600 dark:text-amber-400 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
              >
                Rank
              </button>
            </div>
          </div>

          {formattedTrend && formattedTrend.length > 0 ? (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedTrend} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                  <XAxis 
                    dataKey="short_name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                    dy={8} 
                    minTickGap={16}
                    tickFormatter={(val) => {
                      if (!val) return '';
                      return String(val)
                        .replace(/^Weekly Contest /i, 'W')
                        .replace(/^Biweekly Contest /i, 'BW')
                        .replace(/^Weekly /i, 'W')
                        .replace(/^Biweekly /i, 'BW');
                    }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 600 }}
                    domain={[
                      (dataMin: number) => {
                        if (!dataMin || isNaN(dataMin)) return 1000;
                        return Math.max(0, Math.floor((dataMin - 80) / 100) * 100);
                      },
                      (dataMax: number) => {
                        if (!dataMax || isNaN(dataMax)) return 2400;
                        return Math.ceil((dataMax + 80) / 100) * 100;
                      }
                    ]}
                    tickFormatter={(val) => Math.round(val).toLocaleString()}
                    width={40}
                  />
                  {(viewMetric === 'both' || viewMetric === 'rank') && (
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      reversed 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#f59e0b', fontSize: 10, fontWeight: 600 }}
                      domain={[
                        (dataMin: number) => {
                          if (!dataMin || isNaN(dataMin)) return 1;
                          return Math.max(1, Math.floor(dataMin * 0.7));
                        },
                        (dataMax: number) => {
                          if (!dataMax || isNaN(dataMax)) return 50000;
                          return Math.ceil(dataMax * 1.15);
                        }
                      ]}
                      tickFormatter={(val) => {
                        if (val >= 1000) return `#${(val / 1000).toFixed(0)}k`;
                        return `#${val}`;
                      }}
                      width={44}
                    />
                  )}
                  <Tooltip content={<CustomContestTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '14px' }} 
                    formatter={(val) => <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">{val}</span>}
                  />
                  {(viewMetric === 'both' || viewMetric === 'rating') && (
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="avg_rating" 
                      name="Rating" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      connectNulls={true}
                      dot={{ r: 3, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 1.5 }} 
                      activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }} 
                    />
                  )}
                  {(viewMetric === 'both' || viewMetric === 'rank') && (
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="avg_rank" 
                      name="Rank" 
                      stroke="#f59e0b" 
                      strokeWidth={2.5} 
                      strokeDasharray="4 4" 
                      connectNulls={true}
                      dot={{ r: 2.5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 1 }} 
                      activeDot={{ r: 5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }} 
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700 h-[280px]">
              <p className="text-slate-400 dark:text-navy-400 font-medium">No trend data available.</p>
            </div>
          )}
        </div>

        {/* Highlights Tile (Single student) OR Top Performers (Global) */}
        {studentId ? (
          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Contest Highlights
            </h3>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Contests Attended</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{rawContests.length}</span>
                  <span className="text-[11px] text-slate-400">({weeklyCount}W / {biweeklyCount}B)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Solved</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {summary.problems_solved || rawContests.reduce((acc, c) => acc + (c.problems_solved || 0), 0)}
                  </span>
                  <span className="text-[11px] text-slate-400">problems</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Peak Standing</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-amber-500">
                    {summary.best_rank ? `#${Number(summary.best_rank).toLocaleString('en-US')}` : '-'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Best rank</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Solved / Contest</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-indigo-500">
                    {summary.avg_solved ? Number(summary.avg_solved).toFixed(1) : 0}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">/ 4 avg</span>
                </div>
              </div>
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

      {/* Weekly Contest Breakdown Section */}
      {(studentId || rawContests.length > 0) && (
        <div id="weekly-contest-breakdown-section" className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm space-y-3.5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-navy-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Weekly & Biweekly Contest Breakdown
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30">
                {rawContests.length}
              </span>
            </div>

            {/* Filter buttons & sort toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-navy-800 p-1 rounded-xl border border-slate-200/60 dark:border-navy-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'ALL' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  All ({rawContests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('Weekly')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'Weekly' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Weekly ({weeklyCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('Biweekly')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'Biweekly' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Biweekly ({biweeklyCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                title={`Sorting: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
              </button>
            </div>
          </div>

          {/* Search bar with Prominent Clear Border */}
          <div className="relative">
            <div className="flex items-center w-full bg-white dark:bg-navy-950 border-2 border-slate-300 dark:border-navy-600 focus-within:border-brand-500 dark:focus-within:border-brand-400 rounded-xl shadow-xs transition-all overflow-hidden px-3 py-1.5 sm:py-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
              <input
                type="text"
                placeholder="Search contest (e.g. 192, Weekly)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table Container - Fits 100% on same page with ZERO horizontal scroll */}
          {filteredContests.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-800/30 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
              <Trophy className="w-7 h-7 mx-auto mb-1.5 opacity-30 text-slate-400" />
              <p className="font-semibold text-xs sm:text-sm">No contests match your search or filter.</p>
              <button 
                onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                className="mt-1.5 text-xs font-semibold text-brand-600 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full text-left border-collapse table-auto sm:table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/70 dark:bg-navy-800/40 text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 sm:px-3 rounded-l-lg w-[36%] sm:w-[35%]">Contest & Date</th>
                    <th className="py-2.5 px-1.5 sm:px-2 text-center w-[20%] sm:w-[19%]">Solved</th>
                    <th className="py-2.5 px-1.5 sm:px-2 text-center w-[14%] sm:w-[13%]">Score</th>
                    <th className="py-2.5 px-2 sm:px-3 text-right w-[15%] sm:w-[17%]">Rating</th>
                    <th className="py-2.5 px-2.5 sm:px-3 text-right rounded-r-lg w-[15%] sm:w-[16%]">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {paginatedContests.map((c) => {
                    const solved = c.problems_solved || 0;
                    const total = c.total_problems || 4;
                    const ratingDelta = c.rating_change;
                    const contestScore = c.score ?? (solved * 4);
                    const isSelected = selectedContestId === c.id;

                    return (
                      <tr 
                        key={c.id || c.contest_name} 
                        onClick={() => setSelectedContestId(selectedContestId === c.id ? 'ALL' : c.id)}
                        className={`cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-brand-50/80 dark:bg-brand-950/40 ring-2 ring-brand-500/80 shadow-xs' 
                            : c.is_best_rank 
                              ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/80 dark:hover:bg-amber-950/40' 
                              : 'hover:bg-slate-50/80 dark:hover:bg-navy-800/50'
                        }`}
                        title="Click to view detailed metrics for this week"
                      >
                        {/* 1. Contest & Date */}
                        <td className="py-2.5 sm:py-3 px-2.5 sm:px-3">
                          <div className="flex flex-col">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {c.contest_name}
                              </span>
                              <span className={`px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold rounded uppercase tracking-wider ${
                                c.contest_type === 'Biweekly' 
                                  ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30' 
                                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30'
                              }`}>
                                {c.contest_type}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-brand-500 text-white">
                                  Selected
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {c.formatted_date || c.date || '-'}
                              </span>
                              {c.finish_time && (
                                <span className="flex items-center gap-0.5 font-mono text-[10px] text-slate-400">
                                  <Clock className="w-2.5 h-2.5" />
                                  {c.finish_time}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Questions Solved with 4 visual blocks */}
                        <td className="py-2.5 sm:py-3 px-1.5 sm:px-2 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5">
                              {[
                                { num: 1, diff: 'Easy', pts: 3, isSolved: (c.q1 ?? (solved >= 1 ? 1 : 0)) === 1, color: 'bg-emerald-500' },
                                { num: 2, diff: 'Med', pts: 4, isSolved: (c.q2 ?? (solved >= 2 ? 1 : 0)) === 1, color: 'bg-amber-500' },
                                { num: 3, diff: 'Med', pts: 5, isSolved: (c.q3 ?? (solved >= 3 ? 1 : 0)) === 1, color: 'bg-amber-500' },
                                { num: 4, diff: 'Hard', pts: 6, isSolved: (c.q4 ?? (solved >= 4 ? 1 : 0)) === 1, color: 'bg-rose-500' }
                              ].map((q) => {
                                return (
                                  <div
                                    key={q.num}
                                    title={`Q${q.num} (${q.diff} • ${q.pts} pts): ${q.isSolved ? 'Solved' : 'Unsolved'}`}
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold ${
                                      q.isSolved
                                        ? `${q.color} text-white shadow-2xs`
                                        : 'bg-slate-200 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    {q.isSolved ? '✓' : q.num}
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              <span className="font-bold text-slate-900 dark:text-white">{solved}</span> / {total}
                            </span>
                          </div>
                        </td>

                        {/* 3. Contest Score */}
                        <td className="py-2.5 sm:py-3 px-1.5 sm:px-2 text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                            <Flame className="w-3 h-3 text-purple-500" />
                            {contestScore} pts
                          </span>
                        </td>

                        {/* 4. Contest Rating & Delta */}
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-right">
                          {c.rating_after ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {Math.round(c.rating_after).toLocaleString('en-US')}
                              </span>
                              {ratingDelta !== null && ratingDelta !== undefined && (
                                <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] sm:text-[10px] font-bold mt-0.5 ${
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

                        {/* 5. Global Rank */}
                        <td className="py-2.5 sm:py-3 px-2.5 sm:px-3 text-right">
                          <div className="flex flex-col items-end">
                            {c.contest_rank && c.contest_rank > 0 ? (
                              <span className={`font-mono font-bold text-xs sm:text-sm ${c.is_best_rank ? 'text-amber-500 font-extrabold' : 'text-slate-700 dark:text-slate-200'}`}>
                                #{Number(c.contest_rank).toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                            {c.is_best_rank && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                Best
                              </span>
                            )}
                          </div>
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
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 dark:border-navy-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredContests.length)} of {filteredContests.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
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