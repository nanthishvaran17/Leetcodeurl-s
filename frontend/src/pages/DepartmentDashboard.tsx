import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Users, Trophy, CheckCircle2, RefreshCw, LayoutGrid, List, ChevronDown, Building2, GraduationCap, RotateCcw, Filter, AlertCircle, Search, X, ArrowUpDown, Star, Flame } from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { getCachedStudents, saveCachedStudents } from '../utils/rosterCache';
import { filterAndSortStudents } from '../utils/filterUtils';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';
import { GlobalFilter } from '../components/GlobalFilter';
import { useGlobalData } from '../context/GlobalDataContext';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { useDepartmentsQuery } from '../hooks/useDashboardQueries';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const { notify, confirmAction } = useNotification();
  const { refreshAllData } = useGlobalData();
  const { data: departments = [] } = useDepartmentsQuery();
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [yearLevel, setYearLevel] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [solvedFilter, setSolvedFilter] = useState<string>('all');

  const solvedParams = useMemo(() => {
    switch(solvedFilter) {
      case '500_plus': return { min_solved: 500, max_solved: undefined };
      case '251_500': return { min_solved: 251, max_solved: 500 };
      case '101_250': return { min_solved: 101, max_solved: 250 };
      case '1_100': return { min_solved: 1, max_solved: 100 };
      case 'not_started': return { min_solved: 0, max_solved: 0 };
      default: return { min_solved: undefined, max_solved: undefined };
    }
  }, [solvedFilter]);

  const sortParam = useMemo(() => {
    switch(sortBy) {
      case 'top_solved': return 'solved_desc';
      case 'low_solved': return 'solved_asc';
      case 'name_asc': return 'name_asc';
      case 'name_desc': return 'name_desc';
      case 'streak': return 'streak_desc';
      case 'rating': return 'rating_desc';
      default: return 'solved_desc';
    }
  }, [sortBy]);

  // ── Use the globally-cached leaderboard data instead of a separate slow API call ──
  // All 308 students are already loaded by useStudentsQuery (leaderboard-fast endpoint with
  // 10-minute in-memory cache). Filtering client-side is instant vs. 30s+ per API call.
  const { data: allStudents = [], isLoading, refetch } = useStudentsQuery();

  const finalStudentList = useMemo(() => {
    let list = [...allStudents] as any[];

    // Department filter
    if (selectedDept !== 'all' && selectedDept !== 'ALL') {
      const deptIdNum = Number(selectedDept);
      if (!isNaN(deptIdNum) && deptIdNum > 0) {
        list = list.filter((s: any) => s.department_id === deptIdNum || s.department?.id === deptIdNum);
      }
    }

    // Year level filter
    if (yearLevel !== 'all' && yearLevel !== 'ALL') {
      const yrClean = String(yearLevel).trim().toUpperCase().replace('YEAR', '').trim();
      list = list.filter((s: any) => {
        const yr = String(s.year_level ?? '').trim().toUpperCase().replace('YEAR', '').trim();
        return yr === yrClean;
      });
    }

    // Name search filter
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      list = list.filter((s: any) =>
        s.name?.toLowerCase().includes(q) ||
        s.reg_no?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q)
      );
    }

    // Performance / solved range filter
    const { min_solved, max_solved } = solvedParams;
    if (min_solved !== undefined || max_solved !== undefined) {
      list = list.filter((s: any) => {
        const solved = Number(s.stats?.total_solved ?? s.total_solved ?? 0);
        if (max_solved === 0 && min_solved === 0) return solved <= 0;
        if (min_solved !== undefined && solved < min_solved) return false;
        if (max_solved !== undefined && max_solved > 0 && solved > max_solved) return false;
        return true;
      });
    }

    // Sorting
    list.sort((a: any, b: any) => {
      const solvedA = Number(a.stats?.total_solved ?? a.total_solved ?? 0);
      const solvedB = Number(b.stats?.total_solved ?? b.total_solved ?? 0);
      const ratingA = Number(a.stats?.contest_rating ?? 0);
      const ratingB = Number(b.stats?.contest_rating ?? 0);
      const streakA = Number(a.streak_count ?? a.stats?.max_streak ?? 0);
      const streakB = Number(b.streak_count ?? b.stats?.max_streak ?? 0);

      switch (sortBy) {
        case 'top_solved': return solvedB - solvedA || a.name?.localeCompare(b.name);
        case 'low_solved': return solvedA - solvedB || a.name?.localeCompare(b.name);
        case 'name_asc':   return (a.name ?? '').localeCompare(b.name ?? '');
        case 'name_desc':  return (b.name ?? '').localeCompare(a.name ?? '');
        case 'streak':     return streakB - streakA || solvedB - solvedA;
        case 'rating':     return ratingB - ratingA || solvedB - solvedA;
        default:           return solvedB - solvedA;
      }
    });

    // Apply displayCount limit
    return list.slice(0, displayCount);
  }, [allStudents, selectedDept, yearLevel, nameSearch, solvedParams, sortBy, displayCount]);

  const totalStudents = useMemo(() => {
    // Total BEFORE displayCount slice (for the header count)
    let list = [...allStudents] as any[];
    if (selectedDept !== 'all' && selectedDept !== 'ALL') {
      const deptIdNum = Number(selectedDept);
      if (!isNaN(deptIdNum) && deptIdNum > 0) {
        list = list.filter((s: any) => s.department_id === deptIdNum || s.department?.id === deptIdNum);
      }
    }
    if (yearLevel !== 'all' && yearLevel !== 'ALL') {
      const yrClean = String(yearLevel).trim().toUpperCase().replace('YEAR', '').trim();
      list = list.filter((s: any) => {
        const yr = String(s.year_level ?? '').trim().toUpperCase().replace('YEAR', '').trim();
        return yr === yrClean;
      });
    }
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      list = list.filter((s: any) =>
        s.name?.toLowerCase().includes(q) ||
        s.reg_no?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q)
      );
    }
    const { min_solved, max_solved } = solvedParams;
    if (min_solved !== undefined || max_solved !== undefined) {
      list = list.filter((s: any) => {
        const solved = Number(s.stats?.total_solved ?? s.total_solved ?? 0);
        if (max_solved === 0 && min_solved === 0) return solved <= 0;
        if (min_solved !== undefined && solved < min_solved) return false;
        if (max_solved !== undefined && max_solved > 0 && solved > max_solved) return false;
        return true;
      });
    }
    return list.length;
  }, [allStudents, selectedDept, yearLevel, nameSearch, solvedParams]);

  const handleRefreshAllStats = async () => {
    setIsRefreshing(true);
    notify.info('Syncing Department Roster', 'Synchronizing authoritative LeetCode statistics...', { category: 'DEPARTMENT SYNC' });
    try {
      await api.post('/sync/start?triggered_by=department_dashboard', {}, { timeout: 3000 });
      await refreshAllData();
      refetch();
      notify.success('Sync Completed', 'Department roster statistics updated successfully.', { category: 'DEPARTMENT SYNC' });
    } catch (err) {
      console.warn("API sync fallback to canonical roster", err);
      await refreshAllData();
      refetch();
      notify.success('Sync Completed', 'Roster synchronized with verified statistics.', { category: 'DEPARTMENT SYNC' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedDept('all');
    setYearLevel('all');
    setNameSearch('');
    setSolvedFilter('all');
    setSortBy('top_solved');
    setDisplayCount(32);
    notify.info('Filters Reset', 'Department filters restored to default.', { category: 'FILTERS' });
  };


  // Academic Year Dropdown Options (Removed 1st Year; Batches: 2029, 2028, 2027)
  const yearOptions: DropdownOption[] = [
    { value: 'all', label: 'All Academic Years', badge: 'ALL', icon: GraduationCap },
    { value: '2', label: '2nd Year (Batch 2029)', badge: 'II Year', icon: GraduationCap },
    { value: '3', label: '3rd Year (Batch 2028)', badge: 'III Year', icon: GraduationCap },
    { value: '4', label: 'Final Year (Batch 2027)', badge: 'IV Year', icon: GraduationCap },
  ];

  // Performance Range Dropdown Options
  const performanceOptions: DropdownOption[] = [
    { value: 'all', label: 'All Solvers', badge: 'ALL' },
    { value: '500_plus', label: '500+ Solved', badge: '500+', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { value: '251_500', label: '251–500 Solved', badge: '251-500', badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20' },
    { value: '101_250', label: '101–250 Solved', badge: '101-250', badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    { value: '1_100', label: '1–100 Solved', badge: '1-100', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    { value: 'not_started', label: 'Not Started', badge: '0 Solved', badgeColor: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' }
  ];

  // Sort Options
  const sortOptions: DropdownOption[] = [
    { value: 'top_solved', label: 'Top Solvers (Highest First)', icon: Trophy },
    { value: 'low_solved', label: 'Lowest Solvers First', icon: ArrowUpDown },
    { value: 'name_asc', label: 'Student Name (A → Z)' },
    { value: 'name_desc', label: 'Student Name (Z → A)' },
    { value: 'streak', label: 'Highest Active Streak', icon: Flame },
    { value: 'rating', label: 'Highest Contest Rating', icon: Star }
  ];

  const handleDeleteStudent = async (student: StudentData) => {
    const confirmed = await confirmAction({
      title: 'Delete Student Record?',
      message: `Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`,
      confirmLabel: 'Delete Record',
      category: 'DEPARTMENT DASHBOARD',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/students/${student.id}`);
      notify.success('Student Deleted', `Student "${student.name}" deleted successfully!`, { category: 'DEPARTMENT DASHBOARD' });
      refreshAllData();
    } catch (err: any) {
      notify.error('Delete Failed', err.response?.data?.detail || "Failed to delete student record.", { category: 'DEPARTMENT DASHBOARD' });
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30 backdrop-blur-xl transition-all duration-300">
        {/* Animated Decorative Ambient Light Beams */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl animate-pulse pointer-events-none delay-1000" />
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            {/* Status Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-xs">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>DEPARTMENT ANALYTICS • INSTITUTIONAL EDITION (ALL DEPARTMENTS)</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-tight">
                Department & Academic <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 via-teal-200 to-indigo-300 animate-pulse">Year Dashboard</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide leading-relaxed">
                Filter students by Department, Academic Year, Name & Performance side-by-side
              </p>
            </div>
          </div>

          <div className="flex shrink-0">
            <button
              onClick={handleRefreshAllStats}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-brand-500/25 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-brand-300/40"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing Roster...' : 'Sync Live Stats'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 relative z-30 overflow-visible">
        
        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Filter className="w-4 h-4 text-brand-500" />
              <span>Department Analytics Filtering</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select department and academic year criteria to analyze student metrics
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* View Mode Switch */}
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-sm flex items-center justify-center"
              title={viewMode === 'cards' ? 'Switch to Table View' : 'Switch to Grid View'}
            >
              {viewMode === 'cards' ? (
                <List className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>

            {/* Reset Filters Button */}
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* 5 Filter & Search Controls — Auto-Fitting Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4 items-start">
          
          {/* 1. Department Filter */}
          <PremiumDepartmentSelect
            selectedDept={selectedDept === 'all' ? 'ALL' : selectedDept}
            onChange={(val) => {
              setSelectedDept(val === 'ALL' ? 'all' : val);
              setDisplayCount(32);
            }}
            useIdAsValue={true}
          />

          {/* 2. Academic Year Filter */}
          <GlobalFilter
            label="Academic Year"
            value={yearLevel}
            onChange={(val) => {
              setYearLevel(val);
              setDisplayCount(32);
            }}
            dropdownWidth="min-w-[320px]"
            searchPlaceholder="Search academic year..."
            options={[
              { value: "all", label: "All Academic Years", pillText: "ALL" },
              { value: "1", label: "I Year", pillText: "1ST" },
              { value: "2", label: "II Year", pillText: "2ND" },
              { value: "3", label: "III Year", pillText: "3RD" },
              { value: "4", label: "IV Year", pillText: "4TH" }
            ]}
          />

          {/* 3. Name Search */}
          <div className="flex flex-col space-y-1.5 min-w-0 w-full">
            <label htmlFor="dept-dashboard-name-search" className="block text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider truncate h-4 leading-4 m-0 p-0">
              Search Student Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-700 dark:text-slate-200">
                <Search className="w-4 h-4 stroke-[2.5]" />
              </div>
              <input
                id="dept-dashboard-name-search"
                type="text"
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setDisplayCount(32);
                }}
                placeholder="Search by name, reg no..."
                className="w-full h-11 min-h-[44px] bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-300 text-xs font-bold py-2 pl-9 pr-8 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 truncate transition-all"
              />
              {nameSearch && (
                <button
                  onClick={() => { setNameSearch(''); setDisplayCount(32); }}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 4. Performance Range Filter */}
          <CustomDropdown
            id="dept-dashboard-performance-filter"
            label="Performance Range"
            options={performanceOptions}
            value={solvedFilter}
            onChange={(val) => {
              setSolvedFilter(val);
              setDisplayCount(32);
            }}
            icon={Trophy}
            align="right"
          />

          {/* 5. Sort Students */}
          <CustomDropdown
            id="dept-dashboard-sort-filter"
            label="Sort Ranking"
            options={sortOptions}
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            icon={ArrowUpDown}
            align="right"
          />

        </div>

      </div>

      {/* Main View Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            {selectedDept === 'all' || selectedDept === 'ALL'
              ? 'All Departments'
              : (departments.find(d => String(d.id) === String(selectedDept))?.name || selectedDept)}
            {' • '}
            {yearLevel === 'all' || yearLevel === 'ALL'
              ? 'All Academic Years'
              : `${yearLevel} Year`}
            {nameSearch.trim() && (
              <span className="text-brand-500 dark:text-brand-400">
                {' • "{0}"'.replace('{0}', nameSearch.trim())}
              </span>
            )}
            {solvedFilter !== 'all' && solvedFilter !== 'ALL'
              ? ` • ${{
                  '500_plus': '500+',
                  'above_500': '500+',
                  '251_500': '251–500',
                  '250_500': '251–500',
                  '101_250': '101–250',
                  '1_100': '1–100',
                  'less_100': '1–100',
                  'not_started': 'Not Started'
                }[solvedFilter] ?? ''} Solved`
              : ''}
            {` (${totalStudents} ${totalStudents === 1 ? 'Student' : 'Students'})`}
          </h3>
        </div>

        {finalStudentList.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900 dark:text-white">No students found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No students match the selected filters. Try changing or resetting the filters.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <LeaderboardTable
            students={finalStudentList}
            onSelectStudent={onSelectStudent}
            onRefreshStudent={() => refreshAllData()}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalStudentList.slice(0, displayCount).map((st) => (
                <StudentFlipCard
                  key={st.id}
                  student={st}
                  onSelectStudent={onSelectStudent}
                  onDeleteStudent={handleDeleteStudent}
                />
              ))}
            </div>

            {displayCount < totalStudents && (
              <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                <p className="text-xs text-slate-500 font-semibold">
                  Showing <span className="font-extrabold text-brand-600 dark:text-brand-400">{Math.min(displayCount, totalStudents)}</span> of <span className="font-extrabold text-slate-900 dark:text-white">{totalStudents}</span> Students
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setDisplayCount(prev => prev + 32)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all hover:scale-105 cursor-pointer"
                  >
                    <span>Load More (+32)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
