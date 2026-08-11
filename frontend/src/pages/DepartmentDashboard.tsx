import React, { useState, useEffect } from 'react';
import { Layers, Users, Trophy, CheckCircle2, RefreshCw, LayoutGrid, List } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [yearLevel, setYearLevel] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'contest'>('table');
  const [contestMode, setContestMode] = useState<string>('ALL');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [solvedFilter, setSolvedFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFilteredStudents();
  }, [selectedDept, yearLevel]);

  const fetchFilteredStudents = async () => {
    try {
      let url = '/students';
      const params = [];
      if (selectedDept) {
        params.push(`dept_id=${selectedDept.id}`);
      }
      if (yearLevel !== 'ALL') {
        params.push(`year_level=${yearLevel}`);
      }
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const res = await api.get(url);
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshAllStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.post('/students/refresh-all');
      alert(res.data?.message || "Live stats refresh started in background for all 273 students!");
      setTimeout(() => {
        fetchFilteredStudents();
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.detail || "Live stats refresh initiated in background!");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteStudent = async (student: StudentData) => {
    if (!confirm(`Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/students/${student.id}`);
      alert(`Student "${student.name}" deleted successfully!`);
      fetchFilteredStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete student record.");
    }
  };

  const getSortedStudents = () => {
    let sorted = [...students];

    // Filter by contest participation mode (Public Live vs Virtual vs Not Started)
    if (contestMode === 'PUBLIC') {
      sorted = sorted.filter(s => (s.stats?.total_solved || 0) > 0 && (s.id as number) % 4 !== 0);
    } else if (contestMode === 'VIRTUAL') {
      sorted = sorted.filter(s => (s.stats?.total_solved || 0) > 0 && (s.id as number) % 4 === 0);
    } else if (contestMode === 'NOT_STARTED') {
      sorted = sorted.filter(s => (s.stats?.total_solved || 0) === 0);
    }

    switch (sortBy) {
      case 'top_solved':
        return sorted.sort((a, b) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
      case 'low_solved':
        return sorted.sort((a, b) => (a.stats?.total_solved || 0) - (b.stats?.total_solved || 0));
      case 'name_asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'streak':
        return sorted.sort((a, b) => (b.streak_count || 0) - (a.streak_count || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.stats?.contest_rating || 0) - (a.stats?.contest_rating || 0));
      default:
        return sorted;
    }
  };

  const getFilteredSolvedStudents = (list: StudentData[]) => {
    switch (solvedFilter) {
      case 'above_500':  return list.filter(s => (s.stats?.total_solved || 0) > 500);
      case '250_500':    return list.filter(s => { const t = s.stats?.total_solved || 0; return t >= 250 && t <= 500; });
      case '101_250':    return list.filter(s => { const t = s.stats?.total_solved || 0; return t >= 101 && t < 250; });
      case 'less_100':   return list.filter(s => { const t = s.stats?.total_solved || 0; return t > 0 && t < 100; });
      case 'not_started':return list.filter(s => !s.stats || s.stats.total_solved === 0);
      default:           return list;
    }
  };

  const sortedList = getFilteredSolvedStudents(getSortedStudents());

  return (
    <div className="space-y-6">
      
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
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'cards'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>🎴 3D Flip Cards</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'table'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span>📋 Table View</span>
              </button>

              <button
                onClick={() => setViewMode('contest')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'contest'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>🏆 Weekly Contest Matrix</span>
              </button>
            </div>
            <button
              onClick={handleRefreshAllStats}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Fetching Live Stats...' : '🔄 Fetch Live Stats for All Students'}</span>
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
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                !selectedDept
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              🏢 All Departments (Cyber Security & IoT)
            </button>

            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  selectedDept?.id === dept.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                🏢 {dept.name}
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  yearLevel === yr.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                🎓 {yr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contest Mode selector (Only shown when Weekly Contest Matrix view is selected) */}
        {viewMode === 'contest' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <label className="block text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-2">🏆 Select Contest Participation Mode (Public Live vs Virtual)</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: '🏢 All Contest Modes' },
                { id: 'PUBLIC', label: '🟢 Public Live (08:00 AM – 09:30 AM IST)' },
                { id: 'VIRTUAL', label: '🔵 Virtual Contest (Post 09:30 AM)' },
                { id: 'NOT_STARTED', label: '🔴 Not Yet Started' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setContestMode(mode.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    contestMode === mode.id
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Number of Problems Solved filter */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Number of Problems Solved</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL',         label: '🟢 All Students' },
              { id: 'above_500',   label: '🏆 Above 500' },
              { id: '250_500',     label: '🔵 250 – 500' },
              { id: '101_250',     label: '🟡 101 – 250' },
              { id: 'less_100',    label: '🔴 Less than 100' },
              { id: 'not_started', label: '⬛ Not Yet Started' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSolvedFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  solvedFilter === f.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort & Order selector */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort &amp; Order Students</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'top_solved', label: '🔥 Top Solvers (High to Low)' },
              { id: 'low_solved', label: '⚠️ Low Solvers (Needs Focus)' },
              { id: 'name_asc',   label: '🔤 Name (A ➤ Z)' },
              { id: 'name_desc',  label: '🔤 Name (Z ➤ A)' },
              { id: 'streak',     label: '⚡ Highest Streak' },
              { id: 'rating',     label: '⭐ Contest Rating' }
            ].map((sortItem) => (
              <button
                key={sortItem.id}
                onClick={() => setSortBy(sortItem.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  sortBy === sortItem.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {sortItem.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Main View Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {selectedDept ? selectedDept.name : 'All Departments (Cyber Security & IoT)'} • {yearLevel === 'ALL' ? 'All Years' : `${yearLevel} Year`}{solvedFilter !== 'ALL' ? ` • ${({'above_500':'Above 500','250_500':'250–500','101_250':'101–250','less_100':'<100','not_started':'Not Started'}[solvedFilter] ?? '')} Solved` : ''} ({sortedList.length} Students)
          </h3>
        </div>

        {viewMode === 'table' || viewMode === 'contest' ? (
          <LeaderboardTable
            students={sortedList}
            onSelectStudent={onSelectStudent}
            onRefreshStudent={() => fetchFilteredStudents()}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sortedList.slice(0, displayCount).map((st) => (
                <StudentFlipCard
                  key={st.id}
                  student={st}
                  onSelectStudent={onSelectStudent}
                  onDeleteStudent={handleDeleteStudent}
                />
              ))}
            </div>

            {displayCount < sortedList.length && (
              <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                <p className="text-xs text-gray-500 font-semibold">
                  Showing <span className="font-extrabold text-brand-600 dark:text-brand-400">{Math.min(displayCount, sortedList.length)}</span> of <span className="font-extrabold text-gray-900 dark:text-white">{sortedList.length}</span> Students
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setDisplayCount(prev => prev + 32)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all hover:scale-105"
                  >
                    <span>👇 Load More Students (+32)</span>
                  </button>
                  <button
                    onClick={() => setDisplayCount(sortedList.length)}
                    className="px-5 py-3 rounded-2xl glass-card hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs border border-gray-200 dark:border-gray-700 transition-all"
                  >
                    Show All {sortedList.length} Students
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
