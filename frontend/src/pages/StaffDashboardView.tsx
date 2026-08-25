import React, { useState, useEffect } from 'react';
import {
  Users, AlertTriangle, RefreshCw, BarChart3, CheckCircle2, Search,
  ShieldCheck, Award, TrendingUp, TrendingDown, Minus, Eye, Bell,
  FileText, Clock, AlertCircle, ArrowRight, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { StaffMentoringDetailModal } from '../components/StaffMentoringDetailModal';

export const StaffDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [priorityStudents, setPriorityStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  useEffect(() => {
    fetchMentoringData();
  }, []);

  const fetchMentoringData = async () => {
    setLoading(true);
    try {
      const [sumRes, studRes, prioRes, alertRes] = await Promise.all([
        api.get('/faculty-assignments/my-mentoring-summary'),
        api.get('/faculty-assignments/my-students'),
        api.get('/faculty-assignments/priority-students'),
        api.get('/faculty-assignments/alerts')
      ]);

      const studentList = Array.isArray(studRes.data?.students)
        ? studRes.data.students
        : (Array.isArray(studRes.data) ? studRes.data : []);

      setMyStudents(studentList);
      setPriorityStudents(prioRes.data || []);
      setAlerts(alertRes.data || []);
    } catch (err) {
      console.error('Error fetching mentoring dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter ONLY inside assigned students set
  const filteredStudents = myStudents.filter((s: any) =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.reg_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">

      {/* Staff Mentoring Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-indigo-500/30">

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-400/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>MY MENTORING DASHBOARD</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Welcome, {user?.name || user?.username}</h1>
            <p className="text-xs text-gray-300">
              Restricted Portfolio • Monitoring Assigned Students & Mentoring Progress
            </p>
          </div>

          <button
            onClick={fetchMentoringData}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Portfolio</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">

        <div className="glass-card p-5 rounded-3xl border space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Assigned</span>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">
            {summary?.total_assigned || myStudents.length} / 30
          </h3>
          <p className="text-[10px] text-gray-500">Max Capacity: 30</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-emerald-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-emerald-500">
            {summary?.active_students || 0}
          </h3>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Active Solvers</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Completed</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-black text-indigo-500">
            {summary?.completed_students || 0}
          </h3>
          <p className="text-[10px] text-indigo-400">Target Achieved</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-amber-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Attention</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-amber-500">
            {summary?.needing_attention || 0}
          </h3>
          <p className="text-[10px] text-amber-600 font-bold">Needs Action</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-rose-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>At Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-rose-500">
            {summary?.at_risk || 0}
          </h3>
          <p className="text-[10px] text-rose-600 font-bold">Immediate Follow-Up</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Avg Progress</span>
            <BarChart3 className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">
            {summary?.weekly_progress_avg || 0}
          </h3>
          <p className="text-[10px] text-gray-500">Solved / Student</p>
        </div>

      </div>

      {/* POST-9:30 AM ACTIVITY NOTIFICATION BANNER FOR STAFF */}
      {summary?.post_930_solvers_count > 0 && (
        <div className="glass-card p-5 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-900/40 to-indigo-950/40 flex items-center justify-between flex-wrap gap-4 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center space-x-2">
                <span>🟠 Post-Session Activity Detected</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {summary.post_930_solvers_count} Students
                </span>
              </h4>
              <p className="text-xs text-gray-300">
                {summary.post_930_solvers_count} of your assigned students solved +{summary.post_930_total_solves} problems after 09:30 AM IST lock time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S PRIORITY SECTION */}
      {priorityStudents.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Today's Priority — ({priorityStudents.length} Students Need Attention)
              </h3>
            </div>
            <span className="text-xs text-amber-600 font-bold">Restricted to your assigned portfolio</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {priorityStudents.slice(0, 3).map((st: any) => (
              <div key={st.id} className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-amber-200 dark:border-amber-900/50 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-gray-900 dark:text-white">{st.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/30">
                    {st.status_label || 'Needs Attention'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono">Reg: {st.reg_no} • {st.department} ({st.year_level} Year)</p>
                <div className="space-y-1">
                  {st.priority_reasons?.map((r: string, idx: number) => (
                    <p key={idx} className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{r}</span>
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedStudent(st)}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1"
                >
                  <span>Inspect Student</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MY STUDENTS MAIN SECTION */}
      <div className="glass-card p-6 rounded-3xl border space-y-6 shadow-xl">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-500" />
              <span>My Assigned Students ({myStudents.length})</span>
            </h3>
            <p className="text-xs text-gray-500">
              Only students strictly assigned to your mentorship allocation are fetched.
            </p>
          </div>

          {/* Search inside assigned set strictly */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assigned students..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Assigned Students Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-navy-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-950 text-gray-400 font-black uppercase text-[10px] tracking-wider border-b">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">Dept / Class</th>
                <th className="px-4 py-3">LeetCode Handle</th>
                <th className="px-4 py-3">Total Solved</th>
                <th className="px-4 py-3">Contest Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 font-bold animate-pulse">
                    Loading your assigned students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                    {search ? "No student found in your assigned portfolio matching search." : "No students assigned to your portfolio yet."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st: any) => {
                  const solved = st.total_solved || 0;
                  const statusLabel = solved >= 100 ? 'Excellent' : (solved >= 30 ? 'Improving' : 'Needs Improvement');
                  const statusColor = statusLabel === 'Excellent' ? 'emerald' : 'amber';

                  return (
                    <tr key={st.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-850 transition-colors">
                      <td className="px-4 py-3.5 font-extrabold text-gray-900 dark:text-white">
                        {st.name}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-500">
                        {st.reg_no}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                        {st.department} ({st.year_level} - {st.section})
                      </td>
                      <td className="px-4 py-3.5 font-bold text-brand-600 dark:text-brand-400">
                        {st.username ? `@${st.username}` : 'Not Linked'}
                      </td>
                      <td className="px-4 py-3.5 font-black text-gray-900 dark:text-white">
                        {solved}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-amber-500">
                        {st.contest_rating ? Math.round(st.contest_rating) : 'N/A'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          statusLabel === 'Excellent'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelectedStudent(st)}
                          className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center space-x-1.5 transition-all text-[11px] shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Staff Mentoring Detail Modal */}
      {selectedStudent && (
        <StaffMentoringDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onRefresh={fetchMentoringData}
        />
      )}

    </div>
  );
};
