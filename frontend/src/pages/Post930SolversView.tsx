import React, { useState, useEffect } from 'react';
import {
  Clock, Download, RefreshCw, Search, Users, AlertCircle,
  ExternalLink, Eye, ArrowUpDown, ChevronRight, X, ShieldAlert, CheckCircle2
} from 'lucide-react';
import api from '../services/api';

export const Post930SolversView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState<string>('');
  const [minSolves, setMinSolves] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>('latest');
  const [dept, setDept] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<string>('');
  const [section, setSection] = useState<string>('');

  // Selected student evidence modal state
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  useEffect(() => {
    fetchPost930Solvers();
  }, [minSolves, sortBy, dept, yearLevel, section]);

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

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (minSolves) params.append('min_post_window_solves', minSolves.toString());
    if (dept) params.append('dept', dept);
    if (yearLevel) params.append('year_level', yearLevel);
    if (section) params.append('section', section);

    const exportUrl = `${api.defaults.baseURL}/contests/post-930-solvers/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
  };

  const studentsList = data?.students || [];
  const filteredStudents = studentsList.filter((s: any) =>
    (s.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.register_number || s.reg_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(search.toLowerCase())
  );

  const summary = data?.summary || {
    students_detected: 0,
    total_post_solves: 0,
    total_post_submissions: 0,
    earliest_activity: 'None',
    latest_activity: 'None'
  };

  return (
    <div className="space-y-8 py-2 animate-fade-in">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-amber-500/30">

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-400/30">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>POST-09:30 AM IST ACTIVITY ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Post-9:30 AM Solvers Report</h1>
            <p className="text-xs text-gray-300">
              Verified problem submissions timestamped after official Sunday Contest snapshot lock. Official contest scores remain 100% immutable.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-lg flex items-center space-x-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={fetchPost930Solvers}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Grid — 5 Headline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-amber-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
            Students Detected
          </span>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {summary.students_detected}
          </p>
          <p className="text-[10px] text-gray-400">Verified post-window solvers</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
            Post-9:30 Problems
          </span>
          <p className="text-3xl font-black text-indigo-500">
            +{summary.total_post_solves}
          </p>
          <p className="text-[10px] text-gray-400">Deduplicated problem solves</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-purple-500/30 space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">
            Post-9:30 Submissions
          </span>
          <p className="text-3xl font-black text-purple-500">
            {summary.total_post_submissions || summary.total_post_solves}
          </p>
          <p className="text-[10px] text-gray-400">Total submission attempts</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
            Earliest Activity
          </span>
          <p className="text-xl font-black text-gray-900 dark:text-white">
            {summary.earliest_activity}
          </p>
          <p className="text-[10px] text-gray-400">First qualifying solve</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border space-y-1.5 shadow-lg">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
            Latest Activity
          </span>
          <p className="text-xl font-black text-gray-900 dark:text-white">
            {summary.latest_activity}
          </p>
          <p className="text-[10px] text-gray-400">Most recent solve</p>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="glass-card p-5 rounded-3xl border space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, reg no, username..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center space-x-3 flex-wrap gap-2 text-xs font-bold">
            <select
              value={minSolves}
              onChange={(e) => setMinSolves(Number(e.target.value))}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900"
            >
              <option value={1}>1+ Post-9:30 Solves</option>
              <option value={2}>2+ Post-9:30 Solves</option>
              <option value={3}>3+ Post-9:30 Solves</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900"
            >
              <option value="latest">Sort: Latest Activity</option>
              <option value="highest">Sort: Highest Solves Count</option>
              <option value="earliest">Sort: Earliest Activity</option>
              <option value="name">Sort: Student Name A-Z</option>
            </select>

            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900"
            >
              <option value="">All Depts</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="AIDS">AIDS</option>
              <option value="AIML">AIML</option>
            </select>

            <select
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900"
            >
              <option value="">All Years</option>
              <option value="II">II Year</option>
              <option value="III">III Year</option>
              <option value="IV">IV Year</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Solvers Table */}
      <div className="glass-card rounded-3xl border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-950 text-gray-400 font-black uppercase text-[10px] tracking-wider border-b">
              <tr>
                <th className="px-4 py-3.5">Student Name</th>
                <th className="px-4 py-3.5">Reg No</th>
                <th className="px-4 py-3.5">Dept / Class</th>
                <th className="px-4 py-3.5 text-right">Official 09:30 Solved</th>
                <th className="px-4 py-3.5 text-right">Post-9:30 Solves</th>
                <th className="px-4 py-3.5 text-right">Submissions</th>
                <th className="px-4 py-3.5 text-right">Current Total</th>
                <th className="px-4 py-3.5">First Activity</th>
                <th className="px-4 py-3.5">Latest Activity</th>
                <th className="px-4 py-3.5">Evidence Status</th>
                <th className="px-4 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-gray-400 font-bold animate-pulse">
                    Detecting post-9:30 AM solvers & verifying submission timestamps...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-rose-500 font-bold">
                    {error}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-gray-400 italic">
                    No students solved problems after the official 09:30 AM lock for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st: any) => (
                  <tr key={st.student_id} className="hover:bg-gray-50/50 dark:hover:bg-navy-850 transition-colors">
                    <td className="px-4 py-3.5 font-extrabold text-gray-900 dark:text-white">
                      {st.student_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-500">
                      {st.register_number || st.reg_no}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                      {st.department} ({st.year || st.year_level} - {st.section})
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-700 dark:text-gray-300">
                      {st.official_locked_solved}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-amber-500">
                      +{st.post_window_solve_count}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-purple-500">
                      {st.post_window_submission_count || st.post_window_solve_count}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-indigo-500">
                      {st.current_total_solved}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {st.first_post_window_solve_formatted}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-gray-800 dark:text-gray-200">
                      {st.latest_post_window_solve_formatted}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{st.evidence_status || 'VERIFIED'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelectedStudent(st)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center space-x-1 transition-all text-[11px] shadow-sm"
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
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-lg overflow-hidden text-gray-900 dark:text-gray-100 space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-800 pb-3">
              <div>
                <h3 className="text-base font-black flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>{selectedStudent.student_name}</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Reg: {selectedStudent.register_number || selectedStudent.reg_no} • {selectedStudent.department} ({selectedStudent.year || selectedStudent.year_level} - {selectedStudent.section})
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl bg-gray-100 dark:bg-navy-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-navy-800 p-3 rounded-2xl border text-xs">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase">Official Score:</span>
                <p className="font-black text-gray-900 dark:text-white">{selectedStudent.official_locked_solved}</p>
              </div>
              <div>
                <span className="text-[10px] text-amber-500 font-bold uppercase">Post-9:30 Problems:</span>
                <p className="font-black text-amber-500">+{selectedStudent.post_window_solve_count}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                Qualifying Post-9:30 AM Problems ({selectedStudent.problems?.length || 0})
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedStudent.problems?.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-800 border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{idx + 1}. {p.problem_name || p.name}</p>
                      <div className="flex items-center space-x-2 text-[10px] mt-0.5">
                        <span className="text-amber-500 font-mono">Solved: {p.solved_at || p.timestamp_ist}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">{p.evidence_status || 'VERIFIED'}</span>
                      </div>
                    </div>

                    {(p.problem_url || p.url) && (
                      <a
                        href={p.problem_url || p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
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
                className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-navy-800 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
