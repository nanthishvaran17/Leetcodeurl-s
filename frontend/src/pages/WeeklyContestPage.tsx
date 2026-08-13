import React, { useState, useEffect } from 'react';
import {
  Trophy, Calendar, RefreshCw, AlertTriangle, Download, FileSpreadsheet,
  FileText, CheckCircle2, XCircle, Clock, ShieldCheck, PlayCircle, Lock, Layers, ArrowUpRight, ArrowDownRight, Zap, Filter, Trash2
} from 'lucide-react';
import api from '../services/api';

export const WeeklyContestPage: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState<string>('ALL');
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'error_board' | 'comparison'>('matrix');
  const [loading, setLoading] = useState<boolean>(true);
  const [customCalendarDate, setCustomCalendarDate] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const latestReqIdRef = React.useRef(0);

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
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
    }
  }, [selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter]);

  const fetchInitialContestData = async () => {
    setLoading(true);
    try {
      const [currRes, allSessionsRes] = await Promise.all([
        api.get('/contests/current-session'),
        api.get('/contests/sessions')
      ]);
      setCurrentSession(currRes.data);
      const list = allSessionsRes.data || [];
      setSessionsList(list);
      
      const targetId = (list.length > 0 ? list[0].sessionId : null) || currRes.data?.sessionId;
      if (targetId) {
        setSelectedSessionId(targetId);
      } else {
        setSelectedSessionId(null);
        setMatrixRows([]);
        setErrorLogs([]);
        setComparison(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to load contest session data", err);
      setLoading(false);
    }
  };

  const selectedSessionIdRef = React.useRef<number | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const handleSelectSession = (sessionId: number) => {
    if (sessionId === selectedSessionId) return;
    const sessObj = sessionsList.find(s => s.sessionId === sessionId);
    console.log("[CONTEST CLICK]", { contestNumber: sessObj?.contestNumber, sessionId });
    
    // Clear all prior state & reset filters before loading new contest data to enforce ZERO STALE CARRYOVER
    setLoading(true);
    setMatrixRows([]);
    setSessionMetrics(null);
    setErrorLogs([]);
    setComparison(null);
    setSelectedDeptFilter('ALL');
    setSelectedYearFilter('ALL');
    setSelectedAttendanceFilter('ALL');

    selectedSessionIdRef.current = sessionId;
    setSelectedSessionId(sessionId);
  };

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const fetchSessionDetails = async (sessionId: number, dept: string = 'ALL', year: string = 'ALL', attendance: string = 'ALL') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestedSessionId = sessionId;
    const reqId = ++latestReqIdRef.current;

    console.log("[MATRIX REQUEST]", {
      sessionId: requestedSessionId,
      url: `/contests/sessions/${requestedSessionId}/matrix`,
      dept,
      year,
      attendance
    });

    setLoading(true);
    setMatrixRows([]);
    setSessionMetrics(null);

    try {
      let matrixUrl = `/contests/sessions/${requestedSessionId}/matrix?dept=${dept}&year=${year}&attendance=${attendance}`;
      const [matRes, errRes, compRes] = await Promise.all([
        api.get(matrixUrl, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/data-quality`, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/comparison`, { signal: controller.signal })
      ]);
      
      const responseSessionId = matRes.data?.sessionId ?? matRes.data?.session_id;
      const responseContestNumber = matRes.data?.contestNumber ?? matRes.data?.contest_number;

      // 1. Request Race Protection
      if (reqId !== latestReqIdRef.current) {
        console.warn("[IGNORED SUPERSEEDED REQUEST]", { requestedSessionId, reqId, latestReqId: latestReqIdRef.current });
        return;
      }

      // 2. Validate response session_id matches requested session_id
      if (responseSessionId != null && Number(responseSessionId) !== Number(requestedSessionId)) {
        console.error("[BLOCKED STALE CONTEST RESPONSE]", { requestedSessionId, responseSessionId, responseContestNumber });
        return;
      }

      // 3. Verify currently selected session in ref has not changed
      if (selectedSessionIdRef.current !== requestedSessionId) {
        console.warn("[IGNORED OUTDATED CONTEST RESPONSE]", { selectedRef: selectedSessionIdRef.current, requestedSessionId });
        return;
      }

      console.log("[MATRIX RESPONSE]", {
        requestedSessionId,
        responseSessionId,
        responseContestNumber,
        rows: matRes.data?.rows?.length
      });

      console.log("[STATE COMMIT]", {
        sessionId: requestedSessionId,
        contestNumber: responseContestNumber,
        rows: matRes.data?.rows?.length
      });

      setMatrixRows(matRes.data?.rows || []);
      setSessionMetrics(matRes.data?.metrics || null);
      setErrorLogs(errRes.data || []);
      setComparison(compRes.data || null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log(`[CONTEST FETCH ABORTED] Request for session ${sessionId} cancelled.`);
        return;
      }
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        console.error("Contest matrix fetch failed", err);
      }
    } finally {
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        setLoading(false);
      }
    }
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSummary, setSyncSummary] = useState<any>(null);

  const handleFetchSelectedContest = async () => {
    if (!selectedSessionId) return;
    setIsSyncing(true);
    try {
      console.log(`[SINGLE CONTEST SYNC START] Session ${selectedSessionId}`);
      const res = await api.post(`/contests/sessions/${selectedSessionId}/sync`);
      console.log("[SINGLE CONTEST SYNC RESPONSE]", res.data);
      setSyncSummary(res.data);
      
      // Reload matrix for the selected session
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
      
      alert(`Successfully synchronized session ${selectedSessionId}. Validated ${res.data.target_authentic} authentic results.`);
    } catch (err: any) {
      console.error("[SINGLE CONTEST SYNC ERROR]", err);
      const detailMsg = err.response?.data?.detail || err.message || "Synchronization could not be completed.";
      alert(`Sync Notice: ${detailMsg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSession = async (sessionId: number, sessionLabel: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger session select
    const session = displaySessions.find(s => s.sessionId === sessionId);
    if (session?.status === 'LIVE') {
      alert('🔴 Cannot delete a LIVE session. Finalize the contest first.');
      return;
    }
    if (!window.confirm(`⚠️ Permanently delete "${sessionLabel}"?\n\nThis will also delete all contest results, snapshots, and email logs for this session.\n\nThis action cannot be undone.`)) return;
    setDeletingSessionId(sessionId);
    try {
      await api.delete(`/contests/sessions/${sessionId}`);
      // Remove from local list
      setSessionsList(prev => prev.filter(s => s.sessionId !== sessionId));
      // If deleted session was selected, switch to the first remaining
      if (selectedSessionId === sessionId) {
        const remaining = sessionsList.filter(s => s.sessionId !== sessionId);
        if (remaining.length > 0) handleSelectSession(remaining[0].sessionId);
        else { setSelectedSessionId(null); setMatrixRows([]); setErrorLogs([]); setComparison(null); }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete session.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const downloadReportFile = (format: string) => {
    if (!selectedSessionId) return;
    const deptParam = encodeURIComponent(selectedDeptFilter || 'ALL');
    const yearParam = encodeURIComponent(selectedYearFilter || 'ALL');
    const attParam = encodeURIComponent(selectedAttendanceFilter || 'ALL');
    const url = `/reports/${selectedSessionId}/${format}?dept=${deptParam}&year=${yearParam}&attendance=${attParam}`;
    const selSession = sessionsList.find(s => s.sessionId === selectedSessionId) || activeSessionObj;

    const contestName = selSession?.contestName || 'Weekly Contest';
    const match = contestName.match(/\d+/);
    const contestNum = match ? match[0] : selectedSessionId;
    const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;

    let filename = `Weekly_Contest_${contestNum}`;
    const isFiltered = (selectedDeptFilter !== 'ALL') || (selectedYearFilter !== 'ALL') || (selectedAttendanceFilter !== 'ALL');
    if (isFiltered) {
      if (selectedDeptFilter !== 'ALL') filename += `_${selectedDeptFilter.replace(/[()]/g, '')}`;
      if (selectedYearFilter !== 'ALL') filename += `_${selectedYearFilter}`;
      if (selectedAttendanceFilter !== 'ALL') filename += `_${selectedAttendanceFilter}`;
    }
    filename += `.${ext}`;

    api.get(url, { responseType: 'blob' }).then(res => {
      // Parse disposition filename if available
      const disposition = res.headers['content-disposition'];
      let serverFilename = filename;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) serverFilename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', serverFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }).catch(async (err) => {
      console.error('Download failed:', err);
      let errMsg = 'Failed to download report. Please try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.detail) errMsg = parsed.detail;
        } catch (_e) { }
      }
      alert(errMsg);
    });
  };

  if (loading) {
    const loadingSession = sessionsList.find(s => s.sessionId === selectedSessionId);
    const loadingName = loadingSession?.contestName || 'Institutional Weekly Contest Engine';
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Loading {loadingName}...</p>
      </div>
    );
  }

  // Calculate filtered stats dynamically
  const totalRows = sessionMetrics?.totalStudents ?? matrixRows.length;
  const attendedRows = sessionMetrics?.officialAttended ?? sessionMetrics?.officialParticipants ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC').length;
  const notAttendedRows = sessionMetrics?.notAttended ?? sessionMetrics?.notParticipated ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'PENDING' || r.status === 'NOT ATTENDED').length;
  const virtualRows = sessionMetrics?.virtualAttended ?? sessionMetrics?.virtualParticipants ?? matrixRows.filter(r => r.participation_status === 'VIRTUAL_ATTENDED' || r.status === 'VIRTUAL').length;
  const errorRows = sessionMetrics?.dataErrors ?? sessionMetrics?.failedVerification ?? matrixRows.filter(r => r.participation_status === 'DATA_ERROR').length;

  const displaySessions = sessionsList;
  const activeSessionObj = displaySessions.find(s => s.sessionId === selectedSessionId) || currentSession;
  const statusColor = activeSessionObj?.status === 'LIVE' ? 'bg-emerald-500 text-white animate-pulse' :
    activeSessionObj?.status === 'FINALIZED' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white';

  const toggleAttendanceFilter = (targetFilter: string) => {
    if (selectedAttendanceFilter === targetFilter) {
      setSelectedAttendanceFilter('ALL');
    } else {
      setSelectedAttendanceFilter(targetFilter);
    }
  };

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
            <button onClick={() => setShowPreviewModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105 flex items-center space-x-1.5 cursor-pointer">
              <span>👁</span>
              <span>Preview Report</span>
            </button>
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
              {displaySessions.length === 0 ? (
                <option value="">No recent completed Weekly Contest is available.</option>
              ) : (
                displaySessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    📅 {s.sessionDate} — {s.contestName} ({s.status})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Quick Week Pill Buttons (Latest completed contest in 7-day window) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {displaySessions.length === 0 ? (
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 py-1">
              ⚠️ No recent completed Weekly Contest is available.
            </p>
          ) : (
            displaySessions.map((s) => {
              const isSelected = s.sessionId === selectedSessionId;
              const isDeleting = deletingSessionId === s.sessionId;
              return (
                <div key={s.sessionId} className="relative group">
                  <button
                    onClick={() => handleSelectSession(s.sessionId)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2.5 cursor-pointer pr-8 ${isSelected
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105'
                        : 'bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700'
                      }`}
                  >
                    <span>📅 {s.sessionDate}</span>
                    <span>•</span>
                    <span>{s.contestName}</span>
                    <span className={`px-2 py-0.5 text-[9px] rounded-full font-mono uppercase font-bold ${s.status === 'LIVE' ? 'bg-emerald-400 text-slate-900' : s.status === 'FINALIZED' ? 'bg-indigo-900 text-indigo-200' : 'bg-amber-400 text-slate-900'
                      }`}>
                      {s.status}
                    </span>
                  </button>
                  {/* Delete button — visible on hover, hidden for LIVE */}
                  {s.status !== 'LIVE' && (
                    <button
                      onClick={(e) => handleDeleteSession(s.sessionId, `${s.contestName} (${s.sessionDate})`, e)}
                      disabled={isDeleting}
                      title={`Delete ${s.contestName}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                    >
                      {isDeleting
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Combined Department, Academic Year & Attendance Filters Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-400 tracking-wider">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Combined Department, Year & Attendance Filter:</span>
          </div>

          <button
            onClick={handleFetchSelectedContest}
            disabled={isSyncing || !selectedSessionId}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Fetching...' : `↻ Fetch Selected Contest`}</span>
          </button>
        </div>

        {/* Sync Summary Progress Panel */}
        {syncSummary && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-navy-950 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-extrabold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Global Archive Sync Complete ({syncSummary.timezone})</span>
              <button onClick={() => setSyncSummary(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex flex-wrap gap-4 text-gray-700 dark:text-gray-300 font-bold">
              <span>Discovered: <b>{syncSummary.weeklyContestsDiscovered}</b></span>
              <span>Processed: <b>{syncSummary.processed}</b></span>
              <span>Validated: <b>{syncSummary.skippedExisting}</b></span>
              <span>Inserted: <b>{syncSummary.inserted}</b></span>
              <span>Conflicts: <b>{syncSummary.conflicts}</b></span>
              <span>Errors: <b className={syncSummary.errors > 0 ? 'text-rose-600' : 'text-emerald-600'}>{syncSummary.errors}</b></span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Department Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'CSE(CS)', 'CSE(IOT)'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDeptFilter(dept)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedDeptFilter === dept
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {dept === 'ALL' ? '🏢 All Depts' : dept}
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedYearFilter === yr
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {yr === 'ALL' ? '🎓 All Years' : `${yr} Year`}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attendance Status</label>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'ALL', label: 'All' },
                { code: 'PUBLIC_ATTENDED', label: '🟢 Public' },
                { code: 'PUBLIC_NOT_ATTENDED', label: '🔴 Not Attended' },
                { code: 'VIRTUAL_ATTENDED', label: '🔵 Virtual' }
              ].map((att) => (
                <button
                  key={att.code}
                  onClick={() => toggleAttendanceFilter(att.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedAttendanceFilter === att.code
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {att.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Metrics Snapshot Grid (Clickable Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 0: All Roster Count */}
        <button
          onClick={() => setSelectedAttendanceFilter('ALL')}
          className={`p-5 rounded-2xl bg-white dark:bg-navy-900 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'ALL'
              ? 'border-brand-500 ring-4 ring-brand-500/20 scale-105 shadow-xl'
              : 'border-gray-200 dark:border-gray-800 hover:border-brand-300 shadow-sm'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Filter Roster Count</p>
            {selectedAttendanceFilter === 'ALL' && (
              <span className="text-[9px] font-black bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{totalRows}</p>
        </button>

        {/* Card 1: Public Attended (Clickable) */}
        <button
          onClick={() => toggleAttendanceFilter('PUBLIC_ATTENDED')}
          className={`p-5 rounded-2xl bg-emerald-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'PUBLIC_ATTENDED'
              ? 'border-emerald-500 ring-4 ring-emerald-500/30 scale-105 shadow-xl bg-emerald-500/20'
              : 'border-emerald-500/20 hover:border-emerald-400'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">🟢 Public Attended</p>
            {selectedAttendanceFilter === 'PUBLIC_ATTENDED' && (
              <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{attendedRows}</p>
        </button>

        {/* Card 2: Public Not Attended (Clickable) */}
        <button
          onClick={() => toggleAttendanceFilter('PUBLIC_NOT_ATTENDED')}
          className={`p-5 rounded-2xl bg-rose-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED'
              ? 'border-rose-500 ring-4 ring-rose-500/30 scale-105 shadow-xl bg-rose-500/20'
              : 'border-rose-500/20 hover:border-rose-400'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">🔴 Public Not Attended</p>
            {selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED' && (
              <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{notAttendedRows}</p>
        </button>

        {/* Card 3: Virtual Attended (Clickable) */}
        <button
          onClick={() => toggleAttendanceFilter('VIRTUAL_ATTENDED')}
          className={`p-5 rounded-2xl bg-blue-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'VIRTUAL_ATTENDED'
              ? 'border-blue-500 ring-4 ring-blue-500/30 scale-105 shadow-xl bg-blue-500/20'
              : 'border-blue-500/20 hover:border-blue-400'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">🔵 Virtual Attended</p>
            {selectedAttendanceFilter === 'VIRTUAL_ATTENDED' && (
              <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{virtualRows}</p>
        </button>

        {/* Card 4: Data Errors */}
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
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Contest Comparison: {comparison.currentWeek?.contestName || 'Selected Contest'} vs {comparison.previousWeek?.contestName || 'Previous Contest'}
              </h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-bold mt-0.5">
                <span>Public Participation:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {comparison.currentWeek?.contestName || 'Selected Contest'} → <b>{comparison.currentWeek?.rate}%</b>
                </span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {comparison.previousWeek?.contestName || 'Previous Contest'} → <b>{comparison.previousWeek?.rate}%</b>
                </span>
              </div>
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
          {/* Legend */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-gray-50 dark:bg-navy-950">
            <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Legend:</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">🟢 PUBLIC</span> Public contest attended</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">🔵 VIRTUAL</span> Virtual attendance</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">🔴 NOT ATTENDED</span> Did not participate</span>
            <span className="text-[10px] text-gray-400 font-bold">Q cells: <span className="text-emerald-600 font-black">1</span> = solved &nbsp;|&nbsp; <span className="text-rose-400 font-black">0</span> = not solved &nbsp;|&nbsp; <span className="text-gray-300 font-black">—</span> = not attended</span>
          </div>
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
                  <th className="px-4 py-3 text-center">Contest Name</th>
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
                    <td colSpan={13} className="p-8 text-center text-gray-500 font-bold">
                      No contest participation records found for the selected Weekly Contest.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map((r, idx) => {
                    const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC';
                    const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.status === 'VIRTUAL';
                    const isAttended = isPublicAttended || isVirtualAttended;
                    const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED';
                    const isError = r.participation_status === 'DATA_ERROR';

                    // Status badge config
                    const statusBadge = isPublicAttended
                      ? { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', label: '🟢 PUBLIC' }
                      : isVirtualAttended
                        ? { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', label: '🔵 VIRTUAL' }
                        : isNotAttended
                          ? { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', label: '🔴 NOT ATTENDED' }
                          : isError
                            ? { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', label: '⚠️ DATA ERROR' }
                            : { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: '🟡 PENDING' };

                    // Q cell renderer:
                    // - Attended + solved → 1 (green)
                    // - Attended + not solved → 0 (red dim)
                    // - Not attended / pending / error → — (grey dash)
                    const renderQ = (val: any) => {
                      if (!isAttended || val === '—' || val === null || val === undefined) return <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>;
                      return (val === 1 || val === '1')
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-black">1</span>
                        : <span className="text-rose-400 dark:text-rose-500 font-bold">0</span>;
                    };

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors ${!isAttended ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white font-mono text-[11px]">{r.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.dept}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 font-bold">{r.year}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full whitespace-nowrap ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {r.contest_name || activeSessionObj?.contestName || 'Weekly Contest'}
                        </td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q1)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q2)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q3)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q4)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">
                          {isAttended ? (r.total_solved ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">
                          {isAttended ? (r.rank || '—') : '—'}
                        </td>
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

      {/* Interactive Report Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black flex items-center space-x-2">
                  <span>👁 Report Live Preview</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/30 font-mono">PREVIEW == EXCEL == PDF == WORD == ZIP</span>
                </h3>
                <p className="text-xs text-gray-300 font-bold mt-1">
                  {activeSessionObj?.contestName || 'Weekly Contest'} ({activeSessionObj?.sessionDate || 'Sunday Session'})
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Filter Metadata Badges Bar */}
            <div className="px-6 py-3 bg-gray-100 dark:bg-navy-950 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-gray-500">Active Filters:</span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-black">🏢 Dept: {selectedDeptFilter}</span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-black">🎓 Year: {selectedYearFilter}</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black">📊 Attendance: {selectedAttendanceFilter}</span>
              </div>
              <span className="text-brand-600 dark:text-brand-400 font-black">Showing {matrixRows.length} Roster Students</span>
            </div>

            {/* Modal Body: Scrollable Preview Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-center">S.No</th>
                      <th className="px-3 py-2.5">Reg No</th>
                      <th className="px-3 py-2.5">Student Name</th>
                      <th className="px-3 py-2.5 text-center">Dept</th>
                      <th className="px-3 py-2.5 text-center">Year</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-center">Contest Name</th>
                      <th className="px-3 py-2.5 text-center">Q1</th>
                      <th className="px-3 py-2.5 text-center">Q2</th>
                      <th className="px-3 py-2.5 text-center">Q3</th>
                      <th className="px-3 py-2.5 text-center">Q4</th>
                      <th className="px-3 py-2.5 text-right">Contest Solved</th>
                      <th className="px-3 py-2.5 text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {matrixRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-gray-500 font-bold">
                          No matching student records found for the active filter selection.
                        </td>
                      </tr>
                    ) : (
                      matrixRows.map((r, idx) => {
                        const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC';
                        const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.status === 'VIRTUAL';
                        const isAttended = isPublicAttended || isVirtualAttended;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-3 py-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold font-mono text-gray-900 dark:text-white">{r.reg_no}</td>
                            <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                            <td className="px-3 py-2 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.dept}</td>
                            <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400 font-bold">{r.year}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isPublicAttended ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : isVirtualAttended ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                {isPublicAttended ? '🟢 PUBLIC' : isVirtualAttended ? '🔵 VIRTUAL' : '🔴 NOT ATTENDED'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-gray-600 dark:text-gray-300">{r.contest_name || activeSessionObj?.contestName || 'Weekly Contest'}</td>
                            <td className="px-3 py-2 text-center font-bold">{isAttended ? (r.q1 === 1 || r.q1 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-3 py-2 text-center font-bold">{isAttended ? (r.q2 === 1 || r.q2 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-3 py-2 text-center font-bold">{isAttended ? (r.q3 === 1 || r.q3 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-3 py-2 text-center font-bold">{isAttended ? (r.q4 === 1 || r.q4 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-3 py-2 text-right font-black text-emerald-600 dark:text-emerald-400">{isAttended ? (r.total_solved ?? '—') : '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-600 dark:text-gray-400">{isAttended ? (r.rank || r.contest_rank || '—') : '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer: Direct Export Action Buttons */}
            <div className="p-5 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-gray-500 font-bold">
                ⚠️ Central Report Dataset: <b>PREVIEW == EXCEL == PDF == WORD == ZIP</b>
              </span>
              <div className="flex items-center space-x-2">
                <button onClick={() => downloadReportFile('excel')} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer">
                  Export Excel (.xlsx)
                </button>
                <button onClick={() => downloadReportFile('pdf')} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer">
                  Export PDF (.pdf)
                </button>
                <button onClick={() => downloadReportFile('word')} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer">
                  Export Word (.docx)
                </button>
                <button onClick={() => downloadReportFile('zip')} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer">
                  Export All (.zip)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
