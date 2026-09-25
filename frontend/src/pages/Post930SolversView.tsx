import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock, Download, RefreshCw, Search, Users, AlertCircle,
  ExternalLink, Eye, ArrowUpDown, ChevronRight, X, ShieldAlert, CheckCircle2, FileSpreadsheet, Filter
} from 'lucide-react';
import api from '../services/api';
import { downloadManager } from '../services/download/downloadManager';
import { useDepartments } from '../contexts/DepartmentContext';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';

const formatYear = (yr: any) => {
  if (!yr) return 'II Year';
  const clean = String(yr).replace(/year/gi, '').trim();
  if (!clean) return 'II Year';
  if (clean === '1' || clean === 'I') return 'I Year';
  if (clean === '2' || clean === 'II') return 'II Year';
  if (clean === '3' || clean === 'III') return 'III Year';
  if (clean === '4' || clean === 'IV') return 'IV Year';
  return `${clean} Year`;
};

export const Post930SolversView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { departments } = useDepartments();

  // Filters state
  const [search, setSearch] = useState<string>('');
  const [minSolves, setMinSolves] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>('latest');
  const [dept, setDept] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<string>('');
  const [section, setSection] = useState<string>('');

  const hasActiveFilters = Boolean(search || minSolves !== 1 || sortBy !== 'latest' || dept || yearLevel || section);
  const activeFilterCount = [
    Boolean(search),
    minSolves !== 1,
    sortBy !== 'latest',
    Boolean(dept),
    Boolean(yearLevel),
    Boolean(section)
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setMinSolves(1);
    setSortBy('latest');
    setDept('');
    setYearLevel('');
    setSection('');
  };

  // Selected student evidence modal state
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const getDeptBadgeStyle = (deptCode: string) => {
    const code = (deptCode || '').toUpperCase().trim();
    if (code.includes('IOT')) {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    } else if (code.includes('CS') || code.includes('CYBER')) {
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (code === 'IT' || code.includes('INFORMATION')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    } else if (code.includes('AIDS') || code.includes('AI')) {
      return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30';
    } else if (code.includes('AGRI')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    } else if (code.includes('EEE')) {
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
    } else if (code.includes('ECE')) {
      return 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30';
    } else if (code.includes('CSE')) {
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
    } else {
      return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
    }
  };

  useEffect(() => {
    fetchPost930Solvers();
  }, [minSolves, sortBy, dept, yearLevel, section, search]);

  const fetchPost930Solvers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/contests/post-930-solvers', {
        params: {
          min_post_window_solves: minSolves,
          sort_by: sortBy,
          dept: dept || undefined,
          year_level: yearLevel || undefined,
          section: section || undefined,
          search: search || undefined
        }
      });
      setData(res.data);
    } catch (err: any) {
      console.error('Error fetching post-9:30 solvers:', err);
      setError(err.response?.data?.detail || 'Failed to load post-9:30 solvers activity.');
    } finally {
      setLoading(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (minSolves) params.append('min_post_window_solves', minSolves.toString());
      if (dept) params.append('dept', dept);
      if (yearLevel) params.append('year_level', yearLevel);
      if (section) params.append('section', section);
      if (search) params.append('search', search);

      await downloadManager.download({
        endpoint: `/contests/post-930-solvers/export?${params.toString()}`,
        filename: `Post_930_Solvers_${data?.session_date || 'Report'}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } catch (err) {
      console.error("Post 9:30 solvers export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const studentsList = data?.students || [];
  const q = search.toLowerCase();
  const filteredStudents = studentsList.filter((s: any) => {
    if ((s.student_name || s.name) && (s.student_name || s.name).toLowerCase().includes(q)) return true;
    if ((s.register_number || s.reg_no) && (s.register_number || s.reg_no).toLowerCase().includes(q)) return true;
    if (s.username && s.username.toLowerCase().includes(q)) return true;
    return false;
  });

  const summary = data?.summary || {
    students_detected: 0,
    total_post_solves: 0,
    total_post_submissions: 0,
    earliest_activity: 'None',
    latest_activity: 'None'
  };

  return (
    <div className="space-y-8 py-2 animate-fade-in">

      {/* Header Banner - Sleek Dark Indigo & Brand Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-950 via-indigo-950 to-navy-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-black border border-brand-500/40">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>POST-09:30 AM IST ACTIVITY ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Post-9:30 AM Solvers Report</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Verified problem submissions timestamped after official Sunday Contest snapshot lock. Official contest scores remain 100% immutable.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportExcel}
              className="relative overflow-hidden px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 border border-emerald-400/30 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer active:scale-95 group whitespace-nowrap flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-black tracking-wide">Export Excel <span className="hidden sm:inline">(.xlsx)</span></span>
            </button>

            <button
              onClick={fetchPost930Solvers}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-black border border-white/20 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 text-brand-300 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Grid — 5 Headline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
            Students Detected
          </span>
          <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {summary.students_detected}
          </p>
          <p className="text-[10px] text-slate-400">Verified post-window solvers</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
            Post-9:30 Problems
          </span>
          <p className="text-3xl font-black text-indigo-500">
            +{summary.total_post_solves}
          </p>
          <p className="text-[10px] text-slate-400">Deduplicated problem solves</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-purple-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">
            Post-9:30 Submissions
          </span>
          <p className="text-3xl font-black text-purple-500">
            {summary.total_post_submissions || summary.total_post_solves}
          </p>
          <p className="text-[10px] text-slate-400">Total submission attempts</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Earliest Activity
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.earliest_activity}
          </p>
          <p className="text-[10px] text-slate-400">First qualifying solve</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Latest Activity
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.latest_activity}
          </p>
          <p className="text-[10px] text-slate-400">Most recent solve</p>
        </div>
      </div>

      {/* Filters & Search Control Bar - Uniform Responsive Grid */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3.5">
        
        {/* Filter Bar Header & Reset */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100 dark:border-navy-800/80">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-brand-500" />
            <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
              Filter Solvers & Activity
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-[10px] font-extrabold border border-brand-500/30">
                {activeFilterCount} Active
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center space-x-1 transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-end">

          {/* Search Input */}
          <div className="flex flex-col space-y-1.5 w-full min-w-0">
            <label className="block text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate flex items-center h-4 leading-4 m-0 p-0">
              <span>Search Student</span>
            </label>
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, reg no, username..."
                className="w-full pl-10 pr-9 h-11 rounded-2xl border border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Min Solves Filter */}
          <CustomDropdown
            label="Min Solves"
            value={String(minSolves)}
            onChange={(val) => setMinSolves(Number(val))}
            options={[
              { value: '1', label: '1+ Post-9:30 Solves' },
              { value: '2', label: '2+ Post-9:30 Solves' },
              { value: '3', label: '3+ Post-9:30 Solves' }
            ]}
            placeholder="Select Min Solves"
            triggerClassName="w-full h-11 bg-slate-50 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-2xl shadow-xs hover:border-brand-500/60 transition-all"
          />

          {/* Sort By Filter */}
          <CustomDropdown
            label="Sort Order"
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            options={[
              { value: 'latest', label: 'Sort: Latest Activity' },
              { value: 'highest', label: 'Sort: Highest Solves' },
              { value: 'earliest', label: 'Sort: Earliest Activity' },
              { value: 'name', label: 'Sort: Student Name A-Z' }
            ]}
            placeholder="Select Sort"
            triggerClassName="w-full h-11 bg-slate-50 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-2xl shadow-xs hover:border-brand-500/60 transition-all"
          />

          {/* Department Filter */}
          <CustomDropdown
            label="Department"
            value={dept}
            onChange={(val) => setDept(val)}
            options={[
              { value: '', label: 'All Depts' },
              ...departments
                .filter(d => {
                  const code = (d.code || '').toUpperCase().trim();
                  const name = (d.name || '').toUpperCase().trim();
                  return code.includes('CS') || code.includes('CYBER') || code.includes('IOT') || code === 'IT' || name.includes('CYBER') || name.includes('IOT') || name.includes('INFORMATION');
                })
                .map(d => ({
                  value: d.code,
                  label: d.name
                }))
            ]}
            placeholder="All Depts"
            triggerClassName="w-full h-11 bg-slate-50 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-2xl shadow-xs hover:border-brand-500/60 transition-all"
          />

          {/* Year Filter */}
          <CustomDropdown
            label="Academic Year"
            value={yearLevel}
            onChange={(val) => setYearLevel(val)}
            options={[
              { value: '', label: 'All Years' },
              { value: 'II', label: 'II Year' },
              { value: 'III', label: 'III Year' },
              { value: 'IV', label: 'IV Year' }
            ]}
            placeholder="All Years"
            triggerClassName="w-full h-11 bg-slate-50 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-2xl shadow-xs hover:border-brand-500/60 transition-all"
          />

        </div>
      </div>

      {/* Main Solvers Table (Desktop) & Cards (Mobile) */}
      <div className="glass-card rounded-3xl border overflow-hidden shadow-xl">
        
        {/* MOBILE CARDS VIEW (md:hidden) */}
        <div className="block md:hidden p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold animate-pulse">
              Detecting post-9:30 AM solvers & verifying submission timestamps...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-500 font-bold">
              {error}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">
              No students solved problems after the official 09:30 AM lock for the selected filters.
            </div>
          ) : (
            filteredStudents.map((st: any) => (
              <div
                key={st.student_id}
                className="bg-white dark:bg-navy-900/90 rounded-2xl p-4 border border-slate-200/90 dark:border-navy-700/80 shadow-md space-y-3 transition-all hover:shadow-lg"
              >
                {/* Header: Name, Reg No & Dept Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {st.student_name}
                    </h4>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400 font-bold truncate">
                      {st.register_number || st.reg_no}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black border shrink-0 whitespace-nowrap ${getDeptBadgeStyle(st.department)}`}>
                    <span>{st.department}</span>
                    <span className="font-bold opacity-90">• {formatYear(st.year || st.year_level)}</span>
                  </span>
                </div>

                {/* Stats 4-Grid */}
                <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-850 text-center">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase block">Official</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{st.official_locked_solved}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-amber-500 uppercase block">Post-9:30</span>
                    <span className="text-xs font-black text-amber-500">
                      {st.post_window_solve_count?.toString().startsWith('+') ? st.post_window_solve_count : `+${st.post_window_solve_count}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-purple-500 uppercase block">Subs</span>
                    <span className="text-xs font-black text-purple-500">{st.post_window_submission_count || st.post_window_solve_count}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-indigo-500 uppercase block">Total</span>
                    <span className="text-xs font-black text-indigo-500">{st.current_total_solved}</span>
                  </div>
                </div>

                {/* Timestamps & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-navy-800 gap-2">
                  <div className="flex flex-col text-[10px] text-slate-500 dark:text-slate-400 font-bold min-w-0">
                    <span className="truncate">First: <strong className="text-slate-700 dark:text-slate-300">{st.first_post_window_solve_formatted || '—'}</strong></span>
                    <span className="truncate">Latest: <strong className="text-slate-700 dark:text-slate-300">{st.latest_post_window_solve_formatted || '—'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{st.evidence_status || 'VERIFIED'}</span>
                    </span>
                    <button
                      onClick={() => setSelectedStudent(st)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center space-x-1 transition-all text-[11px] shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-200 font-black uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-navy-700">
              <tr>
                <th className="px-4 py-3.5 whitespace-nowrap">Student Name</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Reg No</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Dept / Class</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Official 09:30 Solved</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Post-9:30 Solves</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Submissions</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Current Total</th>
                <th className="px-4 py-3.5 whitespace-nowrap">First Activity</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Latest Activity</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Evidence Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap sticky right-0 z-20 bg-slate-100 dark:bg-navy-900 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-600 dark:text-slate-300 font-extrabold animate-pulse whitespace-nowrap">
                    Detecting post-9:30 AM solvers & verifying submission timestamps...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-rose-600 dark:text-rose-400 font-extrabold whitespace-nowrap">
                    {error}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Clock className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">No Matching Post-9:30 AM Solvers</h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold max-w-md">
                        No students solved problems after the official 09:30 AM lock for the selected filters.
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 px-3.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 text-brand-600 dark:text-brand-300 text-xs font-bold transition-all border border-brand-200 dark:border-brand-800 cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st: any) => (
                  <tr key={st.student_id} className="group hover:bg-slate-50/80 dark:hover:bg-navy-850 transition-colors">
                    <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {st.student_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {st.register_number || st.reg_no}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border whitespace-nowrap ${getDeptBadgeStyle(st.department)}`}>
                        <span>{st.department}</span>
                        <span className="font-bold text-xs opacity-90">• {formatYear(st.year || st.year_level)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {st.official_locked_solved}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {st.post_window_solve_count?.toString().startsWith('+') ? st.post_window_solve_count : `+${st.post_window_solve_count}`}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-purple-600 dark:text-purple-400 whitespace-nowrap">
                      {st.post_window_submission_count || st.post_window_solve_count}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {st.current_total_solved}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {st.first_post_window_solve_formatted || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {st.latest_post_window_solve_formatted || '—'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{st.evidence_status || 'VERIFIED'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-navy-950 dark:group-hover:bg-navy-850 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] transition-colors text-center">
                      <button
                        onClick={() => setSelectedStudent(st)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center space-x-1.5 transition-all text-xs shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Solves</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Problem Evidence Modal */}
      {selectedStudent && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 space-y-4 p-6 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
              <div>
                <h3 className="text-base font-black flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>{selectedStudent.student_name}</span>
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                    Reg: {selectedStudent.register_number || selectedStudent.reg_no}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black border ${getDeptBadgeStyle(selectedStudent.department)}`}>
                    {selectedStudent.department} • {formatYear(selectedStudent.year || selectedStudent.year_level)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-navy-900 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Official Score:</span>
                <p className="font-black text-slate-900 dark:text-white text-base">{selectedStudent.official_locked_solved}</p>
              </div>
              <div>
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">Post-9:30 Problems:</span>
                <p className="font-black text-amber-500 text-base">{selectedStudent.post_window_solve_count?.toString().startsWith('+') ? selectedStudent.post_window_solve_count : `+${selectedStudent.post_window_solve_count}`}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Qualifying Post-9:30 AM Problems ({selectedStudent.problems?.length || 0})
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedStudent.problems?.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{idx + 1}. {p.problem_name || p.name}</p>
                      <div className="flex items-center space-x-2 text-[10px] mt-0.5">
                        <span className="text-amber-500 font-mono font-bold">Solved: {p.solved_at || p.timestamp_ist}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">{p.evidence_status || 'VERIFIED'}</span>
                      </div>
                    </div>

                    {(p.problem_url || p.url) && (
                      <a
                        href={p.problem_url || p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 text-xs font-black hover:bg-slate-300 dark:hover:bg-navy-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
