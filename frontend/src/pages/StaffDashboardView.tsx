import React, { useState, useEffect } from 'react';
import {
  Users, AlertTriangle, RefreshCw, BarChart3, CheckCircle2, Search,
  ShieldCheck, Award, TrendingUp, TrendingDown, Minus, Eye, Bell,
  FileText, Clock, AlertCircle, ArrowRight, Download, Zap, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { StaffMentoringDetailModal } from '../components/StaffMentoringDetailModal';
import { useNotification } from '../context/NotificationContext';

export const StaffDashboardView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [summary, setSummary] = useState<any>(null);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [priorityStudents, setPriorityStudents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveSyncing, setLiveSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'ATTENTION' | 'AT_RISK'>('ALL');

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

      if (sumRes.data) {
        setSummary(sumRes.data);
      }
      setMyStudents(studentList);
      setPriorityStudents(prioRes.data || []);
      setAlerts(alertRes.data || []);
    } catch (err) {
      console.error('Error fetching mentoring dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLiveSync = async () => {
    if (liveSyncing) return;
    setLiveSyncing(true);
    setSyncStatusMsg(`FETCHING LIVE DATA... Checking ${myStudents.length || 30} assigned profiles from LeetCode...`);
    notify.info('Live Sync Started', `Fetching live LeetCode data strictly for your ${myStudents.length || 30} assigned students...`);
    try {
      const res = await api.post('/faculty-assignments/live-sync');
      if (res.data?.status === 'ALREADY_RUNNING') {
        notify.warning('Sync In Progress', res.data.message || 'Live sync already in progress.');
        setSyncStatusMsg(res.data.message);
      } else {
        const successCnt = res.data?.success_count || 0;
        const unavailCnt = res.data?.unavailable_count || 0;
        const failedCnt = res.data?.failed_count || 0;
        const totalChecked = res.data?.total_assigned || myStudents.length;
        const nowFormatted = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        setLastSyncTime(nowFormatted);
        setSyncStatusMsg(`LIVE SYNC COMPLETED • ${totalChecked} Students Checked (${successCnt} Updated, ${unavailCnt} Unavailable, ${failedCnt} Failed)`);
        notify.success('Live Sync Complete', `Updated ${successCnt} profiles successfully.`);
        await fetchMentoringData();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to complete live sync.';
      notify.error('Live Sync Error', errMsg);
      setSyncStatusMsg(`Sync error: ${errMsg}`);
    } finally {
      setLiveSyncing(false);
    }
  };

  // Local KPI calculations fallback if summary is loading
  const totalAssignedCount = summary?.total_assigned || myStudents.length;
  const activeCount = summary?.active_students ?? myStudents.filter((s: any) => (s.total_solved || 0) > 0).length;
  const completedCount = summary?.completed_students ?? myStudents.filter((s: any) => (s.total_solved || 0) >= 100).length;
  const attentionCount = summary?.needing_attention ?? myStudents.filter((s: any) => (s.total_solved || 0) < 30 && (s.total_solved || 0) > 0).length;
  const atRiskCount = summary?.at_risk ?? myStudents.filter((s: any) => (s.total_solved || 0) === 0 || !s.username).length;
  const totalSolvedSum = myStudents.reduce((acc: number, s: any) => acc + (s.total_solved || 0), 0);
  const avgSolvedProgress = summary?.weekly_progress_avg ?? (myStudents.length > 0 ? (totalSolvedSum / myStudents.length).toFixed(1) : 0);

  // Filter ONLY inside assigned students set based on active KPI filter + search query
  const filteredStudents = myStudents.filter((s: any) => {
    const solved = s.total_solved || 0;
    
    // Status Category Filter
    if (filterStatus === 'ACTIVE' && solved <= 0) return false;
    if (filterStatus === 'COMPLETED' && solved < 100) return false;
    if (filterStatus === 'ATTENTION' && (solved >= 100 || (solved >= 30 && s.username))) return false;
    if (filterStatus === 'AT_RISK' && solved > 0 && s.username) return false;

    // Text Search Filter
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.reg_no || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  });

  const handleCardFilterClick = (status: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'ATTENTION' | 'AT_RISK') => {
    setFilterStatus(prev => prev === status ? 'ALL' : status);
    // Smooth scroll down to table
    const tableEl = document.getElementById('assigned-students-table-section');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
            <p className="text-xs text-gray-300 flex items-center gap-2">
              <span>Restricted Portfolio • Monitoring {myStudents.length} Assigned Students</span>
              {lastSyncTime && (
                <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Last Live Sync: {lastSyncTime} IST
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={liveSyncing}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-black shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${liveSyncing ? 'animate-bounce text-amber-400' : 'text-amber-300'}`} />
              <span>{liveSyncing ? 'Fetching Live Data...' : 'FETCH LIVE DATA'}</span>
            </button>

            <button
              type="button"
              onClick={fetchMentoringData}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Portfolio</span>
            </button>
          </div>
        </div>

        {/* Live Sync Status Banner */}
        {syncStatusMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-white/10 border border-white/15 text-xs font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
            <button 
              type="button"
              onClick={() => setSyncStatusMsg(null)}
              className="text-gray-400 hover:text-white text-[10px] ml-2 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Interactive Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

        {/* 1. Assigned (All) */}
        <div 
          onClick={() => handleCardFilterClick('ALL')}
          title="Click to view all assigned students"
          className={`glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] ${
            filterStatus === 'ALL'
              ? 'ring-2 ring-brand-500 border-brand-500/50 bg-brand-500/5 dark:bg-brand-500/10'
              : 'hover:border-brand-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Assigned</span>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">
            {totalAssignedCount} / 30
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              totalAssignedCount === 30
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : (totalAssignedCount > 30
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20')
            }`}>
              {summary?.workload_status || (totalAssignedCount === 30 ? 'AT CAPACITY' : 'WITHIN CAPACITY')}
            </span>
          </div>
        </div>

        {/* 2. Active Solvers */}
        <div 
          onClick={() => handleCardFilterClick('ACTIVE')}
          title="Click to filter active solvers"
          className={`glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] ${
            filterStatus === 'ACTIVE'
              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/10'
              : 'border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-emerald-500">
            {activeCount}
          </h3>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            Active Solvers {filterStatus === 'ACTIVE' && '• (Filtered)'}
          </p>
        </div>

        {/* 3. Completed (Target Achieved) */}
        <div 
          onClick={() => handleCardFilterClick('COMPLETED')}
          title="Click to filter students with 100+ solved"
          className={`glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] ${
            filterStatus === 'COMPLETED'
              ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-500/10'
              : 'border-indigo-500/30 hover:border-indigo-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Completed</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-black text-indigo-500">
            {completedCount}
          </h3>
          <p className="text-[10px] text-indigo-400 font-bold">
            Target Achieved {filterStatus === 'COMPLETED' && '• (Filtered)'}
          </p>
        </div>

        {/* 4. Attention (Needs Action) */}
        <div 
          onClick={() => handleCardFilterClick('ATTENTION')}
          title="Click to filter students needing attention"
          className={`glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] ${
            filterStatus === 'ATTENTION'
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/10'
              : 'border-amber-500/30 hover:border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Attention</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-amber-500">
            {attentionCount}
          </h3>
          <p className="text-[10px] text-amber-600 font-bold">
            Needs Action {filterStatus === 'ATTENTION' && '• (Filtered)'}
          </p>
        </div>

        {/* 5. At Risk */}
        <div 
          onClick={() => handleCardFilterClick('AT_RISK')}
          title="Click to filter at-risk students"
          className={`glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] ${
            filterStatus === 'AT_RISK'
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/10'
              : 'border-rose-500/30 hover:border-rose-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>At Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-rose-500">
            {atRiskCount}
          </h3>
          <p className="text-[10px] text-rose-600 font-bold">
            Immediate Follow-Up {filterStatus === 'AT_RISK' && '• (Filtered)'}
          </p>
        </div>

        {/* 6. Avg Progress */}
        <div 
          onClick={() => handleCardFilterClick('ALL')}
          title="Average solved problems per assigned student"
          className="glass-card p-5 rounded-3xl border space-y-2 shadow-lg cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Avg Progress</span>
            <BarChart3 className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">
            {avgSolvedProgress}
          </h3>
          <p className="text-[10px] text-gray-500 font-bold">Solved / Student</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {priorityStudents.slice(0, 3).map((st: any) => (
              <div 
                key={st.id} 
                className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-amber-200/80 dark:border-amber-900/50 shadow-md flex flex-col justify-between transition-all hover:border-amber-400 hover:shadow-lg"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate" title={st.name}>
                      {st.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                      {st.status_label || 'Needs Attention'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    Reg: {st.reg_no} • {st.department} ({st.year_level} Year)
                  </p>
                  <div className="space-y-1.5 pt-1 min-h-[44px]">
                    {st.priority_reasons && st.priority_reasons.length > 0 ? (
                      st.priority_reasons.map((r: string, idx: number) => (
                        <p key={idx} className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">{r}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Low activity / Needs review</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-100 dark:border-navy-800 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white text-xs font-black transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Inspect Student</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MY STUDENTS MAIN SECTION */}
      <div id="assigned-students-table-section" className="glass-card p-6 rounded-3xl border space-y-6 shadow-xl scroll-mt-6">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-500" />
              <span>
                My Assigned Students ({filteredStudents.length}{filteredStudents.length !== myStudents.length ? ` of ${myStudents.length}` : ''})
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              Only students strictly assigned to your mentorship allocation are fetched.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Active Filter Pill */}
            {filterStatus !== 'ALL' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-400 text-xs font-bold animate-fade-in">
                <span>Filter: <strong>{filterStatus}</strong> ({filteredStudents.length})</span>
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className="p-0.5 hover:bg-brand-500/20 rounded-md text-brand-600 dark:text-brand-400 transition-colors cursor-pointer"
                  title="Clear filter"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
                        {st.department} ({st.year_level} Year)
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
