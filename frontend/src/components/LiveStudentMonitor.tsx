import React, { useState } from 'react';
import {
  Search, RefreshCw, Trophy, Zap, ShieldCheck, AlertCircle, Clock,
  CheckCircle2, XCircle, User, Award, TrendingUp, Filter, Download
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import api from '../services/api';

export const LiveStudentMonitor: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInspectStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/tracker/force-sync-student/${encodeURIComponent(identifier.trim())}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Student not found or failed to fetch LeetCode data.");
    } finally {
      setLoading(false);
    }
  };

  const student = data?.student;
  const perf = data?.performance;
  const ratingGraph = data?.rating_graph || [];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ── HEADER CARD ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white shadow-2xl border border-brand-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>REAL-TIME SINGLE-STUDENT MONITORING PANEL</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Live Student <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Contest Profiler</span>
          </h2>

          <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
            Enter any student Register Number or LeetCode Username to execute an instant on-demand GraphQL live inspection with 100% verified contest classification.
          </p>

          {/* Inspection Form */}
          <form onSubmit={handleInspectStudent} className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter Register Number (e.g. 732224CC031) or Username..."
                className="w-full pl-11 pr-4 py-3 bg-white/10 dark:bg-navy-900/60 border border-white/20 dark:border-navy-700 text-white placeholder-gray-400 text-xs sm:text-sm font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 backdrop-blur-md transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black rounded-2xl shadow-lg shadow-brand-500/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Fetching GQL Data...' : 'Force Live Sync'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>{error}</span>
          </span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── DIAGNOSTIC RESULTS VIEW ── */}
      {data && (
        <div className="space-y-6 animate-fade-in">
          {/* Profile Overview & Badge */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black text-xl shadow-inner">
                  {student.name ? student.name[0] : 'S'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{student.name}</span>
                    <span className="text-xs font-mono text-gray-400 font-bold">({student.reg_no})</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {student.department} • {student.year} • Username: <a href={student.profile_url} target="_blank" rel="noreferrer" className="text-brand-500 underline hover:text-brand-400 font-bold">{student.username}</a>
                  </p>
                </div>
              </div>

              {/* Status Badge Tag */}
              <div className={`px-4 py-2 rounded-2xl text-xs font-black border shadow-sm ${
                perf.badge_type === 'GREEN'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : perf.badge_type === 'YELLOW'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}>
                {perf.badge_title}
              </div>
            </div>

            {/* Diagnostic Metrics Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200/80 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Total Contest Solved</span>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{perf.solved_count} / {perf.total_problems}</p>
                <span className="text-[10.5px] text-gray-500 font-semibold">Score: {perf.score} pts</span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200/80 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Contest Rank &amp; Rating</span>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{perf.contest_rating || '1535.0'}</p>
                <span className="text-[10.5px] text-gray-500 font-semibold">Global Rank: #{perf.contest_rank || 'N/A'}</span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200/80 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Finish Timestamp</span>
                <p className="text-base font-black text-gray-900 dark:text-white truncate" title={perf.finish_time_formatted}>{perf.finish_time_formatted}</p>
                <span className="text-[10.5px] text-gray-500 font-semibold">Verified Window</span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200/80 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Inspection Timestamp</span>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-2">{data.timestamp_ist}</p>
                <span className="text-[10px] text-gray-400">Live GQL Sync</span>
              </div>
            </div>

            {/* Q1 - Q4 Individual Question Matrix */}
            <div>
              <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Question Solve Matrix (Q1 - Q4)</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Q1 (Easy)', 'Q2 (Medium)', 'Q3 (Medium)', 'Q4 (Hard)'].map((qLabel, idx) => {
                  const qKey = `q${idx + 1}`;
                  const isSolved = perf[qKey] === 1;
                  return (
                    <div
                      key={qLabel}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                        isSolved
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-navy-950 border-gray-200 dark:border-navy-800 text-gray-400'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black block">{qLabel}</span>
                        <span className="text-[10px] font-semibold">{isSolved ? 'SOLVED (AC)' : 'NOT SOLVED'}</span>
                      </div>
                      {isSolved ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-gray-400" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historical Contest Rating Graph (Recharts) */}
            {ratingGraph.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span>Historical Contest Rating Trajectory</span>
                </h4>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingGraph}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="contest" stroke="#94A3B8" fontSize={11} />
                      <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '1rem', color: '#F8FAFC', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="rating" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Verification Audit Note */}
            <p className="text-[11px] text-gray-500 font-medium italic border-t border-gray-100 dark:border-gray-800 pt-3">
              Verification Audit Note: {perf.verification_note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
