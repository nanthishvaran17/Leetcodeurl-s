import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Users, Trophy, CheckCircle2, RefreshCw, LayoutGrid, List, ChevronDown, Building2, GraduationCap, RotateCcw, Filter, AlertCircle, Search, X } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { CANONICAL_ROSTER } from '../data/canonicalRoster';
import { filterAndSortStudents } from '../utils/filterUtils';
import { useNotification } from '../context/NotificationContext';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const { notify, confirmAction } = useNotification();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [yearLevel, setYearLevel] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [solvedFilter, setSolvedFilter] = useState<string>('all');

  useEffect(() => {
    fetchDepartments();
    fetchStudents();
  }, []);

  const DEFAULT_DEPARTMENTS = [
    { id: 5, name: 'Computer Science and Engineering', code: 'CSE' },
    { id: 1, name: 'Computer Science and Engineering (Cyber Security)', code: 'CSE(CS)' },
    { id: 2, name: 'Computer Science and Engineering (IoT)', code: 'CSE(IOT)' },
    { id: 10, name: 'Information Technology', code: 'IT' },
    { id: 14, name: 'Artificial Intelligence and Data Science', code: 'AIDS' },
    { id: 20, name: 'Artificial Intelligence and Machine Learning', code: 'AIML' },
    { id: 8, name: 'Electronics and Communication Engineering', code: 'ECE' },
    { id: 11, name: 'Electrical and Electronics Engineering', code: 'EEE' },
    { id: 17, name: 'Agricultural Engineering', code: 'AGRI' },
    { id: 12, name: 'Mechanical Engineering', code: 'MECH' },
    { id: 13, name: 'Civil Engineering', code: 'CIVIL' },
    { id: 16, name: 'Biomedical Engineering', code: 'BME' }
  ];

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data) && res.data.length >= 2) {
        setDepartments(res.data);
      } else {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    } catch (err) {
      console.warn("Using default department fallback list:", err);
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students/leaderboard-fast');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setStudents(res.data);
      } else {
        const res2 = await api.get('/students');
        if (res2.data && Array.isArray(res2.data)) {
          setStudents(res2.data);
        }
      }
    } catch (err) {
      console.error("fetchStudents error:", err);
    }
  };

  const handleRefreshAllStats = async () => {
    setIsRefreshing(true);
    notify.info('Syncing Department Roster', 'Fetching fresh LeetCode statistics for department students...', { category: 'DEPARTMENT SYNC' });
    try {
      await api.post('/sync/start?triggered_by=department_dashboard');
      await fetchStudents();
      notify.success('Sync Completed', 'Department roster statistics updated.', { category: 'DEPARTMENT SYNC' });
    } catch (err) {
      console.error("Refresh all error", err);
      notify.error('Sync Error', 'Failed to trigger roster sync.', { category: 'DEPARTMENT SYNC' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Combined Canonical Filter Pipeline: Dept + Academic Year + Name Search + Performance Range + Sort ---
  const { filteredAndSorted: finalStudentList, counts: performanceCounts } = useMemo(() => {
    return filterAndSortStudents(students, {
      department: selectedDept,
      academicYear: yearLevel,
      nameSearch,
      performanceRange: solvedFilter,
      sortBy
    });
  }, [students, selectedDept, yearLevel, nameSearch, solvedFilter, sortBy]);

  const handleResetFilters = () => {
    setSelectedDept('all');
    setYearLevel('all');
    setNameSearch('');
    setSolvedFilter('all');
    setSortBy('top_solved');
    setDisplayCount(32);
    notify.info('Filters Reset', 'Department filters restored to default.', { category: 'FILTERS' });
  };

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
      fetchStudents();
    } catch (err: any) {
      notify.error('Delete Failed', err.response?.data?.detail || "Failed to delete student record.", { category: 'DEPARTMENT DASHBOARD' });
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>DEPARTMENT ANALYTICS • CYBER SECURITY & IOT COHORTS</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Department & Academic <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Year Dashboard</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Filter students by Department, Academic Year, Name & Performance side-by-side
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefreshAllStats}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing Roster...' : 'Sync Live Stats'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-6">
        
        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Filter className="w-4 h-4 text-brand-500" />
              <span>Department Cohort Filtering</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filter students by Department, Academic Year, and LeetCode Problem Solved Range
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* View Mode Switch */}
            <div className="flex items-center space-x-1 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card Grid</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Roster Table</span>
              </button>
            </div>

            {/* Reset Filters Button */}
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer shadow-sm"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* 5 Filter & Search Controls — Auto-Fitting Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
          
          {/* 1. Department Filter */}
          <div className="space-y-1.5">
            <label htmlFor="dept-dashboard-department-filter" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Select Department Filter
            </label>
            <div className="relative">
              <select
                id="dept-dashboard-department-filter"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-3 pl-3.5 pr-9 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id || dept.code} value={dept.code || String(dept.id)}>
                    {dept.code ? `${dept.code} — ${dept.name}` : dept.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 2. Academic Year Filter */}
          <div className="space-y-1.5">
            <label htmlFor="dept-dashboard-year-filter" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Select Academic Year
            </label>
            <div className="relative">
              <select
                id="dept-dashboard-year-filter"
                value={yearLevel}
                onChange={(e) => {
                  setYearLevel(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-3 pl-3.5 pr-9 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
              >
                <option value="all">All Academic Years</option>
                <option value="I">I Year</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 3. Name Search */}
          <div className="space-y-1.5">
            <label htmlFor="dept-dashboard-name-search" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Search Student Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                id="dept-dashboard-name-search"
                type="text"
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setDisplayCount(32);
                }}
                placeholder="Search by name, reg no, handle..."
                className="w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-3 pl-9 pr-9 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              {nameSearch && (
                <button
                  onClick={() => { setNameSearch(''); setDisplayCount(32); }}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 4. Performance Range Filter */}
          <div className="space-y-1.5">
            <label htmlFor="dept-dashboard-performance-filter" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Performance Range
            </label>
            <div className="relative">
              <select
                id="dept-dashboard-performance-filter"
                value={solvedFilter}
                onChange={(e) => {
                  setSolvedFilter(e.target.value);
                  setDisplayCount(32);
                }}
                className="w-full appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-3 pl-3.5 pr-9 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
              >
                <option value="all">All Students ({performanceCounts.total})</option>
                <option value="500_plus">500+ ({performanceCounts.above500})</option>
                <option value="251_500">251–500 ({performanceCounts.between251And500})</option>
                <option value="101_250">101–250 ({performanceCounts.between101And250})</option>
                <option value="1_100">1–100 ({performanceCounts.between1And100})</option>
                <option value="not_started">Not Started ({performanceCounts.notStarted})</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 5. Sort Students */}
          <div className="space-y-1.5">
            <label htmlFor="dept-dashboard-sort-filter" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Sort Students
            </label>
            <div className="relative">
              <select
                id="dept-dashboard-sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold py-3 pl-3.5 pr-9 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
              >
                <option value="top_solved">Top Solvers</option>
                <option value="low_solved">Low Solvers</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="streak">Highest Streak</option>
                <option value="rating">Highest Contest Rating</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Main View Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {selectedDept === 'all' || selectedDept === 'ALL'
              ? 'All Departments'
              : (departments.find(d => String(d.id) === String(selectedDept) || d.code === selectedDept)?.name || selectedDept)}
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
            {` (${finalStudentList.length} Students)`}
          </h3>
        </div>

        {finalStudentList.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-gray-900 dark:text-white">No students found</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
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
            onRefreshStudent={() => fetchStudents()}
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

            {displayCount < finalStudentList.length && (
              <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                <p className="text-xs text-gray-500 font-semibold">
                  Showing <span className="font-extrabold text-brand-600 dark:text-brand-400">{Math.min(displayCount, finalStudentList.length)}</span> of <span className="font-extrabold text-gray-900 dark:text-white">{finalStudentList.length}</span> Students
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setDisplayCount(prev => prev + 32)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all hover:scale-105 cursor-pointer"
                  >
                    <span>Load More (+32)</span>
                  </button>
                  <button
                    onClick={() => setDisplayCount(finalStudentList.length)}
                    className="px-5 py-3 rounded-2xl glass-card hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                  >
                    Show All {finalStudentList.length} Students
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
