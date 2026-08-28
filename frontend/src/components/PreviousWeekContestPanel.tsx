import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, RefreshCw, AlertTriangle, CheckCircle2, Search,
  Award, Sparkles, UserX, Clock, Building2, ShieldCheck, HelpCircle,
  Radio, Wifi, WifiOff, Check, Minus, Play
} from 'lucide-react';
import api from '../services/api';
import { useContestWebSocket } from '../hooks/useContestWebSocket';

interface PreviousWeekSummary {
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
  metrics: {
    PUBLIC: number;
    VIRTUAL: number;
    NOT_PARTICIPATED: number;
    NOT_VERIFIED: number;
    MISSING_LEETCODE_USERNAME: number;
    TOTAL_STUDENTS: number;
  };
}

interface ParticipationRecord {
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
}

interface PreviousWeekContestPanelProps {
  onStudentClick?: (student: any) => void;
}

export const PreviousWeekContestPanel: React.FC<PreviousWeekContestPanelProps> = ({ onStudentClick }) => {
  const [summary, setSummary] = useState<PreviousWeekSummary | null>(null);
  const [records, setRecords] = useState<ParticipationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('PUBLIC');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Realtime WebSocket State
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));

  // Hook up live websocket updates
  useContestWebSocket({
    sessionId: summary?.session_id || null,
    onResultUpdate: (event: any) => {
      if (!event || !event.studentId) return;
      setRecords(prev => prev.map(rec => {
        if (rec.student_id !== event.studentId) return rec;
        
        // Also update summary totals artificially if possible, but at minimum we update the records so the table stays fresh!
        return {
          ...rec,
          participation_type: event.participationStatus || rec.participation_type,
          q1: event.q1 ?? rec.q1,
          q2: event.q2 ?? rec.q2,
          q3: event.q3 ?? rec.q3,
          q4: event.q4 ?? rec.q4,
          problems_solved: event.solvedCount ?? rec.problems_solved,
          official_rank: event.officialRank ?? rec.official_rank,
        };
      }));
    }
  });

  const [simulatingStudentId, setSimulatingStudentId] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const fetchPreviousWeekData = async (forceSync: boolean = false) => {
    try {
      if (forceSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let latestSessionId = summary?.session_id;

      if (!latestSessionId) {
        const sessionsRes = await api.get('/contests/sessions');
        const sessions = sessionsRes.data;
        if (!sessions || sessions.length === 0) {
          throw new Error("No contest sessions found.");
        }
        latestSessionId = sessions[0].sessionId;
      }

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
        const mappedRecords = matrixRes.data.rows.map((row: any) => ({
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
          participation_type: row.participation_status === 'PUBLIC_ATTENDED' ? 'PUBLIC' : row.participation_status,
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
      setLastLiveUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load Previous Week Contest data.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // ─── WebSocket Ingestion Subscription ────────────────────────────────────────
  const connectWebSocket = () => {
    try {
      const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
      let wsUrl = '';
      if (envUrl) {
        const targetHost = envUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
        const wsProtocol = envUrl.startsWith('https') ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${targetHost}/ws/leaderboard`;
      } else {
        const isHttps = window.location.protocol === 'https:';
        const wsProtocol = isHttps ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        wsUrl = `${wsProtocol}//${wsHost}/ws/leaderboard`;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Case 1: Targeted Student Question Solve Event
          if (data.type === 'CONTEST_RESULT_UPDATED') {
            const sid = data.studentId || data.student_id;
            const regNo = data.regNo || data.reg_no;
            const uname = (data.username || data.leetcode_username || '').toLowerCase();

            setRecords(prevRecords => {
              const idx = prevRecords.findIndex(r => 
                (sid && r.student_id === sid) ||
                (regNo && r.reg_no === regNo) ||
                (uname && (r.leetcode_username || '').toLowerCase() === uname)
              );

              if (idx !== -1) {
                const updated = [...prevRecords];
                updated[idx] = {
                  ...updated[idx],
                  q1: data.q1 !== undefined ? data.q1 : updated[idx].q1,
                  q2: data.q2 !== undefined ? data.q2 : updated[idx].q2,
                  q3: data.q3 !== undefined ? data.q3 : updated[idx].q3,
                  q4: data.q4 !== undefined ? data.q4 : updated[idx].q4,
                  problems_solved: data.solvedCount !== undefined ? data.solvedCount : (data.problems_solved !== undefined ? data.problems_solved : updated[idx].problems_solved),
                  official_rank: data.officialRank !== undefined ? data.officialRank : updated[idx].official_rank,
                  finish_time: data.finishTime || updated[idx].finish_time,
                  participation_type: data.participationStatus || data.participation_type || updated[idx].participation_type,
                  verification_status: 'VERIFIED'
                };
                return updated;
              }
              return prevRecords;
            });

            setLastLiveUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
          }

          // Case 2: Live Summary Metric Updates
          if (data.type === 'CONTEST_SUMMARY_UPDATED' && data.metrics) {
            setSummary(prev => prev ? {
              ...prev,
              metrics: {
                ...prev.metrics,
                ...data.metrics
              }
            } : null);
            setLastLiveUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
          }
        } catch (e) {
          // Ignore non-JSON pings
        }
      };

      socket.onerror = () => {
        setWsConnected(false);
      };

      socket.onclose = () => {
        setWsConnected(false);
      };
    } catch (e) {
      setWsConnected(false);
    }
  };

  useEffect(() => {
    fetchPreviousWeekData();
    connectWebSocket();

    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send('ping');
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const handleSimulateStep = async (studentId: number, currentSolved: number) => {
    try {
      setSimulatingStudentId(studentId);
      const nextTarget = (currentSolved % 4) + 1;
      await api.post('/contests/live/simulate-step', {
        student_id: studentId,
        target_solved: nextTarget
      });
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

  if (loading && !summary) {
    return (
      <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          Discovering & Analyzing LeetCode Contest...
        </p>
      </div>
    );
  }

  const metrics = summary?.metrics || {
    PUBLIC: 0,
    VIRTUAL: 0,
    NOT_PARTICIPATED: 0,
    NOT_VERIFIED: 0,
    MISSING_LEETCODE_USERNAME: 0,
    TOTAL_STUDENTS: 0,
  };

  return (
    <div className="space-y-6">

      {/* Top Banner Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{summary?.publish_status === 'PUBLISHED' ? 'VERIFIED CONTEST DATASET' : 'INSPECTING'}</span>
            </span>
            <span className="text-xs text-indigo-300 font-mono font-bold">
              Target: {summary?.target_date_ist}
            </span>
            {wsConnected ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE SYNC ACTIVE</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE (POLLING)</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>{summary?.contest_title || 'Weekly Contest Session'}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-white/10 text-gray-300 font-normal">
              {summary?.contest_slug}
            </span>
          </h2>
          <p className="text-xs text-gray-300">
            Authoritative question-level contest telemetry • 08:00 AM – 09:30 AM IST Official Window • Realtime Ingestion
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchPreviousWeekData(true)}
            disabled={syncing}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Re-Syncing Live...' : 'Force Live Re-Sync'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Warning Pill */}
      {!wsConnected && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>⚠ Live WebSocket connection interrupted • Last valid update: {lastLiveUpdate}</span>
          </div>
          <button
            onClick={connectWebSocket}
            className="px-3 py-1 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition"
          >
            Reconnect Live Stream
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: PUBLIC / LIVE */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'PUBLIC' ? 'ALL' : 'PUBLIC')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'PUBLIC'
              ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
              : 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Public / Live</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-2">
            {metrics.PUBLIC}
          </p>
        </button>

        {/* Card 2: VIRTUAL */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'VIRTUAL' ? 'ALL' : 'VIRTUAL')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'VIRTUAL'
              ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
              : 'bg-purple-500/10 border-purple-500/20 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Virtual Practice</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-purple-700 dark:text-purple-300 mt-2">
            {metrics.VIRTUAL}
          </p>
        </button>

        {/* Card 3: NOT PARTICIPATED */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'NOT_PARTICIPATED' ? 'ALL' : 'NOT_PARTICIPATED')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_PARTICIPATED'
              ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30 shadow-lg'
              : 'bg-rose-500/10 border-rose-500/20 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">Not Attended</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-rose-700 dark:text-rose-300 mt-2">
            {metrics.NOT_PARTICIPATED}
          </p>
        </button>

        {/* Card 4: NOT VERIFIED */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'NOT_VERIFIED' ? 'ALL' : 'NOT_VERIFIED')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_VERIFIED'
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
              : 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Pending Verification</span>
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-700 dark:text-amber-300 mt-2">
            {metrics.NOT_VERIFIED}
          </p>
        </button>

        {/* Card 5: MISSING USERNAME */}
        <button
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'MISSING_LEETCODE_USERNAME' ? 'ALL' : 'MISSING_LEETCODE_USERNAME')}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'MISSING_LEETCODE_USERNAME'
              ? 'bg-slate-500/20 border-slate-500 ring-2 ring-slate-500/30 shadow-lg'
              : 'bg-slate-500/10 border-slate-500/20 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">No LeetCode Handle</span>
            <AlertTriangle className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-slate-700 dark:text-slate-300 mt-2">
            {metrics.MISSING_LEETCODE_USERNAME}
          </p>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-navy-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student, reg no, or LeetCode username..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold font-mono">
          Showing {filteredRecords.length} / {records.length} Students • Realtime Sync Active
        </div>
      </div>

      {/* Authoritative Question-Level Data Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-50 dark:bg-navy-950 text-gray-400 font-black uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="p-3.5">#</th>
              <th className="p-3.5">Student Details</th>
              <th className="p-3.5">LeetCode Handle</th>
              <th className="p-3.5">Department</th>
              <th className="p-3.5 text-center">Q1</th>
              <th className="p-3.5 text-center">Q2</th>
              <th className="p-3.5 text-center">Q3</th>
              <th className="p-3.5 text-center">Q4</th>
              <th className="p-3.5 text-center">Solved</th>
              <th className="p-3.5">Official Rank</th>
              <th className="p-3.5">Status</th>
              
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((rec, idx) => {
                const isPublic = rec.participation_type === 'PUBLIC';
                const q1Done = Boolean(rec.q1) || (isPublic && rec.problems_solved >= 1);
                const q2Done = Boolean(rec.q2) || (isPublic && rec.problems_solved >= 2);
                const q3Done = Boolean(rec.q3) || (isPublic && rec.problems_solved >= 3);
                const q4Done = Boolean(rec.q4) || (isPublic && rec.problems_solved >= 4);

                return (
                  <tr 
                    key={rec.id || rec.student_id} 
                    className="hover:bg-gray-50/50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (onStudentClick) {
                        onStudentClick({ id: rec.student_id, name: rec.student_name, reg_no: rec.reg_no, department: { name: rec.department_name }, year_level: rec.year_level, username: rec.leetcode_username });
                      }
                    }}
                  >
                    <td className="p-3.5 font-mono text-gray-400 font-bold">{idx + 1}</td>
                    <td className="p-3.5">
                      <div className="font-extrabold text-gray-900 dark:text-white">{rec.student_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{rec.reg_no} • {rec.year_level || '—'} Year</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold">
                      {rec.leetcode_username ? (
                        <span className="text-indigo-600 dark:text-indigo-400">@{rec.leetcode_username}</span>
                      ) : (
                        <span className="text-gray-400 italic">Unlinked</span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300 font-semibold">
                      {rec.department_name || '—'}
                    </td>

                    {/* Question Q1 */}
                    <td className="p-3.5 text-center">
                      {q1Done ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">1</span>
                      ) : (
                        <span className="text-gray-400 font-bold">0</span>
                      )}
                    </td>

                    {/* Question Q2 */}
                    <td className="p-3.5 text-center">
                      {q2Done ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">1</span>
                      ) : (
                        <span className="text-gray-400 font-bold">0</span>
                      )}
                    </td>

                    {/* Question Q3 */}
                    <td className="p-3.5 text-center">
                      {q3Done ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">1</span>
                      ) : (
                        <span className="text-gray-400 font-bold">0</span>
                      )}
                    </td>

                    {/* Question Q4 */}
                    <td className="p-3.5 text-center">
                      {q4Done ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">1</span>
                      ) : (
                        <span className="text-gray-400 font-bold">0</span>
                      )}
                    </td>

                    {/* Solved Count */}
                    <td className="p-3.5 text-center font-mono font-black text-xs">
                      {rec.problems_solved > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                          {rec.problems_solved} / 4
                        </span>
                      ) : (
                        <span className="text-gray-400">0 / 4</span>
                      )}
                    </td>

                    {/* Rank */}
                    <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-300">
                      {rec.official_rank ? `#${rec.official_rank}` : '—'}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5">
                      {rec.participation_type === 'PUBLIC' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300 inline-flex items-center gap-1">
                          <Award className="w-3 h-3" /> LIVE
                        </span>
                      )}
                      {rec.participation_type === 'VIRTUAL' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-[10px] border border-purple-300 inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> VIRTUAL
                        </span>
                      )}
                      {rec.participation_type === 'NOT_PARTICIPATED' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-300 inline-flex items-center gap-1">
                          <UserX className="w-3 h-3" /> ABSENT
                        </span>
                      )}
                      {rec.participation_type === 'NOT_VERIFIED' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-300 inline-flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> PENDING
                        </span>
                      )}
                      {rec.participation_type === 'MISSING_LEETCODE_USERNAME' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] border border-slate-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> NO HANDLE
                        </span>
                      )}
                    </td>


                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="p-8 text-center text-gray-400 italic">
                  No participation records match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
