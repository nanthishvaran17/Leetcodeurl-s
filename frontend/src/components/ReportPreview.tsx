import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Trophy, Layers, Award, CheckCircle2, UserCheck, Users, HelpCircle, Flame, Filter, Building2, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { FullScreenLoadingOverlay } from './ui/FullScreenLoadingOverlay';

interface ReportPreviewProps {
  reportId: string;
  initialData?: any;
  onClose: () => void;
}

import { useNotification } from '../context/NotificationContext';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';

const formatStudentName = (name: string) => {
  if (!name) return "—";
  return name.split(' ').map(word => {
    return word.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join('.');
  }).join(' ');
};

export const ReportPreview: React.FC<ReportPreviewProps> = ({ reportId, initialData, onClose }) => {
  const { notify } = useNotification();
  const [report, setReport] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchReport = async (forceRefresh: boolean = false) => {
    if (initialData && !forceRefresh) {
      setReport(initialData);
      setLoading(false);
      return;
    }
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
    if (initialData) {
      setReport(initialData);
      setLoading(false);
    } else {
      fetchReport();
    }
  }, [reportId, initialData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

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
      rType === 'HISTORICAL_CONTEST_INTELLIGENCE' ||
      rType === 'HISTORICAL_CONTEST_INTEL' ||
      rType === 'WOW_PERFORMANCE_INTEL' ||
      rType === 'WOW_INTEL' ||
      !!report.contestSummary ||
      !!report.solveDistribution ||
      !!report.histSummary ||
      !!report.wowSummary
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

  const isFiveWeekTrend = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'FIVE_WEEK_PERFORMANCE_TREND' ||
      rType === 'FIVE_WEEK_TREND' ||
      rType === 'BATCH_PERFORMANCE'
    );
  }, [report, rType]);

  const isWowIntel = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'WEEK_ON_WEEK_INTELLIGENCE' ||
      rType === 'WEEK_ON_WEEK' ||
      rType === 'WOW_INTEL' ||
      rType === 'WOW' ||
      rType === 'WOW_INTELLIGENCE' ||
      !!report.wowSummary
    );
  }, [report, rType]);

  const isHistIntel = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'HISTORICAL_CONTEST_INTELLIGENCE' ||
      rType === 'HISTORICAL_CONTEST_INTEL' ||
      !!report.histSummary
    );
  }, [report, rType]);

  const isWeeklyPerformance = useMemo(() => {
    if (!report) return false;
    return (
      rType === 'WEEKLY_STUDENT_PERFORMANCE' ||
      rType === 'WEEKLY_PERFORMANCE' ||
      !!report.college_summary ||
      !!report.department_summaries
    );
  }, [report, rType]);


  const formatMetricTitle = (key: string) => {
    const map: Record<string, string> = {
      totalStudents: "Total Students",
      fiveContestConsistentSolvers: "5-Contest Consistent Solvers (≥4/5)",
      improvingStudents: "Improving Trajectory (↑)",
      stableStudents: "Stable Trajectory (→)",
      decliningStudents: "Declining Trajectory (↓)",
      followUpStudents: "Follow-Up Trajectory",
      total5WeekSolves: "Total 5-Week Solves",
      average5WeekSolves: "Average 5-Week Solves",
      contestWindow: "Contest Window",
      verifiedStudents: "Verified Solvers",
      unverifiedStudents: "Unverified Profiles",
      activeSolvers: "Active Solvers",
      totalSolved: "Total Solved",
      averageSolved: "Average Solved",
      easySolved: "Easy Solved",
      mediumSolved: "Medium Solved",
      hardSolved: "Hard Solved",
      highestSolved: "Highest Solved",
      averageRating: "Average Rating",
      highestRating: "Highest Rating",
      totalParticipations: "Total Participations",
    };
    if (map[key]) return map[key];
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const formatRank = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '—' || val === 'None' || val === 'NaN' || val === 'nan') return '—';
    const cleanStr = String(val).replace(/[^0-9]/g, '');
    const num = Number(cleanStr);
    if (isNaN(num) || num <= 0) return '—';
    return `#${num.toLocaleString()}`;
  };

  const formatRating = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '—' || val === 'None' || val === 'NaN' || val === 'nan') return '—';
    const cleanStr = String(val).replace(/[^0-9.]/g, '');
    const num = Number(cleanStr);
    if (isNaN(num) || num <= 0 || num === 1500 || Math.floor(num) === 1500) return '—';
    return Math.round(num).toLocaleString();
  };

  const renderSundayQCell = (qVal: any, qTime: any, qDisplay: any, isPart: boolean) => {
    let text = qDisplay ? String(qDisplay).replace(/\s*\(\s*—\s*\)/g, '').trim() : null;
    if (!text) {
      if (!isPart) return <span className="text-slate-400 font-bold">—</span>;
      const isSolved = Number(qVal) === 1;
      if (isSolved) {
        text = qTime && String(qTime) !== '—' ? `1 (${qTime} min)` : '1';
      } else {
        text = '0';
      }
    } else if (text === '1 (—)') {
      text = qTime && String(qTime) !== '—' ? `1 (${qTime} min)` : '1';
    } else if (text === '0 (—)') {
      text = '0';
    }

    const isSolved = text.startsWith('1');
    return (
      <span className={`whitespace-nowrap ${isSolved ? "text-emerald-700 dark:text-emerald-300 font-extrabold" : "text-slate-700 dark:text-slate-300 font-bold"}`}>
        {text}
      </span>
    );
  };

  const toRomanYear = (val: any): string => {
    if (!val) return '';
    const v = String(val).trim().toUpperCase();
    if (['1', '1ST', 'I', 'I YEAR', '1 YEAR'].includes(v)) return 'I';
    if (['2', '2ND', 'II', 'II YEAR', '2 YEAR'].includes(v)) return 'II';
    if (['3', '3RD', 'III', 'III YEAR', '3 YEAR'].includes(v)) return 'III';
    if (['4', '4TH', 'IV', 'IV YEAR', '4 YEAR', 'FINAL'].includes(v)) return 'IV';
    if (v.includes('III')) return 'III';
    if (v.includes('II')) return 'II';
    if (v.includes('IV')) return 'IV';
    if (v.includes('I')) return 'I';
    return v;
  };

  const cleanReportTitle = (rawTitle: any): string => {
    if (!rawTitle) return '';
    let t = String(rawTitle).trim();
    // 1. Strip orphaned numbers standalone before hyphens without letters e.g. " 8 - " -> " " only if followed by another title
    t = t.replace(/\s+\b\d+\b\s*-\s*/, ' ').trim();
    // 2. Replace (3 Year) or (2 Year) with (III Year) or (II Year)
    t = t.replace(/\(\s*(\d+|I+|IV|V|FINAL|1ST|2ND|3RD|4TH)\s*(?:Year|Yr)?\s*\)/gi, (_m, g1) => {
      const rY = toRomanYear(g1);
      return `(${rY} Year)`;
    });
    // 3. Replace standalone "3 Year" or "3rd Year" with "III Year"
    t = t.replace(/\b(\d+|1ST|2ND|3RD|4TH)\s*(?:Year|Yr)\b/gi, (_m, g1) => {
      const rY = toRomanYear(g1);
      return `${rY} Year`;
    });
    return t.trim();
  };

  const getQVal = (q: any, qNum: number, solvedCount: any, isPart: boolean) => {
    if (!isPart) return 0;
    if (q === 1 || q === '1' || Number(q) >= 1) return 1;
    const sNum = Number(solvedCount || 0);
    if (sNum >= qNum) return 1;
    return 0;
  };

  const contestSummary = report?.contestSummary || report?.metrics || {};
  const solveDist = report?.solveDistribution || {};

  const allRows = useMemo(() => {
    return report?.allStudents || report?.rows || report?.all_students_current || report?.rosters?.all_current || [];
  }, [report]);

  // Filter student rows based on active filter
  const displayedStudents = useMemo(() => {
    if (!isContestReport || !activeFilter) return allRows;

    return allRows.filter((r: any) => {
      const rawSt = (r.status || r.attendance_status || r.attendance || '').toString().trim().toUpperCase();
      const st = rawSt.replace(/\s+/g, '_');
      const isPart = st === 'PUBLIC_ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'PUBLIC' || st === 'VIRTUAL' || st === 'PUBLIC_LIVE' || st === 'VIRTUAL_PRACTICE' || st === 'ATTENDED';
      const solved = r.contest_solved !== undefined && r.contest_solved !== null 
        ? Number(r.contest_solved) 
        : (r.total_solved !== undefined && r.total_solved !== null 
          ? Number(r.total_solved) 
          : (r.solved !== undefined && r.solved !== null 
            ? Number(r.solved) 
            : null));

      if (activeFilter === 'SOLVED_4') return isPart && solved === 4;
      if (activeFilter === 'SOLVED_3') return isPart && solved === 3;
      if (activeFilter === 'SOLVED_2') return isPart && solved === 2;
      if (activeFilter === 'SOLVED_1') return isPart && solved === 1;
      if (activeFilter === 'SOLVED_0') return isPart && solved === 0;
      if (activeFilter === 'PUBLIC_ATTENDED') return st === 'PUBLIC_ATTENDED' || st === 'PUBLIC' || st === 'PUBLIC_LIVE' || st === 'ATTENDED';
      if (activeFilter === 'VIRTUAL_ATTENDED') return st === 'VIRTUAL_ATTENDED' || st === 'VIRTUAL' || st === 'VIRTUAL_PRACTICE';
      if (activeFilter === 'NOT_ATTENDED') return !isPart || st === 'NOT_ATTENDED' || st === 'PUBLIC_NOT_ATTENDED' || st === 'ABSENT';
      if (activeFilter === 'PENDING_USERNAME') return st === 'PENDING_USERNAME' || st === 'PENDING' || st === 'DATA_ERROR' || st === 'UNLINKED';
      if (activeFilter === 'FETCH_FAILED') return st === 'FETCH_FAILED' || st === 'FETCH_ERROR' || st === 'API_ERROR';
      if (activeFilter === 'INVALID_USERNAME') return st === 'INVALID_USERNAME' || st === 'USERNAME_NOT_FOUND' || st === 'INVALID';
      if (activeFilter === 'DATA_ERROR') return st === 'DATA_ERROR';
      if (activeFilter === 'UNKNOWN') return st === 'UNKNOWN';
      return true;
    });
  }, [allRows, isContestReport, activeFilter]);

  const toggleFilter = (filterKey: string) => {
    setActiveFilter(prev => prev === filterKey ? null : filterKey);
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const downloadFile = async (format: string) => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const activeParam = activeFilter ? `?attendance=${encodeURIComponent(activeFilter)}` : '';
      const url = `/reports/${reportId}/${format}${activeParam}`;
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;

      // Extract exact descriptive report title
      let titlePart = '';
      if (report?.title) {
        let t = report.title;
        if (t.includes(' - ')) {
          const parts = t.split(' - ');
          t = parts[parts.length - 1];
        }
        titlePart = t
          .replace(/\s*\([^)]*\)/g, '')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '_');
      }

      if (!titlePart || titlePart.length < 3) {
        const typeMap: Record<string, string> = {
          'CONTEST_PERFORMANCE_RANKING': 'Contest_Performance_and_Ranking_Report',
          'CONTEST_ATTENDANCE_PARTICIPATION': 'Contest_Attendance_and_Participation_Report',
          'WEEKLY_COORDINATOR': 'Coordinator_Weekly_Performance_Report',
          'WOW_INTEL': 'Week_on_Week_Performance_Intel_Report',
          'HISTORICAL_PERFORMANCE': 'Historical_Contest_Performance_Report',
          'FIVE_WEEK_TREND': '5Week_Contest_Trend_Report',
          'SUNDAY_LIVE': 'Sunday_Live_Contest_Attendance_Report',
          'FRIDAY_OFFICIAL': 'Official_Friday_Contest_Result_Report',
          'LEADERBOARD': 'Official_Institutional_Leaderboard_Report',
          'MASTER_10_SHEET': 'Master_10_Sheet_Institutional_Report',
          'STUDENT_PERFORMANCE': 'Student_Performance_Detail_Report',
          'OFFICIAL_SUMMARY': 'Official_College_Summary_Report',
          'HOD_DEPARTMENT_INTELLIGENCE': 'HOD_Department_Intelligence_Report',
          'FACULTY_CONSOLIDATED': 'Faculty_Consolidated_Performance_Report',
          'PRINCIPAL_EXECUTIVE': 'Principal_Executive_Intelligence_Report',
        };
        titlePart = typeMap[report?.reportType] || (report?.reportType || 'LeetCode_Report').replace(/\s+/g, '_');
      }

      let sessionTag = '';
      if (report?.contestName) {
        sessionTag += `_${report.contestName.replace(/\s+/g, '_')}`;
      } else if (report?.prevContest && report?.currContest) {
        sessionTag += `_${report.prevContest}_vs_${report.currContest}`;
      }

      const dateVal = report?.contestDate || report?.sessionDate || report?.session_date || report?.currDate || '';
      if (dateVal) {
        const parts = dateVal.split(/[.-]/);
        if (parts.length === 3) {
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          let dd = parts[0], mm = parseInt(parts[1], 10), yyyy = parts[2];
          if (parts[0].length === 4) { yyyy = parts[0]; mm = parseInt(parts[1], 10); dd = parts[2]; }
          if (mm >= 1 && mm <= 12) {
            sessionTag += `_${dd.padStart(2, '0')}${months[mm - 1]}${yyyy}`;
          } else {
            sessionTag += `_${dateVal.replace(/[^\d]/g, '')}`;
          }
        } else {
          sessionTag += `_${dateVal.replace(/[^\w]/g, '_')}`;
        }
      }

      let filterTag = '';
      if (report?.department && report.department !== 'ALL') {
        filterTag += `_${report.department}`;
      }
      if (report?.year && report.year !== 'ALL') {
        filterTag += `_Yr${report.year}`;
      }
      if (activeFilter) {
        filterTag += `_Filter_${activeFilter}`;
      }

      const filename = `NEC_${titlePart}${sessionTag}${filterTag}.${ext}`;

      const res = await downloadManager.download({
        endpoint: url,
        filename,
      });

      if (res.success) {
        notify.success('Report Downloaded', `${filename} generated successfully.`, { category: 'DOWNLOAD COMPLETED' });
      } else {
        notify.error('Download Failed', res.error || 'Failed to download report.', { category: 'REPORTS' });
      }
    } catch (err: any) {
      console.error(`Failed to download ${format} report:`, err);
      notify.error('Download Failed', err.message || 'Failed to download report.', { category: 'REPORTS' });
    } finally {
      setIsDownloading(false);
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
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 leading-none">PUBLIC ATTENDED</span>;
    }
    if (s === 'VIRTUAL_ATTENDED' || s === 'VIRTUAL' || s === 'VIRTUAL_PRACTICE') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 leading-none">VIRTUAL ATTENDED</span>;
    }
    if (s === 'NOT_ATTENDED' || s === 'PUBLIC_NOT_ATTENDED' || s === 'ABSENT') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 leading-none">NOT ATTENDED</span>;
    }
    if (s === 'PENDING_USERNAME' || s === 'PENDING') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 leading-none">PENDING USERNAME</span>;
    }
    if (s === 'DATA_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 leading-none">DATA ERROR</span>;
    }
    if (s === 'FETCH_FAILED' || s === 'FETCH_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 leading-none">FETCH FAILED</span>;
    }
    if (s === 'INVALID_USERNAME' || s === 'USERNAME_NOT_FOUND') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 leading-none">INVALID USERNAME</span>;
    }
    return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 leading-none">UNKNOWN</span>;
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
            <div className="min-w-0">
              <h2 className="font-black text-base sm:text-lg text-white print:text-black flex items-center space-x-2 truncate print:whitespace-normal">
                <span className="truncate print:whitespace-normal">{cleanReportTitle(report.title || report.reportTitle) || (isContestReport ? `${report.contestName || 'Contest'} Performance Report` : 'Report Preview')}</span>
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
              {!isHistIntel && !isWowIntel && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                      <span>Contest Attendance &amp; Performance Summary</span>
                    </h3>
                  <span className="text-[11px] text-slate-900 dark:text-slate-100 font-extrabold">Click any card to filter student details below</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  
                  {/* Total Students */}
                  <div 
                    onClick={() => setActiveFilter(null)}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === null ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/30' : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-800 hover:border-brand-400'}`}
                  >
                    <p className="text-xs text-slate-900 dark:text-slate-100 uppercase font-black">Total Students</p>
                    <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{contestSummary.totalStudents || allRows.length}</p>
                    <p className="text-xs text-brand-700 dark:text-brand-300 font-black mt-0.5">All Roster</p>
                  </div>

                  {/* Public Attended */}
                  <div 
                    onClick={() => toggleFilter('PUBLIC_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'PUBLIC_ATTENDED' ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400'}`}
                  >
                    <p className="text-xs text-emerald-950 dark:text-emerald-300 uppercase font-black">Public Attended</p>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{contestSummary.publicAttended ?? "—"}</p>
                    <p className="text-xs text-emerald-950 dark:text-emerald-300 font-black mt-0.5">
                      {contestSummary.publicAttendanceRate 
                        ? (String(contestSummary.publicAttendanceRate).endsWith('%') ? contestSummary.publicAttendanceRate : `${contestSummary.publicAttendanceRate}%`)
                        : `${(( (contestSummary.publicAttended || 0) / Math.max(contestSummary.totalStudents || allRows.length, 1) ) * 100).toFixed(1).replace(/\.0$/, '')}%`}
                    </p>
                  </div>

                  {/* Virtual Attended */}
                  <div 
                    onClick={() => toggleFilter('VIRTUAL_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'VIRTUAL_ATTENDED' ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30' : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-400'}`}
                  >
                    <p className="text-xs text-purple-950 dark:text-purple-300 uppercase font-black">Virtual Attended</p>
                    <p className="text-2xl font-black text-purple-800 dark:text-purple-300 mt-1">{contestSummary.virtualAttended ?? "—"}</p>
                    <p className="text-xs text-purple-950 dark:text-purple-300 font-black mt-0.5">
                      {contestSummary.virtualAttendanceRate 
                        ? (String(contestSummary.virtualAttendanceRate).endsWith('%') ? contestSummary.virtualAttendanceRate : `${contestSummary.virtualAttendanceRate}%`)
                        : `${(( (contestSummary.virtualAttended || 0) / Math.max(contestSummary.totalStudents || allRows.length, 1) ) * 100).toFixed(1).replace(/\.0$/, '')}%`}
                    </p>
                  </div>

                  {/* Not Attended */}
                  <div 
                    onClick={() => toggleFilter('NOT_ATTENDED')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'NOT_ATTENDED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/10 border-rose-500/30 hover:border-rose-400'}`}
                  >
                    <p className="text-xs text-rose-950 dark:text-rose-300 uppercase font-black">Not Attended</p>
                    <p className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">{contestSummary.notAttended ?? "—"}</p>
                    <p className="text-xs text-rose-950 dark:text-rose-300 font-black mt-0.5">Absent</p>
                  </div>

                  {/* Pending Username */}
                  <div 
                    onClick={() => toggleFilter('PENDING_USERNAME')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'PENDING_USERNAME' ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400'}`}
                  >
                    <p className="text-xs text-amber-950 dark:text-amber-300 uppercase font-black">Pending Username</p>
                    <p className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">{contestSummary.pendingUsername ?? 0}</p>
                    <p className="text-xs text-amber-950 dark:text-amber-300 font-black mt-0.5">Unlinked</p>
                  </div>

                  {/* Invalid Username */}
                  <div 
                    onClick={() => toggleFilter('INVALID_USERNAME')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'INVALID_USERNAME' ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30' : 'bg-orange-500/10 border-orange-500/30 hover:border-orange-400'}`}
                  >
                    <p className="text-xs text-orange-950 dark:text-orange-300 uppercase font-black">Invalid Username</p>
                    <p className="text-2xl font-black text-orange-800 dark:text-orange-300 mt-1">{contestSummary.invalidUsername ?? 0}</p>
                    <p className="text-xs text-orange-950 dark:text-orange-300 font-black mt-0.5">Invalid</p>
                  </div>

                </div>
              </div>
              )}


              {/* Problem Solve Distribution (Clickable Filter - Hidden for Sunday Live) */}
              {!isSundayLive && !isHistIntel && !isWowIntel && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                      <span>Problem Solve Distribution (Clickable Filter)</span>
                    </h3>
                    <span className="text-[11px] text-slate-900 dark:text-slate-100 font-extrabold">Click to filter by exact problems solved</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    
                    {/* 4 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_4')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'SOLVED_4' ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">4 Problems Solved</div>
                      <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{solveDist.solved4 ?? report.metrics?.['4 Q Solved'] ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Students</div>
                    </div>

                    {/* 3 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_3')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'SOLVED_3' ? 'bg-teal-500/20 border-teal-500 ring-2 ring-teal-500/30' : 'bg-teal-500/10 border-teal-500/30 hover:border-teal-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">3 Problems Solved</div>
                      <div className="text-2xl font-black text-teal-800 dark:text-teal-300 mt-1">{solveDist.solved3 ?? report.metrics?.['3 Q Solved'] ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Students</div>
                    </div>

                    {/* 2 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_2')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'SOLVED_2' ? 'bg-brand-500/20 border-brand-500 ring-2 ring-brand-500/30' : 'bg-brand-500/10 border-brand-500/30 hover:border-brand-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">2 Problems Solved</div>
                      <div className="text-2xl font-black text-brand-800 dark:text-brand-300 mt-1">{solveDist.solved2 ?? report.metrics?.['2 Q Solved'] ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Students</div>
                    </div>

                    {/* 1 Problem Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_1')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'SOLVED_1' ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">1 Problem Solved</div>
                      <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">{solveDist.solved1 ?? report.metrics?.['1 Q Solved'] ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Students</div>
                    </div>

                    {/* 0 Problems Solved (Participated) */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_0')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'SOLVED_0' ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30' : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">0 Solved (Attended)</div>
                      <div className="text-2xl font-black text-purple-800 dark:text-purple-300 mt-1">{solveDist.solved0 ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Participants</div>
                    </div>

                    {/* Not Attended */}
                    <div 
                      onClick={() => toggleFilter('NOT_ATTENDED')}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[96px] transition-all cursor-pointer ${activeFilter === 'NOT_ATTENDED' ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30' : 'bg-rose-500/10 border-rose-500/30 hover:border-rose-400'}`}
                    >
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">Not Attended</div>
                      <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">{solveDist.notParticipated ?? contestSummary.notAttended ?? 0}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">Absent</div>
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
                    <span>Official Leaderboard & Top Performers</span>
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase">
                        <tr>
                          <th className="px-3.5 py-3 text-center">Rank</th>
                          <th className="px-4 py-3 text-left">Student Name</th>
                          <th className="px-4 py-3 text-center">Register No</th>
                          <th className="px-4 py-3 text-center">Department</th>
                          <th className="px-3 py-3 text-center">Year</th>
                          <th className="px-3 py-3 text-center">Q1</th>
                          <th className="px-3 py-3 text-center">Q2</th>
                          <th className="px-3 py-3 text-center">Q3</th>
                          <th className="px-3 py-3 text-center">Q4</th>
                          <th className="px-4 py-3 text-center">Solved</th>
                          <th className="px-4 py-3 text-center">Score</th>
                          <th className="px-4 py-3 text-center">Global Rank</th>
                          <th className="px-4 py-3 text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                        {report.officialLeaderboard.slice(0, 25).map((lb: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                            <td className="px-3.5 py-2.5 text-center align-middle font-black text-amber-500">#{lb.rank}</td>
                            <td className="px-4 py-2.5 text-left align-middle whitespace-nowrap font-bold text-slate-900 dark:text-white">{formatStudentName(lb.student_name || lb.student)}</td>
                            <td className="px-4 py-2.5 text-center align-middle font-mono text-slate-700 dark:text-slate-300">{lb.reg_no}</td>
                            <td className="px-4 py-2.5 text-center align-middle font-bold text-indigo-600 dark:text-indigo-400">{lb.dept}</td>
                            <td className="px-3 py-2.5 text-center align-middle font-bold text-slate-900 dark:text-slate-100">{lb.year}</td>
                            <td className="px-3 py-2.5 text-center align-middle font-bold">{lb.q1 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center align-middle font-bold">{lb.q2 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center align-middle font-bold">{lb.q3 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-3 py-2.5 text-center align-middle font-bold">{lb.q4 === 1 ? <span className="text-emerald-600">1</span> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-4 py-2.5 text-center align-middle font-black text-emerald-600 text-sm">{lb.solved}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-black text-indigo-600 dark:text-indigo-400">{lb.score !== undefined && lb.score !== null ? lb.score : "—"}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-black text-amber-600 dark:text-amber-400">{formatRank(lb.global_rank || lb.rank_val || lb.rank)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">{formatRating(lb.rating || lb.contest_rating)}</td>
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



              {/* ===== WEEK-ON-WEEK INTEL PREVIEW ===== */}
              {isWowIntel && report.wowSummary && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-center shadow-xs">
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide">Total Students</p>
                      <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{report.wowSummary.totalStudents}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center shadow-xs">
                      <p className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wide">This Week Attended</p>
                      <p className="text-3xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{report.wowSummary.currAttendance}</p>
                      <p className="text-xs text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">{report.currContest} · {report.currDate}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center shadow-xs">
                      <p className="text-xs font-black uppercase text-indigo-800 dark:text-indigo-300 tracking-wide">Last Week Attended</p>
                      <p className="text-3xl font-black text-indigo-800 dark:text-indigo-300 mt-1">{report.wowSummary.prevAttendance}</p>
                      <p className="text-xs text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">{report.prevContest} · {report.prevDate}</p>
                    </div>
                    <div className={`p-4 rounded-2xl text-center border shadow-xs ${(report.wowSummary.attendanceDelta || 0) >= 0 ? 'bg-teal-500/10 border-teal-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                      <p className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wide">Attendance Change</p>
                      <p className={`text-3xl font-black mt-1 ${(report.wowSummary.attendanceDelta || 0) >= 0 ? 'text-teal-800 dark:text-teal-300' : 'text-rose-800 dark:text-rose-300'}`}>
                        {(report.wowSummary.attendanceDelta || 0) >= 0 ? '+' : ''}{report.wowSummary.attendanceDelta}
                      </p>
                      <p className="text-xs text-slate-950 dark:text-white font-black mt-1">
                        ↑ {report.wowSummary.improved} Improved &nbsp;·&nbsp; ↓ {report.wowSummary.declined} Declined &nbsp;·&nbsp; → {report.wowSummary.stable} Stable
                      </p>
                    </div>
                  </div>
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    Week-on-Week Student Comparison — {report.prevContest} vs {report.currContest} ({report.rows?.length || 0} Students)
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs min-w-[1200px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 text-center align-middle w-10" rowSpan={2}>S.No</th>
                          <th className="px-3 py-3 text-center align-middle sticky left-0 bg-[#16324F] z-20" rowSpan={2}>Register No</th>
                          <th className="px-3 py-3 text-left align-middle" rowSpan={2}>Student Name</th>
                          <th className="px-3 py-3 text-center align-middle" rowSpan={2}>Dept</th>
                          <th className="px-3 py-3 text-center align-middle" rowSpan={2}>Yr</th>
                          <th className="px-3 py-3 text-center bg-indigo-900" colSpan={3}>{report.prevContest} — Last Week</th>
                          <th className="px-3 py-3 text-center bg-emerald-900" colSpan={3}>{report.currContest} — This Week</th>
                          <th className="px-3 py-3 text-center align-middle" rowSpan={2}>Δ Solved</th>
                          <th className="px-3 py-3 text-center align-middle" rowSpan={2}>Trend</th>
                        </tr>
                        <tr className="bg-[#1e3d5c] text-xs font-black text-white">
                          <th className="px-3 py-2 text-center bg-indigo-950/80">Status</th>
                          <th className="px-3 py-2 text-center bg-indigo-950/80">Solved</th>
                          <th className="px-3 py-2 text-center bg-indigo-950/80">Score</th>
                          <th className="px-3 py-2 text-center bg-emerald-950/80">Status</th>
                          <th className="px-3 py-2 text-center bg-emerald-950/80">Solved</th>
                          <th className="px-3 py-2 text-center bg-emerald-950/80">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {(report.rows || []).map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{r.s_no}</td>
                            <td className="px-3 py-2.5 text-center font-black font-mono text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-navy-950">{r.reg_no}</td>
                            <td className="px-3 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{r.dept}</td>
                            <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{r.year}</td>
                            <td className="px-3 py-2.5 text-center bg-indigo-50/70 dark:bg-indigo-950/40">
                              {r.prev_status === 'ATTENDED' ? <span className="px-2.5 py-1 rounded text-[11px] font-black bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100">ATTENDED</span> : <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">ABSENT</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-black bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 text-sm">{r.prev_status === 'ATTENDED' ? r.prev_solved : '—'}</td>
                            <td className="px-3 py-2.5 text-center bg-indigo-50/70 dark:bg-indigo-950/40 font-mono font-black text-slate-900 dark:text-slate-100">{r.prev_status === 'ATTENDED' ? r.prev_score : '—'}</td>
                            <td className="px-3 py-2.5 text-center bg-emerald-50/70 dark:bg-emerald-950/40">
                              {r.curr_status === 'ATTENDED' ? <span className="px-2.5 py-1 rounded text-[11px] font-black bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">ATTENDED</span> : <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">ABSENT</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-black bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 text-sm">{r.curr_status === 'ATTENDED' ? r.curr_solved : '—'}</td>
                            <td className="px-3 py-2.5 text-center bg-emerald-50/70 dark:bg-emerald-950/40 font-mono font-black text-slate-900 dark:text-slate-100">{r.curr_status === 'ATTENDED' ? r.curr_score : '—'}</td>
                            <td className={`px-3 py-2.5 text-center font-black text-sm ${(r.solved_delta || 0) > 0 ? 'text-teal-800 dark:text-teal-300' : (r.solved_delta || 0) < 0 ? 'text-rose-800 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                              {(r.solved_delta || 0) > 0 ? `+${r.solved_delta}` : r.solved_delta === 0 ? '—' : r.solved_delta}
                            </td>
                            <td className={`px-3 py-2.5 text-center font-black ${r.trend?.includes('↑') ? 'text-teal-700 dark:text-teal-300' : r.trend?.includes('↓') ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>{r.trend || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== HISTORICAL INTEL PREVIEW ===== */}
              {isHistIntel && (
                <div className="space-y-4 pt-2">
                  <div className="overflow-x-auto">
                    <div className="flex gap-2 pb-2 min-w-max">
                      {(report.histSummary?.sessionParticipation || []).map((sp: any) => (
                        <div key={sp.contestNum} className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-center min-w-[120px] shadow-xs">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">Contest {sp.contestNum}</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{sp.attended}</p>
                          <p className="text-xs font-black text-brand-700 dark:text-brand-300">{sp.rate} attended</p>
                          <p className="text-xs text-slate-800 dark:text-slate-300 font-bold mt-0.5">{sp.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    Historical Performance per Student ({report.rows?.length || 0} Students · {report.histSummary?.numSessions || 0} Contests)
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 text-center align-middle w-10">S.No</th>
                          <th className="px-3 py-3 text-center align-middle sticky left-0 bg-[#16324F] z-20">Register No</th>
                          <th className="px-3 py-3 text-left align-middle">Student Name</th>
                          <th className="px-3 py-3 text-center align-middle">Dept</th>
                          <th className="px-3 py-3 text-center align-middle">Yr</th>
                          {(report.sessionHeaders || []).map((sh: any) => (
                            <th key={sh.contestNum} className="px-3 py-3 text-center align-middle whitespace-nowrap">C{sh.contestNum}<br/><span className="text-[10px] font-extrabold opacity-90">{sh.date}</span></th>
                          ))}
                          <th className="px-3 py-3 text-center align-middle">Attended</th>
                          <th className="px-3 py-3 text-center align-middle">Total Solved</th>
                          <th className="px-3 py-3 text-center align-middle">Consistency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {(report.rows || []).map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{r.s_no}</td>
                            <td className="px-3 py-2.5 text-center font-black font-mono text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-navy-950">{r.reg_no}</td>
                            <td className="px-3 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{r.dept}</td>
                            <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{r.year}</td>
                            {(r.weeklyData || []).map((wd: any, widx: number) => (
                              <td key={widx} className={`px-3 py-2.5 text-center font-black text-sm ${wd.att ? (wd.solved >= 3 ? 'text-emerald-700 dark:text-emerald-300' : wd.solved >= 1 ? 'text-brand-700 dark:text-brand-300' : 'text-amber-700 dark:text-amber-300') : 'text-slate-500 dark:text-slate-400 font-bold'}`}>
                                {wd.att ? wd.solved : '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2.5 text-center font-black text-slate-950 dark:text-white text-sm">{r.totalAttended}</td>
                            <td className="px-3 py-2.5 text-center font-black text-brand-700 dark:text-brand-300 text-sm">{r.totalSolved}</td>
                            <td className={`px-3 py-2.5 text-center font-black text-sm ${r.consistencyPct >= 75 ? 'text-emerald-700 dark:text-emerald-300' : r.consistencyPct >= 40 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-400'}`}>
                              {r.consistencyPct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Student Result Detail Table (Section 5) — not shown for WOW/HIST reports */}
              {!isWowIntel && !isHistIntel && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
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

                <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                  <table className="w-full text-left text-xs mobile-card-table min-w-[950px] print:min-w-0 print:w-full">
                    <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                      {isFridayOfficial ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 text-center sticky left-0 bg-[#16324F] print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Department</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-3.5 py-3 text-left print:border-b print:border-black">LeetCode Handle</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Contest Solved</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Score</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Global Rank</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Rating</th>
                        </tr>
                      ) : isSundayLive ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 text-center sticky left-0 bg-[#16324F] print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
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
                          <th className="px-3.5 py-3 text-center sticky left-0 bg-[#16324F] print:bg-slate-200 print:border-b print:border-black z-20">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Dept</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          {displayedStudents.some((s: any) => s.q1 !== undefined || s.q2 !== undefined) ? (
                            <>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                              <th className="px-4 py-3 text-center print:border-b print:border-black">Contest Solved</th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Easy</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Medium</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Hard</th>
                              <th className="px-4 py-3 text-center print:border-b print:border-black">Total Solved</th>
                            </>
                          )}
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Rank</th>
                          <th className="px-3.5 py-3 text-right print:border-b print:border-black">Rating</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans print:divide-black">
                      {displayedStudents.map((s: any, idx: number) => {
                        const st = (s.status || '').toUpperCase();
                        const isPart = ['PUBLIC_ATTENDED', 'VIRTUAL_ATTENDED', 'PUBLIC', 'VIRTUAL', 'PUBLIC_LIVE', 'VIRTUAL_PRACTICE', 'ATTENDED', 'VERIFIED', 'COMPLETED', 'ATTENDED_SOLVED', 'ATTENDED_ZERO'].includes(st) || (s.total_solved !== undefined && s.total_solved !== null);
                        const cSolved = s.contest_solved !== undefined && s.contest_solved !== null ? s.contest_solved : (s.total_solved !== undefined && s.total_solved !== null ? s.total_solved : (s.solved !== undefined && s.solved !== null ? s.solved : null));
                        const isContestView = s.q1 !== undefined || s.q2 !== undefined;

                        if (isFridayOfficial) {
                          return (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-slate-950 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-100 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                              <td className="px-3.5 py-2.5 text-left font-mono font-bold text-slate-900 dark:text-slate-100">{s.leetcode_handle || s.username || "—"}</td>
                              <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                                {getStatusBadge(s.status)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q1, 1, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q2, 2, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q3, 3, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q4, 4, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center font-black text-sm">
                                {isPart && cSolved !== null ? (
                                  <span className={cSolved >= 3 ? "text-emerald-700 dark:text-emerald-300" : cSolved >= 1 ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"}>
                                    {cSolved}
                                  </span>
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-black text-indigo-700 dark:text-indigo-300">
                                {isPart && s.score !== undefined && s.score !== null ? s.score : "—"}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300">
                                {isPart ? formatRank(s.global_rank || s.rank) : "—"}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
                                {isPart ? formatRating(s.rating || s.contest_rating) : "—"}
                              </td>
                            </tr>
                          );
                        }

                        if (isSundayLive) {
                          return (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 font-black text-slate-950 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-100 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                              <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                                {getStatusBadge(s.status)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs whitespace-nowrap">
                                {renderSundayQCell(s.q1, s.q1_time, s.q1_display, isPart)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs whitespace-nowrap">
                                {renderSundayQCell(s.q2, s.q2_time, s.q2_display, isPart)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs whitespace-nowrap">
                                {renderSundayQCell(s.q3, s.q3_time, s.q3_display, isPart)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-xs whitespace-nowrap">
                                {renderSundayQCell(s.q4, s.q4_time, s.q4_display, isPart)}
                              </td>
                              <td className="px-4 py-2.5 text-center font-black text-sm">
                                {isPart && cSolved !== null ? (
                                  <span className={cSolved >= 3 ? "text-emerald-700 dark:text-emerald-300" : cSolved >= 1 ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"}>
                                    {cSolved}
                                  </span>
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center font-mono font-black text-xs text-slate-950 dark:text-white">
                                {(s.total_time_display && s.total_time_display !== '—' && !s.total_time_display.includes('—'))
                                  ? s.total_time_display
                                  : (s.total_time && s.total_time !== '—'
                                    ? (String(s.total_time).endsWith('min') || String(s.total_time).includes(':') ? s.total_time : `${s.total_time} min`)
                                    : "—")}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                            <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-black text-slate-950 dark:text-white font-mono sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-100 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                              {getStatusBadge(s.status)}
                            </td>
                            {isContestView ? (
                              <>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q1 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q2 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q3 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q4 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center font-black text-sm">
                                  {isPart && cSolved !== null ? (
                                    <span className={cSolved >= 3 ? "text-emerald-700 dark:text-emerald-300" : cSolved >= 1 ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"}>
                                      {cSolved}
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">—</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.easy ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.medium ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.hard ?? 0}</td>
                                <td className="px-4 py-2.5 text-center font-black text-sm text-brand-700 dark:text-brand-300">{s.total_solved ?? ((s.easy || 0) + (s.medium || 0) + (s.hard || 0))}</td>
                              </>
                            )}
                            <td className="px-3.5 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300">
                              {isPart ? formatRank(s.global_rank || s.rank || s.profile_rank) : "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
                              {isPart ? formatRating(s.rating || s.contest_rating) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

            </div>
          ) : (
            /* DEFAULT / OTHER REPORTS VIEW */
            <div className="space-y-6">

              {/* ====== WEEKLY PERFORMANCE DEDICATED VIEW ====== */}
              {isWeeklyPerformance && (
                <div className="space-y-6">
                  {/* Current / Last Week Session Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/40">
                      <div className="text-[10px] uppercase font-black text-cyan-600 dark:text-cyan-400 tracking-wider mb-2">Current Week</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white">{report.currentWeek?.contests_str || `Weekly Contest ${report.currentWeek?.contestNumber || '—'}`}</div>
                      <div className="text-xs text-slate-900 dark:text-slate-100 font-bold mt-1">Session Date: {report.currentWeek?.date || '—'}</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/40">
                      <div className="text-xs uppercase font-black text-amber-700 dark:text-amber-300 tracking-wider mb-2">Last Week</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white">{report.lastWeek?.contests_str || `Weekly Contest ${report.lastWeek?.contestNumber || '—'}`}</div>
                      <div className="text-xs text-slate-900 dark:text-slate-100 font-bold mt-1">Session Date: {report.lastWeek?.date || '—'}</div>
                    </div>
                  </div>

                  {/* College Summary Metrics */}
                  {report.college_summary && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">College Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Total Students', value: report.total_students },
                          { label: 'Verified', value: report.verified_students },
                          { label: 'Unavailable', value: report.unavailable_students },
                          { label: 'Above 500', value: report.college_summary?.metrics?.above_500 },
                          { label: '250–500', value: report.college_summary?.metrics?.['250_500'] },
                          { label: 'Less than 250', value: report.college_summary?.metrics?.['101_250'] },
                          { label: 'Less than 100', value: report.college_summary?.metrics?.less_100 },
                          { label: 'Not Started', value: report.college_summary?.metrics?.not_started },
                          { label: 'Avg Solved', value: report.college_summary?.metrics?.avg_solved },
                          { label: 'Total Solved', value: report.college_summary?.metrics?.total_solved },
                          { label: 'Rating > 1500', value: report.college_summary?.metrics?.rating_1500 },
                          { label: 'Ranking < 20K', value: report.college_summary?.metrics?.ranking_20000 },
                        ].map((m, i) => (
                          <div key={i} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-navy-950 text-center shadow-sm">
                            <p className="text-xs text-slate-900 dark:text-slate-100 uppercase font-black tracking-wider mb-1">{m.label}</p>
                            <p className="text-xl font-black text-slate-950 dark:text-white">{m.value !== null && m.value !== undefined ? (typeof m.value === 'number' && m.value > 999 ? m.value.toLocaleString() : String(m.value)) : '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Week Contest Attendance */}
                  {report.college_summary?.metrics?.current_week && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                        <span>Current Week Contest Attendance</span>
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {[
                          { label: '4/4 Solved', value: report.college_summary.metrics.current_week.q4, color: 'text-emerald-700 dark:text-emerald-300' },
                          { label: '3/4 Solved', value: report.college_summary.metrics.current_week.q3, color: 'text-cyan-700 dark:text-cyan-300' },
                          { label: '2/4 Solved', value: report.college_summary.metrics.current_week.q2, color: 'text-blue-700 dark:text-blue-300' },
                          { label: '1/4 Solved', value: report.college_summary.metrics.current_week.q1, color: 'text-amber-700 dark:text-amber-300' },
                          { label: '0/4 Solved', value: report.college_summary.metrics.current_week.q0, color: 'text-rose-700 dark:text-rose-300' },
                        ].map((m, i) => (
                          <div key={i} className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center">
                            <div className="text-xs font-black text-slate-900 dark:text-slate-100 mb-1">{m.label}</div>
                            <div className={`text-xl font-black ${m.color}`}>{m.value ?? '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Department Summaries */}
                  {report.department_summaries && Array.isArray(report.department_summaries) && report.department_summaries.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Department Performance Summary</h3>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-xs min-w-[900px]">
                          <thead className="bg-[#16324F] text-white font-black uppercase">
                            <tr>
                              <th className="px-3 py-3 text-center">S.No</th>
                              <th className="px-3 py-3">Department</th>
                              <th className="px-3 py-3">Coordinator</th>
                              <th className="px-3 py-3 text-center">Total</th>
                              <th className="px-3 py-3 text-center">Verified</th>
                              <th className="px-3 py-3 text-center">Avg Solved</th>
                              <th className="px-3 py-3 text-center">Total Solved</th>
                              <th className="px-3 py-3 text-center">Above 500</th>
                              <th className="px-3 py-3 text-center">250–500</th>
                              <th className="px-3 py-3 text-center">4/4</th>
                              <th className="px-3 py-3 text-center">3/4</th>
                              <th className="px-3 py-3 text-center">2/4</th>
                              <th className="px-3 py-3 text-center">1/4</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                            {report.department_summaries.filter((d: any) => (d.total_students || 0) > 0).map((d: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                                <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{idx + 1}</td>
                                <td className="px-3 py-2.5 font-black text-brand-700 dark:text-brand-300">{d.department}</td>
                                <td className="px-3 py-2.5 text-slate-950 dark:text-white font-bold">{d.coordinator || '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black">{d.total_students}</td>
                                <td className="px-3 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{d.metrics?.verified}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black">{d.metrics?.avg_solved}</td>
                                <td className="px-3 py-2.5 text-center font-black">{d.metrics?.total_solved?.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-center font-black text-purple-700 dark:text-purple-300">{d.metrics?.above_500}</td>
                                <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{d.metrics?.['250_500']}</td>
                                <td className="px-3 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{d.metrics?.current_week?.q4 ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-cyan-700 dark:text-cyan-300">{d.metrics?.current_week?.q3 ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-blue-700 dark:text-blue-300">{d.metrics?.current_week?.q2 ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-amber-700 dark:text-amber-300">{d.metrics?.current_week?.q1 ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Batch Summaries */}
                  {report.batch_summaries && Array.isArray(report.batch_summaries) && report.batch_summaries.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Batch-wise Performance Summary</h3>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead className="bg-[#16324F] text-white font-black uppercase">
                            <tr>
                              <th className="px-3 py-3">Batch</th>
                              <th className="px-3 py-3 text-center">Year</th>
                              <th className="px-3 py-3 text-center">Total</th>
                              <th className="px-3 py-3 text-center">Above 500</th>
                              <th className="px-3 py-3 text-center">250–500</th>
                              <th className="px-3 py-3 text-center">{'<250'}</th>
                              <th className="px-3 py-3 text-center">{'<100'}</th>
                              <th className="px-3 py-3 text-center">Not Started</th>
                              <th className="px-3 py-3 text-center">Rating {'>'} 1500</th>
                              <th className="px-3 py-3 text-center">4/4</th>
                              <th className="px-3 py-3 text-center">3/4</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                            {report.batch_summaries.filter((b: any) => (b.total_students || 0) > 0).map((b: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                                <td className="px-3 py-2.5 font-black text-brand-700 dark:text-brand-300">{b.batch}</td>
                                <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{b.year}</td>
                                <td className="px-3 py-2.5 text-center font-black">{b.total_students}</td>
                                <td className="px-3 py-2.5 text-center font-black text-purple-700 dark:text-purple-300">{b.categories?.['Above 500'] ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{b.categories?.['250 - 500'] ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black">{b.categories?.['Less than 250'] ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-amber-700 dark:text-amber-300">{b.categories?.['Less than 100'] ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-rose-700 dark:text-rose-300">{b.categories?.['Not Yet Started'] ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{b.rating_1500 ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{b.current_week?.q4 ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center font-black text-cyan-700 dark:text-cyan-300">{b.current_week?.q3 ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Student Roster with Contest Outcomes */}
                  {(() => {
                    const rosterList = report.all_students_current || report.allStudents || report.rows || report.student_list || [];
                    if (!Array.isArray(rosterList) || rosterList.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                          Full Student Roster ({rosterList.length} Students)
                        </h3>
                        <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[450px] overflow-y-auto">
                          <table className="w-full text-xs min-w-[1000px]">
                            <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-3 text-center w-10">S.No</th>
                                <th className="px-3 py-3 sticky left-0 bg-[#16324F] z-20">Reg No</th>
                                <th className="px-3 py-3">Name</th>
                                <th className="px-3 py-3 text-center">Dept</th>
                                <th className="px-3 py-3 text-center">Yr</th>
                                <th className="px-3 py-3 text-center">Easy</th>
                                <th className="px-3 py-3 text-center">Med</th>
                                <th className="px-3 py-3 text-center">Hard</th>
                                <th className="px-3 py-3 text-center">Total</th>
                                <th className="px-3 py-3 text-center">Category</th>
                                <th className="px-3 py-3 text-center">Curr Week</th>
                                <th className="px-3 py-3 text-center">Last Week</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                              {rosterList.map((s: any, idx: number) => {
                                const pubResult = strVal(s.public_result);
                                const lastPubResult = strVal(s.last_public_result);
                                function strVal(v: any): string { return typeof v === 'string' ? v : ''; }
                                const getOutcomeColor = (r: string) => {
                                  if (r === '4_SOLVED') return 'text-emerald-700 dark:text-emerald-300 font-black';
                                  if (r === '3_SOLVED') return 'text-cyan-700 dark:text-cyan-300 font-black';
                                  if (r === '2_SOLVED') return 'text-blue-700 dark:text-blue-300 font-black';
                                  if (r === '1_SOLVED') return 'text-amber-700 dark:text-amber-300 font-black';
                                  if (r === '0_SOLVED') return 'text-rose-700 dark:text-rose-300 font-black';
                                  return 'text-slate-800 dark:text-slate-200 font-bold';
                                };
                                const formatOutcome = (r: string) => {
                                  if (!r) return '—';
                                  if (r.includes('SOLVED')) return r.replace('_SOLVED', '/4');
                                  if (r === 'NOT_PARTICIPATED' || r === 'NOT_ATTENDED') return '—';
                                  return r;
                                };
                                return (
                                  <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                                    <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{s.s_no || (idx + 1)}</td>
                                    <td className="px-3 py-2.5 font-black font-mono text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-navy-950">{s.reg_no}</td>
                                    <td className="px-3 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{formatStudentName(s.name || s.student_name)}</td>
                                    <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                                    <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                                    <td className="px-3 py-2.5 text-center text-emerald-700 dark:text-emerald-300 font-black">{s.easy ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-center text-amber-700 dark:text-amber-300 font-black">{s.medium ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-center text-rose-700 dark:text-rose-300 font-black">{s.hard ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-center font-black text-slate-950 dark:text-white">{s.total_solved ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-center text-xs font-black">{s.category || '—'}</td>
                                    <td className={`px-3 py-2.5 text-center ${getOutcomeColor(pubResult)}`}>{formatOutcome(pubResult)}</td>
                                    <td className={`px-3 py-2.5 text-center ${getOutcomeColor(lastPubResult)}`}>{formatOutcome(lastPubResult)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ====== GENERIC REPORTS BELOW (hidden for weekly perf) ====== */}
              {/* Metrics Overview Cards */}
              {!isWeeklyPerformance && report.metrics && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Executive Summary Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(report.metrics).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-navy-950 text-center shadow-sm">
                        <p className="text-xs text-slate-900 dark:text-slate-100 uppercase font-black tracking-wider mb-1">
                          {formatMetricTitle(key)}
                        </p>
                        <p className="text-xl font-black text-slate-950 dark:text-white">
                          {value !== null && value !== undefined ? (typeof value === 'number' && value > 999 ? value.toLocaleString() : String(value)) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Distribution Grid */}
              {!isWeeklyPerformance && report.distribution && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Problem Solving Category Distribution</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(report.distribution).map(([cat, count]: [string, any]) => (
                      <div key={cat} className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 mb-1">{cat}</div>
                        <div className="text-xl font-black text-purple-800 dark:text-purple-300">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HOD Department Intelligence Summary Table */}
              {!isWeeklyPerformance && (['HOD_DEPARTMENT_INTELLIGENCE', 'PRINCIPAL_EXECUTIVE', 'MANAGEMENT_EXECUTIVE_SUMMARY', 'FRIDAY_OFFICIAL_CONTEST'].includes(rType) || !rType) && report.departmentSummary && Array.isArray(report.departmentSummary) && report.departmentSummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-brand-500" />
                    <span>HOD Department Intelligence Summary</span>
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase hidden md:table-header-group">
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
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {report.departmentSummary.map((d: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] font-black text-slate-900 dark:text-slate-100">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-brand-700 dark:text-brand-300">{d.department}</td>
                            <td className="px-4 py-2.5 text-center font-black">{d.total}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{d.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{d.attendance_pct}%</td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-white">{d.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-black">{d.avg_solved}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{d.solvers_4}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Faculty / Staff Allocation Performance Table */}
              {!isWeeklyPerformance && (['FACULTY_CONSOLIDATED', 'FACULTY_COORDINATOR_CONSOLIDATED'].includes(rType) || !rType) && report.facultySummary && Array.isArray(report.facultySummary) && report.facultySummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    <span>Faculty & Mentor Consolidated Performance</span>
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase hidden md:table-header-group">
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
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {report.facultySummary.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] font-black text-slate-900 dark:text-slate-100">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-slate-950 dark:text-white">{f.staff_name}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{f.department}</td>
                            <td className="px-4 py-2.5 text-center font-black">{f.total_assigned}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{f.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-black text-brand-700 dark:text-brand-300">{f.active_pct}%</td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-white">{f.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-black">{f.avg_solved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5-Week Performance Trend Matrix Table */}
              {isFiveWeekTrend && report.sessionHeaders && Array.isArray(report.sessionHeaders) && report.sessionHeaders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-indigo-500" />
                    <span>Five-Week Longitudinal Performance Matrix</span>
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[950px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group">
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12">S.No</th>
                          <th className="px-3.5 py-3 text-center">Register No</th>
                          <th className="px-3.5 py-3 text-left">Student Name</th>
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
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {(report.allStudents || report.rows || []).map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-slate-950 dark:text-white font-mono">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-black">{s.c1_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-black">{s.c2_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-black">{s.c3_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-black">{s.c4_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-black">{s.c5_solved ?? 0}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-300 text-sm">{s.total_solved ?? 0}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-brand-700 dark:text-brand-300">{s.attendance_rate || '0%'}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border ${
                                s.trajectory?.includes('IMPROVING') ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                                s.trajectory?.includes('STABLE') ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' :
                                s.trajectory?.includes('DECLINING') ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' :
                                'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
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

              {/* Top Performers Table (Only shown for general cumulative reports) */}
              {!isFiveWeekTrend && !isWeeklyPerformance && report.topStudents && report.topStudents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Top Performers Leaderboard</span>
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[750px] md:min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase hidden md:table-header-group">
                        <tr>
                          <th className="px-4 py-3 text-center">Rank</th>
                          <th className="px-4 py-3 text-center">Reg No</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-center">Dept</th>
                          <th className="px-4 py-3 text-center">Year</th>
                          <th className="px-4 py-3 text-right">Easy</th>
                          <th className="px-4 py-3 text-right">Medium</th>
                          <th className="px-4 py-3 text-right">Hard</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {report.topStudents.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-black text-amber-600 dark:text-amber-400">#{idx + 1}</td>
                            <td className="px-4 py-2.5 text-center font-black text-slate-950 dark:text-white font-mono">{s.reg_no}</td>
                            <td className="px-4 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-300">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-amber-700 dark:text-amber-300">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-rose-700 dark:text-rose-300">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-brand-700 dark:text-brand-300 text-sm">{s.total_solved ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
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

              {/* Full Student Roster Table (Only shown for general cumulative reports) */}
              {!isFiveWeekTrend && !isHistIntel && !isWowIntel && !isWeeklyPerformance && allRows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    Full Student Performance Roster ({allRows.length} Students)
                  </h3>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[450px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[800px] print:min-w-0 print:w-full">
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 hidden md:table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                        <tr>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">S.No</th>
                          <th className="px-4 py-3 sticky left-0 bg-[#16324F] print:bg-slate-200 print:border-b print:border-black z-20">Reg No</th>
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
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans print:divide-black">
                        {allRows.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                            <td className="px-4 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-navy-950 group-hover:bg-slate-100 dark:group-hover:bg-navy-800 print:bg-transparent print:text-black z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">{s.reg_no}</td>
                            <td className="px-4 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-300 font-black">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-300 font-black">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right text-rose-700 dark:text-rose-300 font-black">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-black text-brand-700 dark:text-brand-300">{s.total_solved !== null ? s.total_solved : "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${s.status === 'VERIFIED' ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-300'}`}>
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

