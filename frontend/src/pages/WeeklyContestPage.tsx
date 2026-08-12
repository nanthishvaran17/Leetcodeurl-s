import React, { useState, useEffect } from 'react';
import { 
  Trophy, Calendar, RefreshCw, AlertTriangle, Download, FileSpreadsheet, 
  FileText, CheckCircle2, XCircle, Clock, ShieldCheck, PlayCircle, Lock, Layers, ArrowUpRight, ArrowDownRight, Zap, Filter
} from 'lucide-react';
import api from '../services/api';

export const WeeklyContestPage: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'error_board' | 'comparison'>('matrix');
  const [loading, setLoading] = useState<boolean>(true);
  const [customCalendarDate, setCustomCalendarDate] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    fetchInitialContestData();
  }, []);

  const handleCalendarDateChange = async (dateStr: string) => {
    if (!dateStr) return;
    setCustomCalendarDate(dateStr);
    try {
      const res = await api.post(`/contests/custom-session?date=${dateStr}`);
      if (res.data?.sessionId) {
        setSessionsList(prev => {
          const exists = prev.some(s => s.sessionId === res.data.sessionId);
          return exists ? prev : [res.data, ...prev];
        });
        handleSelectSession(res.data.sessionId);
      }
    } catch (err) {
      console.error("Failed to load session for date", dateStr, err);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter);
    }
  }, [selectedSessionId, selectedDeptFilter, selectedYearFilter]);

  const fetchInitialContestData = async () => {
    setLoading(true);
    try {
      const [currRes, listRes] = await Promise.all([
        api.get('/contests/current-session'),
        api.get('/contests/sessions')
      ]);
      setCurrentSession(currRes.data);
      const list = listRes.data || [];
      setSessionsList(list);
      const targetId = currRes.data?.sessionId || (list.length > 0 ? list[0].sessionId : null);
      if (targetId) {
        setSelectedSessionId(targetId);
        fetchSessionDetails(targetId, selectedDeptFilter, selectedYearFilter);
      }
    } catch (err) {
      console.error("Failed to load contest session data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    fetchSessionDetails(sessionId, selectedDeptFilter, selectedYearFilter);
  };

  const fetchSessionDetails = async (sessionId: number, dept: string = 'ALL', year: string = 'ALL') => {
    try {
      let matrixUrl = `/contests/sessions/${sessionId}/matrix?dept=${dept}&year=${year}`;
      const [matRes, errRes, compRes] = await Promise.all([
        api.get(matrixUrl),
        api.get(`/contests/sessions/${sessionId}/data-quality`),
        api.get(`/contests/sessions/${sessionId}/comparison`)
      ]);
      setMatrixRows(matRes.data.rows || []);
      setErrorLogs(errRes.data || []);
      setComparison(compRes.data || null);
    } catch (err) {
      console.error("Failed to load session details", err);
    }
  };

  const handleRetryErrors = async () => {
    if (!selectedSessionId) return;
    setIsRetrying(true);
    try {
      const res = await api.post(`/contests/sessions/${selectedSessionId}/retry`);
      alert(`Live fetch retry completed: ${res.data.resolved_count} records updated, ${res.data.still_failing} pending.`);
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to execute live retry.");
    } finally {
      setIsRetrying(false);
    }
  };

  const downloadReportFile = (format: string) => {
    if (!selectedSessionId) return;
    const url = `/reports/${selectedSessionId}/${format}`;
    api.get(url, { responseType: 'blob' }).then(res => {
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;
      link.setAttribute('download', `Nandha_Weekly_Contest_${currentSession?.sessionDate || 'Report'}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Loading Institutional Weekly Contest Engine...</p>
      </div>
    );
  }

  // Calculate filtered stats
  const totalRows = matrixRows.length;
  const attendedRows = matrixRows.filter(r => r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED').length;
  const notAttendedRows = matrixRows.filter(r => r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'PENDING').length;
  const virtualRows = matrixRows.filter(r => r.participation_status === 'VIRTUAL_ATTENDED').length;
  const errorRows = matrixRows.filter(r => r.participation_status === 'DATA_ERROR').length;

  const defaultSessions = [
    { sessionId: 1, sessionCode: "WEEK-2026-08-09", sessionDate: "09.08.2026", contestName: "Weekly Contest 469 (LAST WEEK)", status: "FINALIZED" },
    { sessionId: 2, sessionCode: "WEEK-2026-08-16", sessionDate: "16.08.2026", contestName: "Weekly Contest 470 (CURRENT WEEK)", status: "LIVE" },
    { sessionId: 3, sessionCode: "WEEK-2026-08-23", sessionDate: "23.08.2026", contestName: "Weekly Contest 471 (UPCOMING WEEK)", status: "SCHEDULED" }
  ];
  const displaySessions = sessionsList.length > 0 ? sessionsList : defaultSessions;

  const activeSessionObj = displaySessions.find(s => s.sessionId === selectedSessionId) || currentSession || defaultSessions[1];
  const statusColor = activeSessionObj?.status === 'LIVE' ? 'bg-emerald-500 text-white animate-pulse' :
                      activeSessionObj?.status === 'FINALIZED' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Live Session Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${statusColor}`}>
                <Trophy className="w-3.5 h-3.5" />
                <span>{activeSessionObj?.status === 'LIVE' ? '🟢 LIVE PUBLIC CONTEST' : activeSessionObj?.status === 'FINALIZED' ? '🔒 LOCKED & FINALIZED' : '🔵 SCHEDULED'}</span>
              </span>
              <span className="text-xs font-mono font-bold text-gray-400">
                IST Window: 08:00 AM – 09:30 AM IST
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              🏆 {activeSessionObj?.contestName || 'Weekly Contest Tracker'}
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              NANDHA ENGINEERING COLLEGE • AUTOMATED CONTEST ENGINE ({activeSessionObj?.sessionDate || 'Sunday Session'})
            </p>
          </div>

          {/* Export Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => downloadReportFile('excel')} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              Excel (.xlsx)
            </button>
            <button onClick={() => downloadReportFile('pdf')} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              PDF (.pdf)
            </button>
            <button onClick={() => downloadReportFile('word')} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              Word (.docx)
            </button>
            <button onClick={() => downloadReportFile('zip')} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              All (.zip)
            </button>
          </div>
        </div>
      </div>

      {/* Week Selector Quick Tabs Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-400 tracking-wider">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span>Select Weekly Session to View:</span>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Interactive Calendar Date Picker */}
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-brand-500" />
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Pick Date:</span>
              <input
                type="date"
                value={customCalendarDate}
                onChange={(e) => handleCalendarDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer"
              />
            </div>

            {/* Session Dropdown Selector */}
            <select
              value={selectedSessionId || ''}
              onChange={(e) => handleSelectSession(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer min-w-[220px]"
            >
              {displaySessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  📅 {s.sessionDate} — {s.contestName} ({s.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Week Pill Buttons (Last Week, Current Week, Upcoming Week) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {displaySessions.map((s) => {
            const isSelected = s.sessionId === selectedSessionId;
            return (
              <button
                key={s.sessionId}
                onClick={() => handleSelectSession(s.sessionId)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700'
                }`}
              >
                <span>📅 {s.sessionDate}</span>
                <span>•</span>
                <span>{s.contestName}</span>
                <span className={`px-2 py-0.5 text-[9px] rounded-full font-mono uppercase font-bold ${
                  s.status === 'LIVE' ? 'bg-emerald-400 text-slate-900' : s.status === 'FINALIZED' ? 'bg-indigo-900 text-indigo-200' : 'bg-amber-400 text-slate-900'
                }`}>
                  {s.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Combined Department & Year Filters Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-400 tracking-wider">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Combined Department & Academic Year Filter:</span>
          </div>

          <button
            onClick={handleRetryErrors}
            disabled={isRetrying}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-md transition-all"
          >
            <Zap className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Syncing...' : '🔄 Live Sync Current Contest Data'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Department Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'CSE(CS)', 'CSE(IOT)'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDeptFilter(dept)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedDeptFilter === dept
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {dept === 'ALL' ? '🏢 All Depts (Combined)' : dept}
                </button>
              ))}
            </div>
          </div>

          {/* Year Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Academic Year</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'II', 'III', 'IV'].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYearFilter(yr)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedYearFilter === yr
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {yr === 'ALL' ? '🎓 All Years (Combined)' : `${yr} Year`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Snapshot Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm text-center">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Filter Roster Count</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{totalRows}</p>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-1">🟢 Public Attended</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{attendedRows}</p>
        </div>

        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
          <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider mb-1">🔴 Public Not Attended</p>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{notAttendedRows}</p>
        </div>

        <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
          <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-1">🔵 Virtual Attended</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{virtualRows}</p>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-1">⚠️ Data Errors</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{errorRows}</p>
        </div>
      </div>

      {/* Week-to-Week Comparison Bar */}
      {comparison && comparison.previousWeek && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">This Week vs Last Week Analytics</h4>
              <p className="text-xs text-gray-500 font-bold">
                Public Participation: <b>{comparison.currentWeek?.rate}%</b> (Last Week: {comparison.previousWeek?.rate}%)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1 ${comparison.comparison?.status === 'IMPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
              {comparison.comparison?.status === 'IMPROVED' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{comparison.comparison?.status} ({comparison.comparison?.rateChange > 0 ? `+${comparison.comparison?.rateChange}%` : `${comparison.comparison?.rateChange}%`})</span>
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'matrix' ? 'bg-brand-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            📊 Live Question-Wise Matrix ({totalRows})
          </button>
          <button
            onClick={() => setActiveTab('error_board')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 ${activeTab === 'error_board' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Data Quality Error Board ({errorLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content 1: Question Matrix Table */}
      {activeTab === 'matrix' && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-center">S.No</th>
                  <th className="px-4 py-3">Reg No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 text-center">Dept</th>
                  <th className="px-4 py-3 text-center">Year</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Q1</th>
                  <th className="px-4 py-3 text-center">Q2</th>
                  <th className="px-4 py-3 text-center">Q3</th>
                  <th className="px-4 py-3 text-center">Q4</th>
                  <th className="px-4 py-3 text-right">Contest Solved</th>
                  <th className="px-4 py-3 text-right">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {matrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-gray-500 font-bold">
                      No contest participation records found for the selected department and year filters.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map((r, idx) => {
                    const isAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED';
                    const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED';
                    const isError = r.participation_status === 'DATA_ERROR';

                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{r.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.dept}</td>
                        <td className="px-4 py-2.5 text-center">{r.year}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                            isAttended ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            isNotAttended ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                            isError ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {isAttended ? '🟢 ATTENDED' : isNotAttended ? '🔴 NOT ATTENDED' : isError ? '⚠️ DATA ERROR' : '🟡 PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold">{r.q1 ? "🟢 1" : "0"}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold">{r.q2 ? "🟢 1" : "0"}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold">{r.q3 ? "🟢 1" : "0"}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold">{r.q4 ? "🟢 1" : "0"}</td>
                        <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">{r.total_solved}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">{r.rank}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: Data Quality Error Board */}
      {activeTab === 'error_board' && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Data Quality Error Log ({errorLogs.length} Logged Entries)</span>
            </h3>
            <p className="text-xs text-gray-500 font-bold">API failure is NEVER marked as NOT ATTENDED.</p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-white font-black uppercase">
                <tr>
                  <th className="px-4 py-3">Register No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Error Type</th>
                  <th className="px-4 py-3">Error Message</th>
                  <th className="px-4 py-3 text-center">Attempts</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {errorLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                      🎉 Zero fetch errors! All student data verified cleanly.
                    </td>
                  </tr>
                ) : (
                  errorLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                      <td className="px-4 py-2.5 font-bold">{log.reg_no}</td>
                      <td className="px-4 py-2.5">{log.student_name}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">{log.error_type}</td>
                      <td className="px-4 py-2.5 text-gray-500">{log.error_message || '—'}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold">{log.attempt_count}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${log.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
