import React, { useState, useEffect } from 'react';
import { Layers, Users, Trophy, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';

interface DepartmentDashboardProps {
  onSelectStudent: (student: StudentData) => void;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ onSelectStudent }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [yearLevel, setYearLevel] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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
      await api.post('/students/refresh-all');
      setTimeout(async () => {
        await fetchFilteredStudents();
        setIsRefreshing(false);
      }, 4000);
    } catch (err) {
      console.error(err);
      setIsRefreshing(false);
    }
  };

  const getSortedStudents = () => {
    const sorted = [...students];
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

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Department & Academic Year View</h2>
          <p className="text-xs text-gray-500">Filter students by Department, Academic Year, Name & Performance</p>
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

      {/* Filter Tabs Bar */}
      <div className="glass-card p-6 rounded-3xl border space-y-5">
        
        {/* Department selector */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Department</label>
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

        {/* Sort & Order selector */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort & Order Students</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'top_solved', label: '🔥 Top Solvers (High to Low)' },
              { id: 'low_solved', label: '⚠️ Low Solvers (Needs Focus)' },
              { id: 'name_asc', label: '🔤 Name (A ➔ Z)' },
              { id: 'name_desc', label: '🔤 Name (Z ➔ A)' },
              { id: 'streak', label: '⚡ Highest Streak' },
              { id: 'rating', label: '⭐ Contest Rating' }
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

      {/* Leaderboard Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {selectedDept ? selectedDept.name : 'All Departments (Cyber Security & IoT)'} • {yearLevel === 'ALL' ? 'All Years' : `${yearLevel} Year`} ({students.length} Students)
          </h3>
        </div>

        <LeaderboardTable
          students={getSortedStudents()}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={() => fetchFilteredStudents()}
        />
      </div>

    </div>
  );
};
