import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Trophy, Layers, Award, CheckCircle2, UserCheck, Users, HelpCircle, Flame, Filter } from 'lucide-react';
import api from '../services/api';

interface ReportPreviewProps {
  reportId: string;
  onClose: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ reportId, onClose }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get(`/reports/${reportId}/preview`);
        setReport(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  const isContestReport = useMemo(() => {
    if (!report) return false;
    return (
      report.reportType === 'CONTEST_PERFORMANCE' ||
      report.report_type === 'CONTEST_PERFORMANCE' ||
      report.reportType === 'OFFICIAL_CONTEST' ||
      report.report_type === 'Weekly_Contest' ||
      !!report.contestSummary ||
      !!report.solveDistribution
    );
  }, [report]);

  const contestSummary = report?.contestSummary || report?.metrics || {};
  const solveDist = report?.solveDistribution || {};

  const allRows = useMemo(() => {
    return report?.allStudents || report?.rows || [];
  }, [report]);

  // Filter student rows based on active filter
  const displayedStudents = useMemo(() => {
    if (!isContestReport || !activeFilter) return allRows;

    return allRows.filter((r: any) => {
      const st = r.status || '';
      const isPart = st === 'PUBLIC_ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'PUBLIC' || st === 'VIRTUAL';
      const solved = r.contest_solved !== undefined && r.contest_solved !== null ? Number(r.contest_solved) : (r.total_solved !== undefined && r.total_solved !== null ? Number(r.total_solved) : null);

      if (activeFilter === 'SOLVED_4') return isPart && solved === 4;
      if (activeFilter === 'SOLVED_3') return isPart && solved === 3;
      if (activeFilter === 'SOLVED_2') return isPart && solved === 2;
      if (activeFilter === 'SOLVED_1') return isPart && solved === 1;
      if (activeFilter === 'SOLVED_0') return isPart && solved === 0;
      if (activeFilter === 'PUBLIC_ATTENDED') return st === 'PUBLIC_ATTENDED' || st === 'PUBLIC';
      if (activeFilter === 'VIRTUAL_ATTENDED') return st === 'VIRTUAL_ATTENDED' || st === 'VIRTUAL';
      if (activeFilter === 'NOT_ATTENDED') return st === 'NOT_ATTENDED' || st === 'PUBLIC_NOT_ATTENDED';
      if (activeFilter === 'PENDING_USERNAME') return st === 'PENDING_USERNAME' || st === 'PENDING';
      if (activeFilter === 'FETCH_FAILED') return st === 'FETCH_FAILED' || st === 'FETCH_ERROR';
      if (activeFilter === 'INVALID_USERNAME') return st === 'INVALID_USERNAME' || st === 'USERNAME_NOT_FOUND';
      if (activeFilter === 'UNKNOWN') return st === 'UNKNOWN';
      return true;
    });
  }, [allRows, isContestReport, activeFilter]);

  const toggleFilter = (filterKey: string) => {
    setActiveFilter(prev => prev === filterKey ? null : filterKey);
  };

  const downloadFile = async (format: string) => {
    try {
      const url = `/reports/${reportId}/${format}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;
      
      const contentDisposition = res.headers['content-disposition'];
      let filename = `${report?.reportType || 'REPORT'}_${reportId}.${ext}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error(`Failed to download ${format} report:`, err);
      const statusCode = err.response?.status;
      if (statusCode === 401) {
        alert("Authentication required. Please sign in again.");
      } else if (statusCode === 403) {
        alert("You do not have permission to generate this institutional report.");
      } else if (statusCode === 404) {
        alert("Report resource not found.");
      } else if (statusCode === 422) {
        alert("Invalid report parameters.");
      } else if (statusCode === 500) {
        alert("Report generation failed on the server. Check server logs.");
      } else {
        alert(`Failed to download ${format.toUpperCase()} report. Please try again.`);
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-navy-900 p-8 rounded-3xl flex flex-col items-center space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <p className="font-bold text-gray-700 dark:text-gray-300">Fetching verified report dataset...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const dataQuality = report.dataQuality || report.data_quality;

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PUBLIC_ATTENDED' || s === 'PUBLIC') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">🟢 PUBLIC ATTENDED</span>;
    }
    if (s === 'VIRTUAL_ATTENDED' || s === 'VIRTUAL') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">🟣 VIRTUAL ATTENDED</span>;
    }
    if (s === 'NOT_ATTENDED' || s === 'PUBLIC_NOT_ATTENDED') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">🔴 NOT ATTENDED</span>;
    }
    if (s === 'PENDING_USERNAME' || s === 'PENDING') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">🟡 PENDING USERNAME</span>;
    }
    if (s === 'FETCH_FAILED' || s === 'FETCH_ERROR') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">🔴 FETCH FAILED</span>;
    }
    if (s === 'INVALID_USERNAME' || s === 'USERNAME_NOT_FOUND') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">🟠 INVALID USERNAME</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">⚪ UNKNOWN</span>;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-navy-900 w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden my-auto animate-modal-content">
        
        {/* ── 1. HEADER BANNER ── */}
        <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/30">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-base sm:text-lg text-white flex items-center space-x-2 truncate">
                <span className="truncate">{report.title || (isContestReport ? `${report.contestName || 'Contest'} Performance Report` : 'Report Preview')}</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold shrink-0">
                  🟢 READY
                </span>
              </h2>
              <p className="text-xs text-blue-200/80 font-medium mt-0.5 truncate">
                {isContestReport && report.contestName && (
                  <span className="font-bold text-amber-300 mr-2">
                    {report.contestName} ({report.contestDate || report.sessionDate || 'Sunday Session'})
                  </span>
                )}
                Report ID: <span className="font-mono text-blue-200">{report.reportId || report.report_id}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="shrink-0 ml-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* ── 2. DATASET QUALITY & RECONCILIATION BAR ── */}
        <div className="px-5 py-2.5 bg-gray-100 dark:bg-navy-950 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs font-bold shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-black">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dataset Reconciliation:</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[11px] font-black">
              Roster: {allRows.length} Students
            </span>
            {isContestReport && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono text-[11px] font-black">
                Participants: {(contestSummary.publicAttended || 0) + (contestSummary.virtualAttended || 0)}
              </span>
            )}
            {activeFilter && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-black">
                <Filter className="w-3 h-3" />
                <span>Filtered: {displayedStudents.length} of {allRows.length} rows</span>
                <button onClick={() => setActiveFilter(null)} className="ml-1 hover:text-rose-500 font-black">✕</button>
              </span>
            )}
          </div>
          <span className="text-brand-600 dark:text-brand-400 font-mono font-bold text-[11px]">
            Nandha Engineering College (Autonomous)
          </span>
        </div>

        {/* ── 3. SCROLLABLE REPORT CONTENT ── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

          {/* ═══════════ CONTEST PERFORMANCE SPECIALIZED VIEW ═══════════ */}
          {isContestReport ? (
            <div className="space-y-6">
              
              {/* Contest Summary KPI Cards (Interactive Filter Triggers) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Contest Attendance &amp; Performance Summary</span>
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">Click any card to filter student details below</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  
                  {/* Total Students */}
                  <div 
                    onClick={() => setActiveFilter(null)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === null ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-navy-950 border-gray-200 dark:border-gray-800 hover:border-blue-400'}`}
                  >
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black">Total Students</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1">{contestSummary.totalStudents || allRows.length}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">All Roster</p>
                  </div>

                  {/* Public Attended */}
                  <div 
                    onClick={() => toggleFilter('PUBLIC_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'PUBLIC_ATTENDED' ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-400'}`}
                  >
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-black">Public Attended</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{contestSummary.publicAttended ?? "—"}</p>
                    <p className="text-[10px] text-emerald-600/80 font-bold mt-0.5">{contestSummary.publicAttendanceRate || `${Math.round(((contestSummary.publicAttended || 0) / max(contestSummary.totalStudents || allRows.length, 1)) * 100)}%`}</p>
                  </div>

                  {/* Virtual Attended */}
                  <div 
                    onClick={() => toggleFilter('VIRTUAL_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'VIRTUAL_ATTENDED' ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30' : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-400'}`}
                  >
                    <p className="text-[10px] text-purple-700 dark:text-purple-400 uppercase font-black">Virtual Attended</p>
                    <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{contestSummary.virtualAttended ?? "—"}</p>
                    <p className="text-[10px] text-purple-600/80 font-bold mt-0.5">{contestSummary.virtualAttendanceRate || `${Math.round(((contestSummary.virtualAttended || 0) / max(contestSummary.totalStudents || allRows.length, 1)) * 100)}%`}</p>
                  </div>

                  {/* Not Attended */}
                  <div 
                    onClick={() => toggleFilter('NOT_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'NOT_ATTENDED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-400'}`}
                  >
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-black">Not Attended</p>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{contestSummary.notAttended ?? "—"}</p>
                    <p className="text-[10px] text-rose-600/80 font-bold mt-0.5">Absent</p>
                  </div>

                  {/* Pending Username */}
                  <div 
                    onClick={() => toggleFilter('PENDING_USERNAME')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'PENDING_USERNAME' ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400'}`}
                  >
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-black">Pending Username</p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{contestSummary.pendingUsername ?? 0}</p>
                    <p className="text-[10px] text-amber-600/80 font-bold mt-0.5">Unlinked</p>
                  </div>

                  {/* Fetch Failed */}
                  <div 
                    onClick={() => toggleFilter('FETCH_FAILED')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'FETCH_FAILED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-400'}`}
                  >
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-black">Fetch Failed</p>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{contestSummary.fetchFailed ?? 0}</p>
                    <p className="text-[10px] text-rose-600/80 font-bold mt-0.5">API Error</p>
                  </div>

                  {/* Invalid Username */}
                  <div 
                    onClick={() => toggleFilter('INVALID_USERNAME')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'INVALID_USERNAME' ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30' : 'bg-orange-500/5 border-orange-500/20 hover:border-orange-400'}`}
                  >
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 uppercase font-black">Invalid Username</p>
                    <p className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1">{contestSummary.invalidUsername ?? 0}</p>
                    <p className="text-[10px] text-orange-600/80 font-bold mt-0.5">Invalid</p>
                  </div>

                </div>
              </div>

              {/* Additional KPI Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-navy-950/60 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black">Total Contest Solved</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{contestSummary.totalContestSolved ?? "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black">Avg Solved (All Students)</p>
                  <p className="text-lg font-black text-gray-800 dark:text-gray-200">{contestSummary.averageProblemsSolved ?? "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black">Avg Solved (Participants)</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{contestSummary.averageSolvedAmongParticipants ?? "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black">Participation Rate</p>
                  <p className="text-lg font-black text-brand-600 dark:text-brand-400">{contestSummary.participationRate ?? "—"}</p>
                </div>
              </div>

              {/* Problem Solve Distribution (Clickable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center space-x-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Problem Solve Distribution (Clickable Filter)</span>
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">Click to filter by exact problems solved</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  
                  {/* 4 Problems Solved */}
                  <div 
                    onClick={() => toggleFilter('SOLVED_4')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_4' ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">4 Problems Solved</div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{solveDist.solved4 ?? report.metrics?.['4 Q Solved'] ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Students</div>
                  </div>

                  {/* 3 Problems Solved */}
                  <div 
                    onClick={() => toggleFilter('SOLVED_3')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_3' ? 'bg-teal-500/20 border-teal-500 ring-2 ring-teal-500/30' : 'bg-teal-500/5 border-teal-500/20 hover:border-teal-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">3 Problems Solved</div>
                    <div className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1">{solveDist.solved3 ?? report.metrics?.['3 Q Solved'] ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Students</div>
                  </div>

                  {/* 2 Problems Solved */}
                  <div 
                    onClick={() => toggleFilter('SOLVED_2')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_2' ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/30' : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">2 Problems Solved</div>
                    <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{solveDist.solved2 ?? report.metrics?.['2 Q Solved'] ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Students</div>
                  </div>

                  {/* 1 Problem Solved */}
                  <div 
                    onClick={() => toggleFilter('SOLVED_1')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_1' ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">1 Problem Solved</div>
                    <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{solveDist.solved1 ?? report.metrics?.['1 Q Solved'] ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Students</div>
                  </div>

                  {/* 0 Problems Solved (Participated) */}
                  <div 
                    onClick={() => toggleFilter('SOLVED_0')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_0' ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30' : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">0 Solved (Attended)</div>
                    <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{solveDist.solved0 ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Participants</div>
                  </div>

                  {/* Not Attended */}
                  <div 
                    onClick={() => toggleFilter('NOT_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'NOT_ATTENDED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-400'}`}
                  >
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Not Attended</div>
                    <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{solveDist.notParticipated ?? contestSummary.notAttended ?? 0}</div>
                    <div className="text-[10px] text-gray-500 font-medium mt-0.5">Absent</div>
                  </div>

                </div>
              </div>

              {/* Student Detail Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    Student Contest Detail Table ({displayedStudents.length} Students {activeFilter ? `• Filter: ${activeFilter}` : ''})
                  </h3>
                  {activeFilter && (
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 underline cursor-pointer"
                    >
                      Clear Active Filter (Show All {allRows.length})
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-xs min-w-[850px]">
                    <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                      <tr>
                        <th className="px-3.5 py-3 text-center w-12">S.No</th>
                        <th className="px-3.5 py-3">Register No</th>
                        <th className="px-3.5 py-3">Student Name</th>
                        <th className="px-3.5 py-3 text-center">Dept</th>
                        <th className="px-3.5 py-3 text-center">Year</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-3 py-3 text-center w-10">Q1</th>
                        <th className="px-3 py-3 text-center w-10">Q2</th>
                        <th className="px-3 py-3 text-center w-10">Q3</th>
                        <th className="px-3 py-3 text-center w-10">Q4</th>
                        <th className="px-4 py-3 text-center">Contest Solved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                      {displayedStudents.map((s: any, idx: number) => {
                        const isPart = s.status === 'PUBLIC_ATTENDED' || s.status === 'VIRTUAL_ATTENDED' || s.status === 'PUBLIC' || s.status === 'VIRTUAL';
                        const cSolved = s.contest_solved !== undefined && s.contest_solved !== null ? s.contest_solved : (isPart && s.total_solved !== undefined && s.total_solved !== null ? s.total_solved : null);

                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-3.5 py-2.5 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-bold text-gray-900 dark:text-white font-mono">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{s.name || s.student_name}</td>
                            <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">{s.year}</td>
                            <td className="px-4 py-2.5 text-center">
                              {getStatusBadge(s.status)}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q1 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-gray-400">0</span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q2 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-gray-400">0</span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q3 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-gray-400">0</span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q4 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-gray-400">0</span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center font-black text-sm">
                              {isPart && cSolved !== null ? (
                                <span className={cSolved >= 3 ? "text-emerald-600 dark:text-emerald-400" : cSolved >= 1 ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}>
                                  {cSolved}
                                </span>
                              ) : (
                                <span className="text-gray-400 font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            /* ═══════════ DEFAULT / OTHER REPORTS VIEW ═══════════ */
            <div className="space-y-6">
              
              {/* Metrics Overview Cards */}
              {report.metrics && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">Executive Summary Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(report.metrics).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-center shadow-sm">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">
                          {value !== null && value !== undefined ? (typeof value === 'number' && value > 999 ? value.toLocaleString() : String(value)) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Distribution Grid */}
              {report.distribution && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Problem Solving Category Distribution</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(report.distribution).map(([cat, count]: [string, any]) => (
                      <div key={cat} className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-center">
                        <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">{cat}</div>
                        <div className="text-lg font-black text-purple-700 dark:text-purple-400">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Performers Table */}
              {report.topStudents && report.topStudents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Top Performers Leaderboard</span>
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[750px]">
                      <thead className="bg-navy-950 text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-center">Rank</th>
                          <th className="px-4 py-3">Reg No</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-center">Dept</th>
                          <th className="px-4 py-3 text-center">Year</th>
                          <th className="px-4 py-3 text-right">Easy</th>
                          <th className="px-4 py-3 text-right">Medium</th>
                          <th className="px-4 py-3 text-right">Hard</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {report.topStudents.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-center font-black text-amber-500">#{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{s.reg_no}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{s.name}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center">{s.year}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">{s.total_solved ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">{s.rating ? Math.round(s.rating) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Student Roster Table */}
              {allRows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                    Full Student Performance Roster ({allRows.length} Students)
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                      <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-center">S.No</th>
                          <th className="px-4 py-3">Reg No</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3 text-center">Dept</th>
                          <th className="px-4 py-3 text-center">Year</th>
                          <th className="px-4 py-3 text-right">Easy</th>
                          <th className="px-4 py-3 text-right">Medium</th>
                          <th className="px-4 py-3 text-right">Hard</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {allRows.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{s.reg_no}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{s.name}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center">{s.year}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400 font-semibold">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">{s.total_solved !== null ? s.total_solved : "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${s.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* ── 4. FOOTER / EXPORT ACTIONS ── */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 font-semibold flex items-center space-x-2">
            <span>Official Institutional Report Dataset</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => downloadFile('excel')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button onClick={() => downloadFile('pdf')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button onClick={() => downloadFile('word')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>Word</span>
            </button>
            <button onClick={() => downloadFile('csv')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button onClick={() => downloadFile('zip')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <Download className="w-4 h-4" />
              <span>All (.zip)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

function max(a: number, b: number) {
  return a > b ? a : b;
}

