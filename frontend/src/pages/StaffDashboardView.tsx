import React, { useState, useEffect } from 'react';
import {
  Users, Building2, Trophy, AlertTriangle, Download, RefreshCw, BarChart3,
  CheckCircle2, Search, Filter, ShieldCheck, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudentData } from '../components/LeaderboardTable';
import api from '../services/api';

export const StaffDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [deptAnalytics, setDeptAnalytics] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studRes, deptRes, qualRes] = await Promise.all([
        api.get('/students'),
        api.get('/analytics/department-comparison'),
        api.get('/analytics/data-quality')
      ]);

      const sorted = studRes.data.sort((a: StudentData, b: StudentData) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
      setStudents(sorted);
      setDeptAnalytics(deptRes.data);
      setDataQuality(qualRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalStudents = students.length;
  const activeStudents = students.filter(s => (s.weekly_progress || 0) > 0 || (s.stats?.total_solved || 0) > 0).length;
  const totalSolvedAll = students.reduce((acc, s) => acc + (s.stats?.total_solved || 0), 0);
  const avgSolvedAll = totalStudents > 0 ? Math.round(totalSolvedAll / totalStudents) : 0;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.reg_no.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      
      {/* Staff Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-indigo-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-400/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>FACULTY & STAFF MONITORING DASHBOARD</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Welcome, {user?.name}</h1>
            <p className="text-xs text-gray-300">
              Department Performance Monitoring & Student Progress Oversight
            </p>
          </div>

          <button
            onClick={fetchData}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Staff Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="glass-card p-6 rounded-3xl border space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Total Students</span>
            <Users className="w-5 h-5 text-brand-500" />
          </div>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white">{totalStudents}</h3>
          <p className="text-xs text-gray-500">Enrolled across departments</p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-emerald-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Active Participants</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-3xl font-black text-emerald-500">{activeStudents}</h3>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            {totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0}% Active Rate
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-amber-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Avg Solved / Student</span>
            <BarChart3 className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-3xl font-black text-amber-500">{avgSolvedAll}</h3>
          <p className="text-xs text-gray-500">Overall college average</p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-rose-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Stale / Unlinked Profiles</span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <h3 className="text-3xl font-black text-rose-500">
            {dataQuality?.missing_links || 0}
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">Requires Action</p>
        </div>

      </div>

      {/* Department Breakdown */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
        <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-indigo-500" />
          <span>Department Performance Summary</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deptAnalytics.map((dept) => (
            <div key={dept.department_id} className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-900 border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                  {dept.department_name} ({dept.department_code})
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-500/20 text-brand-600 dark:text-brand-300">
                  {dept.total_students} Students
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400 font-bold">Avg Solved</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{dept.avg_solved}</p>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400 font-bold">Participation</p>
                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400">{dept.participation_rate}%</p>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400 font-bold">Top Ranker</p>
                  <p className="text-xs font-black text-amber-500 truncate">{dept.top_student_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Leaderboard Search & Table */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Student Performance Master Table</span>
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-bold bg-white dark:bg-navy-900 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-extrabold">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Reg No</th>
                <th className="py-3 px-4">Dept / Year</th>
                <th className="py-3 px-4 text-center">Total Solved</th>
                <th className="py-3 px-4 text-center">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-bold">
              {filteredStudents.slice(0, 15).map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-navy-900">
                  <td className="py-3 px-4 font-black text-brand-600 dark:text-brand-400">#{s.college_rank || '—'}</td>
                  <td className="py-3 px-4 text-gray-900 dark:text-white">{s.name}</td>
                  <td className="py-3 px-4 font-mono text-gray-500">{s.reg_no}</td>
                  <td className="py-3 px-4 text-gray-500">{s.department?.code} • {s.year_level} Yr</td>
                  <td className="py-3 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{s.stats?.total_solved || 0}</td>
                  <td className="py-3 px-4 text-center font-black text-amber-500">{s.stats?.contest_rating ? Math.round(s.stats.contest_rating) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
