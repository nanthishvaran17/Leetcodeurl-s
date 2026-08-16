import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Zap,
  Calendar,
  Filter,
  Flame,
  ArrowUpRight,
  Sparkles,
  Clock,
  ChevronRight,
  Search,
  UserCheck,
  CheckCircle2,
  BarChart2
} from 'lucide-react';
import api from '../services/api';

interface Improver {
  student_id: number;
  reg_no: string;
  name: string;
  department_code: string;
  year_level: string;
  section_name?: string;
  total_solved: number;
  delta_solved: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  delta_rating: number;
  current_contest_rating?: number;
}

interface CollegeDelta {
  period: string;
  delta_total: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
}

interface StatSnapshot {
  id: number;
  student_id: number;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating?: number;
  delta_total: number;
  delta_easy: number;
  delta_medium: number;
  delta_hard: number;
  delta_rating: number;
  captured_at: string;
  sync_run_id?: string;
  source?: string;
}

export const GrowthIntelligencePage: React.FC = () => {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [improvers, setImprovers] = useState<Improver[]>([]);
  const [collegeDelta, setCollegeDelta] = useState<CollegeDelta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Time Machine state
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const [historySnapshots, setHistorySnapshots] = useState<StatSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');

  useEffect(() => {
    fetchGrowthData();
  }, [period, deptFilter, yearFilter]);

  const fetchGrowthData = async () => {
    setLoading(true);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=25&dept=${deptFilter}&year=${yearFilter}`),
        api.get(`/growth/college-delta?period=${period}&dept=${deptFilter}&year=${yearFilter}`)
      ]);
      setImprovers(impRes.data || []);
      setCollegeDelta(deltaRes.data || null);
    } catch (err) {
      console.error("Growth data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchStudentHistory = async (id: string, name?: string) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/history/${id}?limit=50`);
      setHistorySnapshots(res.data || []);
      if (name) setSelectedStudentName(name);
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-8 py-2 pb-16 animate-slideUp">

      
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>REAL-TIME GROWTH & DELTA ENGINE</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-emerald-400 stroke-[2.5]" />
              Growth Intelligence & <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">Time Machine</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-medium leading-relaxed">
              Track student problem-solving deltas, biggest improvers, difficulty acceleration, and historical stat snapshots across custom timeframe windows.
            </p>
          </div>

          {/* Filters & Timeframe Selector Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3.5 py-2 rounded-2xl bg-navy-900/90 text-white text-xs font-bold border border-gray-700/80 backdrop-blur-md shadow-inner outline-none cursor-pointer hover:border-brand-500"
            >
              <option value="ALL">🏢 All Departments (Cyber Security & IoT)</option>
              <option value="CSE(CS)">🏢 Computer Science & Engg (Cyber Security)</option>
              <option value="CSE(IoT)">🏢 Computer Science & Engg (IoT)</option>
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3.5 py-2 rounded-2xl bg-navy-900/90 text-white text-xs font-bold border border-gray-700/80 backdrop-blur-md shadow-inner outline-none cursor-pointer hover:border-brand-500"
            >
              <option value="ALL">All Academic Years</option>
              <option value="II">II Year</option>
              <option value="III">III Year</option>
              <option value="IV">IV Year</option>
            </select>

            <div className="flex items-center space-x-1.5 bg-navy-900/90 p-1.5 rounded-2xl border border-gray-700/80 shadow-inner backdrop-blur-md">
              {(['today', '7d', '30d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    period === p
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/40 scale-105'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* College Aggregate Delta Metrics KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card p-5 rounded-3xl border border-emerald-500/30 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Total Solved Growth</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">
            +{collegeDelta?.delta_total ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Problems solved in selected period</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-emerald-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">Easy Solved</span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            +{collegeDelta?.delta_easy ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Foundation skill building</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-amber-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-amber-600 dark:text-amber-400">Medium Solved</span>
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            +{collegeDelta?.delta_medium ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Interview readiness problems</p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-rose-500/20 bg-white dark:bg-navy-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <span className="text-rose-600 dark:text-rose-400">Hard Solved</span>
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            +{collegeDelta?.delta_hard ?? 0}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Advanced DSA mastery</p>
        </div>

      </div>

      {/* Main Section: Top Improvers Leaderboard */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-2xl space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Flame className="w-6 h-6 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Biggest Improvers Leaderboard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Showing top performance growth for: <span className="font-extrabold text-brand-600 dark:text-brand-400">{period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'}</span>
              </p>
            </div>
          </div>

          <span className="px-4 py-1.5 rounded-2xl bg-gray-100 dark:bg-navy-950 text-gray-800 dark:text-gray-200 font-black text-xs border border-gray-200 dark:border-gray-800 self-start md:self-auto">
            ⚡ {improvers.length} Active Solvers in Period
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm font-bold animate-pulse space-y-2">
            <BarChart2 className="w-8 h-8 mx-auto text-brand-500 animate-bounce" />
            <p>Calculating growth metrics & delta velocity...</p>
          </div>
        ) : improvers.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-xs font-semibold bg-gray-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
            No solve delta recorded for this period yet. Trigger a sync or check back after students solve problems!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 dark:bg-navy-950 text-gray-700 dark:text-gray-300 uppercase font-black text-[11px] border-b border-gray-200 dark:border-gray-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4"># Rank</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Dept / Year</th>
                  <th className="py-3.5 px-4">Total Solved</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Growth (+Delta)</th>
                  <th className="py-3.5 px-4">Difficulty Breakdown</th>
                  <th className="py-3.5 px-4">Rating Delta</th>
                  <th className="py-3.5 px-4 text-right">Time Machine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:border-gray-800 dark:divide-gray-800/80 bg-white dark:bg-navy-900 font-medium">
                {improvers.map((imp, idx) => (
                  <tr key={imp.student_id} className="hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors">
                    
                    {/* Rank Badge */}
                    <td className="py-4 px-4 font-black text-gray-900 dark:text-white">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/30 text-xs">
                          🥇 #1
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-slate-200 to-gray-300 text-slate-900 font-black shadow-sm text-xs">
                          🥈 #2
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-black shadow-sm text-xs">
                          🥉 #3
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs">
                          #{idx + 1}
                        </span>
                      )}
                    </td>

                    {/* Student Info */}
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">{imp.name}</div>
                      <div className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 mt-0.5">{imp.reg_no}</div>
                    </td>

                    {/* Department / Year Pill */}
                    <td className="py-4 px-4">
                      <span className="inline-block px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-extrabold text-xs">
                        {imp.department_code} • {imp.year_level} Yr
                      </span>
                    </td>

                    {/* Total Solved */}
                    <td className="py-4 px-4 font-black text-sm text-gray-900 dark:text-white">
                      {imp.total_solved}
                    </td>

                    {/* Growth Delta */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-black text-sm shadow-sm">
                        <span>+{imp.delta_solved}</span>
                      </span>
                    </td>

                    {/* Difficulty Breakdown */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2 text-xs font-black">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          +{imp.delta_easy} E
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          +{imp.delta_medium} M
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          +{imp.delta_hard} H
                        </span>
                      </div>
                    </td>

                    {/* Rating Delta */}
                    <td className="py-4 px-4">
                      {imp.delta_rating !== 0 ? (
                        <span className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                          imp.delta_rating > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {imp.delta_rating > 0 ? `+${imp.delta_rating}` : imp.delta_rating}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-bold">—</span>
                      )}
                    </td>

                    {/* Time Machine Timeline Button */}
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleFetchStudentHistory(String(imp.student_id), imp.name)}
                        className="px-3.5 py-2 text-xs font-black rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all flex items-center space-x-1.5 shadow-md shadow-brand-600/30 ml-auto transform hover:scale-105"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Time Machine Historical Inspection Section */}
      <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-2xl space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Student Historical Time Machine
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Inspect historical stat snapshots and granular per-sync solve deltas for any student.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Enter Student ID (e.g. 1)..."
              value={searchStudentId}
              onChange={(e) => setSearchStudentId(e.target.value)}
              className="bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-bold rounded-2xl px-4 py-2.5 w-52 focus:outline-none focus:border-brand-500 shadow-inner"
            />
            <button
              onClick={() => handleFetchStudentHistory(searchStudentId)}
              disabled={!searchStudentId || historyLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {historyLoading ? 'Loading...' : 'Inspect Snapshots'}
            </button>
          </div>
        </div>

        {selectedStudentName && (
          <div className="text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 p-3 rounded-2xl border border-brand-200 dark:border-brand-800/60 flex items-center justify-between">
            <span>Viewing historical timeline for: <span className="text-gray-900 dark:text-white font-black text-sm">{selectedStudentName}</span></span>
            <span className="text-[11px] font-mono text-gray-500">Total Snapshots: {historySnapshots.length}</span>
          </div>
        )}

        {historySnapshots.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 dark:bg-navy-950 text-gray-700 dark:text-gray-300 uppercase font-black text-[11px] border-b border-gray-200 dark:border-gray-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Captured At</th>
                  <th className="py-3.5 px-4">Total Solved</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Easy</th>
                  <th className="py-3.5 px-4 text-amber-600 dark:text-amber-400">Medium</th>
                  <th className="py-3.5 px-4 text-rose-600 dark:text-rose-400">Hard</th>
                  <th className="py-3.5 px-4">Contest Rating</th>
                  <th className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400">Delta Solved</th>
                  <th className="py-3.5 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 bg-white dark:bg-navy-900 font-mono font-medium">
                {historySnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors">
                    <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 font-sans font-bold">
                      {new Date(snap.captured_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-black text-sm text-gray-900 dark:text-white">{snap.total_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">{snap.easy_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-amber-600 dark:text-amber-400">{snap.medium_solved}</td>
                    <td className="py-3.5 px-4 font-extrabold text-rose-600 dark:text-rose-400">{snap.hard_solved}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-800 dark:text-gray-200">{snap.contest_rating ?? 'Unrated'}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black">
                        +{snap.delta_total}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] font-sans font-bold text-gray-500 dark:text-gray-400">{snap.source || 'leetcode_public_profile'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-xs font-semibold bg-gray-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
            Select a student from the leaderboard or enter a Student ID above to view snapshot history timeline.
          </div>
        )}
      </div>

    </div>
  );
};

