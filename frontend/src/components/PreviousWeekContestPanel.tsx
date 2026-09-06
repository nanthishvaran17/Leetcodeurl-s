import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  Award, 
  Sparkles, 
  UserX, 
  HelpCircle, 
  AlertTriangle,
  WifiOff,
  Zap,
  CheckCircle2,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useContestWebSocket } from '../hooks/useContestWebSocket';

export interface PreviousWeekSummary {
  session_id: number;
  contest_slug: string;
  contest_title: string;
  target_date_ist: string;
  validation_status: string;
  publish_status: string;
  cache_state: string;
  dataset_version: number;
  sync_id: string;
  sync_started_at: string;
  metrics?: {
    PUBLIC: number;
    VIRTUAL: number;
    NOT_PARTICIPATED: number;
    NOT_VERIFIED: number;
    MISSING_LEETCODE_USERNAME: number;
    TOTAL_STUDENTS: number;
  };
}

export interface ParticipationRecord {
  id: number;
  session_id: number;
  contest_slug: string;
  contest_title: string;
  student_id: number;
  leetcode_username: string | null;
  student_name: string;
  reg_no: string;
  department_name: string | null;
  year_level: string | null;
  participation_type: 'PUBLIC' | 'VIRTUAL' | 'NOT_PARTICIPATED' | 'NOT_VERIFIED' | 'MISSING_LEETCODE_USERNAME';
  official_rank: number | null;
  official_score: number | null;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  problems_solved: number;
  finish_time: string | null;
  source: string;
  verification_status: string;
  verified_at?: string | null;
  recently_updated?: boolean;
}

interface PreviousWeekContestPanelProps {
  onStudentClick?: (student: any) => void;
  sessionId?: number | null;
}

