import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Users, Trophy, CheckCircle2, RefreshCw, LayoutGrid, List, ChevronDown, Building2, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';

import { CANONICAL_ROSTER } from '../data/canonicalRoster';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [yearLevel, setYearLevel] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [displayCount, setDisplayCount] = useState<number>(300);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [solvedFilter, setSolvedFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchDepartments();
    fetchStudents();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      if (res.data && res.data.length > 0) {
        setStudents(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshAllStats = async () => {
    setIsRefreshing(true);
    try {
      await api.post('/students/sync-all');
      await fetchStudents();
    } catch (err) {
      console.error("Manual sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Canonical Normalization & Matching Helpers ---
  const normalizeYear = (yrStr: string | undefined | null): string => {
    if (!yrStr) return '';
    const clean = yrStr.toString().trim().toUpperCase().replace(/YEAR/g, '').trim();
    if (clean === '2' || clean === '2ND' || clean === 'SECOND' || clean === 'II') return 'II';
    if (clean === '3' || clean === '3RD' || clean === 'THIRD' || clean === 'III') return 'III';
    if (clean === '4' || clean === '4TH' || clean === 'FOURTH' || clean === 'IV') return 'IV';
    return clean;
  };

  const matchesDepartment = (s: StudentData, dept: any): boolean => {
    if (!dept || dept.id === 'ALL' || dept.code === 'ALL') return true;

    // Direct ID match
    if (s.department_id && typeof dept.id === 'number' && s.department_id === dept.id) return true;
    if (s.department?.id && typeof dept.id === 'number' && s.department.id === dept.id) return true;

    // Code match
    const targetCode = (dept.code || '').toUpperCase();
    const studentCode = (s.department?.code || '').toUpperCase();
    if (targetCode && studentCode) {
      const cleanTarget = targetCode.replace(/[^A-Z0-9]/g, '');
      const cleanStudent = studentCode.replace(/[^A-Z0-9]/g, '');
      if (cleanTarget === cleanStudent) return true;
    }

    // Name keyword fallback
    const targetName = (dept.name || '').toLowerCase();
    const studentName = (s.department?.name || '').toLowerCase();

    const isTargetCyber = targetCode.includes('CS') || targetName.includes('cyber');
    const isStudentCyber = studentCode.includes('CS') || studentName.includes('cyber');
    if (isTargetCyber && isStudentCyber) return true;

    const isTargetIot = targetCode.includes('IOT') || targetName.includes('iot');
    const isStudentIot = studentCode.includes('IOT') || studentName.includes('iot');
    if (isTargetIot && isStudentIot) return true;

    return false;
  };

  const matchesYear = (s: StudentData, targetYear: string): boolean => {
    if (!targetYear || targetYear === 'ALL' || targetYear === 'ALL YEARS') return true;
    const sYear = normalizeYear(s.year_level);
    const tYear = normalizeYear(targetYear);
    return sYear === tYear;
  };

  // --- 1. Department + Academic Year Filtered Dataset ---
  const deptAndYearStudents = useMemo(() => {
    return students.filter(s => matchesDepartment(s, selectedDept) && matchesYear(s, yearLevel));
  }, [students, selectedDept, yearLevel]);

  // --- 2. Performance Range Counts (Derived STRICTLY from deptAndYearStudents) ---
  const performanceCounts = useMemo(() => {
    let above500 = 0;
    let between250And500 = 0;
    let between101And250 = 0;
    let under100 = 0;
    let notStarted = 0;

    for (const s of deptAndYearStudents) {
      const solved = s.stats?.total_solved ?? s.total_solved ?? 0;
      if (solved > 500) {
        above500++;
      } else if (solved >= 250) {
        between250And500++;
      } else if (solved >= 101) {
        between101And250++;
      } else if (solved > 0) {
        under100++;
      } else {
        notStarted++;
      }
    }

    return {
      total: deptAndYearStudents.length,
      above500,
      between250And500,
      between101And250,
      under100,
      notStarted
    };
  }, [deptAndYearStudents]);

  // --- 3. Performance Solved Filter Range (applied on deptAndYearStudents) ---
  const rangeFilteredStudents = useMemo(() => {
    switch (solvedFilter) {
      case 'above_500':
        return deptAndYearStudents.filter(s => (s.stats?.total_solved ?? s.total_solved ?? 0) > 500);
      case '250_500':
        return deptAndYearStudents.filter(s => { const v = s.stats?.total_solved ?? s.total_solved ?? 0; return v >= 250 && v <= 500; });
      case '101_250':
        return deptAndYearStudents.filter(s => { const v = s.stats?.total_solved ?? s.total_solved ?? 0; return v >= 101 && v <= 250; });
      case 'less_100':
        return deptAndYearStudents.filter(s => { const v = s.stats?.total_solved ?? s.total_solved ?? 0; return v > 0 && v <= 100; });
      case 'not_started':
        return deptAndYearStudents.filter(s => !s.stats || (s.stats?.total_solved ?? s.total_solved ?? 0) === 0);
      default:
        return deptAndYearStudents;
    }
  }, [deptAndYearStudents, solvedFilter]);

  // --- 4. Sorted Display List (Sorted AFTER filtering) ---
  const finalStudentList = useMemo(() => {
    const list = [...rangeFilteredStudents];
    return list.sort((a, b) => {
      const aSolved = a.stats?.total_solved ?? a.total_solved ?? 0;
      const bSolved = b.stats?.total_solved ?? b.total_solved ?? 0;
      const aRating = a.stats?.contest_rating ?? 0;
      const bRating = b.stats?.contest_rating ?? 0;
      const aConsistency = a.consistency_score ?? 0;
      const bConsistency = b.consistency_score ?? 0;

      if (sortBy === 'top_solved') return bSolved - aSolved;
      if (sortBy === 'top_rating') return bRating - aRating;
      if (sortBy === 'consistency') return bConsistency - aConsistency;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [rangeFilteredStudents, sortBy]);

  const handleDeleteStudent = async (student: StudentData) => {
    if (!confirm(`Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/students/${student.id}`);
      alert(`Student "${student.name}" deleted successfully!`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete student record.");
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
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 p-1.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Card Grid</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Roster Table</span>
              </button>
            </div>
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
      <div className="glass-card p-6 rounded-3xl border space-y-5">
        
        {/* Department selector */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Department Filter</label>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setSelectedDept(null)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                !selectedDept
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>All Departments (Cyber Security & IoT)</span>
            </button>

            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  selectedDept?.id === dept.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{dept.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Year Level selector */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Academic Year</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'All Years' },
              { id: 'II', label: 'II Year' },
              { id: 'III', label: 'III Year' },
              { id: 'IV', label: 'IV Year' }
            ].map((yr) => (
              <button
                key={yr.id}
                onClick={() => setYearLevel(yr.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  yearLevel === yr.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{yr.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Student Performance filter section */}
        <div className="pt-5 border-t border-gray-200 dark:border-gray-800 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Student Performance</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter and analyze students by coding activity and performance.</p>
          </div>

          {/* Performance Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Performance Range
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ALL',         label: 'All Students',   count: performanceCounts.total },
                { id: 'above_500',   label: '500+',           count: performanceCounts.above500 },
                { id: '250_500',     label: '250–500',        count: performanceCounts.between250And500 },
                { id: '101_250',     label: '101–250',        count: performanceCounts.between101And250 },
                { id: 'less_100',    label: '<100',           count: performanceCounts.under100 },
                { id: 'not_started', label: 'Not Started',     count: performanceCounts.notStarted },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSolvedFilter(f.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                    solvedFilter === f.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-gray-50 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    solvedFilter === f.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200/80 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sort Students */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Sort Students
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Sort by</span>
              <div className="relative inline-block">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-semibold py-2 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer shadow-sm"
                >
                  <option value="top_solved">Top Solvers</option>
                  <option value="low_solved">Low Solvers</option>
                  <option value="name_asc">Name A–Z</option>
                  <option value="name_desc">Name Z–A</option>
                  <option value="streak">Highest Streak</option>
                  <option value="rating">Highest Contest Rating</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Main View Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {selectedDept ? selectedDept.name : 'All Departments (Cyber Security & IoT)'} • {yearLevel === 'ALL' ? 'All Years' : `${yearLevel} Year`}{solvedFilter !== 'ALL' ? ` • ${({'above_500':'Above 500','250_500':'250–500','101_250':'101–250','less_100':'<100','not_started':'Not Started'}[solvedFilter] ?? '')} Solved` : ''} ({finalStudentList.length} Students)
          </h3>
        </div>

        {viewMode === 'table' ? (
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
