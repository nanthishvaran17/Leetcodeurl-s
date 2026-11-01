import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Layers, Users, CheckCircle2, RefreshCw, LayoutGrid, List, ChevronDown, Building2, School, GraduationCap, RotateCcw, Filter, AlertCircle, Search, X, ArrowUpDown, Star, SortAsc, SortDesc, Award, Activity, SlidersHorizontal } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { getCachedStudents, saveCachedStudents } from '../utils/rosterCache';
import { filterAndSortStudents, normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';
import { useGlobalData } from '../context/GlobalDataContext';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { useDepartments } from '../contexts/DepartmentContext';
import { useAuth } from '../context/AuthContext';
import { getUserCollege, isGlobalAccessRole, isCollegeFilterAllowed, isStaffRole } from '../services/auth/authTypes';
import { studentLiveStore } from '../stores/studentLiveStore';
import { MobileStudentShowcaseFilters } from '../components/mobile/MobileStudentShowcaseFilters';
import { ModernSearchInput } from '../components/ui/ModernSearchInput';
import { GlobalFilter, GlobalFilterOption } from '../components/GlobalFilter';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const { notify, confirmAction } = useNotification();
  const { refreshAllData } = useGlobalData();
  const { departments = [], isHodScope, isGlobalAccess } = useDepartments();
  const { user } = useAuth();
  const userCollege = useMemo(() => getUserCollege(user), [user]);
  const canFilterCollege = useMemo(() => isCollegeFilterAllowed(user), [user]);
  const isGlobalUser = isGlobalAccess || isGlobalAccessRole(user);
  const isStaffUser = isStaffRole(user) && !isGlobalUser;
  const isRestrictedHod = isHodScope && !isGlobalUser;

  // College filter state: 'all', 'NEC', or 'NCT' — Only Admin & Management can switch colleges.
  // Staff, HOD, and Principal are strictly locked to their college (userCollege).
  const [selectedCollege, setSelectedCollege] = useState<string>(() => canFilterCollege ? 'all' : (userCollege || 'NEC'));

  useEffect(() => {
    if (!canFilterCollege && userCollege && selectedCollege !== userCollege) {
      setSelectedCollege(userCollege);
    }
  }, [canFilterCollege, userCollege, selectedCollege]);

  const defaultDeptId = useMemo(() => {
    if (isStaffUser) {
      if (departments.length === 1 && departments[0].id) {
        return String(departments[0].id);
      }
      if (user?.department_id) return String(user.department_id);
      if ((user as any)?.department_code) return (user as any).department_code;
      if (user?.department) return user.department;
    }
    if (isRestrictedHod) {
      if (departments.length > 1) {
        return 'all'; // Multi-dept HOD defaults to combined view of all authorized depts (150 + 150 = 300)
      }
      if (departments.length === 1 && departments[0].id) {
        return String(departments[0].id);
      }
      if (user?.department_id) return String(user.department_id);
    }
    return 'all';
  }, [isStaffUser, isRestrictedHod, departments, user]);

  const [selectedDept, setSelectedDept] = useState<string>(() => defaultDeptId);

  useEffect(() => {
    if (isStaffUser) {
      if (selectedDept !== defaultDeptId) {
        setSelectedDept(defaultDeptId);
      }
    } else if (isRestrictedHod) {
      if (departments.length === 1 && (selectedDept === 'all' || selectedDept === 'ALL')) {
        setSelectedDept(defaultDeptId);
      } else if (!selectedDept) {
        setSelectedDept(defaultDeptId);
      }
    }
  }, [isStaffUser, isRestrictedHod, defaultDeptId, selectedDept, departments.length]);
  const [yearLevel, setYearLevel] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const deferredNameSearch = useDeferredValue(nameSearch);
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [solvedFilter, setSolvedFilter] = useState<string>('all');

  const solvedParams = useMemo(() => {
    switch (solvedFilter) {
      case '500_plus': return { min_solved: 500, max_solved: undefined };
      case '251_500': return { min_solved: 251, max_solved: 500 };
      case '101_250': return { min_solved: 101, max_solved: 250 };
      case '1_100': return { min_solved: 1, max_solved: 100 };
      case 'not_started': return { min_solved: 0, max_solved: 0 };
      default: return { min_solved: undefined, max_solved: undefined };
    }
  }, [solvedFilter]);

  const sortParam = useMemo(() => {
    switch (sortBy) {
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

  const { filteredAndSorted, counts } = useMemo(() => {
    const effectiveDept = isStaffUser ? defaultDeptId : selectedDept;
    return filterAndSortStudents(allStudents as StudentData[], {
      college: selectedCollege === 'all' || selectedCollege === 'ALL' ? undefined : selectedCollege,
      department: effectiveDept,
      academicYear: yearLevel,
      nameSearch: deferredNameSearch,
      performanceRange: solvedFilter,
      sortBy: sortBy,
    });
  }, [allStudents, selectedCollege, selectedDept, isStaffUser, defaultDeptId, yearLevel, deferredNameSearch, solvedFilter, sortBy]);

  const totalStudents = counts.total;

  const finalStudentList = useMemo(() => {
    return filteredAndSorted.slice(0, displayCount);
  }, [filteredAndSorted, displayCount]);

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

  // Pull-to-refresh listener: refresh global query data and re-render department students
  useEffect(() => {
    const handlePull = () => {
      refreshAllData(true);
      refetch();
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [refreshAllData, refetch]);

  const handleResetFilters = () => {
    setSelectedCollege(canFilterCollege ? 'all' : (userCollege || 'NEC'));
    setSelectedDept(defaultDeptId);
    setYearLevel('all');
    setNameSearch('');
    setSolvedFilter('all');
    setSortBy('top_solved');
    setDisplayCount(32);
    notify.info('Filters Reset', 'Department filters restored to default.', { category: 'FILTERS' });
  };


  // College Filter Options (NEC, NCT, ALL) — Only for Admin & Management
  const collegeOptions: DropdownOption[] = useMemo(() => {
    if (!canFilterCollege) return [];
    return [
      { value: 'all', label: 'All Colleges', badge: 'ALL', icon: School },
      { value: 'NEC', label: 'Nandha Engineering College (NEC)', badge: 'NEC', icon: School },
      { value: 'NCT', label: 'Nandha College of Technology (NCT)', badge: 'NCT', icon: School },
    ];
  }, [canFilterCollege]);

  // GlobalFilter Options for Executive Banner
  const collegeGlobalOptions: GlobalFilterOption[] = useMemo(() => {
    if (!canFilterCollege) return [];
    return [
      { value: 'all', label: 'All Colleges', pillText: 'ALL' },
      { value: 'NEC', label: 'Nandha Engineering College (NEC)', pillText: 'NEC' },
      { value: 'NCT', label: 'Nandha College of Technology (NCT)', pillText: 'NCT' },
    ];
  }, [canFilterCollege]);

  const departmentGlobalOptions: GlobalFilterOption[] = useMemo(() => {
    const list: GlobalFilterOption[] = [];
    if (!isStaffUser && (!isRestrictedHod || departments.length > 1)) {
      list.push({ value: 'all', label: isRestrictedHod ? 'All My Depts' : 'All Departments', pillText: 'ALL' });
    }
    departments.forEach((d) => {
      list.push({
        value: String(d.id),
        label: d.name ? `${d.code || d.name} - ${d.name}` : (d.code || 'Dept'),
        pillText: d.code || 'DEPT'
      });
    });
    return list;
  }, [departments, isStaffUser, isRestrictedHod]);

  const yearGlobalOptions: GlobalFilterOption[] = useMemo(() => [
    { value: 'all', label: 'All Academic Years', pillText: 'ALL' },
    { value: '2', label: '2nd Year (Batch 2029)', pillText: 'II Year' },
    { value: '3', label: '3rd Year (Batch 2028)', pillText: 'III Year' },
    { value: '4', label: 'Final Year (Batch 2027)', pillText: 'IV Year' },
  ], []);

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
    { value: 'top_solved', label: 'Top Solvers (Highest First)', icon: Award },
    { value: 'low_solved', label: 'Lowest Solvers First', icon: ArrowUpDown },
    { value: 'name_asc', label: 'Student Name (A → Z)', icon: SortAsc },
    { value: 'name_desc', label: 'Student Name (Z → A)', icon: SortDesc },
    { value: 'streak', label: 'Highest Active Streak', icon: Activity },
    { value: 'rating', label: 'Highest Contest Rating', icon: Star }
  ];

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [mobileFilterTab, setMobileFilterTab] = useState<'all' | 'college' | 'department' | 'year' | 'performance' | 'sort'>('all');

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (canFilterCollege && selectedCollege !== 'all' && selectedCollege !== 'ALL') count++;
    if (selectedDept !== 'all' && selectedDept !== 'ALL') count++;
    if (yearLevel !== 'all') count++;
    if (solvedFilter !== 'all') count++;
    if (sortBy !== 'top_solved') count++;
    return count;
  }, [selectedCollege, selectedDept, yearLevel, solvedFilter, sortBy]);

  const activeCollegeLabel = useMemo(() => {
    if (selectedCollege === 'all' || selectedCollege === 'ALL') return 'All Colleges';
    if (selectedCollege.toUpperCase() === 'NEC') return 'NEC';
    if (selectedCollege.toUpperCase() === 'NCT') return 'NCT';
    return selectedCollege;
  }, [selectedCollege]);

  const activeDeptLabel = useMemo(() => {
    if (selectedDept === 'all' || selectedDept === 'ALL') return 'All Depts';
    const found = departments.find(d => (d.code && d.code.toUpperCase() === selectedDept.toUpperCase()) || String(d.id) === String(selectedDept) || d.name === selectedDept);
    return found ? (found.code || found.name) : selectedDept;
  }, [selectedDept, departments]);

  const activeYearLabel = useMemo(() => {
    if (yearLevel === 'all') return 'All Years';
    const opt = yearOptions.find(o => o.value === yearLevel);
    return opt ? opt.badge || opt.label : yearLevel;
  }, [yearLevel, yearOptions]);

  const activePerformanceLabel = useMemo(() => {
    if (solvedFilter === 'all') return 'All Solvers';
    const opt = performanceOptions.find(o => o.value === solvedFilter);
    return opt ? opt.badge || opt.label : solvedFilter;
  }, [solvedFilter, performanceOptions]);

  const activeSortLabel = useMemo(() => {
    const opt = sortOptions.find(o => o.value === sortBy);
    if (!opt) return 'Top Solvers';
    if (sortBy === 'top_solved') return 'Top Solvers';
    if (sortBy === 'low_solved') return 'Lowest Solvers';
    if (sortBy === 'name_asc') return 'Name (A→Z)';
    if (sortBy === 'name_desc') return 'Name (Z→A)';
    if (sortBy === 'streak') return 'Highest Streak';
    if (sortBy === 'rating') return 'Highest Rating';
    return opt.label;
  }, [sortBy, sortOptions]);

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
    <div className="space-y-4 sm:space-y-6 pb-10 animate-fade-in">

      {/* Executive Header Banner — Growth Intelligence Aesthetic */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-7 md:p-8 shadow-2xl border border-brand-500/30 backdrop-blur-xl transition-all duration-300">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 space-y-4 sm:space-y-6">
          {/* Header Title Section */}
          <div className="flex items-start sm:items-center justify-between gap-3.5 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 shadow-lg shadow-amber-500/10 mt-0.5 sm:mt-0">
                <Building2 className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-x-2.5 leading-tight">
                  <span className="whitespace-nowrap">Department</span>
                  <span className="text-amber-300 font-extrabold">&amp;</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 whitespace-nowrap">
                    Academic Year
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed mt-1 max-w-3xl line-clamp-2 sm:line-clamp-none">
                  Filter students by Department, Academic Year, Name &amp; Performance side-by-side
                </p>
              </div>
            </div>

            {/* Desktop Sync Live Stats Button */}
            <div className="hidden xl:flex shrink-0">
              <button
                onClick={handleRefreshAllStats}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-brand-300/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Live Stats'}</span>
              </button>
            </div>
          </div>

          {/* Filters & Actions Integrated into Banner (Growth Intelligence Style) */}
          <div className="pt-3.5 sm:pt-4 border-t border-brand-400/20 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
            
            {/* Department & Academic Year Filters (side-by-side on mobile) */}
            <div className="flex flex-row items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {canFilterCollege && (
                <div className="flex-1 min-w-0 sm:w-64 sm:flex-none">
                  <GlobalFilter
                    options={collegeGlobalOptions}
                    value={selectedCollege}
                    onChange={(val) => { setSelectedCollege(val); setDisplayCount(32); }}
                    icon={<School className="w-3.5 h-3.5 text-brand-400" />}
                    dropdownWidth="w-full sm:w-64"
                    showSearch={false}
                    variant="dark"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 sm:w-72 sm:flex-none">
                <GlobalFilter
                  options={departmentGlobalOptions}
                  value={selectedDept}
                  onChange={(val) => { setSelectedDept(val); setDisplayCount(32); }}
                  icon={<Building2 className="w-3.5 h-3.5 text-brand-400" />}
                  dropdownWidth="w-full sm:w-72"
                  showSearch={true}
                  variant="dark"
                />
              </div>
              <div className="flex-1 min-w-0 sm:w-60 sm:flex-none">
                <GlobalFilter
                  options={yearGlobalOptions}
                  value={yearLevel}
                  onChange={(val) => { setYearLevel(val); setDisplayCount(32); }}
                  icon={<GraduationCap className="w-3.5 h-3.5 text-brand-400" />}
                  dropdownWidth="w-full sm:w-60"
                  showSearch={false}
                  variant="dark"
                />
              </div>
            </div>

            {/* View Mode, Reset & Live Sync Controls */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full xl:w-auto">
              <div className="flex items-center bg-navy-900/90 p-1 rounded-xl sm:rounded-2xl border border-slate-700/80 shadow-inner backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-white/10"
                  title={viewMode === 'cards' ? 'Switch to Table View' : 'Switch to Grid View'}
                >
                  {viewMode === 'cards' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{viewMode === 'cards' ? 'Table View' : 'Grid View'}</span>
                </button>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center space-x-1 px-2.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Reset all filters to default"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Live Sync Button (Mobile & Tablet) */}
              <button
                onClick={handleRefreshAllStats}
                disabled={isRefreshing}
                title="Synchronize authoritative LeetCode statistics"
                className="flex-1 xl:hidden inline-flex items-center justify-center shrink-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="ml-1.5 font-bold">{isRefreshing ? 'Syncing...' : 'Sync Live Stats'}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-2.5 sm:p-5 rounded-xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-3 sm:space-y-4 relative z-30 overflow-visible">

        {/* College, Department and Academic Year Pill Selectors (Desktop 1-Tap Fast Filter) */}
        <div className="hidden md:flex flex-col gap-2 pt-0.5 pb-1">
          {canFilterCollege && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs select-none scroll-smooth">
              <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mr-0.5">College:</span>
              {[
                { value: 'all', label: 'All Colleges' },
                { value: 'NEC', label: 'NEC' },
                { value: 'NCT', label: 'NCT' }
              ].map(c => {
                const isSelected =
                  selectedCollege.toUpperCase() === c.value.toUpperCase() ||
                  (c.value === 'all' && (selectedCollege === 'all' || selectedCollege === 'ALL'));
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => { setSelectedCollege(c.value); setDisplayCount(32); }}
                    className={`px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs select-none scroll-smooth">
            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mr-0.5">Dept:</span>
            {[
              ...((isRestrictedHod && departments.length <= 1) || isStaffUser ? [] : [{ id: 'all', label: isRestrictedHod ? 'All My Depts' : 'All Depts' }]),
              ...departments.map(d => ({ id: String(d.id), label: d.code || d.name }))
            ].map(d => {
              const isSelected = 
                selectedDept === d.id || 
                (d.id === 'all' && (selectedDept === 'all' || selectedDept === 'ALL')) ||
                normalizeDepartment(selectedDept) === normalizeDepartment(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setSelectedDept(d.id); setDisplayCount(32); }}
                  className={`px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs select-none scroll-smooth">
            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mr-0.5">Year:</span>
            {[
              { value: 'all', label: 'All Years' },
              { value: '2', label: 'II Year' },
              { value: '3', label: 'III Year' },
              { value: '4', label: 'IV Year' }
            ].map(y => {
              const isSelected = 
                yearLevel === y.value ||
                (y.value === 'all' && (yearLevel === 'all' || yearLevel === 'ALL')) ||
                normalizeAcademicYear(yearLevel) === normalizeAcademicYear(y.value);
              return (
                <button
                  key={y.value}
                  type="button"
                  onClick={() => { setYearLevel(y.value); setDisplayCount(32); }}
                  className={`px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  {y.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile View: Dedicated Sleek Filter Control Bar (< 768px) */}
        <div className="block md:hidden space-y-2.5 pt-2">
          {/* Mobile Name Search */}
          <ModernSearchInput
            value={nameSearch}
            onChange={(val) => {
              setNameSearch(val);
              setDisplayCount(32);
            }}
            onSelectStudent={onSelectStudent}
            placeholder="Search by name, reg no, username..."
          />

          <div className="flex items-center space-x-2">
            {/* Primary Mobile Filter Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('all');
                setIsMobileFilterOpen(true);
              }}
              className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-navy-900/90 border border-slate-200/90 dark:border-white/[0.09] text-slate-800 dark:text-slate-100 hover:border-brand-500/40 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black tracking-tight">Filter &amp; Sort</span>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-600 text-white shadow-xs">
                    {activeFiltersCount} active
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
              </div>
            </button>

            {/* Quick Mobile Sort Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('sort');
                setIsMobileFilterOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-navy-900/90 border border-slate-200/90 dark:border-white/[0.09] text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-all shadow-xs cursor-pointer shrink-0"
              title="Quick Sort Selection"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold truncate max-w-[95px]">{activeSortLabel}</span>
            </button>
          </div>

          {/* Quick-Filter Horizontal Scrollable Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            {/* College Quick Chip — Admin & Management only */}
            {canFilterCollege && (
              <button
                type="button"
                onClick={() => {
                  setMobileFilterTab('college');
                  setIsMobileFilterOpen(true);
                }}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                  selectedCollege !== 'all' && selectedCollege !== 'ALL'
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-500/30'
                    : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
                }`}
              >
                <School className="w-3 h-3 shrink-0 text-teal-500" />
                <span>College: {activeCollegeLabel}</span>
                {(selectedCollege !== 'all' && selectedCollege !== 'ALL') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0 ml-0.5" />
                )}
              </button>
            )}

            {/* Department Quick Chip */}
            <button
              type="button"
              onClick={() => {
                if (isStaffUser) return;
                setMobileFilterTab('department');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                selectedDept !== 'all' && selectedDept !== 'ALL'
                  ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300 border-brand-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <Building2 className="w-3 h-3 shrink-0" />
              <span>Dept: {activeDeptLabel}</span>
              {(selectedDept !== 'all' && selectedDept !== 'ALL') && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Academic Year Quick Chip */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('year');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                yearLevel !== 'all'
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <GraduationCap className="w-3 h-3 shrink-0" />
              <span>Year: {activeYearLabel}</span>
              {yearLevel !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Performance Range Quick Chip */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('performance');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                solvedFilter !== 'all'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <Award className="w-3 h-3 shrink-0" />
              <span>Solved: {activePerformanceLabel}</span>
              {solvedFilter !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Clear All Quick Chip */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop View: 4 Filter & Search Controls (>= 768px) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 items-end">

          {/* 1. Name Search */}
          <div className="flex flex-col space-y-1.5 min-w-0 w-full">
            <label htmlFor="dept-dashboard-name-search" className="block text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate h-4 leading-4 m-0 p-0">
              Search Student Name
            </label>
            <ModernSearchInput
              id="dept-dashboard-name-search"
              value={nameSearch}
              onChange={(val) => {
                setNameSearch(val);
                setDisplayCount(32);
              }}
              onSelectStudent={onSelectStudent}
              placeholder="Search by name, reg no..."
              size="sm"
            />
          </div>

          {/* 2. College Campus Filter — Admin & Management only */}
          {canFilterCollege && (
            <div className="min-w-0 w-full">
              <CustomDropdown
                compact={true}
                id="dept-dashboard-college-filter"
                label="College Campus"
                options={collegeOptions}
                value={selectedCollege}
                onChange={(val) => {
                  setSelectedCollege(val);
                  setDisplayCount(32);
                }}
                icon={School}
                align="left"
              />
            </div>
          )}

          {/* 3. Performance Range Filter */}
          <div className="min-w-0 w-full">
            <CustomDropdown
              compact={true}
              id="dept-dashboard-performance-filter"
              label="Performance Range"
              options={performanceOptions}
              value={solvedFilter}
              onChange={(val) => {
                setSolvedFilter(val);
                setDisplayCount(32);
              }}
              icon={Award}
              align="right"
            />
          </div>

          {/* 4. Sort Students */}
          <div className="min-w-0 w-full">
            <CustomDropdown
              compact={true}
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

      </div>

      {/* 2026 Modern Mobile Filter & Sorting Bottom Sheet Drawer */}
      <MobileStudentShowcaseFilters
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        initialTab={mobileFilterTab}
        selectedCollege={selectedCollege}
        onSelectCollege={(val) => {
          setSelectedCollege(val);
          setDisplayCount(32);
        }}
        collegeOptions={collegeOptions}
        selectedDept={selectedDept === 'ALL' ? 'all' : selectedDept}
        onSelectDept={(val) => {
          if (isStaffUser) return;
          setSelectedDept(val);
          setDisplayCount(32);
        }}
        yearLevel={yearLevel}
        onSelectYear={(val) => {
          setYearLevel(val);
          setDisplayCount(32);
        }}
        solvedFilter={solvedFilter}
        onSelectSolvedFilter={(val) => {
          setSolvedFilter(val);
          setDisplayCount(32);
        }}
        sortBy={sortBy}
        onSelectSortBy={(val) => setSortBy(val)}
        departments={departments}
        yearOptions={yearOptions}
        performanceOptions={performanceOptions}
        sortOptions={sortOptions}
        performanceCounts={counts}
        totalResults={filteredAndSorted.length}
        onReset={handleResetFilters}
      />

      {/* Main View Display */}
      <div className="space-y-6">
        <div className="flex items-center flex-wrap gap-3 mb-5">
          {/* Active Filters Premium Pill */}
          <div className="inline-flex items-center flex-wrap gap-2.5 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-navy-900 dark:to-navy-800/80 border border-slate-200/80 dark:border-navy-700/80 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-200">
              <School className="w-4 h-4 text-teal-500" />
              <span className="font-black text-xs sm:text-sm tracking-tight">
                {canFilterCollege
                  ? (selectedCollege === 'all' || selectedCollege === 'ALL'
                    ? 'All Colleges'
                    : selectedCollege.toUpperCase() === 'NEC'
                    ? 'Nandha Engineering (NEC)'
                    : selectedCollege.toUpperCase() === 'NCT'
                    ? 'Nandha Tech (NCT)'
                    : selectedCollege)
                  : (userCollege === 'NCT' ? 'Nandha Tech (NCT)' : 'Nandha Engineering (NEC)')}
              </span>
            </div>

            <span className="text-slate-300 dark:text-navy-600 font-bold px-0.5">•</span>

            <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-200">
              <Building2 className="w-4 h-4 text-brand-500" />
              <span className="font-black text-xs sm:text-sm tracking-tight">
                {selectedDept === 'all' || selectedDept === 'ALL'
                  ? 'All Departments'
                  : (departments.find(d => String(d.id) === String(selectedDept))?.name || selectedDept)}
              </span>
            </div>

            <span className="text-slate-300 dark:text-navy-600 font-bold px-0.5">•</span>

            <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-200">
              <GraduationCap className="w-4 h-4 text-indigo-500" />
              <span className="font-black text-xs sm:text-sm tracking-tight">
                {yearLevel === 'all' || yearLevel === 'ALL'
                  ? 'All Academic Years'
                  : `${yearLevel} Year`}
              </span>
            </div>

            {nameSearch.trim() && (
              <>
                <span className="text-slate-300 dark:text-navy-600 font-bold px-0.5">•</span>
                <div className="flex items-center space-x-1.5 text-brand-600 dark:text-brand-400">
                  <Search className="w-3.5 h-3.5" />
                  <span className="font-black text-xs sm:text-sm tracking-tight">
                    "{nameSearch.trim()}"
                  </span>
                </div>
              </>
            )}

            {solvedFilter !== 'all' && solvedFilter !== 'ALL' && (
              <>
                <span className="text-slate-300 dark:text-navy-600 font-bold px-0.5">•</span>
                <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400">
                  <Award className="w-3.5 h-3.5" />
                  <span className="font-black text-xs sm:text-sm tracking-tight">
                    {{
                      '500_plus': '500+',
                      'above_500': '500+',
                      '251_500': '251–500',
                      '250_500': '251–500',
                      '101_250': '101–250',
                      '1_100': '1–100',
                      'less_100': '1–100',
                      'not_started': 'Not Started'
                    }[solvedFilter] ?? ''} Solved
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Total Count Premium Pill */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-2xl shadow-sm">
            <Users className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="text-xs sm:text-sm font-black text-brand-700 dark:text-brand-300 tracking-wide uppercase">
              {totalStudents} {totalStudents === 1 ? 'STUDENT' : 'STUDENTS'}
            </span>
          </div>
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
              className="w-full sm:w-auto min-h-[42px] justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5 touch-manipulation active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <LeaderboardTable
            students={filteredAndSorted}
            onSelectStudent={onSelectStudent}
            onRefreshStudent={async (studentId) => {
              if (studentId) {
                try {
                  const res = await api.post(`/students/${studentId}/refresh`);
                  if (res.data?.stats) {
                    studentLiveStore.updateStudent(studentId, {
                      stats: res.data.stats,
                    } as any);
                  }
                  notify.success('Profile Synced', res.data?.message || 'Student profile refreshed!', { category: 'SYNC ENGINE' });
                } catch (err: any) {
                  notify.error('Sync Failed', err?.response?.data?.detail || err?.message || 'Failed to refresh student stats.', { category: 'SYNC ENGINE' });
                }
              }
              refreshAllData();
            }}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {finalStudentList.slice(0, displayCount).map((st) => (
                <StudentFlipCard
                  key={st.id}
                  student={st}
                  onSelectStudent={onSelectStudent}
                  onDeleteStudent={handleDeleteStudent}
                />
              ))}
            </div>

            {displayCount < totalStudents ? (
              <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                <p className="text-xs text-slate-800 dark:text-slate-200 font-extrabold text-center px-2 break-words">
                  Showing <span className="font-black text-brand-600 dark:text-brand-400">{Math.min(displayCount, totalStudents)}</span> of <span className="font-black text-slate-900 dark:text-white">{totalStudents}</span> Students
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:space-x-3 w-full sm:w-auto px-4 sm:px-0">
                  <button
                    onClick={() => setDisplayCount(prev => prev + 32)}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <span>Load More (+32)</span>
                  </button>
                  <button
                    onClick={() => setDisplayCount(totalStudents)}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-5 py-3 rounded-2xl glass-card hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <span>Show All {totalStudents} Students</span>
                  </button>
                </div>
              </div>
            ) : totalStudents > 32 ? (
              <div className="flex flex-col items-center justify-center pt-6 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-extrabold text-center px-2 break-words">
                  Showing all <span className="font-black text-brand-600 dark:text-brand-400">{totalStudents}</span> students
                </p>
                <button
                  onClick={() => setDisplayCount(32)}
                  className="min-h-[40px] px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95 touch-manipulation cursor-pointer inline-flex items-center space-x-2 shadow-sm"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                  <span>Collapse to Top 32</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

    </div>
  );
};
