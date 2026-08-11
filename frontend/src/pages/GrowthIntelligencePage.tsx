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
  UserCheck
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
  }, [period]);

  const fetchGrowthData = async () => {
    setLoading(true);
    try {
      const [impRes, deltaRes] = await Promise.all([
        api.get(`/growth/improvers?period=${period}&limit=25`),
        api.get(`/growth/college-delta?period=${period}`)
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
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl bg-gradient-to-r from-brand-900/40 via-navy-900/50 to-purple-950/40 border border-brand-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand-400 font-bold text-xs uppercase tracking-widest mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Real-Time Growth & Delta Engine</span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-emerald-400" />
              Growth Intelligence & Time Machine
            </h1>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl">
              Track student problem-solving deltas, biggest improvers, difficulty acceleration, and historical stat snapshots across custom timeframe windows.
            </p>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="flex items-center space-x-1.5 bg-gray-900/80 p-1.5 rounded-xl border border-gray-800 self-start md:self-auto">
            {(['today', '7d', '30d', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* College Aggregate Delta Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-emerald-400">Total Solved Growth</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            +{collegeDelta?.delta_total ?? 0}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Problems solved in selected period</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-900/10">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-emerald-400">Easy Solved</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            +{collegeDelta?.delta_easy ?? 0}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Foundation skill building</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-900/10">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-amber-400">Medium Solved</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="text-2xl font-black text-amber-400">
            +{collegeDelta?.delta_medium ?? 0}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Interview readiness problems</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-500/20 bg-rose-900/10">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-rose-400">Hard Solved</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="text-2xl font-black text-rose-400">
            +{collegeDelta?.delta_hard ?? 0}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Advanced DSA mastery</p>
        </div>
      </div>

      {/* Main Section: Top Improvers Leaderboard */}
      <div className="glass-card p-6 rounded-2xl border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">
              Biggest Improvers Leaderboard ({period === 'today' ? 'Today' : period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'})
            </h2>
          </div>
          <span className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full font-mono">
            {improvers.length} Students Active
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm animate-pulse">
            Calculating growth metrics & delta velocity...
          </div>
        ) : improvers.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No solve delta recorded for this period yet. Trigger a sync or check back after students solve problems!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-navy-900/80 text-gray-400 uppercase font-semibold text-[11px] border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4"># Rank</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4">Total Solved</th>
                  <th className="py-3 px-4 text-emerald-400">Growth (+Delta)</th>
                  <th className="py-3 px-4">Difficulty Breakdown</th>
                  <th className="py-3 px-4">Rating Delta</th>
                  <th className="py-3 px-4 text-right">Time Machine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {improvers.map((imp, idx) => (
                  <tr key={imp.student_id} className="hover:bg-navy-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-white">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40">1</span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 font-bold border border-slate-400/40">2</span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 font-bold border border-amber-700/40">3</span>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{imp.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{imp.reg_no}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-brand-900/60 border border-brand-500/30 text-brand-300 text-[10px] font-bold">
                        {imp.department_code} • Yr {imp.year_level}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-200">
                      {imp.total_solved}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-400 text-sm">
                      +{imp.delta_solved}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="text-emerald-400">+{imp.delta_easy} E</span>
                        <span className="text-amber-400">+{imp.delta_medium} M</span>
                        <span className="text-rose-400">+{imp.delta_hard} H</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {imp.delta_rating !== 0 ? (
                        <span className={`font-bold ${imp.delta_rating > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {imp.delta_rating > 0 ? `+${imp.delta_rating}` : imp.delta_rating}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleFetchStudentHistory(String(imp.student_id), imp.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-800 hover:bg-brand-600 text-gray-300 hover:text-white transition-all flex items-center space-x-1 ml-auto"
                      >
                        <Clock className="w-3 h-3" />
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

      {/* Time Machine Section */}
      <div className="glass-card p-6 rounded-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-400" />
              Student Historical Time Machine
            </h3>
            <p className="text-xs text-gray-400">
              Inspect historical stat snapshots and granular per-sync solve deltas for any student.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Enter Student ID..."
              value={searchStudentId}
              onChange={(e) => setSearchStudentId(e.target.value)}
              className="bg-navy-900 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 w-48 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => handleFetchStudentHistory(searchStudentId)}
              disabled={!searchStudentId || historyLoading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {historyLoading ? 'Loading...' : 'Inspect Snapshots'}
            </button>
          </div>
        </div>

        {selectedStudentName && (
          <div className="mb-4 text-xs font-bold text-brand-300 bg-brand-950/40 p-2.5 rounded-xl border border-brand-800/40">
            Viewing historical timeline for: <span className="text-white font-black">{selectedStudentName}</span>
          </div>
        )}

        {historySnapshots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-navy-900/80 text-gray-400 uppercase font-semibold text-[11px] border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-4">Captured At</th>
                  <th className="py-2.5 px-4">Total Solved</th>
                  <th className="py-2.5 px-4">Easy</th>
                  <th className="py-2.5 px-4">Medium</th>
                  <th className="py-2.5 px-4">Hard</th>
                  <th className="py-2.5 px-4">Contest Rating</th>
                  <th className="py-2.5 px-4 text-emerald-400">Delta Solved</th>
                  <th className="py-2.5 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 font-mono">
                {historySnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-navy-900/40">
                    <td className="py-2.5 px-4 text-gray-300 font-sans">
                      {new Date(snap.captured_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{snap.total_solved}</td>
                    <td className="py-2.5 px-4 text-emerald-400">{snap.easy_solved}</td>
                    <td className="py-2.5 px-4 text-amber-400">{snap.medium_solved}</td>
                    <td className="py-2.5 px-4 text-rose-400">{snap.hard_solved}</td>
                    <td className="py-2.5 px-4">{snap.contest_rating ?? 'Unrated'}</td>
                    <td className="py-2.5 px-4 font-extrabold text-emerald-400">
                      +{snap.delta_total}
                    </td>
                    <td className="py-2.5 px-4 text-[10px] text-gray-400">{snap.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-xs">
            Select a student from the leaderboard or enter a Student ID above to view snapshot history.
          </div>
        )}
      </div>
    </div>
  );
};