export const PreviousWeekContestPanel: React.FC<PreviousWeekContestPanelProps> = ({ onStudentClick, sessionId }) => {
  const [summary, setSummary] = useState<PreviousWeekSummary | null>(null);
  const [records, setRecords] = useState<ParticipationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [simulatingStudentId, setSimulatingStudentId] = useState<number | null>(null);

  // Hook up live websocket updates in a batched way
  const { status: wsStatus, lastSyncAt, latestUpdate: wsLatestUpdate } = useContestWebSocket({
    sessionId: sessionId || null,
    onBatchUpdate: (events: any[]) => {
      setRecords(prev => {
        let changed = false;
        const updated = [...prev];
        
        for (const event of events) {
          if (!event) continue;
          
          let idx = event.studentId != null ? updated.findIndex(rec => rec.student_id === event.studentId) : -1;
          if (idx === -1 && event.regNo) {
            idx = updated.findIndex(rec => rec.reg_no.toLowerCase() === event.regNo.toLowerCase());
          }
          if (idx === -1 && event.username) {
            idx = updated.findIndex(rec => (rec.leetcode_username || '').toLowerCase() === event.username.toLowerCase());
          }
          if (idx === -1) continue;
          
          changed = true;
          const newPType = event.participationStatus;
          const currentRec = updated[idx];
          const newSolved = event.solvedCount ?? currentRec.problems_solved;

          updated[idx] = {
            ...currentRec,
            participation_type: newPType ? (
              (newPType === 'PUBLIC_ATTENDED' || newPType === 'PUBLIC') ? 'PUBLIC'
              : (newPType === 'VIRTUAL_ATTENDED' || newPType === 'VIRTUAL') ? 'VIRTUAL'
              : (newPType === 'NOT_ATTENDED' || newPType === 'PUBLIC_NOT_ATTENDED') ? 'NOT_PARTICIPATED'
              : (newPType === 'PENDING') ? 'NOT_VERIFIED'
              : (newPType === 'UNKNOWN' || newPType === 'USERNAME_NOT_FOUND' || newPType === 'DATA_ERROR' || newPType === 'SOURCE_ERROR') ? 'MISSING_LEETCODE_USERNAME'
              : newPType
            ) : (newSolved > 0 && currentRec.participation_type === 'NOT_PARTICIPATED' ? 'PUBLIC' : currentRec.participation_type),
            q1: event.q1 ?? currentRec.q1,
            q2: event.q2 ?? currentRec.q2,
            q3: event.q3 ?? currentRec.q3,
            q4: event.q4 ?? currentRec.q4,
            problems_solved: newSolved,
            official_rank: event.officialRank ?? currentRec.official_rank,
            recently_updated: true,
          };
        }
        
        return changed ? updated : prev;
      });
    },
    onSyncCompleted: () => {
      // Background silent refresh when a full sync cycle finishes
      fetchPreviousWeekData(false, true);
    }
  });

  // Real-time incremental update for individual student events
  useEffect(() => {
    if (!wsLatestUpdate) return;
    const evt = wsLatestUpdate;
    setRecords(prev => {
      const updated = [...prev];
      let idx = evt.student_id != null ? updated.findIndex(r => r.student_id === evt.student_id) : -1;
      if (idx === -1 && evt.people_id) idx = updated.findIndex(r => r.reg_no === evt.people_id);
      if (idx === -1 && evt.reg_no) idx = updated.findIndex(r => r.reg_no === evt.reg_no);
      if (idx === -1 && evt.account_id) idx = updated.findIndex(r => (r.leetcode_username || '').toLowerCase() === evt.account_id.toLowerCase());

      if (idx !== -1) {
        const old = updated[idx];
        const solved = evt.activity?.count ?? old.problems_solved;
        updated[idx] = {
          ...old,
          q1: evt.activity?.q1 ?? old.q1,
          q2: evt.activity?.q2 ?? old.q2,
          q3: evt.activity?.q3 ?? old.q3,
          q4: evt.activity?.q4 ?? old.q4,
          problems_solved: solved,
          participation_type: (old.participation_type === 'VIRTUAL' ? 'VIRTUAL' : (solved > 0 ? 'PUBLIC' : old.participation_type)),
          recently_updated: true
        };
        return updated;
      }
      return prev;
    });
  }, [wsLatestUpdate]);

  const fetchPreviousWeekData = async (forceSync: boolean = false, silent: boolean = false) => {
    if (!sessionId) return;
    
    try {
      if (forceSync) {
        setSyncing(true);
      } else if (!silent) {
        setLoading(true);
      }
      setError(null);

      const latestSessionId = sessionId;

      if (forceSync && latestSessionId) {
        await api.post(`/contests/sessions/${latestSessionId}/sync`);
      }

      const [summaryRes, matrixRes] = await Promise.all([
        api.get(`/contests/sessions/${latestSessionId}/live-status`),
        api.get(`/contests/sessions/${latestSessionId}/matrix`)
      ]);

      if (summaryRes.data) {
        const d = summaryRes.data;
        setSummary({
          session_id: d.sessionId,
          contest_slug: d.contestId,
          contest_title: d.contestName,
          target_date_ist: d.sessionDate,
          validation_status: d.status,
          publish_status: d.status,
          cache_state: 'HIT',
          dataset_version: 1,
          sync_id: 'live',
          sync_started_at: d.startIso,
          metrics: {
            PUBLIC: d.metrics?.public || 0,
            VIRTUAL: d.metrics?.virtual || 0,
            NOT_PARTICIPATED: d.metrics?.notAttended || 0,
            NOT_VERIFIED: d.metrics?.notVerified || 0,
            MISSING_LEETCODE_USERNAME: d.metrics?.sourceError || 0,
            TOTAL_STUDENTS: d.metrics?.totalStudents || 0,
          }
        });
      }
      
      if (matrixRes.data && matrixRes.data.rows) {
        const mappedRecords: ParticipationRecord[] = matrixRes.data.rows.map((row: any) => ({
          id: row.s_no,
          session_id: latestSessionId,
          contest_slug: row.contest_id,
          contest_title: row.contest_name,
          student_id: row.student_id,
          leetcode_username: row.username,
          student_name: row.name,
          reg_no: row.reg_no,
          department_name: row.dept,
          year_level: row.year,
          participation_type: (row.participation_status === 'PUBLIC_ATTENDED' || row.participation_status === 'PUBLIC') ? 'PUBLIC' 
            : (row.participation_status === 'VIRTUAL_ATTENDED' || row.participation_status === 'VIRTUAL') ? 'VIRTUAL'
            : (row.participation_status === 'NOT_ATTENDED' || row.participation_status === 'PUBLIC_NOT_ATTENDED') ? 'NOT_PARTICIPATED'
            : (row.participation_status === 'PENDING') ? 'NOT_VERIFIED'
            : (row.participation_status === 'UNKNOWN' || row.participation_status === 'USERNAME_NOT_FOUND' || row.participation_status === 'DATA_ERROR' || row.participation_status === 'SOURCE_ERROR') ? 'MISSING_LEETCODE_USERNAME'
            : row.participation_status,
          official_rank: row.rank !== '' && row.rank !== null ? row.rank : null,
          official_score: row.score !== '' && row.score !== null ? row.score : null,
          q1: (row.q1 === 1 || row.q1 === '1') ? 1 : 0,
          q2: (row.q2 === 1 || row.q2 === '1') ? 1 : 0,
          q3: (row.q3 === 1 || row.q3 === '1') ? 1 : 0,
          q4: (row.q4 === 1 || row.q4 === '1') ? 1 : 0,
          problems_solved: (!row.total_contest_solved || row.total_contest_solved === '' || row.total_contest_solved === '—') ? 0 : Number(row.total_contest_solved),
          finish_time: null,
          source: row.source_status || 'UNKNOWN',
          verification_status: row.source_status || 'UNKNOWN'
        }));
        setRecords(mappedRecords);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load Previous Week Contest data.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setSyncing(false);
      }
    }
  };

  // Initial load when sessionId prop changes
  useEffect(() => {
    if (sessionId) {
      fetchPreviousWeekData();
    } else {
      setRecords([]);
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Silent automatic background polling every 12 seconds so UI updates without manual reloads
  useEffect(() => {
    if (!sessionId) return;
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPreviousWeekData(false, true);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleSimulateStep = async (studentId: number, currentSolved: number) => {
    try {
      setSimulatingStudentId(studentId);
      const nextTarget = (currentSolved % 4) + 1;
      await api.post('/contests/live/simulate-step', {
        student_id: studentId,
        target_solved: nextTarget
      });
      // Quick silent re-fetch
      setTimeout(() => fetchPreviousWeekData(false, true), 300);
    } catch (err) {
      console.error('Simulate step failed:', err);
    } finally {
      setTimeout(() => setSimulatingStudentId(null), 500);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedTypeFilter !== 'ALL' && r.participation_type !== selectedTypeFilter) {
        return false;
      }
      if (selectedDeptFilter !== 'ALL' && r.department_name !== selectedDeptFilter) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchName = r.student_name.toLowerCase().includes(query);
        const matchReg = r.reg_no.toLowerCase().includes(query);
        const matchUser = (r.leetcode_username || '').toLowerCase().includes(query);
        if (!matchName && !matchReg && !matchUser) return false;
      }
      return true;
    });
  }, [records, selectedTypeFilter, selectedDeptFilter, searchTerm]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    records.forEach((r) => {
      if (r.department_name) depts.add(r.department_name);
    });
    return Array.from(depts).sort();
  }, [records]);

  // Dynamically calculate metrics directly from real-time records state
  const dynamicMetrics = useMemo(() => {
    const counts = {
      PUBLIC: 0,
      VIRTUAL: 0,
      NOT_PARTICIPATED: 0,
      NOT_VERIFIED: 0,
      MISSING_LEETCODE_USERNAME: 0,
      TOTAL_STUDENTS: records.length,
    };
    records.forEach(r => {
      const type = r.participation_type;
      if (type === 'PUBLIC') counts.PUBLIC++;
      else if (type === 'VIRTUAL') counts.VIRTUAL++;
      else if (type === 'NOT_PARTICIPATED') counts.NOT_PARTICIPATED++;
      else if (type === 'NOT_VERIFIED') counts.NOT_VERIFIED++;
      else if (type === 'MISSING_LEETCODE_USERNAME') counts.MISSING_LEETCODE_USERNAME++;
      else counts.NOT_PARTICIPATED++;
    });
    if (records.length === 0 && summary?.metrics) {
      return summary.metrics;
    }
    return counts;
  }, [records, summary?.metrics]);

  if (loading && !summary) {
    return (
      <div className="p-8 text-center bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Discovering & Analyzing LeetCode Contest Telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top Banner Card */}
      <div className="p-6 rounded-3xl bg-[#0b1120] text-white border border-slate-800/90 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{summary?.publish_status === 'PUBLISHED' ? 'VERIFIED CONTEST DATASET' : 'INSPECTING'}</span>
            </span>
            <span className="text-xs text-slate-300 font-mono font-bold">
              Target: {summary?.target_date_ist || '06.09.2026'}
            </span>
            {wsStatus === 'LIVE' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE SYNC ACTIVE</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span>AUTO-POLLING ACTIVE</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <span>{summary?.contest_title || 'Weekly Contest 518'}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700/60 font-normal">
              {summary?.contest_slug || 'weekly-contest-518'}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Authoritative question-level contest telemetry • 08:00 AM – 09:30 AM IST Official Window • Realtime Ingestion
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchPreviousWeekData(true)}
            disabled={syncing}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Re-Syncing Live...' : 'Force Live Re-Sync'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Notice if completely offline */}
      {wsStatus !== 'LIVE' && (
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-indigo-500" />
            <span>Realtime Auto-Sync active in background • Last sync: {lastSyncAt || 'Live'}</span>
          </div>
          <button
            onClick={() => fetchPreviousWeekData(false, true)}
            className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
          >
            Sync Now
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid — Matching Exact Pastel Palette & High-Contrast Typography */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: PUBLIC / LIVE */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'PUBLIC' ? 'ALL' : 'PUBLIC')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'PUBLIC'
              ? 'bg-[#eefbf4] dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg'
              : 'bg-[#eefbf4] dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">Public / Live</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#0fa958] dark:text-emerald-400 mt-2">
            {dynamicMetrics.PUBLIC}
          </p>
        </button>

        {/* Card 2: VIRTUAL PRACTICE */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'VIRTUAL' ? 'ALL' : 'VIRTUAL')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'VIRTUAL'
              ? 'bg-[#f8f4fe] dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-lg'
              : 'bg-[#f8f4fe] dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 tracking-wider">Virtual Practice</span>
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#8b5cf6] dark:text-purple-400 mt-2">
            {dynamicMetrics.VIRTUAL}
          </p>
        </button>

        {/* Card 3: NOT ATTENDED */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'NOT_PARTICIPATED' ? 'ALL' : 'NOT_PARTICIPATED')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_PARTICIPATED'
              ? 'bg-[#fef2f2] dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/40 shadow-lg'
              : 'bg-[#fef2f2] dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300 tracking-wider">Not Attended</span>
            <UserX className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#f43f5e] dark:text-rose-400 mt-2">
            {dynamicMetrics.NOT_PARTICIPATED}
          </p>
        </button>

        {/* Card 4: PENDING VERIFICATION */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'NOT_VERIFIED' ? 'ALL' : 'NOT_VERIFIED')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_VERIFIED'
              ? 'bg-[#fffbeb] dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/40 shadow-lg'
              : 'bg-[#fffbeb] dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider">Pending Verification</span>
            <HelpCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#d97706] dark:text-amber-400 mt-2">
            {dynamicMetrics.NOT_VERIFIED}
          </p>
        </button>

        {/* Card 5: NO LEETCODE HANDLE */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'MISSING_LEETCODE_USERNAME' ? 'ALL' : 'MISSING_LEETCODE_USERNAME')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'MISSING_LEETCODE_USERNAME'
              ? 'bg-[#f8fafc] dark:bg-slate-900/60 border-slate-400 ring-2 ring-slate-400/40 shadow-lg'
              : 'bg-[#f8fafc] dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-wider">No LeetCode Handle</span>
            <AlertTriangle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#334155] dark:text-slate-200 mt-2">
            {dynamicMetrics.MISSING_LEETCODE_USERNAME}
          </p>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, reg no, or LeetCode username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
            Showing {filteredRecords.length} / {records.length} Students
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/50 text-[11px] font-black uppercase text-slate-500 tracking-wider">
              <th className="py-3.5 px-4 text-center">#</th>
              <th className="py-3.5 px-4">Student Details</th>
              <th className="py-3.5 px-4">LeetCode Handle</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-3 text-center">Q1</th>
              <th className="py-3.5 px-3 text-center">Q2</th>
              <th className="py-3.5 px-3 text-center">Q3</th>
              <th className="py-3.5 px-3 text-center">Q4</th>
              <th className="py-3.5 px-4 text-center">Solved</th>
              <th className="py-3.5 px-4 text-center">Official Rank</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-center">Live Sim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400">
                  No participation records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => {
                const isAbsent = r.participation_type === 'NOT_PARTICIPATED';
                const isMissingHandle = r.participation_type === 'MISSING_LEETCODE_USERNAME';
                const isPending = r.participation_type === 'NOT_VERIFIED';
                const isPublic = r.participation_type === 'PUBLIC';
                const isVirtual = r.participation_type === 'VIRTUAL';

                return (
                  <tr 
                    key={`${r.student_id}-${idx}`}
                    className={`hover:bg-slate-50/80 dark:hover:bg-navy-900/80 transition-colors ${
                      r.recently_updated ? 'bg-emerald-500/10 dark:bg-emerald-950/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => onStudentClick && onStudentClick(r)}
                        className="cursor-pointer group"
                      >
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {r.student_name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {r.reg_no} {r.year_level && `• ${r.year_level} Year`}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.leetcode_username ? (
                        <a
                          href={`https://leetcode.com/u/${r.leetcode_username}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          @{r.leetcode_username}
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 italic">
                          No Handle
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {r.department_name || '—'}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q1 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q1 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q2 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q2 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q3 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q3 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q4 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q4 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 dark:text-white">
                      {r.problems_solved} / 4
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                      {r.official_rank != null ? `#${r.official_rank.toLocaleString()}` : '#—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isPublic && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ATTENDED
                        </span>
                      )}
                      {isVirtual && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          VIRTUAL
                        </span>
                      )}
                      {isAbsent && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          ABSENT
                        </span>
                      )}
                      {isMissingHandle && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                          NO HANDLE
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleSimulateStep(r.student_id, r.problems_solved)}
                        disabled={simulatingStudentId === r.student_id}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer disabled:opacity-40"
                        title="Simulate Realtime Solve Event"
                      >
                        <Zap className={`w-3.5 h-3.5 ${simulatingStudentId === r.student_id ? 'animate-bounce text-amber-500' : ''}`} />
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
  );
};
