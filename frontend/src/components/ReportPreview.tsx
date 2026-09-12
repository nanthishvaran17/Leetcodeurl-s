import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Trophy, Layers, Award, CheckCircle2, UserCheck, Users, HelpCircle, Flame, Filter, Building2, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { FullScreenLoadingOverlay } from './ui/FullScreenLoadingOverlay';

interface ReportPreviewProps {
  reportId: string;
  onClose: () => void;
}

import { useNotification } from '../context/NotificationContext';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';

export const ReportPreview: React.FC<ReportPreviewProps> = ({ reportId, onClose }) => {
  const { notify } = useNotification();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/${reportId}/preview`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
      setError("Unable to fetch the verified report dataset.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const rType = ((report?.reportType || report?.report_type || '') as string).toUpperCase();

  const isContestReport = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'CONTEST_PERFORMANCE' ||
      rType === 'OFFICIAL_CONTEST' ||
      rType === 'WEEKLY_CONTEST' ||
      rType === 'WEEKLY_CONTEST_INTELLIGENCE' ||
      rType === 'SUNDAY_LIVE_CONTEST' ||
      rType === 'CONTEST_ATTENDANCE_PARTICIPATION' ||
      rType === 'CONTEST_PERFORMANCE_RANKING' ||
      rType === 'SUNDAY_CONTEST' ||
      !!report.contestSummary ||
      !!report.solveDistribution
    );
  }, [report, rType]);

  const isSundayLive = useMemo(() => {
    if (!report) return false;
    return rType === 'SUNDAY_LIVE_CONTEST' || rType === 'SUNDAY_LIVE' || rType === 'SUNDAY_CONTEST';
  }, [report, rType]);

  const isFridayOfficial = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'FRIDAY_OFFICIAL_CONTEST' ||
      rType === 'FRIDAY_OFFICIAL' ||
      rType === 'OFFICIAL_CONTEST' ||
      rType === 'WEEKLY_CONTEST_INTELLIGENCE'
    );
  }, [report, rType]);

  const contestSummary = report?.contestSummary || report?.metrics || {};
  const solveDist = report?.solveDistribution || {};

  const allRows = useMemo(() => {
    return report?.allStudents || report?.rows || [];
  }, [report]);

  // Filter student rows based on active filter
  const displayedStudents = useMemo(() => {
    if (!isContestReport || !activeFilter) return allRows;

    return allRows.filter((r: any) => {
      const st = (r.status || '').toUpperCase();
      const isPart = st === 'PUBLIC_ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'PUBLIC' || st === 'VIRTUAL' || st === 'PUBLIC_LIVE' || st === 'VIRTUAL_PRACTICE' || st === 'ATTENDED';
      const solved = r.contest_solved !== undefined && r.contest_solved !== null ? Number(r.contest_solved) : (r.total_solved !== undefined && r.total_solved !== null ? Number(r.total_solved) : null);

      if (activeFilter === 'SOLVED_4') return isPart && solved === 4;
      if (activeFilter === 'SOLVED_3') return isPart && solved === 3;
      if (activeFilter === 'SOLVED_2') return isPart && solved === 2;
      if (activeFilter === 'SOLVED_1') return isPart && solved === 1;
      if (activeFilter === 'SOLVED_0') return isPart && solved === 0;
      if (activeFilter === 'PUBLIC_ATTENDED') return st === 'PUBLIC_ATTENDED' || st === 'PUBLIC' || st === 'PUBLIC_LIVE' || st === 'ATTENDED';
      if (activeFilter === 'VIRTUAL_ATTENDED') return st === 'VIRTUAL_ATTENDED' || st === 'VIRTUAL' || st === 'VIRTUAL_PRACTICE';
      if (activeFilter === 'NOT_ATTENDED') return st === 'NOT_ATTENDED' || st === 'PUBLIC_NOT_ATTENDED' || st === 'ABSENT';
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
      const activeParam = activeFilter ? `?attendance=${encodeURIComponent(activeFilter)}` : '';
      const url = `/reports/${reportId}/${format}${activeParam}`;
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;
      const filename = `${report?.reportType || 'REPORT'}_${reportId}.${ext}`;

      const res = await downloadManager.download({
        endpoint: url,
        filename,
      });

      if (res.success) {
        notify.success('Report Downloaded', `${filename} generated successfully.`, { category: 'REPORT PREVIEW' });
      } else {
        notify.error('Download Failed', res.error || 'Failed to download report.', { category: 'REPORTS' });
      }
    } catch (err: any) {
      console.error(`Failed to download ${format} report:`, err);
      notify.error('Download Failed', err.message || 'Failed to download report.', { category: 'REPORTS' });
    }
  };

  if (loading || error) {
    return (
      <FullScreenLoadingOverlay 
        message="Fetching verified report dataset..." 
        error={error || undefined}
        onRetry={error ? fetchReport : undefined}
        onCancel={error ? onClose : undefined}
      />
    );
  }

  if (!report) return null;

  const dataQuality = report.dataQuality || report.data_quality;

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PUBLIC_ATTENDED' || s === 'PUBLIC' || s === 'PUBLIC_LIVE' || s === 'ATTENDED') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">PUBLIC ATTENDED</span>;
    }
    if (s === 'VIRTUAL_ATTENDED' || s === 'VIRTUAL' || s === 'VIRTUAL_PRACTICE') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">VIRTUAL ATTENDED</span>;
    }
    if (s === 'NOT_ATTENDED' || s === 'PUBLIC_NOT_ATTENDED' || s === 'ABSENT') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">NOT ATTENDED</span>;
    }
    if (s === 'PENDING_USERNAME' || s === 'PENDING') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">PENDING USERNAME</span>;
    }
    if (s === 'FETCH_FAILED' || s === 'FETCH_ERROR') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">FETCH FAILED</span>;
    }
    if (s === 'INVALID_USERNAME' || s === 'USERNAME_NOT_FOUND') {
      return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">INVALID USERNAME</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">UNKNOWN</span>;
  };

  return createPortal(
    <div
      className="modal-overlay-responsive animate-modal-backdrop print:bg-white print:p-0 print:absolute print:inset-0 print:z-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-container-responsive max-w-6xl bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 animate-modal-content print:rounded-none print:shadow-none print:border-none print:max-w-full print:w-full">
        
        {/* 1. HEADER BANNER */}
        <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-brand-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between shrink-0 print:bg-white print:text-black print:border-b-2 print:border-black">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-brand-500/30 print:hidden">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-base sm:text-lg text-white print:text-black flex items-center space-x-2 truncate print:whitespace-normal">
                <span className="truncate print:whitespace-normal">{report.title || (isContestReport ? `${report.contestName || 'Contest'} Performance Report` : 'Report Preview')}</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold shrink-0 print:hidden">
                  READY
                </span>
              </h2>
              <p className="text-xs text-brand-200/80 print:text-slate-700 font-medium mt-0.5 truncate print:whitespace-normal">
                {isContestReport && report.contestName && (
                  <span className="font-bold text-amber-300 print:text-black mr-2">
                    {report.contestName} ({report.contestDate || report.sessionDate || 'Sunday Session'})
                  </span>
                )}
                Report ID: <span className="font-mono text-brand-200 print:text-slate-600">{report.reportId || report.report_id}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="shrink-0 ml-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm print:hidden"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* 2. DATASET QUALITY & RECONCILIATION BAR */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-navy-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-bold shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-black">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dataset Reconciliation:</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[11px] font-black">
              Roster: {allRows.length} Students
            </span>
            {isContestReport && (
              <span className="px-2 py-0.5 rounded-md bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-mono text-[11px] font-black">
                Participants: {(contestSummary.publicAttended || 0) + (contestSummary.virtualAttended || 0)}
              </span>
            )}
            {activeFilter && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-black">
                <Filter className="w-3 h-3" />
                <span>Filtered: {displayedStudents.length} of {allRows.length} rows</span>
                <button onClick={() => setActiveFilter(null)} className="ml-1 hover:text-rose-500 font-black"></button>
              </span>
            )}
          </div>
          <span className="text-brand-600 dark:text-brand-400 font-mono font-bold text-[11px]">
            Nandha Engineering College (Autonomous)
          </span>
        </div>

        {/* 3. SCROLLABLE REPORT CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6 print:overflow-visible print:h-auto print:p-0 print:space-y-4 print:mt-4">

          {/* CONTEST PERFORMANCE SPECIALIZED VIEW */}
          {isContestReport ? (
            <div className="space-y-6">
              
              {/* Contest Summary KPI Cards (Interactive Filter Triggers) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-brand-500" />
                    <span>Contest Attendance &amp; Performance Summary</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Click any card to filter student details below</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  
                  {/* Total Students */}
                  <div 
                    onClick={() => setActiveFilter(null)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === null ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/30' : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-800 hover:border-brand-400'}`}
                  >
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">Total Students</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{contestSummary.totalStudents || allRows.length}</p>
                    <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold mt-0.5">All Roster</p>
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


              {/* Problem Solve Distribution (Clickable Filter - Hidden for Sunday Live) */}
              {!isSundayLive && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Problem Solve Distribution (Clickable Filter)</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">Click to filter by exact problems solved</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    
                    {/* 4 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_4')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_4' ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">4 Problems Solved</div>
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{solveDist.solved4 ?? report.metrics?.['4 Q Solved'] ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Students</div>
                    </div>

                    {/* 3 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_3')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_3' ? 'bg-teal-500/20 border-teal-500 ring-2 ring-teal-500/30' : 'bg-teal-500/5 border-teal-500/20 hover:border-teal-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">3 Problems Solved</div>
                      <div className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1">{solveDist.solved3 ?? report.metrics?.['3 Q Solved'] ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Students</div>
                    </div>

                    {/* 2 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_2')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_2' ? 'bg-brand-500/20 border-brand-500 ring-2 ring-brand-500/30' : 'bg-brand-500/5 border-brand-500/20 hover:border-brand-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">2 Problems Solved</div>
                      <div className="text-xl font-black text-brand-600 dark:text-brand-400 mt-1">{solveDist.solved2 ?? report.metrics?.['2 Q Solved'] ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Students</div>
                    </div>

                    {/* 1 Problem Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_1')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_1' ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">1 Problem Solved</div>
                      <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{solveDist.solved1 ?? report.metrics?.['1 Q Solved'] ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Students</div>
                    </div>

                    {/* 0 Problems Solved (Participated) */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_0')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'SOLVED_0' ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30' : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">0 Solved (Attended)</div>
                      <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{solveDist.solved0 ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Participants</div>
                    </div>

                    {/* Not Attended */}
                    <div 
                      onClick={() => toggleFilter('NOT_ATTENDED')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${activeFilter === 'NOT_ATTENDED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-400'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Not Attended</div>
                      <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{solveDist.notParticipated ?? contestSummary.notAttended ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Absent</div>
                    </div>

                  </div>
                </div>
              )}

              {/* Critical Data Validation Banner (Section 12) */}
              {(report.validationError || report.isValidated === false) && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500 text-rose-700 dark:text-rose-400 font-bold flex items-center space-x-3">
                  <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide">Official Result Generation Blocked</p>
                    <p className="text-xs font-semibold mt-0.5">{report.validationError || "Official result generation blocked because validated source data contains critical errors."}</p>
                  </div>
                </div>
              )}

              {/* Question-Wise Official Result (Section 6 - Friday Official) */}
              {isFridayOfficial && report.questionWiseResult && Array.isArray(report.questionWiseResult) && report.questionWiseResult.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-brand-500" />
                    <span>Question-Wise Official Result</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Question</th>
                          <th className="px-4 py-3 text-center">Solved</th>
                          <th className="px-4 py-3 text-center">Not Solved</th>
                          <th className="px-4 py-3 text-right">Solve Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                        {report.questionWiseResult.map((q: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{q.question}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{q.solved}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-500">{q.not_solved}</td>
                            <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">{q.solve_rate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Solve Distribution Table (Section 7 - Friday Official) */}
              {isFridayOfficial && report.solveDistributionList && Array.isArray(report.solveDistributionList) && report.solveDistributionList.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Solve Distribution (4/4 – 0/4)</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-center">Student Count</th>
                          <th className="px-4 py-3 text-right">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                        {report.solveDistributionList.map((sd: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{sd.category}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-600 dark:text-emerald-400">{sd.count}</td>
                            <td className="px-4 py-2.5 text-right font-black text-indigo-600 dark:text-indigo-400">{sd.percentage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Leaderboard & Top Performers (Sections 8 & 9 - Friday Official) */}
              {isFridayOfficial && report.officialLeaderboard && Array.isArray(report.officialLeaderboard) && report.officialLeaderboard.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Official Leaderboard & Top Performers</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-center">Rank</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Register No</th>
                          <th className="px-4 py-3 text-left">Department</th>
                          <th className="px-4 py-3 text-center">Year</th>
                          <th className="px-3 py-3 text-center">Q1</th>
                          <th className="px-3 py-3 text-center">Q2</th>
                          <th className="px-3 py-3 text-center">Q3</th>
                          <th className="px-3 py-3 text-center">Q4</th>
                          <th className="px-4 py-3 text-center">Solved</th>
                          <th className="px-4 py-3 text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                        {report.officialLeaderboard.slice(0, 25).map((lb: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                            <td className="px-4 py-2.5 text-center font-black text-amber-500">#{lb.rank}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{lb.student_name || lb.student}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">{lb.reg_no}</td>
                            <td className="px-4 py-2.5 text-left font-bold text-indigo-600 dark:text-indigo-400">{lb.dept}</td>
                            <td className="px-4 py-2.5 text-center">{lb.year}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{lb.q1 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{lb.q2 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{lb.q3 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{lb.q4 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-600 text-sm">{lb.solved}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold">{lb.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Department-Wise Official Result (Section 10 - Friday Official) */}
              {isFridayOfficial && report.departmentResults && Array.isArray(report.departmentResults) && report.departmentResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-brand-500" />
                    <span>Department-Wise Official Result</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Department</th>
                          <th className="px-3.5 py-3 text-center">Total Students</th>
                          <th className="px-3.5 py-3 text-center">Participants</th>
                          <th className="px-3.5 py-3 text-center">Participation %</th>
                          <th className="px-3 py-3 text-center">4/4</th>
                          <th className="px-3 py-3 text-center">3/4</th>
                          <th className="px-3 py-3 text-center">2/4</th>
                          <th className="px-3 py-3 text-center">1/4</th>
                          <th className="px-3 py-3 text-center">0/4</th>
                          <th className="px-3.5 py-3 text-right">Total Solves</th>
                          <th className="px-3.5 py-3 text-right">Average Solved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                        {report.departmentResults.map((dr: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                            <td className="px-4 py-2.5 font-bold text-brand-600 dark:text-brand-400">{dr.department}</td>
                            <td className="px-3.5 py-2.5 text-center font-bold">{dr.total_students}</td>
                            <td className="px-3.5 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{dr.participants}</td>
                            <td className="px-3.5 py-2.5 text-center font-extrabold text-indigo-600 dark:text-indigo-400">{dr.participation_pct}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{dr.solved_4}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-teal-600">{dr.solved_3}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-brand-600">{dr.solved_2}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-amber-600">{dr.solved_1}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-400">{dr.solved_0}</td>
                            <td className="px-3.5 py-2.5 text-right font-black text-slate-900 dark:text-white">{dr.total_solves?.toLocaleString()}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold">{dr.average_solved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Student Result Detail Table (Section 5) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    {isFridayOfficial ? 'Official Student Result Roster' : isSundayLive ? 'Sunday Live Attendance & Solve Detail Table' : 'Student Contest Detail Table'} ({displayedStudents.length} Students {activeFilter ? `• Filter: ${activeFilter}` : ''})
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

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                  <table className="w-full text-left text-xs mobile-card-table min-w-[950px] print:min-w-0 print:w-full">
                    <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                      {isFridayOfficial ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 sticky left-0 bg-[#16324F] print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-left print:border-b print:border-black">Department</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-3.5 py-3 text-left print:border-b print:border-black">LeetCode Handle</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Contest Solved</th>
                          <th className="px-3.5 py-3 text-right print:border-b print:border-black">Score</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Global Rank</th>
                          <th className="px-3.5 py-3 text-right print:border-b print:border-black">Rating</th>
                        </tr>
                      ) : isSundayLive ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 sticky left-0 bg-navy-950 print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 print:border-b print:border-black">Student Name</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Attendance</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Contest Solved</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Total Time</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 sticky left-0 bg-navy-950 print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Dept</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Contest Solved</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Global Rank</th>
                          <th className="px-3.5 py-3 text-right print:border-b print:border-black">Rating</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans print:divide-black">
                      {displayedStudents.map((s: any, idx: number) => {
                        const st = (s.status || '').toUpperCase();
                        const isPart = st === 'PUBLIC_ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'PUBLIC' || st === 'VIRTUAL' || st === 'PUBLIC_LIVE' || st === 'VIRTUAL_PRACTICE' || st === 'ATTENDED';
                        const cSolved = s.contest_solved !== undefined && s.contest_solved !== null ? s.contest_solved : (isPart && s.total_solved !== undefined && s.total_solved !== null ? s.total_solved : (s.solved !== undefined && s.solved !== null ? s.solved : null));

                        if (isFridayOfficial) {
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px] print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-50 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200 print:text-black">{s.name || s.student_name}</td>
                              <td className="px-3.5 py-2.5 text-left font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                              <td className="px-3.5 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">{s.year}</td>
                              <td className="px-3.5 py-2.5 text-left font-mono text-slate-700 dark:text-slate-300">{s.leetcode_handle || s.username || "Not Available"}</td>
                              <td className="px-4 py-2.5 text-center">
                                {getStatusBadge(s.status)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold">
                                {isPart ? (s.q1 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>) : <span className="text-slate-400 font-normal">Not Available</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold">
                                {isPart ? (s.q2 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>) : <span className="text-slate-400 font-normal">Not Available</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold">
                                {isPart ? (s.q3 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>) : <span className="text-slate-400 font-normal">Not Available</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold">
                                {isPart ? (s.q4 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>) : <span className="text-slate-400 font-normal">Not Available</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center font-black text-sm">
                                {isPart && cSolved !== null ? (
                                  <span className={cSolved >= 3 ? "text-emerald-600 dark:text-emerald-400" : cSolved >= 1 ? "text-brand-600 dark:text-brand-400" : "text-slate-500"}>
                                    {cSolved}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Not Available</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                {isPart && s.score !== undefined && s.score !== null ? s.score : "Not Available"}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                                {isPart && (s.global_rank || s.rank) && (s.global_rank || s.rank) !== '—' && (s.global_rank || s.rank) !== 'Not Available' ? `#${Number(s.global_rank || s.rank).toLocaleString()}` : "Not Available"}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {isPart && (s.rating || s.contest_rating) ? Math.round(Number(s.rating || s.contest_rating)).toLocaleString() : "Not Available"}
                              </td>
                            </tr>
                          );
                        }

                        if (isSundayLive) {
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px] print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-50 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200 print:text-black">{s.name || s.student_name}</td>
                              <td className="px-4 py-2.5 text-center">
                                {getStatusBadge(s.status)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs">
                                {s.q1_display ? (
                                  <span className={s.q1_display.startsWith('1') ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>{s.q1_display}</span>
                                ) : isPart ? (
                                  s.q1 === 1 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">{s.q1_time ? `1 (${s.q1_time} min)` : "1 (Not Available)"}</span>
                                  ) : <span className="text-slate-400">0 (—)</span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs">
                                {s.q2_display ? (
                                  <span className={s.q2_display.startsWith('1') ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>{s.q2_display}</span>
                                ) : isPart ? (
                                  s.q2 === 1 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">{s.q2_time ? `1 (${s.q2_time} min)` : "1 (Not Available)"}</span>
                                  ) : <span className="text-slate-400">0 (—)</span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs">
                                {s.q3_display ? (
                                  <span className={s.q3_display.startsWith('1') ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>{s.q3_display}</span>
                                ) : isPart ? (
                                  s.q3 === 1 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">{s.q3_time ? `1 (${s.q3_time} min)` : "1 (Not Available)"}</span>
                                  ) : <span className="text-slate-400">0 (—)</span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs">
                                {s.q4_display ? (
                                  <span className={s.q4_display.startsWith('1') ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>{s.q4_display}</span>
                                ) : isPart ? (
                                  s.q4 === 1 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">{s.q4_time ? `1 (${s.q4_time} min)` : "1 (Not Available)"}</span>
                                  ) : <span className="text-slate-400">0 (—)</span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center font-black text-sm">
                                {isPart && cSolved !== null ? (
                                  <span className={cSolved >= 3 ? "text-emerald-600 dark:text-emerald-400" : cSolved >= 1 ? "text-brand-600 dark:text-brand-400" : "text-slate-500"}>
                                    {cSolved}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                                {s.total_time_display || (isPart ? (s.total_time ? `${s.total_time} min` : "Not Available") : "—")}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                            <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px] print:text-black">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-50 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200 print:text-black">{s.name || s.student_name}</td>
                            <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">{s.year}</td>
                            <td className="px-4 py-2.5 text-center">
                              {getStatusBadge(s.status)}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q1 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q2 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q3 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {isPart ? (
                                s.q4 === 1 ? <span className="text-emerald-600 dark:text-emerald-400">1</span> : <span className="text-slate-400">0</span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center font-black text-sm">
                              {isPart && cSolved !== null ? (
                                <span className={cSolved >= 3 ? "text-emerald-600 dark:text-emerald-400" : cSolved >= 1 ? "text-brand-600 dark:text-brand-400" : "text-slate-500"}>
                                  {cSolved}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                              {isPart && s.rank && s.rank !== '—' ? `#${Number(s.rank).toLocaleString()}` : '—'}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {isPart && (s.rating || s.contest_rating) ? Math.round(Number(s.rating || s.contest_rating)).toLocaleString() : '—'}
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
            /* DEFAULT / OTHER REPORTS VIEW */
            <div className="space-y-6">
              
              {/* Metrics Overview Cards */}
              {report.metrics && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Executive Summary Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(report.metrics).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-navy-950 text-center shadow-sm">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
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
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Problem Solving Category Distribution</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(report.distribution).map(([cat, count]: [string, any]) => (
                      <div key={cat} className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-center">
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{cat}</div>
                        <div className="text-lg font-black text-purple-700 dark:text-purple-400">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HOD Department Intelligence Summary Table */}
              {report.departmentSummary && Array.isArray(report.departmentSummary) && report.departmentSummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-brand-500" />
                    <span>HOD Department Intelligence Summary</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px]">
                      <thead className="bg-navy-950 text-white font-black uppercase hidden md:table-header-group">
                        <tr>
                          <th className="px-4 py-3 text-center">S.No</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 text-center">Total Students</th>
                          <th className="px-4 py-3 text-center">Active Solvers</th>
                          <th className="px-4 py-3 text-center">Participation %</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-right">Avg Solved</th>
                          <th className="px-4 py-3 text-center">4/4 Solvers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                        {report.departmentSummary.map((d: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-brand-600 dark:text-brand-400">{d.department}</td>
                            <td className="px-4 py-2.5 text-center font-bold">{d.total}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{d.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-extrabold text-indigo-600 dark:text-indigo-400">{d.attendance_pct}%</td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">{d.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold">{d.avg_solved}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-600 dark:text-emerald-400">{d.solvers_4}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Faculty / Staff Allocation Performance Table */}
              {report.facultySummary && Array.isArray(report.facultySummary) && report.facultySummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    <span>Faculty & Mentor Consolidated Performance</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px]">
                      <thead className="bg-navy-950 text-white font-black uppercase hidden md:table-header-group">
                        <tr>
                          <th className="px-4 py-3 text-center">S.No</th>
                          <th className="px-4 py-3">Faculty / Mentor Name</th>
                          <th className="px-4 py-3 text-center">Dept</th>
                          <th className="px-4 py-3 text-center">Assigned Students</th>
                          <th className="px-4 py-3 text-center">Active Solvers</th>
                          <th className="px-4 py-3 text-center">Active %</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-right">Avg Solved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                        {report.facultySummary.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{f.staff_name}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{f.department}</td>
                            <td className="px-4 py-2.5 text-center font-bold">{f.total_assigned}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{f.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-extrabold text-brand-600 dark:text-brand-400">{f.active_pct}%</td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">{f.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold">{f.avg_solved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5-Week Performance Trend Matrix Table */}
              {report.sessionHeaders && Array.isArray(report.sessionHeaders) && report.sessionHeaders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-indigo-500" />
                    <span>Five-Week Longitudinal Performance Matrix</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[950px]">
                      <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group">
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12">S.No</th>
                          <th className="px-3.5 py-3">Register No</th>
                          <th className="px-3.5 py-3">Student Name</th>
                          <th className="px-3.5 py-3 text-center">Dept</th>
                          <th className="px-3.5 py-3 text-center">Year</th>
                          {report.sessionHeaders.map((hdr: string, i: number) => (
                            <th key={i} className="px-3.5 py-3 text-center">{hdr}</th>
                          ))}
                          <th className="px-4 py-3 text-right">5-W Solved</th>
                          <th className="px-3.5 py-3 text-center">Attendance %</th>
                          <th className="px-4 py-3 text-center">Trajectory</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                        {(report.allStudents || report.rows || []).map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white font-mono">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{s.name}</td>
                            <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">{s.year}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">{s.c1_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">{s.c2_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">{s.c3_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">{s.c4_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">{s.c5_solved ?? 0}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">{s.total_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-extrabold text-brand-600 dark:text-brand-400">{s.attendance_rate || '0%'}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border ${
                                s.trajectory?.includes('IMPROVING') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                s.trajectory?.includes('STABLE') ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' :
                                s.trajectory?.includes('DECLINING') ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}>
                                {s.trajectory || 'FOLLOW-UP'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Performers Table */}
              {report.topStudents && report.topStudents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Top Performers Leaderboard</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px] md:min-w-[750px]">
                      <thead className="bg-navy-950 text-white font-black uppercase hidden md:table-header-group">
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
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-center font-black text-amber-500">#{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{s.reg_no}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{s.name}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center">{s.year}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">{s.total_solved ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              {(() => {
                                const r = s.rating ?? s.contest_rating ?? s.contestRating ?? s.stats?.contest_rating;
                                return (r !== null && r !== undefined && r !== '' && r !== '—' && !isNaN(Number(r)) && Number(r) > 0)
                                  ? Math.round(Number(r)).toLocaleString()
                                  : "—";
                              })()}
                            </td>
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
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Full Student Performance Roster ({allRows.length} Students)
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[450px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[800px] print:min-w-0 print:w-full">
                      <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                        <tr>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">S.No</th>
                          <th className="px-4 py-3 sticky left-0 bg-navy-950 print:bg-slate-200 print:border-b print:border-black z-20">Reg No</th>
                          <th className="px-4 py-3 print:border-b print:border-black">Student Name</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Dept</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-4 py-3 text-right print:border-b print:border-black">Easy</th>
                          <th className="px-4 py-3 text-right print:border-b print:border-black">Medium</th>
                          <th className="px-4 py-3 text-right print:border-b print:border-black">Hard</th>
                          <th className="px-4 py-3 text-right print:border-b print:border-black">Total Solved</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 print:divide-black">
                        {allRows.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                            <td className="px-4 py-2.5 text-center text-slate-400 font-mono print:text-black">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-50 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 print:text-black">{s.name}</td>
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

        {/* 4. FOOTER / EXPORT ACTIONS */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="text-xs text-slate-500 font-semibold flex items-center space-x-2">
            <span>Official Institutional Report Dataset</span>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button onClick={() => window.print()} className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>Print UI</span>
            </button>
            <button onClick={() => downloadFile('excel')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button onClick={() => downloadFile('pdf')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button onClick={() => downloadFile('word')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
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
    </div>,
    document.body
  );
};

function max(a: number, b: number) {
  return a > b ? a : b;
}

