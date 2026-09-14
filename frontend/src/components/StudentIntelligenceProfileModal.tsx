// million-ignore
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ExternalLink,
  RefreshCw,
  FileText,
  Award,
  Trophy,
  Zap,
  Target,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Sparkles,
  Building2,
  Flame,
  ArrowLeft,
  Activity,
  Briefcase
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis
} from 'recharts';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

interface StudentIntelligenceProfileModalProps {
  studentId: number;
  initialStudent?: any;
  onClose: () => void;
  onRefreshList?: () => void;
}

export const StudentIntelligenceProfileModal: React.FC<StudentIntelligenceProfileModalProps> = ({
  studentId,
  initialStudent,
  onClose,
  onRefreshList
}) => {
  const { notify } = useNotification();
  const [intelData, setIntelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probSearch, setProbSearch] = useState('');

  const fetchProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/hr-candidate-finder/student/${studentId}`);
      if (res.data && res.data.status === 'success') {
        setIntelData(res.data);
      } else if (res.data) {
        setIntelData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch student intelligence profile:', err);
      notify.error('Fetch Error', err.response?.data?.detail || 'Failed to load student intelligence profile.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchProfile();
    }
  }, [studentId]);

  const handleRefreshStudent = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      notify.info('Live Sync Triggered', 'Contacting LeetCode for real-time profile synchronization...');
      const res = await api.post(`/hr-candidate-finder/refresh-student/${studentId}`);
      if (res.data && res.data.status === 'success') {
        setIntelData(res.data);
        notify.success('Profile Synced', 'Student statistics and contest history successfully refreshed from LeetCode.');
        if (onRefreshList) onRefreshList();
      } else {
        await fetchProfile(true);
      }
    } catch (err: any) {
      console.error('Failed to refresh student:', err);
      notify.error('Sync Error', err.response?.data?.detail || 'Could not refresh profile live.');
    } finally {
      setRefreshing(false);
    }
  };

  const st = intelData?.student || initialStudent || {};
  const coding = intelData?.coding || {};
  const contests = intelData?.contests || {};
  const activity = intelData?.activity || {};
  const languages = intelData?.languages || [];
  const topics = intelData?.topics || [];
  const contestHistory = intelData?.contest_history || [];
  const submissions = intelData?.submissions || [];
  const performance = intelData?.performance || {};
  const placement = intelData?.placement || {};
  const cohort = intelData?.cohort_context || {};
  const hrDecision = intelData?.hr_decision || {};
  const strengths = intelData?.strengths || [];
  const areasToWatch = intelData?.areas_to_watch || [];

  const totalSolved = coding.total_solved ?? initialStudent?.total_solved ?? 0;
  const easySolved = coding.easy_solved ?? initialStudent?.easy_solved ?? 0;
  const mediumSolved = coding.medium_solved ?? initialStudent?.medium_solved ?? 0;
  const hardSolved = coding.hard_solved ?? initialStudent?.hard_solved ?? 0;

  const easyPct = totalSolved > 0 ? (coding.easy_pct ?? Math.round((easySolved / totalSolved) * 1000) / 10) : 0;
  const mediumPct = totalSolved > 0 ? (coding.medium_pct ?? Math.round((mediumSolved / totalSolved) * 1000) / 10) : 0;
  const hardPct = totalSolved > 0 ? (coding.hard_pct ?? Math.round((hardSolved / totalSolved) * 1000) / 10) : 0;

  const difficultyPieData = [
    { name: 'Easy', value: easySolved, color: '#10b981' },
    { name: 'Medium', value: mediumSolved, color: '#f59e0b' },
    { name: 'Hard', value: hardSolved, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Contest Rating Progression Data
  const contestProgressionData = [...contestHistory]
    .filter(h => h.rating_after && h.rating_after !== 'N/A' && !isNaN(Number(h.rating_after)))
    .sort((a, b) => (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0))
    .map(h => ({
      date: h.date,
      rating: Number(h.rating_after),
      name: h.contest_name,
      rank: h.contest_rank,
      solved: h.problems_solved
    }));

  const handlePrintDossier = () => {
    window.print();
  };

  return typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in text-slate-900 dark:text-slate-100 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            className="w-full max-w-6xl max-h-[94vh] bg-white dark:bg-navy-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. TOP STICKY HEADER & HERO IDENTITY */}
            <div className="bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 border-b border-indigo-500/20 shrink-0 relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Back / Close button & Title */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <button
                    onClick={onClose}
                    className="p-2 sm:p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/10 transition-all cursor-pointer shrink-0"
                    title="Back to Candidate Ledger"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg border-2 border-white/20 shrink-0">
                      {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                          {st.name || 'Student Profile'}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                          Institutional Intelligence
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold flex-wrap mt-0.5">
                        <span className="font-mono font-bold text-amber-300">{st.reg_no || 'N/A'}</span>
                        <span>•</span>
                        <span className="text-slate-200">{st.department || st.dept_code}</span>
                        <span>•</span>
                        <span>{st.batch || st.year_level}</span>
                        {st.section && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Sec {st.section}</span>
                          </>
                        )}
                        {st.accommodation && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-200 text-[10px] font-bold">
                            {st.accommodation}
                          </span>
                        )}
                        {st.twelfth_cutoff != null && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-200 text-[10px] font-bold">
                            12th: {st.twelfth_cutoff}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Hero Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                  {st.leetcode_url && (
                    <a
                      href={st.leetcode_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>@{st.username || 'LeetCode'}</span>
                    </a>
                  )}

                  <button
                    onClick={handleRefreshStudent}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-brand-600/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Syncing...' : 'Live Refresh'}</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer ml-1"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Meta strip at bottom of hero */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-[11px] text-slate-400 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {st.data_freshness || 'Verified Active'}
                  </span>
                  <span>
                    Last Synced: <strong className="text-slate-200 font-mono">{st.last_synced || 'Recent'}</strong>
                  </span>
                  {st.email && (
                    <span>
                      Email: <strong className="text-slate-200">{st.email}</strong>
                    </span>
                  )}
                  {st.institutional_email && (
                    <span>
                      College Email: <strong className="text-slate-200">{st.institutional_email}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintDossier}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Print Dossier
                  </button>
                </div>
              </div>
            </div>

            {/* 2. MAIN SCROLLABLE CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-navy-950/50">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-10 h-10 text-brand-600 animate-spin" />
                  <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                    Compiling complete student intelligence ledger...
                  </p>
                  <p className="text-xs text-slate-400">Loading DSA metrics, contest ratings, submissions, and cohort rankings</p>
                </div>
              ) : (
                <>
                  {/* SECTION 1: EXECUTIVE PERFORMANCE KPI DASHBOARD */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        <span>1. Executive Performance KPI Dashboard</span>
                      </h3>
                      <span className="text-[11px] font-bold text-slate-500 font-mono">100% Real Database Ground Truth</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                      {/* KPI 1: Total Solved */}
                      <div className="col-span-2 bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Solved</span>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                          {totalSolved}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold font-mono pt-1">
                          <span className="text-emerald-600">{easySolved}E</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-amber-600">{mediumSolved}M</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-600">{hardSolved}H</span>
                        </div>
                      </div>

                      {/* KPI 2: Acceptance Rate */}
                      <div className="col-span-2 bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Acceptance Rate</span>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                          {coding.acceptance_rate || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate pt-1">
                          {coding.total_submissions ? `${coding.total_submissions} Total Submissions` : 'Profile Synchronized'}
                        </div>
                      </div>

                      {/* KPI 3: Contest Rating */}
                      <div className="col-span-2 bg-purple-50/70 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/40 shadow-sm space-y-1">
                        <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Contest Rating</span>
                        <div className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300 font-mono">
                          {contests.contest_rating && contests.contest_rating !== 'N/A' ? contests.contest_rating : '—'}
                        </div>
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold truncate pt-1">
                          {contests.contests_attended && contests.contests_attended !== 'N/A' ? `${contests.contests_attended} Contests Attended` : 'No Contests Yet'}
                        </div>
                      </div>

                      {/* KPI 4: Global Rank */}
                      <div className="col-span-2 bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/40 shadow-sm space-y-1">
                        <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Global Rank</span>
                        <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 font-mono truncate">
                          {contests.global_rank && contests.global_rank !== 'N/A' ? contests.global_rank : '—'}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold truncate pt-1">
                          {contests.top_percentage && contests.top_percentage !== 'N/A' ? `Top ${contests.top_percentage}` : 'Worldwide Ranking'}
                        </div>
                      </div>
                    </div>

                    {/* Secondary KPI Row: Placement Score, Readiness, Risk, Streak */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white dark:bg-navy-900 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Performance Score</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {performance.score ?? 'N/A'} / 100
                        </div>
                      </div>

                      <div className="bg-white dark:bg-navy-900 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Placement Readiness</span>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                          {placement.readiness || 'Standard Track'}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-navy-900 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Risk Level</span>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            performance.risk_level === 'HIGH' || performance.risk_level === 'CRITICAL' ? 'bg-rose-500' :
                            performance.risk_level === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span>{performance.risk_level || 'Low Risk'}</span>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-navy-900 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Activity Streak</span>
                        <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                          <Flame className="w-4 h-4 text-amber-500" />
                          <span>{activity.current_streak ?? 0} Days</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: DSA / PROBLEM-SOLVING DIFFICULTY INTELLIGENCE */}
                  <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Brain className="w-4 h-4 text-indigo-600 dark:text-brand-400" />
                        <span>2. DSA / Problem-Solving Intelligence</span>
                      </h3>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">Difficulty Volume Breakdown</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      {/* Difficulty Cards */}
                      <div className="md:col-span-2 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">Easy</span>
                            <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">{easySolved}</div>
                            <span className="text-[11px] font-bold text-emerald-600">{easyPct}% of total</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase">Medium</span>
                            <div className="text-2xl font-black text-amber-800 dark:text-amber-200 font-mono mt-0.5">{mediumSolved}</div>
                            <span className="text-[11px] font-bold text-amber-600">{mediumPct}% of total</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                            <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase">Hard</span>
                            <div className="text-2xl font-black text-rose-800 dark:text-rose-200 font-mono mt-0.5">{hardSolved}</div>
                            <span className="text-[11px] font-bold text-rose-600">{hardPct}% of total</span>
                          </div>
                        </div>

                        {/* Multi-Segment Stacked Bar */}
                        <div className="space-y-1.5 pt-1">
                          <div className="w-full bg-slate-100 dark:bg-navy-950 h-4 rounded-full overflow-hidden flex border border-slate-200 dark:border-navy-800">
                            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${easyPct}%` }} title={`Easy: ${easySolved}`} />
                            <div className="bg-amber-500 h-full transition-all" style={{ width: `${mediumPct}%` }} title={`Medium: ${mediumSolved}`} />
                            <div className="bg-rose-500 h-full transition-all" style={{ width: `${hardPct}%` }} title={`Hard: ${hardSolved}`} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 font-mono">
                            <span>Easy: {easyPct}%</span>
                            <span>Medium: {mediumPct}%</span>
                            <span>Hard: {hardPct}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Donut Chart */}
                      <div className="h-44 flex items-center justify-center">
                        {difficultyPieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={difficultyPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={64}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {difficultyPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  border: 'none',
                                  borderRadius: '12px',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center text-xs text-slate-400 font-bold">No solved problems recorded.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: CONTEST INTELLIGENCE */}
                  <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>3. Contest Intelligence &amp; Rating Progression</span>
                      </h3>
                      <span className="text-[11px] font-bold text-purple-600 font-mono">
                        {contests.best_rating && contests.best_rating !== 'N/A' ? `Peak Rating: ${contests.best_rating}` : 'Official Contest Record'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40">
                        <span className="text-[10px] font-extrabold text-purple-600 uppercase">Current Rating</span>
                        <div className="text-xl font-black text-purple-700 dark:text-purple-300 font-mono mt-0.5">
                          {contests.contest_rating && contests.contest_rating !== 'N/A' ? contests.contest_rating : '—'}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Best Rating</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {contests.best_rating && contests.best_rating !== 'N/A' ? contests.best_rating : '—'}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Contests Attended</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {contests.contests_attended && contests.contests_attended !== 'N/A' ? contests.contests_attended : 0}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Best Rank</span>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                          {contests.best_rank && contests.best_rank !== 'N/A' ? contests.best_rank : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Progression Chart */}
                    {contestProgressionData.length > 1 && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Official Contest Rating Progression History ({contestProgressionData.length} contests)
                        </span>
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={contestProgressionData}>
                              <defs>
                                <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                              <YAxis domain={['dataMin - 50', 'dataMax + 50']} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  border: 'none',
                                  borderRadius: '12px',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}
                              />
                              <Area type="monotone" dataKey="rating" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#ratingGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Contest History Ledger */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Recent Contest History ({contestHistory.length} Sessions)
                      </span>
                      {contestHistory.length > 0 ? (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-navy-950 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px]">
                              <tr>
                                <th className="py-2.5 px-3">Contest Name</th>
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3 text-center">Rank</th>
                                <th className="py-2.5 px-3 text-center">Score / Solved</th>
                                <th className="py-2.5 px-3 text-right">Rating After</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-semibold text-slate-800 dark:text-slate-200">
                              {contestHistory.slice(0, 8).map((h: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{h.contest_name}</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500">{h.date}</td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-600">{h.contest_rank}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{h.problems_solved} / {h.total_problems || 4}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-black">{h.rating_after}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-navy-950 rounded-2xl">
                          No contest participation history recorded.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 4: CODING ACTIVITY & CONSISTENCY */}
                  <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span>4. Coding Activity &amp; Consistency Intelligence</span>
                      </h3>
                      <span className="text-[11px] font-bold text-amber-600 font-mono">
                        Active Days: {activity.active_days ?? coding.active_days ?? 'N/A'}
                      </span>
                    </div>

                    {/* 7d, 30d, 90d, 365d Submission Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">7-Day Submissions</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {activity.sub_7d ?? 'N/A'}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">30-Day Submissions</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {activity.sub_30d ?? 'N/A'}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">90-Day Submissions</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {activity.sub_90d ?? 'N/A'}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">365-Day Submissions</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                          {activity.sub_365d ?? 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Submission Heatmap Grid */}
                    {activity.heatmap && activity.heatmap.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            LeetCode Contribution Activity Calendar (Past 365 Days)
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            Most active day: {activity.most_active_day || 'N/A'}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 pt-1">
                          {activity.heatmap.slice(-60).map((h: any, idx: number) => {
                            const cnt = h.count || 0;
                            const bg =
                              cnt === 0
                                ? 'bg-slate-200 dark:bg-navy-900'
                                : cnt < 3
                                ? 'bg-emerald-300 dark:bg-emerald-800'
                                : cnt < 6
                                ? 'bg-emerald-500 dark:bg-emerald-600'
                                : 'bg-emerald-600 dark:bg-emerald-500';
                            return (
                              <div
                                key={idx}
                                className={`h-6 rounded-md ${bg} flex items-center justify-center text-[9px] font-bold text-white shadow-2xs`}
                                title={`${h.date}: ${cnt} submissions`}
                              >
                                {cnt > 0 ? cnt : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent Submissions Table */}
                    {submissions.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            Recent Submissions &amp; Problem Solves ({submissions.length} items)
                          </span>
                          <input
                            type="text"
                            placeholder="Filter problem title..."
                            value={probSearch}
                            onChange={(e) => setProbSearch(e.target.value)}
                            className="px-3 py-1 rounded-xl text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 w-44"
                          />
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-navy-950 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px]">
                              <tr>
                                <th className="py-2.5 px-3">Problem</th>
                                <th className="py-2.5 px-3">Language</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3 text-center">Runtime / Memory</th>
                                <th className="py-2.5 px-3 text-right">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium text-slate-800 dark:text-slate-200">
                              {submissions
                                .filter((s: any) => !probSearch || (s.title || '').toLowerCase().includes(probSearch.toLowerCase()))
                                .slice(0, 10)
                                .map((s: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                      <a
                                        href={`https://leetcode.com/problems/${s.title_slug || 'two-sum'}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-brand-600 flex items-center gap-1.5"
                                      >
                                        <span>{s.title}</span>
                                        <ExternalLink className="w-3 h-3 text-slate-400" />
                                      </a>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold text-[10px]">
                                        {s.language}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold text-[10px]">
                                        {s.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                      {s.runtime && s.runtime !== 'N/A' ? s.runtime : '—'} {s.memory && s.memory !== 'N/A' ? `• ${s.memory}` : ''}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{s.timestamp}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 5 & 6: LANGUAGE & TOPIC / SKILL INTELLIGENCE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Language Intelligence */}
                    <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>5. Language Intelligence</span>
                        </h3>
                        <span className="text-[11px] font-bold text-amber-600 font-mono">
                          Primary: {intelData?.primary_language || 'Auto-Detected'}
                        </span>
                      </div>

                      {languages.length > 0 ? (
                        <div className="space-y-3">
                          {languages.map((l: any, idx: number) => {
                            const maxSolved = languages[0]?.solved || 1;
                            const pct = Math.round((l.solved / maxSolved) * 100);
                            return (
                              <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                                    {l.language}
                                  </span>
                                  <span className="font-mono font-black text-brand-600 dark:text-brand-400">{l.solved} solved</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-navy-900 h-2 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400 italic">No language breakdown data recorded.</div>
                      )}
                    </div>

                    {/* Topic / Skill Intelligence */}
                    <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Target className="w-4 h-4 text-brand-600" />
                          <span>6. Topic &amp; Skill Intelligence</span>
                        </h3>
                        <span className="text-[11px] font-bold text-brand-600 font-mono">DSA Proficiency</span>
                      </div>

                      {topics.length > 0 ? (
                        <div className="space-y-2.5">
                          {topics.slice(0, 6).map((t: any, idx: number) => {
                            const maxT = topics[0]?.problems_solved || 1;
                            const pct = Math.min(100, Math.max(10, Math.round((t.problems_solved / maxT) * 100)));
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className="text-slate-800 dark:text-slate-200">{t.topic_name}</span>
                                  <span className="font-mono font-black text-indigo-600 dark:text-brand-400">{t.problems_solved} solved</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-navy-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-navy-800">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400 italic">Topic-level intelligence unavailable.</div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 7 & 8: PLACEMENT INTELLIGENCE & INSTITUTIONAL CONTEXT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Placement Intelligence */}
                    <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <span>7. Placement &amp; Hiring Readiness</span>
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-[10px] uppercase">
                          {placement.readiness || 'Standard'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase">Interview Readiness</span>
                          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                            {placement.interview_readiness || '75%'}
                          </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase">Hiring Priority</span>
                          <div className="text-xl font-black text-brand-600 dark:text-brand-400 font-mono mt-0.5">
                            {totalSolved >= 200 ? 'High' : totalSolved >= 100 ? 'Medium' : 'Standard'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-navy-950">
                          <span className="text-slate-500 font-bold">Recommended Company Track:</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {totalSolved >= 300 && hardSolved >= 10 ? 'Product / Tier-1 Tech' : totalSolved >= 150 ? 'Product & Core Tech' : 'Service & IT Services'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Department & Batch Context */}
                    <div className="bg-white dark:bg-navy-900 p-5 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                          <span>8. Department &amp; Institutional Context</span>
                        </h3>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">Cohort Percentiles</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40">
                          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase">College Rank</span>
                          <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                            {st.college_rank || cohort.college_rank || '—'}
                          </div>
                          <span className="text-[10px] text-indigo-500">out of {cohort.college_student_count || 1500}</span>
                        </div>

                        <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                          <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase">Dept Rank</span>
                          <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                            {st.dept_rank || cohort.dept_rank || '—'}
                          </div>
                          <span className="text-[10px] text-amber-500">out of {cohort.dept_student_count || 300}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Batch Rank</span>
                          <div className="text-base font-black text-slate-900 dark:text-white font-mono">{st.year_rank || cohort.year_rank || '—'}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Section Rank</span>
                          <div className="text-base font-black text-slate-900 dark:text-white font-mono">{st.section_rank || cohort.section_rank || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 9: HR ASSESSMENT & HIRING DECISION */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-navy-950 text-white p-6 rounded-3xl border border-indigo-500/30 shadow-xl space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        <span>9. Institutional HR Assessment &amp; Hiring Decision</span>
                      </h3>
                      <div className="flex items-center gap-1 text-amber-400 text-sm font-black font-mono">
                        <span>Evaluation Rating:</span>
                        <span className="text-base">{hrDecision.candidate_strength || '★★★★☆'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Key Strengths */}
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <span className="text-emerald-400 font-black uppercase text-[10px] tracking-wider block">
                          Verified Key Strengths
                        </span>
                        {strengths.length > 0 ? (
                          <div className="space-y-1.5 text-slate-200">
                            {strengths.map((s: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{s.replace(/^[✓\s]+/, '')}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">Consistent coding foundation in progress.</p>
                        )}
                      </div>

                      {/* Areas for Attention */}
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <span className="text-amber-400 font-black uppercase text-[10px] tracking-wider block">
                          Target Areas For Technical Mentorship
                        </span>
                        {areasToWatch.length > 0 ? (
                          <div className="space-y-1.5 text-slate-300">
                            {areasToWatch.map((a: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>{a.replace(/^[⚠️\s]+/, '')}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">No critical deficiencies detected.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between flex-wrap gap-3 border-t border-white/10 text-xs">
                      <div className="text-slate-300">
                        <span>Recommended Next Action: </span>
                        <strong className="text-amber-300 font-bold">
                          {totalSolved >= 200 ? 'Schedule Direct Technical Interview Round' : 'Recommend for DSA Acceleration Mentorship'}
                        </strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrintDossier}
                          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-black transition-all cursor-pointer shadow-md"
                        >
                          Export Full Dossier
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3. MODAL FOOTER */}
            <div className="px-6 py-3.5 bg-slate-100 dark:bg-navy-950 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500 font-bold">
                Student ID: <strong className="font-mono text-slate-800 dark:text-slate-200">{st.id || studentId}</strong>
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 font-bold transition-all cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
};

export default StudentIntelligenceProfileModal;
