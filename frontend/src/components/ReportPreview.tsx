import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Layers, Award, CheckCircle2, UserCheck, Users, HelpCircle, Filter, Building2, GraduationCap, Target, Printer, ShieldCheck, TrendingUp, UserX, Clock } from 'lucide-react';
import api from '../services/api';
import { FullScreenLoadingOverlay } from './ui/FullScreenLoadingOverlay';
import { SwipeHandle } from './SwipeHandle';

interface ReportPreviewProps {
  reportId: string;
  initialData?: any;
  onClose: () => void;
}

import { useNotification } from '../context/NotificationContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';
import { deriveYearLevelFromRegNo } from '../utils/filterUtils';

const formatStudentName = (name: string) => {
  if (!name) return "—";
  return name.split(' ').map(word => {
    return word.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join('.');
  }).join(' ');
};

const getContestDifficultyBreakdown = (s: any, forceCurrentContestOnly: boolean = false) => {
  if (!forceCurrentContestOnly) {
    if (s.contest_easy !== undefined && s.contest_medium !== undefined && s.contest_hard !== undefined && s.contest_easy !== null) {
      return {
        easy: Number(s.contest_easy || 0),
        medium: Number(s.contest_medium || 0),
        hard: Number(s.contest_hard || 0),
      };
    }
    if (s.contest_easy_solved !== undefined && s.contest_medium_solved !== undefined && s.contest_hard_solved !== undefined && s.contest_easy_solved !== null) {
      return {
        easy: Number(s.contest_easy_solved || 0),
        medium: Number(s.contest_medium_solved || 0),
        hard: Number(s.contest_hard_solved || 0),
      };
    }
  }

  let q1 = s.q1 !== undefined && s.q1 !== null ? (s.q1 === 1 || s.q1 === true || s.q1 === '1' ? 1 : 0) : null;
  let q2 = s.q2 !== undefined && s.q2 !== null ? (s.q2 === 1 || s.q2 === true || s.q2 === '1' ? 1 : 0) : null;
  let q3 = s.q3 !== undefined && s.q3 !== null ? (s.q3 === 1 || s.q3 === true || s.q3 === '1' ? 1 : 0) : null;
  let q4 = s.q4 !== undefined && s.q4 !== null ? (s.q4 === 1 || s.q4 === true || s.q4 === '1' ? 1 : 0) : null;

  let cEasy = q1 !== null ? q1 : 0;
  let cMed = (q2 !== null ? q2 : 0) + (q3 !== null ? q3 : 0);
  let cHard = q4 !== null ? q4 : 0;

  const knownSum = cEasy + cMed + cHard;
  const totSolved = s.contest_solved !== undefined && s.contest_solved !== null 
    ? Number(s.contest_solved) 
    : (s.total_contest_solved !== undefined && s.total_contest_solved !== null 
      ? Number(s.total_contest_solved) 
      : (s.solved !== undefined && s.solved !== null ? Number(s.solved) : (s.total_solved !== undefined ? Number(s.total_solved) : knownSum)));

  if (totSolved > knownSum) {
    const rem = totSolved - knownSum;
    const fullBlocks = Math.floor(rem / 4);
    const leftover = rem % 4;

    cEasy += fullBlocks + (leftover >= 1 ? 1 : 0);
    cMed += (fullBlocks * 2) + (leftover >= 2 ? 1 : 0) + (leftover >= 3 ? 1 : 0);
    cHard += fullBlocks + (leftover >= 4 ? 1 : 0);
  }

  return { easy: cEasy, medium: cMed, hard: cHard };
};

export const ReportPreview: React.FC<ReportPreviewProps> = ({ reportId, initialData, onClose }) => {
  const { notify } = useNotification();
  useScrollLock(true);
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
    if (rType === 'WEEKLY_PERFORMANCE' || rType === 'WEEKLY_STUDENT_PERFORMANCE' || !!report.batch_summaries) return false;
    return (
      rType === 'CONTEST_PERFORMANCE' ||
      rType === 'OFFICIAL_CONTEST' ||
      rType === 'FRIDAY_OFFICIAL_CONTEST' ||
      rType === 'FRIDAY_OFFICIAL' ||
      rType === 'SATURDAY_BIWEEKLY_CONTEST' ||
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
      !!report.department_summaries ||
      !!report.batch_summaries
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
    if (isNaN(num) || num <= 0 || num >= 5000000) return '—';
    return `#${num.toLocaleString()}`;
  };

  const formatAccommodation = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '—' || val === 'None' || val === 'NaN' || val === 'nan') return '—';
    const s = String(val).trim().toUpperCase();
    if (s.includes('DAY')) return 'D';
    if (s.includes('HOSTEL')) return 'H';
    return s.charAt(0) || '—';
  };

  const formatRating = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '—' || val === 'None' || val === 'NaN' || val === 'nan') return '—';
    const cleanStr = String(val).replace(/[^0-9.]/g, '');
    const num = Number(cleanStr);
    if (isNaN(num) || num <= 0 || num === 1500 || Math.round(num) === 1500) return '—';
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
    t = t.replace(/^NANDHA ENGINEERING COLLEGE \([^)]+\)\s*/i, '').trim();
    t = t.replace(/^NANDHA ENGINEERING COLLEGE\s*/i, '').trim();
    t = t.replace(/\s+\b\d+\b\s*-\s*/, ' ').trim();
    t = t.replace(/\(\s*(\d+|I+|IV|V|FINAL|1ST|2ND|3RD|4TH)\s*(?:Year|Yr)?\s*\)/gi, (_m, g1) => {
      const rY = toRomanYear(g1);
      return `(${rY} Year)`;
    });
    const yBrackets = t.match(/\([I|V|X]+ Year\)/gi);
    if (yBrackets && yBrackets.length > 1) {
      const lastBracket = yBrackets[yBrackets.length - 1];
      yBrackets.slice(0, yBrackets.length - 1).forEach(b => {
        t = t.replace(b, '').trim();
      });
    }
    return t.replace(/\s+/g, ' ').trim();
  };

  const isFridayContestType = useMemo(() => {
    const rid = String(report?.reportId || report?.report_id || '').toUpperCase();
    return rType === 'FRIDAY_OFFICIAL_CONTEST' || rType === 'FRIDAY_OFFICIAL' || rid.includes('RPT-FRIDAY') || rid.includes('FRIDAY');
  }, [report, rType]);

  const headerTitle = useMemo(() => {
    let raw = cleanReportTitle(report?.title || report?.reportTitle);
    if (isFridayContestType && !rType.includes('BIWEEKLY')) {
      if (raw.toUpperCase().includes('BIWEEKLY CONTEST')) {
        raw = raw.replace(/BIWEEKLY CONTEST\s*\d*\s*—?/gi, 'FRIDAY CONTEST RESULT —').trim();
      }
      return raw || 'FRIDAY CONTEST RESULT — STUDENT PERFORMANCE REPORT';
    }
    return raw || (isContestReport ? `${report?.contestName || 'Contest'} Performance Report` : 'Report Preview');
  }, [report, isFridayContestType, isContestReport, rType]);

  const contestBadgeText = useMemo(() => {
    if (isFridayContestType && !rType.includes('BIWEEKLY')) {
      const cDate = report?.contestDate || report?.sessionDate || '';
      const name = (report?.contestName && !report.contestName.toLowerCase().includes('biweekly')) ? report.contestName : 'Friday Contest Result';
      return `${name}${cDate ? ` (${cDate})` : ''}`;
    }
    return `${report?.contestName || 'Contest'} (${report?.contestDate || report?.sessionDate || 'Sunday Session'})`;
  }, [report, isFridayContestType, rType]);

  const getQVal = (q: any, qNum: number, solvedCount: any, isPart: boolean) => {
    if (!isPart) return 0;
    if (q === 1 || q === '1' || Number(q) >= 1) return 1;
    const sNum = Number(solvedCount || 0);
    if (sNum >= qNum) return 1;
    return 0;
  };

  const contestSummary = report?.contestSummary || report?.metrics || {};
  const solveDist = report?.solveDistribution || {};

  const userSnapshot = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const userRole = (userSnapshot?.role || '').trim().toLowerCase();
  const isHodUser = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(userRole);
  const authorizedDeptCodes: string[] = useMemo(() => {
    return (userSnapshot?.authorized_department_codes || []).map((c: string) => c.trim().toUpperCase());
  }, [userSnapshot]);

  const allRows = useMemo(() => {
    let raw = report?.allStudents || report?.rows || report?.all_students_current || report?.rosters?.all_current || [];
    if (!Array.isArray(raw)) return [];
    if (isHodUser && authorizedDeptCodes.length > 0) {
      raw = raw.filter((r: any) => {
        const d = (r.department || r.dept || r.department_code || '').trim().toUpperCase();
        return authorizedDeptCodes.some(c => d === c || d.includes(c) || c.includes(d));
      });
    }
    return raw;
  }, [report, isHodUser, authorizedDeptCodes]);

  const displayDepartmentResults = useMemo(() => {
    const rawList = report?.departmentResults || [];
    if (!Array.isArray(rawList)) return [];
    if (isHodUser && authorizedDeptCodes.length > 0) {
      return rawList.filter((dr: any) => {
        const d = (dr.department || '').trim().toUpperCase();
        return authorizedDeptCodes.some(c => d === c || d.includes(c) || c.includes(d));
      });
    }
    const targetDept = (report?.department || report?.deptFilter || '').trim().toUpperCase();
    if (targetDept && targetDept !== 'ALL') {
      return rawList.filter((dr: any) => {
        const d = (dr.department || '').trim().toUpperCase();
        return d === targetDept || d.includes(targetDept) || targetDept.includes(d);
      });
    }
    return rawList;
  }, [report?.departmentResults, report?.department, report?.deptFilter, isHodUser, authorizedDeptCodes]);

  const displayOfficialLeaderboard = useMemo(() => {
    const rawLb = report?.officialLeaderboard || [];
    if (!Array.isArray(rawLb)) return [];
    if (isHodUser && authorizedDeptCodes.length > 0) {
      return rawLb.filter((lb: any) => {
        const d = (lb.dept || lb.department || '').trim().toUpperCase();
        return authorizedDeptCodes.some(c => d === c || d.includes(c) || c.includes(d));
      });
    }
    const targetDept = (report?.department || report?.deptFilter || '').trim().toUpperCase();
    if (targetDept && targetDept !== 'ALL') {
      return rawLb.filter((lb: any) => {
        const d = (lb.dept || lb.department || '').trim().toUpperCase();
        return d === targetDept || d.includes(targetDept) || targetDept.includes(d);
      });
    }
    return rawLb;
  }, [report?.officialLeaderboard, report?.department, report?.deptFilter, isHodUser, authorizedDeptCodes]);

  // Filter student rows based on active filter (for both Contest and Profile/General reports)
  const displayedStudents = useMemo(() => {
    if (!activeFilter) return allRows;

    return allRows.filter((r: any) => {
      const rawSt = (r.status || r.attendance_status || r.attendance || '').toString().trim().toUpperCase();
      const st = rawSt.replace(/\s+/g, '_');
      const isPart = st === 'PUBLIC_ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'PUBLIC' || st === 'VIRTUAL' || st === 'PUBLIC_LIVE' || st === 'VIRTUAL_PRACTICE' || st === 'ATTENDED';
      
      const cSolved = r.contest_solved !== undefined && r.contest_solved !== null ? Number(r.contest_solved) : null;
      const tSolved = r.total_solved !== undefined && r.total_solved !== null 
        ? Number(r.total_solved) 
        : (r.total !== undefined && r.total !== null 
          ? Number(r.total) 
          : (r.solved !== undefined && r.solved !== null 
            ? Number(r.solved) 
            : null));
      const solved = cSolved !== null ? cSolved : (tSolved !== null ? tSolved : 0);
      const easySolved = Number(r.easy || r.easy_solved || 0);
      const medSolved = Number(r.medium || r.medium_solved || 0);
      const hardSolved = Number(r.hard || r.hard_solved || 0);
      const overallSolved = tSolved !== null ? tSolved : (easySolved + medSolved + hardSolved);

      // Contest specific filters
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

      // General / Cumulative Metric Filters
      if (activeFilter === 'METRIC_ACTIVE_SOLVERS' || activeFilter === 'activeSolvers' || activeFilter === 'active_solvers') {
        return overallSolved > 0 || isPart || Boolean(r.is_active_solver);
      }
      if (activeFilter === 'METRIC_VERIFIED_SOLVERS' || activeFilter === 'verifiedSolvers' || activeFilter === 'verified_solvers') {
        return r.is_unverified !== true && st !== 'UNVERIFIED' && st !== 'INVALID_USERNAME' && st !== 'PENDING_USERNAME';
      }
      if (activeFilter === 'METRIC_UNVERIFIED_PROFILES' || activeFilter === 'unverifiedProfiles' || activeFilter === 'unverified_profiles') {
        return r.is_unverified === true || st === 'UNVERIFIED' || st === 'INVALID_USERNAME' || st === 'PENDING_USERNAME';
      }
      if (activeFilter === 'METRIC_EASY_SOLVED' || activeFilter === 'easySolved' || activeFilter === 'easy_solved') {
        return easySolved > 0;
      }
      if (activeFilter === 'METRIC_MEDIUM_SOLVED' || activeFilter === 'mediumSolved' || activeFilter === 'medium_solved') {
        return medSolved > 0;
      }
      if (activeFilter === 'METRIC_HARD_SOLVED' || activeFilter === 'hardSolved' || activeFilter === 'hard_solved') {
        return hardSolved > 0;
      }
      if (activeFilter === 'METRIC_ZERO_SOLVED' || activeFilter === 'zeroSolved' || activeFilter === 'notYetStarted') {
        return overallSolved === 0;
      }

      // Problem Solving Category Distribution Filters
      if (activeFilter === 'Above 500' || activeFilter === 'Above_500' || activeFilter === '>500') {
        return overallSolved >= 500;
      }
      if (activeFilter === '250-500' || activeFilter === '250_500' || activeFilter === '250-499') {
        return overallSolved >= 250 && overallSolved < 500;
      }
      if (activeFilter === '100-249' || activeFilter === '100_249' || activeFilter === '100-250') {
        return overallSolved >= 100 && overallSolved < 250;
      }
      if (activeFilter === '50-99' || activeFilter === '50_99') {
        return overallSolved >= 50 && overallSolved < 100;
      }
      if (activeFilter === '25-49' || activeFilter === '25_49') {
        return overallSolved >= 25 && overallSolved < 50;
      }
      if (activeFilter === '1-24' || activeFilter === '1_24') {
        return overallSolved >= 1 && overallSolved < 25;
      }
      if (activeFilter === '0 Solved' || activeFilter === '0_Solved' || activeFilter === 'Not Yet Started' || activeFilter === 'Not_Yet_Started') {
        return overallSolved === 0;
      }
      if (activeFilter === 'Less than 100' || activeFilter === 'Less_than_100' || activeFilter === '<100') {
        return overallSolved < 100 && overallSolved > 0;
      }

      return true;
    });
  }, [allRows, activeFilter]);

  const toggleFilter = (filterKey: string) => {
    setActiveFilter(prev => prev === filterKey ? null : filterKey);
  };

  // Comprehensive Condition Stats for Summary Breakdown under the tables
  const conditionStats = useMemo(() => {
    const students = displayedStudents || [];
    let s4 = 0, s3 = 0, s2 = 0, s1 = 0, s0 = 0, notAtt = 0;
    let totalEasy = 0, totalMed = 0, totalHard = 0, totalSolves = 0;
    let attendedCount = 0;

    students.forEach((s: any) => {
      const st = (s.status || s.attendance_status || s.attendance || '').toString().trim().toUpperCase();
      const isPart = ['PUBLIC_ATTENDED', 'VIRTUAL_ATTENDED', 'PUBLIC', 'VIRTUAL', 'PUBLIC_LIVE', 'VIRTUAL_PRACTICE', 'ATTENDED', 'VERIFIED', 'COMPLETED', 'ATTENDED_SOLVED', 'ATTENDED_ZERO'].includes(st) || 
        (s.contest_solved !== undefined && s.contest_solved !== null && Number(s.contest_solved) >= 0) ||
        (s.contests_attended !== undefined && Number(s.contests_attended) > 0);

      const cSolved = s.contest_solved !== undefined && s.contest_solved !== null 
        ? Number(s.contest_solved) 
        : (s.solved !== undefined && s.solved !== null 
          ? Number(s.solved) 
          : (s.total_contest_solved !== undefined && s.total_contest_solved !== null
            ? Number(s.total_contest_solved)
            : (s.total_solved !== undefined && s.total_solved !== null ? Number(s.total_solved) : null)));

      if (isPart || (cSolved !== null && cSolved > 0)) {
        attendedCount++;
        if (cSolved >= 4) s4++;
        else if (cSolved === 3) s3++;
        else if (cSolved === 2) s2++;
        else if (cSolved === 1) s1++;
        else s0++;
      } else {
        notAtt++;
      }

      const cDiff = getContestDifficultyBreakdown(s, isContestReport);
      const e = Number(s.easy ?? s.easy_solved ?? cDiff.easy ?? 0);
      const m = Number(s.medium ?? s.medium_solved ?? cDiff.medium ?? 0);
      const h = Number(s.hard ?? s.hard_solved ?? cDiff.hard ?? 0);

      totalEasy += e;
      totalMed += m;
      totalHard += h;
      totalSolves += (cSolved !== null && cSolved > 0 ? cSolved : (e + m + h));
    });

    // If backend report already provided college/contest-wide solveDist and filter is not active:
    if (!activeFilter && solveDist && (solveDist.solved4 !== undefined || solveDist.solved3 !== undefined)) {
      s4 = Number(solveDist.solved4 ?? s4);
      s3 = Number(solveDist.solved3 ?? s3);
      s2 = Number(solveDist.solved2 ?? s2);
      s1 = Number(solveDist.solved1 ?? s1);
      s0 = Number(solveDist.solved0 ?? s0);
    }

    if (totalEasy === 0 && report?.metrics?.easySolved) totalEasy = Number(report.metrics.easySolved);
    if (totalMed === 0 && report?.metrics?.mediumSolved) totalMed = Number(report.metrics.mediumSolved);
    if (totalHard === 0 && report?.metrics?.hardSolved) totalHard = Number(report.metrics.hardSolved);
    if (totalSolves === 0 && report?.metrics?.totalSolved) totalSolves = Number(report.metrics.totalSolved);

    return {
      totalStudents: students.length,
      attendedCount,
      notAttendedCount: notAtt,
      s4,
      s3,
      s2,
      s1,
      s0,
      totalEasy,
      totalMed,
      totalHard,
      totalSolves,
    };
  }, [displayedStudents, isContestReport, activeFilter, solveDist, report?.metrics]);

  // Robust Contest Metrics Calculation with zero-fallback & reconciliation safety
  const totalRosterCount = useMemo(() => {
    return contestSummary.totalStudents || allRows.length || 0;
  }, [contestSummary.totalStudents, allRows.length]);

  const actualParticipantCount = useMemo(() => {
    const sumAttended = (contestSummary.publicAttended || 0) + (contestSummary.virtualAttended || 0);
    if (sumAttended > 0) return sumAttended;
    if (conditionStats.attendedCount > 0) return conditionStats.attendedCount;
    const distSum = (Number(solveDist.solved4) || 0) + (Number(solveDist.solved3) || 0) + (Number(solveDist.solved2) || 0) + (Number(solveDist.solved1) || 0) + (Number(solveDist.solved0) || 0);
    if (distSum > 0) return distSum;
    if (report.histSummary?.sessionParticipation?.length > 0) {
      return report.histSummary.sessionParticipation[report.histSummary.sessionParticipation.length - 1].attended || 0;
    }
    return allRows.filter((r: any) => (r.totalAttended || 0) > 0 || (r.weeklyData || []).some((w: any) => w.att) || (r.status || '').toUpperCase().includes('ATTEND')).length;
  }, [contestSummary, conditionStats.attendedCount, solveDist, report.histSummary, allRows]);

  const actualNotAttendedCount = useMemo(() => {
    if (solveDist.notParticipated !== undefined && solveDist.notParticipated !== null && Number(solveDist.notParticipated) >= 0) {
      return Number(solveDist.notParticipated);
    }
    if (contestSummary.notAttended !== undefined && contestSummary.notAttended !== null && Number(contestSummary.notAttended) > 0) {
      return Number(contestSummary.notAttended);
    }
    if (conditionStats.notAttendedCount > 0) {
      return conditionStats.notAttendedCount;
    }
    return Math.max(totalRosterCount - actualParticipantCount, 0);
  }, [solveDist.notParticipated, contestSummary.notAttended, conditionStats.notAttendedCount, totalRosterCount, actualParticipantCount]);

  const turnoutPercentage = useMemo(() => {
    if (totalRosterCount <= 0) return '0%';
    const pct = (actualParticipantCount / totalRosterCount) * 100;
    return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  }, [actualParticipantCount, totalRosterCount]);

  const absentPercentage = useMemo(() => {
    if (totalRosterCount <= 0) return '0%';
    const pct = (actualNotAttendedCount / totalRosterCount) * 100;
    return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  }, [actualNotAttendedCount, totalRosterCount]);

  const s4Count = Number(solveDist.solved4 ?? report.metrics?.['4 Q Solved'] ?? conditionStats.s4 ?? 0);
  const s3Count = Number(solveDist.solved3 ?? report.metrics?.['3 Q Solved'] ?? conditionStats.s3 ?? 0);
  const s2Count = Number(solveDist.solved2 ?? report.metrics?.['2 Q Solved'] ?? conditionStats.s2 ?? 0);
  const s1Count = Number(solveDist.solved1 ?? report.metrics?.['1 Q Solved'] ?? conditionStats.s1 ?? 0);
  const s0Count = Number(solveDist.solved0 ?? report.metrics?.['0 Q Solved'] ?? conditionStats.s0 ?? Math.max(actualParticipantCount - (s4Count + s3Count + s2Count + s1Count), 0));
  const notAttendedCount = actualNotAttendedCount;

  const getCohortPct = (count: number) => {
    if (totalRosterCount <= 0) return '0%';
    const pct = (count / totalRosterCount) * 100;
    return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const downloadFile = async (format: string) => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeFilter) queryParams.append('attendance', activeFilter);
      if (report?.department && report.department !== 'ALL') queryParams.append('department', report.department);
      if (report?.year && report.year !== 'ALL') queryParams.append('year', report.year);
      if (report?.reportType || report?.report_type) queryParams.append('report_type', report.reportType || report.report_type);
      
      const qString = queryParams.toString();
      const url = `/reports/${reportId}/${format}${qString ? '?' + qString : ''}`;
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
          'WEEKLY_PERFORMANCE': 'Coordinator_Weekly_Performance_Report',
          'WEEKLY_STUDENT_PERFORMANCE': 'Coordinator_Weekly_Performance_Report',
          'WOW_INTEL': 'Week_on_Week_Performance_Intel_Report',
          'HISTORICAL_PERFORMANCE': 'Historical_Contest_Performance_Report',
          'FIVE_WEEK_TREND': '5Week_Contest_Trend_Report',
          'SUNDAY_LIVE': 'Sunday_Live_Contest_Attendance_Report',
          'FRIDAY_OFFICIAL': 'Official_Friday_Contest_Result_Report',
          'LEADERBOARD': 'Official_Institutional_Leaderboard_Report',
          'MASTER_10_SHEET': 'Master_10_Sheet_Institutional_Report',
          'STUDENT_PERFORMANCE': 'Student_Performance_Detail_Report',
          'ASSIGNED_STUDENTS': 'Mentoring_Assigned_Students_Report',
          'STAFF_MENTORING': 'Mentoring_Assigned_Students_Report',
          'OFFICIAL_SUMMARY': 'Official_College_Summary_Report',
          'HOD_DEPARTMENT_INTELLIGENCE': 'HOD_Department_Intelligence_Report',
          'FACULTY_CONSOLIDATED': 'Faculty_Consolidated_Performance_Report',
          'PRINCIPAL_EXECUTIVE': 'Principal_Executive_Intelligence_Report',
        };
        titlePart = typeMap[report?.reportType] || (report?.reportType || 'Student_Performance_Detail').replace(/\s+/g, '_');
      }

      if (isWeeklyPerformance) {
        titlePart = 'Coordinator_Weekly_Performance_Report';
      }

      let sessionTag = '';
      if (report?.contestName) {
        sessionTag += `_${report.contestName.replace(/\s+/g, '_')}`;
      } else if (report?.prevContest && report?.currContest) {
        sessionTag += `_${report.prevContest}_vs_${report.currContest}`;
      }

      const isLiveReport = ['STUDENT_PERFORMANCE', 'ASSIGNED_STUDENTS', 'STAFF_MENTORING'].includes(report?.reportType || '');
      const dateVal = isLiveReport ? '' : (report?.contestDate || report?.sessionDate || report?.session_date || report?.currDate || report?.report_date || report?.reportDate || '');
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      if (dateVal) {
        const parts = dateVal.split(/[.-]/);
        if (parts.length === 3) {
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
      } else {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = months[now.getMonth()];
        const yyyy = now.getFullYear();
        sessionTag += `_${dd}${mm}${yyyy}`;
      }

      let filterTag = '';
      const DEPT_NAME_MAP: Record<string, string> = {
        '1': 'CSE-CS',
        '2': 'CSE-IOT',
        '3': 'IT',
        '4': 'IT',
        '7': 'IT',
        '8': 'CSE',
        '9': 'AGRI',
        '10': 'AIDS',
        '11': 'EEE',
        '12': 'ECE',
        'CSE(CS)': 'CSE-CS',
        'CSE(IOT)': 'CSE-IOT',
        'CSE(IoT)': 'CSE-IOT',
        'CSE': 'CSE',
        'IT': 'IT',
        'AIDS': 'AIDS',
        'ECE': 'ECE',
        'EEE': 'EEE',
        'MECH': 'MECH',
        'CIVIL': 'CIVIL',
        'AGRI': 'AGRI',
        'BME': 'BME',
      };
      const deptRaw = (report?.department || report?.deptFilter || '').toString().trim();
      if (deptRaw && deptRaw.toUpperCase() !== 'ALL') {
        const dUpper = deptRaw.toUpperCase();
        const dClean = DEPT_NAME_MAP[deptRaw] || DEPT_NAME_MAP[dUpper] || deptRaw.replace(/[\(\)\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        filterTag += `_${dClean}`;
      }

      const YEAR_NAME_MAP: Record<string, string> = {
        '1': 'I-Yr', 'I': 'I-Yr', '1ST': 'I-Yr',
        '2': 'II-Yr', 'II': 'II-Yr', '2ND': 'II-Yr',
        '3': 'III-Yr', 'III': 'III-Yr', '3RD': 'III-Yr',
        '4': 'IV-Yr', 'IV': 'IV-Yr', '4TH': 'IV-Yr',
      };
      const yrRaw = (report?.year || report?.yearFilter || '').toString().trim();
      if (yrRaw && yrRaw.toUpperCase() !== 'ALL') {
        const yUpper = yrRaw.toUpperCase();
        const yClean = YEAR_NAME_MAP[yrRaw] || YEAR_NAME_MAP[yUpper] || `${yrRaw.replace(/YEAR|YR/gi, '').trim()}-Yr`;
        filterTag += `_${yClean}`;
      }

      if (activeFilter && activeFilter !== 'ALL') {
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
    if (s === 'PUBLIC_ATTENDED' || s === 'PUBLIC' || s === 'PUBLIC_LIVE' || s === 'ATTENDED' || s === 'VERIFIED' || s === 'FINALIZED') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 leading-tight shadow-2xs">PUBLIC ATTENDED</span>;
    }
    if (s === 'VIRTUAL_ATTENDED' || s === 'VIRTUAL' || s === 'VIRTUAL_PRACTICE') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-purple-50 text-purple-800 border border-purple-300 leading-tight shadow-2xs">VIRTUAL ATTENDED</span>;
    }
    if (s === 'NOT_ATTENDED' || s === 'PUBLIC_NOT_ATTENDED' || s === 'ABSENT') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-rose-50 text-rose-800 border border-rose-300 leading-tight shadow-2xs">NOT ATTENDED</span>;
    }
    if (s === 'PENDING_USERNAME' || s === 'PENDING') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-300 leading-tight shadow-2xs">PENDING USERNAME</span>;
    }
    if (s === 'DATA_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-orange-50 text-orange-800 border border-orange-300 leading-tight shadow-2xs">DATA ERROR</span>;
    }
    if (s === 'FETCH_FAILED' || s === 'FETCH_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-rose-50 text-rose-800 border border-rose-300 leading-tight shadow-2xs">FETCH FAILED</span>;
    }
    if (s === 'INVALID_USERNAME' || s === 'USERNAME_NOT_FOUND') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-orange-50 text-orange-800 border border-orange-300 leading-tight shadow-2xs">INVALID USERNAME</span>;
    }
    return <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300 leading-tight shadow-2xs">UNKNOWN</span>;
  };

  return createPortal(
    <div
      className="modal-overlay-responsive animate-modal-backdrop print:bg-white print:p-0 print:static print:w-full print:h-auto print:overflow-visible"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-container-responsive report-preview-white-modal max-w-7xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 animate-modal-content print:static print:rounded-none print:shadow-none print:border-none print:max-w-full print:w-full print:h-auto print:overflow-visible print:p-0 flex flex-col overflow-hidden">
        
        {/* Mobile bottom-sheet drag handle (Tap or swipe down to close) */}
        <SwipeHandle
          onClose={onClose}
          className="bg-white border-b border-slate-100"
          pillClassName="bg-slate-300 hover:bg-slate-400"
        />

        {/* 1. HEADER BANNER - Crisp Executive White & Compact */}
        <div className="relative overflow-hidden px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-white text-slate-900 flex items-center justify-between shrink-0 border-b border-slate-200/90 shadow-2xs print:bg-white print:text-black print:border-b-2 print:border-black">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center shrink-0 text-indigo-600 shadow-xs">
              <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight print:text-black truncate print:whitespace-normal">
                  {headerTitle}
                </h2>
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-extrabold tracking-wide shrink-0 shadow-2xs print:hidden">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  READY
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate print:whitespace-normal flex items-center gap-1.5 flex-wrap">
                {isContestReport && (
                  <span className="font-bold text-amber-900 print:text-black px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-[10px] sm:text-[11px]">
                    {contestBadgeText}
                  </span>
                )}
                <span className="text-[10px] sm:text-[11px] text-slate-500">Report ID: <span className="font-mono font-bold text-slate-700 print:text-slate-600">{report.reportId || report.report_id}</span></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="shrink-0 ml-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all font-bold text-xs flex items-center space-x-1 cursor-pointer shadow-2xs print:hidden touch-manipulation active:scale-95 group"
          >
            <X className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-600 transition-colors" />
            <span className="text-xs">Close</span>
          </button>
        </div>

        {/* 2. DATASET QUALITY & RECONCILIATION BAR - Crisp Light & Compact */}
        <div className="px-3 sm:px-5 py-2 bg-slate-50/90 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs font-bold shrink-0 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="flex items-center space-x-1 text-slate-800 font-extrabold text-[11px] sm:text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Dataset Reconciliation:</span>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] sm:text-[11px] font-bold">
              Roster: {totalRosterCount} Students
            </span>
            {isContestReport && (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] sm:text-[11px] font-bold">
                Participants: {actualParticipantCount} ({turnoutPercentage})
              </span>
            )}
            {isContestReport && actualNotAttendedCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[10px] sm:text-[11px] font-bold">
                Absent: {actualNotAttendedCount} ({absentPercentage})
              </span>
            )}
            {activeFilter && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] sm:text-[11px] font-bold shadow-2xs">
                <Filter className="w-3 h-3 text-amber-600" />
                <span>Filtered: {displayedStudents.length}/{allRows.length}</span>
                <button 
                  type="button" 
                  onClick={() => setActiveFilter(null)} 
                  className="ml-1 p-0.5 hover:text-rose-600 font-bold touch-manipulation active:scale-90"
                  aria-label="Clear active filter"
                >
                  <X className="w-3 h-3 inline" />
                </button>
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px] sm:text-[11px] border border-blue-200 shadow-2xs">
            <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Nandha Engineering College (Autonomous)</span>
          </div>
        </div>

        {/* 3. SCROLLABLE REPORT CONTENT */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-5 bg-slate-50/50 text-slate-900 print:overflow-visible print:h-auto print:p-0 print:space-y-4 print:mt-4">

          {/* CONTEST PERFORMANCE SPECIALIZED VIEW */}
          {isContestReport ? (
            <div className="space-y-6">
              
              {/* Contest Executive Summary: Solve Condition & Performance Cohorts */}
              {!isHistIntel && !isWowIntel && (
                <div className="space-y-4 print:break-inside-avoid">
                  <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1427] border-2 border-slate-200/90 dark:border-white/10 shadow-xl space-y-5">
                    {/* Header with Title, Report Type Scope & Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white uppercase tracking-wider">
                            Solve Condition &amp; Performance Summary
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                            {rType || 'CONTEST PERFORMANCE REPORT'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          Aggregated solve condition cohorts, problem difficulty metrics & attendance breakdown for this contest session.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black text-slate-700 dark:text-slate-200">
                          <span>In Scope: {allRows.length} Students</span>
                        </span>
                        {activeFilter && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-black text-amber-700 dark:text-amber-300">
                            <span>Filtered View: {conditionStats.totalStudents}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 1. Problem Solve Distribution Cohorts (4/4, 3/4, 2/4, 1/4, 0/4, Not Attended) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Contest / Weekly Solve Distribution Cohorts
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                          Click any cohort card to filter students in the table
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                        {/* 4/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_4')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_4'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-emerald-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">4 Solved (4/4)</span>
                            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s4 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight mt-1">{conditionStats.s4}</p>
                        </div>

                        {/* 3/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_3')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_3'
                              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-teal-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">3 Solved (3/4)</span>
                            <span className="text-[10px] font-black text-teal-800 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s3 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-teal-800 dark:text-teal-300 tracking-tight mt-1">{conditionStats.s3}</p>
                        </div>

                        {/* 2/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_2')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_2'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-brand-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">2 Solved (2/4)</span>
                            <span className="text-[10px] font-black text-brand-800 dark:text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s2 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-brand-800 dark:text-brand-300 tracking-tight mt-1">{conditionStats.s2}</p>
                        </div>

                        {/* 1/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_1')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_1'
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-amber-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">1 Solved (1/4)</span>
                            <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s1 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight mt-1">{conditionStats.s1}</p>
                        </div>

                        {/* 0/4 Solved (Attended) */}
                        <div
                          onClick={() => toggleFilter('SOLVED_0')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_0'
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-purple-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">0 Solved (Attended)</span>
                            <span className="text-[10px] font-black text-purple-800 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s0 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-purple-800 dark:text-purple-300 tracking-tight mt-1">{conditionStats.s0}</p>
                        </div>

                        {/* Not Attended / Absent */}
                        <div
                          onClick={() => toggleFilter('NOT_ATTENDED')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'NOT_ATTENDED'
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-rose-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Not Attended</span>
                            <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.notAttendedCount / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-rose-800 dark:text-rose-300 tracking-tight mt-1">{conditionStats.notAttendedCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Problem Difficulty Solves Split (Easy / Medium / Hard / Total) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Difficulty Solve Distribution (Easy • Medium • Hard)
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Easy Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Easy Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">
                            {conditionStats.totalEasy.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            Foundational Solves
                          </span>
                        </div>

                        {/* Medium Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Medium Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">
                            {conditionStats.totalMed.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                            Core Algorithmic Solves
                          </span>
                        </div>

                        {/* Hard Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">Hard Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">
                            {conditionStats.totalHard.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-400">
                            High Difficulty Solves
                          </span>
                        </div>

                        {/* Total Cumulative Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-brand-500/15 border border-brand-500/30 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">Total Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-brand-800 dark:text-brand-300 tracking-tight my-1">
                            {conditionStats.totalSolves.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-brand-700 dark:text-brand-400">
                            Cumulative Solves
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Official Condition Criteria Reference Strip */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-slate-700 dark:text-slate-300 font-bold">
                        Evaluation Standards: 4/4 (100% Complete) • 3/4 (Advanced) • 2/4 (Intermediate) • 1/4 (Developing) • 0/4 (Participation)
                      </div>
                      {activeFilter && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter(null)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white font-black text-[11px] transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0"
                        >
                          <span>Clear Filter ({conditionStats.totalStudents}/{allRows.length})</span>
                        </button>
                      )}
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
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-1.5">
                    {report.questionWiseResult.map((q: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{q.question}</span>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5 space-x-1.5">
                            <span className="text-emerald-700 font-bold">{q.solved} Solved</span>
                            <span>•</span>
                            <span className="text-rose-600 font-bold">{q.not_solved} Unsolved</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-500 block">Solve Rate</span>
                          <span className="text-xs font-extrabold text-brand-700 font-mono">{q.solve_rate}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Question</th>
                          <th className="px-4 py-3 text-center">Solved</th>
                          <th className="px-4 py-3 text-center">Not Solved</th>
                          <th className="px-4 py-3 text-right">Solve Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {report.questionWiseResult.map((q: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{q.question}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{q.solved}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-500">{q.not_solved}</td>
                            <td className="px-4 py-2.5 text-right font-black text-brand-600">{q.solve_rate}</td>
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
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center space-x-1.5">
                    <span>Solve Distribution (4/4 – 0/4)</span>
                  </h3>
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-1.5">
                    {report.solveDistributionList.map((sd: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{sd.category}</span>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                            <span className="text-emerald-700 font-bold">{sd.count} Students</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-500 block">Percentage</span>
                          <span className="text-xs font-extrabold text-indigo-700 font-mono">{sd.percentage}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase">
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
              {isFridayOfficial && displayOfficialLeaderboard && Array.isArray(displayOfficialLeaderboard) && displayOfficialLeaderboard.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <span>Official Leaderboard & Top Performers</span>
                  </h3>
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {displayOfficialLeaderboard.slice(0, 25).map((lb: any, i: number) => {
                      const rankVal = formatRank(lb.global_rank || lb.rank_val || lb.rank);
                      const ratingVal = formatRating(lb.rating || lb.contest_rating);
                      return (
                        <div key={i} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                                #{lb.rank}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">{formatStudentName(lb.student_name || lb.student)}</h4>
                                <p className="text-[10px] text-slate-500 font-mono leading-tight">{lb.reg_no} • {lb.dept} ({lb.year})</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-emerald-700 block">{lb.solved} Solved</span>
                              <span className="text-[10px] font-mono font-bold text-indigo-700 block">Score: {lb.score ?? 0}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                            <div className="flex items-center gap-0.5 font-mono text-[9px] font-bold">
                              <span className={`px-1 py-0.2 rounded ${lb.q1 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q1</span>
                              <span className={`px-1 py-0.2 rounded ${lb.q2 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q2</span>
                              <span className={`px-1 py-0.2 rounded ${lb.q3 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q3</span>
                              <span className={`px-1 py-0.2 rounded ${lb.q4 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q4</span>
                            </div>
                            <div className="text-right shrink-0 text-[10px] font-mono font-medium text-slate-600 flex items-center gap-1.5">
                              {rankVal !== '—' && <span className="font-bold text-amber-700">Global: {rankVal}</span>}
                              {ratingVal !== '—' && <span className="font-bold text-slate-700">| Rating: {ratingVal}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase">
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
                        {displayOfficialLeaderboard.slice(0, 25).map((lb: any, i: number) => (
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
              {isFridayOfficial && displayDepartmentResults && Array.isArray(displayDepartmentResults) && displayDepartmentResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <span>Department-Wise Official Result</span>
                  </h3>
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {displayDepartmentResults.map((dr: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <h4 className="text-xs font-bold text-slate-900">{dr.department}</h4>
                          <span className="text-[10.5px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {dr.participants}/{dr.total_students} ({dr.participation_pct})
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{dr.total_solves?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500 font-medium">Avg:</span> <span className="font-mono font-bold text-slate-900">{dr.average_solved}</span></div>
                          <div className="flex items-center gap-1 font-mono text-[9px] font-bold">
                            <span className="text-emerald-700">4/4:{dr.solved_4}</span>
                            <span className="text-indigo-700">3/4:{dr.solved_3}</span>
                            <span className="text-amber-700">2/4:{dr.solved_2}</span>
                            <span className="text-slate-600">1/4:{dr.solved_1}</span>
                            <span className="text-rose-600">0/4:{dr.solved_0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase">
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
                        {displayDepartmentResults.map((dr: any, i: number) => (
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
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 text-center align-middle w-10" rowSpan={2}>S.No</th>
                          <th className="px-3 py-3 text-center align-middle" rowSpan={2}>Register No</th>
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
                            <td className="px-3 py-2.5 text-center font-black font-mono text-slate-950 dark:text-white">{r.reg_no}</td>
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
                            <td className="px-3 py-2.5 text-center font-black bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 text-sm">{r.curr_status === 'ATTENDED' ? r.curr_solved : 0}</td>
                            <td className="px-3 py-2.5 text-center bg-emerald-50/70 dark:bg-emerald-950/40 font-mono font-black text-slate-900 dark:text-slate-100">{r.curr_status === 'ATTENDED' ? r.curr_score : 0}</td>
                            <td className={`px-3 py-2.5 text-center font-black text-sm ${(r.solved_delta || 0) > 0 ? 'text-teal-800 dark:text-teal-300' : (r.solved_delta || 0) < 0 ? 'text-rose-800 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                              {(r.solved_delta || 0) > 0 ? `+${r.solved_delta}` : r.solved_delta === 0 ? '0' : r.solved_delta}
                            </td>
                            <td className={`px-3 py-2.5 text-center font-black ${r.trend?.includes('↑') ? 'text-teal-700 dark:text-teal-300' : r.trend?.includes('↓') ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>{r.trend || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== HISTORICAL INTEL PREVIEW ===== */}
              {/* Historical Performance per Student Table (Section for Historical Intelligence Report) */}
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
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2 max-h-[500px] overflow-y-auto pr-0.5">
                    {(report.rows || []).map((r: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0 border border-slate-200/60">
                              #{r.s_no || idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{formatStudentName(r.name || r.student_name)}</h4>
                              <p className="text-[10px] text-slate-500 font-mono leading-tight">{r.reg_no} • {r.dept} ({r.year})</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-brand-700 block">{r.total_solved_fraction || `${r.totalSolved} Solved`}</span>
                            <span className={`text-[10px] font-bold ${r.consistencyPct >= 75 ? 'text-emerald-700' : r.consistencyPct >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>{r.consistencyPct}% Consistency</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-700 font-bold mr-1">Sessions ({r.contests_attended_fraction || `${r.totalAttended} Attended`}):</span>
                          {(r.weeklyData || []).map((wd: any, widx: number) => (
                            <span key={widx} className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${wd.att ? (wd.solved >= 3 ? 'bg-emerald-100 text-emerald-800' : wd.solved >= 1 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800') : 'bg-rose-100 text-rose-800'}`}>
                              C{widx + 1}:{wd.att ? wd.solved : '—'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 text-center align-middle w-10">S.No</th>
                          <th className="px-3 py-3 text-center align-middle">Register No</th>
                          <th className="px-3 py-3 text-left align-middle">Student Name</th>
                          <th className="px-3 py-3 text-center align-middle">Dept</th>
                          <th className="px-3 py-3 text-center align-middle">Yr</th>
                          <th className="px-3 py-3 text-center align-middle">Accommodation</th>
                          <th className="px-3 py-3 text-center align-middle">12th Cutoff</th>
                          {(report.sessionHeaders || []).map((sh: any) => (
                            <th key={sh.contestNum} className="px-3 py-3 text-center align-middle whitespace-nowrap">C{sh.contestNum}<br/><span className="text-[10px] font-extrabold opacity-90">{sh.date}</span></th>
                          ))}
                          <th className="px-3 py-3 text-center align-middle">Contests Attended</th>
                          <th className="px-3 py-3 text-center align-middle font-extrabold">Total Solved</th>
                          <th className="px-3 py-3 text-center align-middle font-extrabold bg-blue-900/40 text-blue-200">Attended Solved</th>
                          <th className="px-3 py-3 text-center align-middle bg-amber-900/40 text-amber-200">Badges</th>
                          <th className="px-3 py-3 text-center align-middle bg-emerald-900/40 text-emerald-200">Contest Easy</th>
                          <th className="px-3 py-3 text-center align-middle bg-teal-900/40 text-teal-200">Contest Med</th>
                          <th className="px-3 py-3 text-center align-middle bg-purple-900/40 text-purple-200">Contest Hard</th>
                          <th className="px-3.5 py-3 text-center align-middle">Global Rank</th>
                          <th className="px-3.5 py-3 text-right align-middle">Contest Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {(report.rows || []).map((r: any, idx: number) => {
                          const cDiff = getContestDifficultyBreakdown(r);
                          return (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                              <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black">{r.s_no || idx + 1}</td>
                              <td className="px-3 py-2.5 text-center font-black font-mono text-slate-950 dark:text-white">{r.reg_no}</td>
                              <td className="px-3 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{r.name}</td>
                              <td className="px-3 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{r.dept}</td>
                              <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{r.year}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">{formatAccommodation(r.accommodation || r.accomodation || r.accommodation_type)}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{r.twelfth_cutoff !== undefined && r.twelfth_cutoff !== null ? Number(r.twelfth_cutoff).toFixed(1) : (r.cutoff !== undefined && r.cutoff !== null ? Number(r.cutoff).toFixed(1) : (r.twelfthCutoff !== undefined && r.twelfthCutoff !== null ? Number(r.twelfthCutoff).toFixed(1) : "—"))}</td>
                              {(r.weeklyData || []).map((wd: any, widx: number) => (
                                <td key={widx} className={`px-3 py-2.5 text-center font-black text-sm ${wd.att ? (wd.solved >= 3 ? 'text-emerald-700 dark:text-emerald-300' : wd.solved >= 1 ? 'text-brand-700 dark:text-brand-300' : 'text-amber-700 dark:text-amber-300') : 'text-slate-500 dark:text-slate-400 font-bold'}`}>
                                  {wd.att ? wd.solved : '—'}
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-950 dark:text-white text-sm">{r.contests_attended_fraction ?? (report.histSummary?.numSessions ? `${r.contests_attended ?? r.total_attended ?? 0}/${report.histSummary.numSessions}` : (r.contests_attended ?? r.total_attended ?? 0))}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-brand-700 dark:text-brand-300 text-sm">{r.total_solved_fraction ?? (report.histSummary?.numSessions ? `${r.total_solved ?? r.totalSolved ?? 0}/${report.histSummary.numSessions * 4}` : (r.total_solved ?? r.totalSolved ?? (cDiff.easy + cDiff.medium + cDiff.hard)))}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-blue-700 dark:text-blue-300 text-sm bg-blue-500/5">{r.attended_solve_fraction ?? ((r.total_attended || r.totalAttended) ? `${r.total_solved ?? r.totalSolved ?? 0}/${(r.total_attended || r.totalAttended || 1) * 4}` : '0/0')}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-500/5">{r.badges ?? r.total_badges ?? r.badges_count ?? 0}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">{r.contest_easy ?? cDiff.easy}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-500/5">{r.contest_medium ?? cDiff.medium}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/5">{r.contest_hard ?? cDiff.hard}</td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300">
                                {formatRank(r.global_rank || r.rank || r.profile_rank || r.contest_global_ranking)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
                                {formatRating(r.rating || r.contest_rating || r.stats?.contest_rating)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#E6F0FA] dark:bg-[#162747] text-[#1B365D] dark:text-[#E2E8F0] font-black border-t-2 border-slate-800 sticky bottom-0 z-10">
                        <tr>
                          <td colSpan={7} className="px-4 py-3 text-center uppercase tracking-wider font-extrabold text-xs sm:text-sm border-r border-slate-300 dark:border-slate-700">
                            TOTAL SOLVED COUNT
                          </td>
                          {(report.sessionHeaders || []).map((sh: any, shIdx: number) => {
                            const cNum = String(sh.contestNum || sh.num || sh);
                            const sumSolves = (report.rows || []).reduce((acc: number, r: any) => {
                              const wd = (r.weeklyData || []).find((w: any) => String(w.contestNum) === cNum);
                              return acc + (wd && wd.att ? Number(wd.solved || 0) : 0);
                            }, 0);
                            return (
                              <td key={shIdx} className="px-3 py-3 text-center font-black text-xs sm:text-sm">
                                {sumSolves}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm">
                            {(report.rows || []).reduce((acc: number, r: any) => {
                              const attCnt = Array.isArray(r.weeklyData) 
                                ? r.weeklyData.filter((w: any) => w.att).length 
                                : Number(r.contests_attended || r.total_attended || 0);
                              return acc + attCnt;
                            }, 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm">
                            {(report.rows || []).reduce((acc: number, r: any) => {
                              const tSol = Number(r.total_solved ?? r.totalSolved ?? (
                                Array.isArray(r.weeklyData) 
                                  ? r.weeklyData.filter((w: any) => w.att).reduce((s: number, w: any) => s + Number(w.solved || 0), 0)
                                  : 0
                              ));
                              return acc + tSol;
                            }, 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm">
                            {(report.rows || []).reduce((acc: number, r: any) => {
                              const attSol = Number(r.total_solved ?? r.totalSolved ?? (
                                Array.isArray(r.weeklyData) 
                                  ? r.weeklyData.filter((w: any) => w.att).reduce((s: number, w: any) => s + Number(w.solved || 0), 0)
                                  : 0
                              ));
                              return acc + attSol;
                            }, 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                            {(report.rows || []).reduce((acc: number, r: any) => acc + Number(r.badges ?? r.total_badges ?? r.badges_count ?? 0), 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                            {(report.rows || []).reduce((acc: number, r: any) => acc + Number(r.contest_easy ?? getContestDifficultyBreakdown(r).easy ?? 0), 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm text-teal-600 dark:text-teal-400">
                            {(report.rows || []).reduce((acc: number, r: any) => acc + Number(r.contest_medium ?? getContestDifficultyBreakdown(r).medium ?? 0), 0)}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                            {(report.rows || []).reduce((acc: number, r: any) => acc + Number(r.contest_hard ?? getContestDifficultyBreakdown(r).hard ?? 0), 0)}
                          </td>
                          <td className="px-3.5 py-3 text-center font-black text-xs sm:text-sm text-slate-400">—</td>
                          <td className="px-3.5 py-3 text-center font-black text-xs sm:text-sm text-slate-400">—</td>
                        </tr>
                      </tfoot>
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

                {/* Mobile Card View (< sm) - Compact, Crisp White & Clean */}
                <div className="block sm:hidden print:hidden space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                  {displayedStudents.map((s: any, idx: number) => {
                    const st = (s.status || '').toUpperCase();
                    const isPart = ['PUBLIC_ATTENDED', 'VIRTUAL_ATTENDED', 'PUBLIC', 'VIRTUAL', 'PUBLIC_LIVE', 'VIRTUAL_PRACTICE', 'ATTENDED', 'VERIFIED', 'COMPLETED', 'ATTENDED_SOLVED', 'ATTENDED_ZERO'].includes(st) || (s.total_solved !== undefined && s.total_solved !== null);
                    const cSolved = s.contest_solved !== undefined && s.contest_solved !== null ? s.contest_solved : (s.total_solved !== undefined && s.total_solved !== null ? s.total_solved : (s.solved !== undefined && s.solved !== null ? s.solved : null));
                    const cDiff = getContestDifficultyBreakdown(s, true);
                    const rankVal = formatRank(s.global_rank || s.rank || s.profile_rank || s.contest_global_ranking);
                    const ratingVal = formatRating(s.rating || s.contest_rating || s.stats?.contest_rating);

                    return (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5 hover:border-slate-300 transition-colors">
                        {/* Top: Rank #, Name, Dept, Status Badge */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0 border border-slate-200/60">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{formatStudentName(s.name || s.student_name)}</h4>
                              <p className="text-[10px] text-slate-500 font-mono leading-tight">{s.reg_no} • {s.dept} ({s.year})</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {getStatusBadge(s.status)}
                          </div>
                        </div>

                        {/* Bottom Row: Solved Breakdown & Rank/Rating in one sleek compact strip */}
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className={`font-extrabold text-xs shrink-0 ${isPart && cSolved !== null && cSolved > 0 ? 'text-emerald-700' : isPart ? 'text-amber-700' : 'text-slate-500'}`}>
                              {isPart && cSolved !== null ? `${cSolved} Solved` : '0 Solved'}
                            </span>
                            {s.q1 !== undefined ? (
                              <div className="flex items-center gap-0.5 font-mono text-[9px] font-bold">
                                <span className={`px-1 py-0.2 rounded ${s.q1 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q1</span>
                                <span className={`px-1 py-0.2 rounded ${s.q2 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q2</span>
                                <span className={`px-1 py-0.2 rounded ${s.q3 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q3</span>
                                <span className={`px-1 py-0.2 rounded ${s.q4 === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>Q4</span>
                              </div>
                            ) : (
                              <span className="font-mono text-[9px] text-slate-500">
                                E:{cDiff.easy} M:{cDiff.medium} H:{cDiff.hard}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0 text-[10px] font-mono font-medium text-slate-600 flex items-center gap-1.5">
                            {rankVal !== '—' && (
                              <span className="font-bold text-amber-700">Rank: {rankVal}</span>
                            )}
                            {ratingVal !== '—' && (
                              <span className="font-bold text-slate-700">| Rating: {ratingVal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                  <table className="w-full text-left text-xs mobile-card-table min-w-[650px] sm:min-w-[950px] print:min-w-0 print:w-full">
                    <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10 table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                      {isFridayOfficial ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Department</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Accommodation</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">12th Cutoff</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Contests Attended</th>
                          <th className="px-3.5 py-3 text-left print:border-b print:border-black">LeetCode Handle</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black font-extrabold">Contest Solved</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-emerald-900/40 text-emerald-200">Contest Easy</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-teal-900/40 text-teal-200">Contest Med</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-purple-900/40 text-purple-200">Contest Hard</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Score</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Global Rank</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Rating</th>
                        </tr>
                      ) : isSundayLive ? (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Accommodation</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">12th Cutoff</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Contests Attended</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Attendance</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q1</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q2</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q3</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Q4</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black font-extrabold">Contest Solved</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-emerald-900/40 text-emerald-200">Contest Easy</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-teal-900/40 text-teal-200">Contest Med</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black bg-purple-900/40 text-purple-200">Contest Hard</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Total Time</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12 print:border-b print:border-black">S.No</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Register No</th>
                          <th className="px-3.5 py-3 text-left whitespace-nowrap print:border-b print:border-black">Student Name</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Dept</th>
                          <th className="px-3.5 py-3 text-center print:border-b print:border-black">Year</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Accommodation</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">12th Cutoff</th>
                          <th className="px-3 py-3 text-center print:border-b print:border-black">Contests Attended</th>
                          <th className="px-4 py-3 text-center print:border-b print:border-black">Status</th>
                          {displayedStudents.some((s: any) => s.q1 !== undefined || s.q2 !== undefined) ? (
                            <>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q1</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q2</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q3</th>
                              <th className="px-3 py-3 text-center w-10 print:border-b print:border-black">Q4</th>
                              <th className="px-4 py-3 text-center print:border-b print:border-black font-extrabold">Contest Solved</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-emerald-900/40 text-emerald-200">Contest Easy</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-teal-900/40 text-teal-200">Contest Med</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-purple-900/40 text-purple-200">Contest Hard</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3 text-center print:border-b print:border-black font-extrabold">Total Solved</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-emerald-900/40 text-emerald-200">Contest Easy</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-teal-900/40 text-teal-200">Contest Med</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black bg-purple-900/40 text-purple-200">Contest Hard</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Profile Easy</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Profile Medium</th>
                              <th className="px-3 py-3 text-center print:border-b print:border-black">Profile Hard</th>
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
                        const cDiff = getContestDifficultyBreakdown(s, isFridayOfficial || isSundayLive);

                        if (isFridayOfficial) {
                          return (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-slate-950 dark:text-white font-mono print:text-black">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                              <td className="px-3.5 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">{formatAccommodation(s.accommodation || s.accomodation)}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.twelfth_cutoff !== undefined && s.twelfth_cutoff !== null ? Number(s.twelfth_cutoff).toFixed(1) : (s.cutoff !== undefined && s.cutoff !== null ? Number(s.cutoff).toFixed(1) : "—")}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.contests_attended ?? s.total_attended ?? 0}</td>
                              <td className="px-3.5 py-2.5 text-left font-mono font-bold text-slate-900 dark:text-slate-100">{s.leetcode_handle || s.username || "—"}</td>
                              <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                                {getStatusBadge(s.status)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q1, 1, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q2, 2, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q3, 3, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black">
                                {isPart ? (getQVal(s.q4, 4, cSolved, isPart) === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center font-black text-sm">
                                {isPart && cSolved !== null ? (
                                  <span className={cSolved >= 3 ? "text-emerald-700 dark:text-emerald-300" : cSolved >= 1 ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"}>
                                    {cSolved}
                                  </span>
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">{cDiff.easy}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-500/5">{cDiff.medium}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/5">{cDiff.hard}</td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-black text-indigo-700 dark:text-indigo-300">
                                {isPart && s.score !== undefined && s.score !== null ? s.score : "0"}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300">
                                {formatRank(s.global_rank || s.rank || s.profile_rank || s.contest_global_ranking)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
                                {formatRating(s.rating || s.contest_rating || s.stats?.contest_rating)}
                              </td>
                            </tr>
                          );
                        }

                        if (isSundayLive) {
                          return (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                              <td className="px-3.5 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                              <td className="px-3.5 py-2.5 font-black text-slate-950 dark:text-white font-mono text-center print:text-black">{s.reg_no}</td>
                              <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">{formatAccommodation(s.accommodation || s.accomodation)}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.twelfth_cutoff !== undefined && s.twelfth_cutoff !== null ? Number(s.twelfth_cutoff).toFixed(1) : (s.cutoff !== undefined && s.cutoff !== null ? Number(s.cutoff).toFixed(1) : "—")}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.contests_attended ?? s.total_attended ?? 0}</td>
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
                              <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">{cDiff.easy}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-500/5">{cDiff.medium}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/5">{cDiff.hard}</td>
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
                            <td className="px-3.5 py-2.5 font-black text-slate-950 dark:text-white font-mono text-center print:text-black">{s.reg_no}</td>
                            <td className="px-3.5 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-3.5 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{s.year}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">{formatAccommodation(s.accommodation || s.accomodation)}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.twelfth_cutoff !== undefined && s.twelfth_cutoff !== null ? Number(s.twelfth_cutoff).toFixed(1) : (s.cutoff !== undefined && s.cutoff !== null ? Number(s.cutoff).toFixed(1) : "—")}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.contests_attended ?? s.total_attended ?? 0}</td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                              {getStatusBadge(s.status)}
                            </td>
                            {isContestView ? (
                              <>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q1 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q2 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q3 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center font-black">
                                  {isPart ? (s.q4 === 1 ? <span className="text-emerald-700 dark:text-emerald-300">1</span> : <span className="text-slate-700 dark:text-slate-300">0</span>) : <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center font-black text-sm">
                                  {isPart && cSolved !== null ? (
                                    <span className={cSolved >= 3 ? "text-emerald-700 dark:text-emerald-300" : cSolved >= 1 ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"}>
                                      {cSolved}
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">0</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">{cDiff.easy}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-500/5">{cDiff.medium}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/5">{cDiff.hard}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2.5 text-center font-black text-sm text-brand-700 dark:text-brand-300">{s.total_solved ?? ((s.easy || 0) + (s.medium || 0) + (s.hard || 0))}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">{cDiff.easy}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-500/5">{cDiff.medium}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/5">{cDiff.hard}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.easy ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.medium ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{s.hard ?? 0}</td>
                              </>
                            )}
                            <td className="px-3.5 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-300">
                              {formatRank(s.global_rank || s.rank || s.profile_rank || s.contest_global_ranking)}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950 dark:text-white">
                              {formatRating(s.rating || s.contest_rating || s.stats?.contest_rating)}
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

                  {/* Contest Attendance Comparison (Current Week & Last Week) */}
                  {(report.college_summary?.metrics?.current_week || report.college_summary?.metrics?.last_week) && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Current Week Contest Attendance */}
                        {report.college_summary?.metrics?.current_week && (
                          <div className="p-4 rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50/40 dark:bg-cyan-950/20 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-black uppercase text-cyan-900 dark:text-cyan-200 tracking-wider flex items-center space-x-1.5">
                                <span>Current Week Attendance</span>
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                                {report.currentWeek?.date || 'Latest'}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 sm:gap-2">
                              {[
                                { label: '4/4 Solved', value: report.college_summary.metrics.current_week.q4, color: 'text-emerald-700 dark:text-emerald-300' },
                                { label: '3/4 Solved', value: report.college_summary.metrics.current_week.q3, color: 'text-cyan-700 dark:text-cyan-300' },
                                { label: '2/4 Solved', value: report.college_summary.metrics.current_week.q2, color: 'text-blue-700 dark:text-blue-300' },
                                { label: '1/4 Solved', value: report.college_summary.metrics.current_week.q1, color: 'text-amber-700 dark:text-amber-300' },
                                { label: '0/4 Solved', value: report.college_summary.metrics.current_week.q0, color: 'text-rose-700 dark:text-rose-300' },
                              ].map((m, i) => (
                                <div key={i} className="p-1 sm:p-2 rounded-xl bg-white/80 dark:bg-navy-900/60 border border-cyan-200/60 dark:border-cyan-800/40 text-center">
                                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5 truncate">{m.label}</div>
                                  <div className={`text-sm sm:text-lg font-black ${m.color}`}>{m.value ?? '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Last Week Contest Attendance */}
                        {report.college_summary?.metrics?.last_week && (
                          <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-black uppercase text-amber-900 dark:text-amber-200 tracking-wider flex items-center space-x-1.5">
                                <span>Last Week Attendance</span>
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {report.lastWeek?.date || 'Past'}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 sm:gap-2">
                              {[
                                { label: '4/4 Solved', value: report.college_summary.metrics.last_week.q4, color: 'text-emerald-700 dark:text-emerald-300' },
                                { label: '3/4 Solved', value: report.college_summary.metrics.last_week.q3, color: 'text-cyan-700 dark:text-cyan-300' },
                                { label: '2/4 Solved', value: report.college_summary.metrics.last_week.q2, color: 'text-blue-700 dark:text-blue-300' },
                                { label: '1/4 Solved', value: report.college_summary.metrics.last_week.q1, color: 'text-amber-700 dark:text-amber-300' },
                                { label: '0/4 Solved', value: report.college_summary.metrics.last_week.q0, color: 'text-rose-700 dark:text-rose-300' },
                              ].map((m, i) => (
                                <div key={i} className="p-1 sm:p-2 rounded-xl bg-white/80 dark:bg-navy-900/60 border border-amber-200/60 dark:border-amber-800/40 text-center">
                                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5 truncate">{m.label}</div>
                                  <div className={`text-sm sm:text-lg font-black ${m.color}`}>{m.value ?? '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Department Summaries */}
                  {report.department_summaries && Array.isArray(report.department_summaries) && report.department_summaries.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Department Performance Summary</h3>
                      {/* Mobile Card View (< sm) */}
                      <div className="block sm:hidden print:hidden space-y-2">
                        {report.department_summaries.filter((d: any) => (d.total_students || 0) > 0).map((d: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">#{idx + 1}</span>
                                <h4 className="text-xs font-bold text-slate-900 truncate">{d.department}</h4>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium shrink-0">Coord: {d.coordinator || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                              <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-bold text-slate-900">{d.total_students}</span> ({d.metrics?.verified ?? 0})</div>
                              <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{d.metrics?.total_solved?.toLocaleString()}</span></div>
                              <div><span className="text-slate-500 font-medium">Avg:</span> <span className="font-mono font-bold text-slate-900">{d.metrics?.avg_solved}</span></div>
                              <div><span className="text-purple-700 font-bold">&gt;500:</span> <span className="font-bold text-slate-900">{d.metrics?.above_500}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View (>= sm) */}
                      <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-xs min-w-[900px]">
                          <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase">
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
                                <td className="px-3 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{d.metrics?.current_week?.q4 ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-black text-cyan-700 dark:text-cyan-300">{d.metrics?.current_week?.q3 ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-black text-blue-700 dark:text-blue-300">{d.metrics?.current_week?.q2 ?? 0}</td>
                                <td className="px-3 py-2.5 text-center font-black text-amber-700 dark:text-amber-300">{d.metrics?.current_week?.q1 ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Batch Summaries - Institutional Official Report Layout */}
                  {(() => {
                    const canonicalBatches = [
                      { label: '2023 - 2027', year: 'IV' },
                      { label: '2024 - 2028', year: 'III' },
                      { label: '2025 - 2029', year: 'II' }
                    ];
                    const rawBatches = Array.isArray(report.batch_summaries) ? report.batch_summaries : [];
                    const batchesToDisplay = canonicalBatches.map(cb => {
                      const found = rawBatches.find((b: any) => (b.batch || '').replace(/\s+/g, '') === cb.label.replace(/\s+/g, ''));
                      if (found) return found;
                      return { batch: cb.label, year: cb.year, total_students: 0, current_week: {}, last_week: {} };
                    });

                    // Canonical Demographic & Accommodation Breakdown: TOTAL, BOYS, GIRLS, DAY SCHOLAR, HOSTEL
                    let demographicSummaries: any[] = Array.isArray(report.demographic_summary) && report.demographic_summary.length > 0
                      ? report.demographic_summary
                      : (Array.isArray(report.demographic_summaries) && report.demographic_summaries.length > 0 ? report.demographic_summaries : []);

                    if (!demographicSummaries || demographicSummaries.length === 0) {
                      const roster = report.all_students_current || report.allStudents || report.rows || report.student_list || [];
                      if (Array.isArray(roster) && roster.length > 0) {
                        const FEMALE_KEYWORDS = [
                          'SHREE', 'DEVI', 'PRIYA', 'SRI', 'DHARSHINI', 'VARSHINI', 'JANANI', 'SOWMIYA',
                          'SHARMILA', 'POOMITHA', 'RITHIKA', 'RITHANIKA', 'KIRUTHIKAA', 'AMRUTHA', 'DHANUSHYA',
                          'HARDIKA', 'INIYA', 'LAKSANA', 'NETHRA', 'NIVETHYTHA', 'NIVETHA', 'PRITHIKA',
                          'RADHISRI', 'SUPRIYA', 'VEDHASREE', 'YAZHINI', 'GAYATHRI', 'KAVYA', 'SNEHA',
                          'SWETHA', 'NANDHINI', 'ABINAYA', 'KEERTHANA', 'PAVITHRA', 'ANANYA', 'DEEPIKA',
                          'ARCHANA', 'HARINI', 'MONISHA', 'SANDHIYA', 'SUBHASHINI', 'SUBASHREE', 'BHUVANESHWARI',
                          'SOUNDARYA', 'AISWARYA', 'AISHWARYA', 'MEENA', 'KARTHIKA', 'DIVYA', 'POOJA',
                          'MADHUMITHA', 'MITHRA', 'SWATHI', 'THANANYA', 'SUSHMITHA', 'LAVANYA', 'HEMA',
                          'PREETHI', 'RESHMA', 'SARANYA', 'SUJITHA', 'SUGANYA', 'RAMYA', 'REVATHI', 'GOWRI',
                          'PRIYADHARSHINI', 'AARATHANA', 'AARSIKA', 'SAHANAJ', 'SURUTHI', 'SUSITHA',
                          'GOWRIPRIYA', 'JAYASRI', 'JEEVITHA', 'PRADEEPA', 'THARANYA', 'SUVATHI',
                          'KANISHAA', 'KANISKA', 'JANARANSHINI', 'MOWNAVARTHINI', 'SRIVIDHYA', 'STEFFY',
                          'SUBITHA', 'ABIRAMI', 'CHRISTINA', 'SHRUTI'
                        ];
                        const MALE_OVERRIDE = ['SELVAN', 'SANJAY', 'SRIDHAR'];

                        const isGirl = (s: any) => {
                          const g = String(s.gender || '').trim().toUpperCase();
                          if (['F', 'FEMALE', 'GIRL', 'WOMAN'].includes(g)) return true;
                          if (['M', 'MALE', 'BOY', 'MAN'].includes(g)) return false;
                          const name = String(s.name || s.student || s.student_name || '').trim().toUpperCase();
                          if (MALE_OVERRIDE.some(m => name.includes(m))) return false;
                          return FEMALE_KEYWORDS.some(f => name.includes(f));
                        };

                        const isHostel = (s: any) => {
                          const acc = String(s.accommodation || s.accom || s.accommodation_type || '').trim().toUpperCase();
                          return acc.includes('HOSTEL') || acc === 'H';
                        };

                        const cfgs = [
                          { label: 'TOTAL SOLVED COUNT', filter: () => true, bg: 'bg-[#E6F0FA] dark:bg-[#162747]', text: 'text-[#1B365D] dark:text-[#E2E8F0]' },
                          { label: 'BOYS SOLVED COUNT', filter: (s: any) => !isGirl(s), bg: 'bg-white dark:bg-navy-950', text: 'text-[#1B365D] dark:text-[#CBD5E1]' },
                          { label: 'GIRLS SOLVED COUNT', filter: (s: any) => isGirl(s), bg: 'bg-[#F8FAFC] dark:bg-navy-900/50', text: 'text-[#1B365D] dark:text-[#CBD5E1]' },
                          { label: 'DAY SCHOLARS (D) SOLVED COUNT', filter: (s: any) => !isHostel(s), bg: 'bg-white dark:bg-navy-950', text: 'text-[#1B365D] dark:text-[#CBD5E1]' },
                          { label: 'HOSTELERS (H) SOLVED COUNT', filter: (s: any) => isHostel(s), bg: 'bg-[#F8FAFC] dark:bg-navy-900/50', text: 'text-[#1B365D] dark:text-[#CBD5E1]' },
                        ];

                        demographicSummaries = cfgs.map(cfg => {
                          const sub = roster.filter(cfg.filter);
                          const tot = sub.length;
                          const above500 = sub.filter((s: any) => Number(s.total_solved || s.solved || 0) > 500).length;
                          const p250_500 = sub.filter((s: any) => { const n = Number(s.total_solved || s.solved || 0); return n >= 250 && n <= 500; }).length;
                          const p100_249 = sub.filter((s: any) => { const n = Number(s.total_solved || s.solved || 0); return n >= 100 && n < 250; }).length;
                          const p1_99 = sub.filter((s: any) => { const n = Number(s.total_solved || s.solved || 0); return n >= 1 && n < 100; }).length;
                          const p0 = sub.filter((s: any) => Number(s.total_solved || s.solved || 0) === 0).length;
                          const q4 = sub.filter((s: any) => String(s.public_result || '') === '4_SOLVED').length;
                          const q3 = sub.filter((s: any) => String(s.public_result || '') === '3_SOLVED').length;
                          const q2 = sub.filter((s: any) => String(s.public_result || '') === '2_SOLVED').length;
                          const q1 = sub.filter((s: any) => String(s.public_result || '') === '1_SOLVED').length;
                          const r1500 = sub.filter((s: any) => Number(s.contest_rating || 0) > 1500).length;
                          const rnk20 = sub.filter((s: any) => { const r = Number(s.contest_ranking || s.contest_global_ranking || 0); return r > 0 && r < 20000; }).length;

                          return {
                            label: cfg.label,
                            total_students: tot,
                            above_500: above500,
                            prob_250_500: p250_500,
                            prob_100_249: p100_249,
                            prob_1_99: p1_99,
                            prob_0: p0,
                            q4, q3, q2, q1,
                            rating_above_1500: r1500,
                            rank_below_20000: rnk20,
                            bgClass: cfg.bg,
                            textClass: cfg.text
                          };
                        });
                      }
                    }

                    return (
                      <div className="space-y-4">
                        {/* Institutional Official Paper Header Card */}
                        <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white shadow-sm space-y-2 font-sans">
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
                            <img
                              src="/black_white_logo.png"
                              alt="Nandha Engineering College"
                              className="h-12 sm:h-14 w-auto object-contain shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                            <div className="space-y-1">
                              <h2 className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-950 dark:text-white">
                                NANDHA ENGINEERING COLLEGE, ERODE - 638 052.
                              </h2>
                              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                {(() => {
                                  const dRaw = (report.department_name || report.department || '').toString().trim();
                                  if (dRaw.includes('Cyber') || dRaw === '1' || dRaw === 'CSE(CS)') {
                                    return 'Department of CSE (Cyber Security)';
                                  }
                                  if (dRaw.includes('Things') || dRaw.includes('IoT') || dRaw === '2' || dRaw === 'CSE(IOT)') {
                                    return 'Department of CSE (Internet of Things )';
                                  }
                                  if (report.department_name && !report.department_name.match(/Department of \d+/i)) {
                                    return report.department_name;
                                  }
                                  return 'Department of CSE (Cyber Security)';
                                })()}
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Date: {report.session_date || report.contest_date || report.report_date || report.currentWeek?.date || '11.10.2026'}
                              </p>
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white pt-1">
                                Leetcode Performance - Weekly Report
                              </h3>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Name &amp; Designation of the Academic Coordinator: <span className="font-black text-brand-700 dark:text-brand-400">
                                  {(() => {
                                    const dRaw = (report.department_name || report.department || '').toString().trim();
                                    if (dRaw.includes('Things') || dRaw.includes('IoT') || dRaw === '2' || dRaw === 'CSE(IOT)') {
                                      return 'P.Devayani /AP';
                                    }
                                    return report.coordinator || 'M. Santhoshkumar, AP / CSE (Cyber Security)';
                                  })()}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Card View (< md) */}
                        <div className="block md:hidden print:hidden space-y-3">
                          {batchesToDisplay.map((b: any, idx: number) => {
                            const cw = b.current_week || {};
                            const lw = b.last_week || {};
                            const totStudents = b.total_students || lw.total_students || cw.total_students || 0;
                            return (
                              <div key={idx} className="p-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-navy-950 shadow-sm space-y-3 font-sans">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                      Batch {b.year || 'IV'}
                                    </span>
                                    <h4 className="text-xs font-black text-slate-900 dark:text-white">{b.batch}</h4>
                                  </div>
                                  <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                                    {totStudents} Students
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {/* Last Week Row */}
                                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/40 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                      <span>(Last Week)</span>
                                      <span className="text-[10px] text-slate-500">Rating: - | Rank: -</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&gt;500</div><div className="font-black text-slate-900 dark:text-white">{lw.prob_above_500 ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">250-500</div><div className="font-black text-slate-900 dark:text-white">{lw.prob_250_500 ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&lt;250</div><div className="font-black text-slate-900 dark:text-white">{lw.prob_100_249 ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&lt;100</div><div className="font-black text-slate-900 dark:text-white">{lw.prob_1_99 ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">Not start</div><div className="font-black text-slate-900 dark:text-white">{lw.prob_0 ?? 0}</div></div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] pt-1 text-slate-600 dark:text-slate-400">
                                      <span>Contests:</span>
                                      <span className="font-mono font-bold">4Q: {lw.q4 ?? 0} | 3Q: {lw.q3 ?? 0} | 2Q: {lw.q2 ?? 0} | 1Q: {lw.q1 ?? 0}</span>
                                    </div>
                                  </div>

                                  {/* Current Week Row */}
                                  <div className="p-2.5 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-black text-cyan-900 dark:text-cyan-200">
                                      <span>(Current Week)</span>
                                      <span className="text-[10px] text-cyan-700 dark:text-cyan-300">
                                        Rating: {(cw.rating_above_1500 ?? cw.rating_1500 ?? 0) > 0 ? (cw.rating_above_1500 ?? cw.rating_1500) : '-'} | Rank: {(cw.rank_below_20000 ?? cw.ranking_20000 ?? 0) > 0 ? (cw.rank_below_20000 ?? cw.ranking_20000) : '-'}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-cyan-200 dark:border-cyan-800"><div className="text-[9px] text-slate-500">&gt;500</div><div className="font-black text-slate-900 dark:text-white">{cw.prob_above_500 ?? cw.categories?.['Above 500'] ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-cyan-200 dark:border-cyan-800"><div className="text-[9px] text-slate-500">250-500</div><div className="font-black text-slate-900 dark:text-white">{cw.prob_250_500 ?? cw.categories?.['250 - 500'] ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-cyan-200 dark:border-cyan-800"><div className="text-[9px] text-slate-500">&lt;250</div><div className="font-black text-slate-900 dark:text-white">{cw.prob_100_249 ?? cw.categories?.['Less than 250'] ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-cyan-200 dark:border-cyan-800"><div className="text-[9px] text-slate-500">&lt;100</div><div className="font-black text-slate-900 dark:text-white">{cw.prob_1_99 ?? cw.categories?.['Less than 100'] ?? 0}</div></div>
                                      <div className="p-1 bg-white dark:bg-navy-950 rounded border border-cyan-200 dark:border-cyan-800"><div className="text-[9px] text-slate-500">Not start</div><div className="font-black text-slate-900 dark:text-white">{cw.prob_0 ?? cw.categories?.['Not Yet Started'] ?? 0}</div></div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] pt-1 text-cyan-800 dark:text-cyan-300">
                                      <span>Contests:</span>
                                      <span className="font-mono font-black">4Q: {cw.q4 ?? 0} | 3Q: {cw.q3 ?? 0} | 2Q: {cw.q2 ?? 0} | 1Q: {cw.q1 ?? 0}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Mobile Demographic Summary Cards */}
                          {demographicSummaries && demographicSummaries.length > 0 && (
                            <div className="space-y-2 pt-2 border-t-2 border-slate-300 dark:border-slate-700">
                              <div className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                                Demographic &amp; Accommodation Summary
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {demographicSummaries.map((d: any, dIdx: number) => (
                                  <div key={`m-demo-${dIdx}`} className={`p-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 ${dIdx === 0 ? 'bg-[#E6F0FA]/90 dark:bg-[#162747]/70' : 'bg-white dark:bg-navy-950'} shadow-2xs space-y-1.5`}>
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                                      <span className="text-xs font-black text-[#1B365D] dark:text-[#E2E8F0] uppercase tracking-wide">{d.label}</span>
                                      <span className="text-xs font-black px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 font-mono">
                                        {d.total_students ?? d.num_students ?? 0} Students
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                                      <div className="p-1 rounded bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&gt;500</div><div className="font-black text-slate-900 dark:text-white">{d.above_500 ?? d.prob_above_500 ?? 0}</div></div>
                                      <div className="p-1 rounded bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">250-500</div><div className="font-black text-slate-900 dark:text-white">{d.prob_250_500 ?? d['250_500'] ?? 0}</div></div>
                                      <div className="p-1 rounded bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&lt;250</div><div className="font-black text-slate-900 dark:text-white">{d.prob_100_249 ?? d['101_250'] ?? 0}</div></div>
                                      <div className="p-1 rounded bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">&lt;100</div><div className="font-black text-slate-900 dark:text-white">{d.prob_1_99 ?? d.less_100 ?? 0}</div></div>
                                      <div className="p-1 rounded bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800"><div className="text-[9px] text-slate-500">Not start</div><div className="font-black text-slate-900 dark:text-white">{d.prob_0 ?? d.not_started ?? 0}</div></div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] pt-0.5 text-slate-600 dark:text-slate-400 font-mono">
                                      <span>Contest Solves:</span>
                                      <span className="font-bold">4Q: {d.q4 ?? 0} | 3Q: {d.q3 ?? 0} | 2Q: {d.q2 ?? 0} | 1Q: {(d.q1 ?? 0) > 0 ? d.q1 : '—'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Desktop Multi-Level Institutional Table (>= md) */}
                        <div className="hidden md:block print:block border-2 border-slate-400 dark:border-slate-600 rounded-xl overflow-x-auto shadow-sm bg-white dark:bg-navy-950">
                          <table className="w-full text-left text-xs min-w-[980px] border-collapse font-sans">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-navy-900 text-slate-950 dark:text-white font-black text-xs uppercase border-b-2 border-slate-400 dark:border-slate-600">
                                <th rowSpan={2} className="px-3.5 py-3 border border-slate-400 dark:border-slate-600 text-center font-black">
                                  Batch
                                </th>
                                <th rowSpan={2} className="px-3 py-3 border border-slate-400 dark:border-slate-600 text-center font-black max-w-[140px] leading-tight">
                                  Number of Students (Total Count)
                                </th>
                                <th colSpan={5} className="px-3 py-2 border border-slate-400 dark:border-slate-600 text-center font-black">
                                  Number of Problems Solved
                                </th>
                                <th colSpan={4} className="px-3 py-2 border border-slate-400 dark:border-slate-600 text-center font-black">
                                  Weekly Contest Attended: (give the count here)
                                </th>
                                <th colSpan={2} className="px-3 py-2 border border-slate-400 dark:border-slate-600 text-center font-black">
                                  Leetcode Contest Rating and Ranking
                                </th>
                              </tr>
                              <tr className="bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 text-[11px] font-black border-b border-slate-400 dark:border-slate-600">
                                {/* Problems Solved */}
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Above 500</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">250 - 500</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Less than 250</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Less than 100</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Not yet started</th>
                                {/* Contests Attended */}
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">4 Q Solved</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">3 Q Solved</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">2 Q Solved</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">1 Q Solved</th>
                                {/* Rating & Ranking */}
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Rating: Above 1500</th>
                                <th className="px-2 py-2 border border-slate-400 dark:border-slate-600 text-center">Ranking: Below 20000</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-400 dark:divide-slate-600 font-sans text-xs">
                              {batchesToDisplay.map((b: any, idx: number) => {
                                const cw = b.current_week || {};
                                const lw = b.last_week || {};
                                const totalStudents = b.total_students || lw.total_students || cw.total_students || 0;
                                const cwRating = cw.rating_above_1500 ?? cw.rating_1500 ?? 0;
                                const cwRanking = cw.rank_below_20000 ?? cw.ranking_20000 ?? 0;

                                return (
                                  <React.Fragment key={idx}>
                                    {/* Row 1: Last Week */}
                                    <tr className="hover:bg-slate-50 dark:hover:bg-navy-900/30 transition-colors">
                                      <td className="px-3.5 py-3 border border-slate-400 dark:border-slate-600 font-bold text-slate-900 dark:text-white text-center leading-tight">
                                        <div className="font-extrabold">{b.batch}</div>
                                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">(Last Week)</div>
                                      </td>
                                      {/* Total Students Cell (rowSpan=2) */}
                                      <td rowSpan={2} className="px-3 py-3 border border-slate-400 dark:border-slate-600 text-center font-black text-slate-950 dark:text-white text-base align-middle bg-slate-50/40 dark:bg-navy-900/10">
                                        {totalStudents}
                                      </td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.prob_above_500 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.prob_250_500 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.prob_100_249 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.prob_1_99 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.prob_0 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.q4 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.q3 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.q2 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{lw.q1 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-400 dark:text-slate-500">-</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-400 dark:text-slate-500">-</td>
                                    </tr>

                                    {/* Row 2: Current Week */}
                                    <tr className="hover:bg-slate-50 dark:hover:bg-navy-900/30 transition-colors">
                                      <td className="px-3.5 py-3 border border-slate-400 dark:border-slate-600 font-bold text-slate-900 dark:text-white text-center leading-tight">
                                        <div className="font-extrabold">{b.batch}</div>
                                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">(Current Week)</div>
                                      </td>
                                      {/* Total Students omitted here due to rowSpan={2} */}
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.prob_above_500 ?? cw.categories?.['Above 500'] ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.prob_250_500 ?? cw.categories?.['250 - 500'] ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.prob_100_249 ?? cw.categories?.['Less than 250'] ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.prob_1_99 ?? cw.categories?.['Less than 100'] ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.prob_0 ?? cw.categories?.['Not Yet Started'] ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.q4 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.q3 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.q2 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100">{cw.q1 ?? 0}</td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-black text-slate-950 dark:text-white">
                                        {cwRating > 0 ? cwRating : '-'}
                                      </td>
                                      <td className="px-2 py-3 border border-slate-400 dark:border-slate-600 text-center font-black text-slate-950 dark:text-white">
                                        {cwRanking > 0 ? cwRanking : '-'}
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })}

                              {/* ── Consolidation Summary Block (TOTAL, BOYS, GIRLS, DAY SCHOLARS, HOSTELERS) ── */}
                              {demographicSummaries && demographicSummaries.map((d: any, dIdx: number) => {
                                const isLast = dIdx === demographicSummaries.length - 1;
                                const bg = d.bgClass || (dIdx === 0 ? 'bg-[#E6F0FA] dark:bg-[#162747]' : (dIdx % 2 === 0 ? 'bg-[#F8FAFC] dark:bg-navy-900/50' : 'bg-white dark:bg-navy-950'));
                                const text = d.textClass || (dIdx === 0 ? 'text-[#1B365D] dark:text-[#E2E8F0] font-black' : 'text-[#1B365D] dark:text-[#CBD5E1] font-bold');
                                const borderBottom = isLast ? 'border-b-2 border-b-[#1B365D] dark:border-b-blue-400' : 'border-b border-slate-300 dark:border-slate-700';

                                return (
                                  <tr key={`demo-${dIdx}`} className={`${bg} ${borderBottom} transition-colors`}>
                                    <td className={`px-3.5 py-2.5 border border-slate-400 dark:border-slate-600 ${text} text-center uppercase tracking-wider text-[11px] sm:text-xs font-black`}>
                                      {d.label}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-black ${text}`}>
                                      {d.total_students ?? d.num_students ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.above_500 ?? d.prob_above_500 ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.prob_250_500 ?? d['250_500'] ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.prob_100_249 ?? d['101_250'] ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.prob_1_99 ?? d.less_100 ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.prob_0 ?? d.not_started ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.q4 ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.q3 ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {d.q2 ?? 0}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {(d.q1 ?? 0) > 0 ? d.q1 : '—'}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {(d.rating_above_1500 ?? d.rating_1500 ?? 0) > 0 ? (d.rating_above_1500 ?? d.rating_1500) : '—'}
                                    </td>
                                    <td className={`px-2 py-2.5 border border-slate-400 dark:border-slate-600 text-center font-bold ${text}`}>
                                      {(d.rank_below_20000 ?? d.ranking_20000 ?? 0) > 0 ? (d.rank_below_20000 ?? d.ranking_20000) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Student Roster with Contest Outcomes */}
                  {(() => {
                    const rosterList = report.all_students_current || report.allStudents || report.rows || report.student_list || [];
                    if (!Array.isArray(rosterList) || rosterList.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                          Full Student Roster ({rosterList.length} Students)
                        </h3>
                        {/* Mobile Card View (< sm) */}
                        <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                          {rosterList.map((s: any, idx: number) => {
                            const pubResult = typeof s.public_result === 'string' ? s.public_result : '';
                            const lastPubResult = typeof s.last_public_result === 'string' ? s.last_public_result : '';
                            const formatOutcome = (r: string) => {
                              if (!r) return '—';
                              if (r.includes('SOLVED')) return r.replace('_SOLVED', '/4');
                              if (r === 'NOT_PARTICIPATED' || r === 'NOT_ATTENDED') return '—';
                              return r;
                            };
                            return (
                              <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5 transition-all active:scale-[0.98] touch-manipulation">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center space-x-1.5 min-w-0">
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0 border border-slate-200/60">
                                      #{s.s_no || idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-bold text-slate-900 truncate">{formatStudentName(s.name || s.student_name)}</h4>
                                      <p className="text-[10px] text-slate-500 font-mono leading-tight">{s.reg_no} • {s.dept} ({s.year})</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-brand-700 block">{s.total_solved ?? '—'} Solved</span>
                                    <span className="text-[10px] text-slate-500 font-medium block">{s.category || '—'}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-center text-[10px] pt-0.5">
                                  <div className="p-1 rounded-lg bg-emerald-50 border border-emerald-200">
                                    <div className="text-[8px] font-bold text-emerald-800 uppercase">E / M / H</div>
                                    <div className="font-bold text-emerald-800">{s.easy ?? 0}/{s.medium ?? 0}/{s.hard ?? 0}</div>
                                  </div>
                                  <div className="p-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <div className="text-[8px] font-bold text-indigo-800 uppercase">Curr Week</div>
                                    <div className="font-bold text-indigo-800">{formatOutcome(pubResult)}</div>
                                  </div>
                                  <div className="p-1 rounded-lg bg-purple-50 border border-purple-200">
                                    <div className="text-[8px] font-bold text-purple-800 uppercase">Last Week</div>
                                    <div className="font-bold text-purple-800">{formatOutcome(lastPubResult)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Table View (>= sm) */}
                        <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[450px] overflow-y-auto">
                          <table className="w-full text-xs min-w-[1000px]">
                            <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-3 text-center w-10">S.No</th>
                                <th className="px-3 py-3 text-center">Reg No</th>
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
                                    <td className="px-3 py-2.5 font-black font-mono text-slate-950 dark:text-white text-center">{s.reg_no}</td>
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
              {/* ====== GENERIC REPORTS BELOW (hidden for weekly perf) ====== */}
              {/* Metrics Overview Cards — 2026 SaaS Glassmorphic Matrix */}
              {!isWeeklyPerformance && report.metrics && (
                <div className="space-y-3.5 print:break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-brand-500 animate-ping"></div>
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest print:text-black">
                        Executive Summary Metrics
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 print:hidden px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shadow-xs">
                      Tap tile to filter roster
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {Object.entries(report.metrics).map(([key, value]) => {
                      const k = key.toLowerCase();
                      
                      let fKey: string | null = null;
                      let icon = <FileText className="w-4 h-4" />;
                      let lightGradient = 'from-indigo-50/90 via-white to-blue-50/50';
                      let darkGradient = 'dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950';
                      let borderColor = 'border-indigo-200/90 dark:border-indigo-500/25 hover:border-indigo-400 dark:hover:border-indigo-500/50';
                      let iconBox = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                      let numColor = 'text-indigo-950 dark:text-white';
                      let titleColor = 'text-indigo-800 dark:text-indigo-300';
                      let chipLabel = 'Roster';

                      if (k.includes('total_student') || k.includes('totalstudent') || k === 'total') {
                        fKey = 'TOTAL_STUDENTS';
                        icon = <Users className="w-4 h-4" />;
                        lightGradient = 'from-indigo-50/90 via-white to-blue-50/50';
                        darkGradient = 'dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-indigo-200/90 dark:border-indigo-500/25 hover:border-indigo-400 dark:hover:border-indigo-500/50';
                        iconBox = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                        numColor = 'text-indigo-950 dark:text-white';
                        titleColor = 'text-indigo-800 dark:text-indigo-300';
                        chipLabel = 'All Enrolled';
                      } else if (k.includes('verified_solver') || k.includes('verifiedsolver')) {
                        fKey = 'METRIC_VERIFIED_SOLVERS';
                        icon = <UserCheck className="w-4 h-4" />;
                        lightGradient = 'from-emerald-50/90 via-white to-teal-50/50';
                        darkGradient = 'dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-emerald-200/90 dark:border-emerald-500/25 hover:border-emerald-400 dark:hover:border-emerald-500/50';
                        iconBox = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                        numColor = 'text-emerald-950 dark:text-emerald-300';
                        titleColor = 'text-emerald-800 dark:text-emerald-300';
                        chipLabel = 'Verified';
                      } else if (k.includes('unverified')) {
                        fKey = 'METRIC_UNVERIFIED_PROFILES';
                        icon = <AlertTriangle className="w-4 h-4" />;
                        lightGradient = 'from-rose-50/90 via-white to-red-50/50';
                        darkGradient = 'dark:from-rose-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-rose-200/90 dark:border-rose-500/25 hover:border-rose-400 dark:hover:border-rose-500/50';
                        iconBox = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20';
                        numColor = 'text-rose-950 dark:text-rose-300';
                        titleColor = 'text-rose-800 dark:text-rose-300';
                        chipLabel = 'Attention';
                      } else if (k.includes('active_solver') || k.includes('activesolver') || k === 'active') {
                        fKey = 'METRIC_ACTIVE_SOLVERS';
                        icon = <UserCheck className="w-4 h-4" />;
                        lightGradient = 'from-amber-50/90 via-white to-orange-50/50';
                        darkGradient = 'dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-amber-200/90 dark:border-amber-500/25 hover:border-amber-400 dark:hover:border-amber-500/50';
                        iconBox = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';
                        numColor = 'text-amber-950 dark:text-amber-300';
                        titleColor = 'text-amber-800 dark:text-amber-300';
                        chipLabel = 'Active';
                      } else if (k.includes('total_solved') || k.includes('totalsolved')) {
                        fKey = null;
                        icon = <CheckCircle2 className="w-4 h-4" />;
                        lightGradient = 'from-cyan-50/90 via-white to-blue-50/50';
                        darkGradient = 'dark:from-cyan-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-cyan-200/90 dark:border-cyan-500/25 hover:border-cyan-400 dark:hover:border-cyan-500/50';
                        iconBox = 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
                        numColor = 'text-cyan-950 dark:text-cyan-300';
                        titleColor = 'text-cyan-800 dark:text-cyan-300';
                        chipLabel = 'Aggregate';
                      } else if (k.includes('average_solved') || k.includes('averagesolved') || k.includes('avg')) {
                        fKey = null;
                        icon = <Target className="w-4 h-4" />;
                        lightGradient = 'from-purple-50/90 via-white to-indigo-50/50';
                        darkGradient = 'dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-purple-200/90 dark:border-purple-500/25 hover:border-purple-400 dark:hover:border-purple-500/50';
                        iconBox = 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20';
                        numColor = 'text-purple-950 dark:text-purple-300';
                        titleColor = 'text-purple-800 dark:text-purple-300';
                        chipLabel = 'Mean Rate';
                      } else if (k.includes('easy')) {
                        fKey = 'METRIC_EASY_SOLVED';
                        icon = <CheckCircle2 className="w-4 h-4" />;
                        lightGradient = 'from-emerald-50/90 via-white to-teal-50/50';
                        darkGradient = 'dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-emerald-200/90 dark:border-emerald-500/25 hover:border-emerald-400 dark:hover:border-emerald-500/50';
                        iconBox = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                        numColor = 'text-emerald-950 dark:text-emerald-300';
                        titleColor = 'text-emerald-800 dark:text-emerald-300';
                        chipLabel = 'Easy Tier';
                      } else if (k.includes('medium')) {
                        fKey = 'METRIC_MEDIUM_SOLVED';
                        icon = <Layers className="w-4 h-4" />;
                        lightGradient = 'from-amber-50/90 via-white to-yellow-50/50';
                        darkGradient = 'dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-amber-200/90 dark:border-amber-500/25 hover:border-amber-400 dark:hover:border-amber-500/50';
                        iconBox = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';
                        numColor = 'text-amber-950 dark:text-amber-300';
                        titleColor = 'text-amber-800 dark:text-amber-300';
                        chipLabel = 'Medium Tier';
                      } else if (k.includes('hard')) {
                        fKey = 'METRIC_HARD_SOLVED';
                        icon = <AlertTriangle className="w-4 h-4" />;
                        lightGradient = 'from-purple-50/90 via-white to-rose-50/50';
                        darkGradient = 'dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-purple-200/90 dark:border-purple-500/25 hover:border-purple-400 dark:hover:border-purple-500/50';
                        iconBox = 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20';
                        numColor = 'text-purple-950 dark:text-purple-300';
                        titleColor = 'text-purple-800 dark:text-purple-300';
                        chipLabel = 'Hard Tier';
                      } else if (k.includes('not_yet_started') || k.includes('zero_solved') || k.includes('unlinked')) {
                        fKey = 'METRIC_ZERO_SOLVED';
                        icon = <AlertTriangle className="w-4 h-4" />;
                        lightGradient = 'from-orange-50/90 via-white to-amber-50/50';
                        darkGradient = 'dark:from-orange-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-orange-200/90 dark:border-orange-500/25 hover:border-orange-400 dark:hover:border-orange-500/50';
                        iconBox = 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20';
                        numColor = 'text-orange-950 dark:text-orange-300';
                        titleColor = 'text-orange-800 dark:text-orange-300';
                        chipLabel = 'Zero Solves';
                      }

                      const isSelected = fKey ? (fKey === 'TOTAL_STUDENTS' ? activeFilter === null : activeFilter === fKey) : false;

                      return (
                        <div
                          key={key}
                          onClick={() => {
                            if (fKey === 'TOTAL_STUDENTS') {
                              setActiveFilter(null);
                            } else if (fKey) {
                              toggleFilter(fKey);
                            }
                          }}
                          role={fKey ? "button" : undefined}
                          title={fKey ? `Click to filter roster by ${formatMetricTitle(key)}` : undefined}
                          className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-300 text-left print:bg-white print:border-slate-300 print:shadow-none print:break-inside-avoid ${
                            fKey ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]' : ''
                          } ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-500/20 via-brand-500/15 to-transparent dark:from-indigo-500/30 dark:via-brand-500/20 dark:to-transparent border-brand-500 dark:border-brand-400 ring-2 ring-brand-500/40 shadow-xl shadow-brand-500/15'
                              : `bg-gradient-to-br ${lightGradient} ${darkGradient} ${borderColor} shadow-md shadow-slate-200/50 dark:shadow-black/40`
                          } backdrop-blur-xl group`}
                        >
                          {/* Ambient glow in card corner */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.04] rounded-full blur-xl pointer-events-none" />

                          {/* Top row: Label + Themed Icon Badge */}
                          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
                            <p className={`text-[11px] uppercase font-black tracking-wider truncate print:text-slate-700 ${
                              isSelected ? 'text-brand-600 dark:text-brand-300' : titleColor
                            }`}>
                              {formatMetricTitle(key)}
                            </p>
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-transform group-hover:scale-110 ${iconBox}`}>
                              {icon}
                            </div>
                          </div>

                          {/* Middle: Big high-contrast number */}
                          <p className={`text-2xl sm:text-3xl font-black font-mono tracking-tight print:text-black my-1 relative z-10 ${
                            isSelected ? 'text-brand-700 dark:text-white' : numColor
                          }`}>
                            {value !== null && value !== undefined ? (typeof value === 'number' && value > 999 ? value.toLocaleString() : String(value)) : "—"}
                          </p>

                          {/* Bottom: Active status or context chip */}
                          <div className="mt-2.5 flex items-center justify-between text-[10px] relative z-10">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1.5 font-mono font-black uppercase text-brand-600 dark:text-brand-300 tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/40 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                FILTER ACTIVE
                              </span>
                            ) : (
                              <span className="font-mono font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors uppercase tracking-wider text-[9.5px]">
                                {fKey ? 'tap to filter' : chipLabel}
                              </span>
                            )}
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 opacity-60">
                              {chipLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Distribution Grid */}
              {!isWeeklyPerformance && report.distribution && (
                <div className="space-y-3 print:break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5 print:text-black">
                      <Layers className="w-4 h-4 text-purple-500 print:text-black" />
                      <span>Problem Solving Category Distribution</span>
                    </h3>
                    <span className="text-[10px] font-bold text-purple-400 print:hidden">Click category to filter</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(report.distribution).map(([cat, count]: [string, any]) => {
                      const isCatSelected = activeFilter === cat;
                      return (
                        <div
                          key={cat}
                          onClick={() => toggleFilter(cat)}
                          role="button"
                          title={`Click to filter students with ${cat} solved`}
                          className={`p-3.5 rounded-2xl border text-center transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] print:bg-white print:border-purple-300 print:break-inside-avoid ${
                            isCatSelected
                              ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-600 dark:border-purple-400 ring-2 ring-purple-500/40 shadow-md'
                              : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60 shadow-xs'
                          }`}
                        >
                          <div className={`text-xs font-black mb-1 print:text-slate-700 ${
                            isCatSelected ? 'text-purple-950 dark:text-purple-100' : 'text-slate-900 dark:text-slate-100'
                          }`}>
                            {cat}
                          </div>
                          <div className={`text-xl font-black print:text-purple-900 ${
                            isCatSelected ? 'text-purple-900 dark:text-purple-100' : 'text-purple-800 dark:text-purple-300'
                          }`}>
                            {count}
                          </div>
                          {isCatSelected && (
                            <span className="inline-block mt-0.5 text-[9px] font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                              ● Filter Active
                            </span>
                          )}
                        </div>
                      );
                    })}
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
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.departmentSummary.map((d: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              #{idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 truncate">{d.department}</h4>
                          </div>
                          <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{d.attendance_pct}% Active</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-bold text-slate-900">{d.total}</span> (Act: {d.active_solvers})</div>
                          <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{d.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500 font-medium">Avg:</span> <span className="font-mono font-bold text-slate-900">{d.avg_solved}</span></div>
                          <div><span className="text-emerald-700 font-bold">4/4:</span> <span className="font-bold text-slate-900">{d.solvers_4}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase table-header-group">
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

              {/* Year-wise Intelligence Summary Table (HOD Report) */}
              {!isWeeklyPerformance && ['HOD_DEPARTMENT_INTELLIGENCE', 'PRINCIPAL_EXECUTIVE', 'MANAGEMENT_EXECUTIVE_SUMMARY'].includes(rType) && report.yearSummary && Array.isArray(report.yearSummary) && report.yearSummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    <span>Year-wise Intelligence Summary</span>
                  </h3>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.yearSummary.map((y: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <h4 className="text-xs font-bold text-indigo-700">{y.year}</h4>
                          <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{y.attendance_pct}% Active</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-bold text-slate-900">{y.total}</span></div>
                          <div><span className="text-slate-500 font-medium">Active:</span> <span className="font-bold text-emerald-700">{y.active_solvers}</span></div>
                          <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{y.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-emerald-700 font-bold">4/4:</span> <span className="font-bold text-slate-900">{y.solvers_4}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[520px]">
                      <thead className="bg-[#2F5D8A] text-white font-black uppercase">
                        <tr>
                          <th className="px-4 py-3 text-center">S.No</th>
                          <th className="px-4 py-3">Academic Year</th>
                          <th className="px-4 py-3 text-center">Total Students</th>
                          <th className="px-4 py-3 text-center">Active Solvers</th>
                          <th className="px-4 py-3 text-center">Participation %</th>
                          <th className="px-4 py-3 text-right">Total Solved</th>
                          <th className="px-4 py-3 text-right">Avg Solved</th>
                          <th className="px-4 py-3 text-center">4/4 Solvers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {report.yearSummary.map((y: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] font-black text-slate-900 dark:text-slate-100">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-indigo-700 dark:text-indigo-300">{y.year}</td>
                            <td className="px-4 py-2.5 text-center font-black">{y.total}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{y.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{y.attendance_pct}%</td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-white">{y.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-black">{y.avg_solved}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{y.solvers_4}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cutoff Band Intelligence Table */}
              {!isWeeklyPerformance && ['HOD_DEPARTMENT_INTELLIGENCE', 'PRINCIPAL_EXECUTIVE', 'MANAGEMENT_EXECUTIVE_SUMMARY', '12TH_TNEA_CUTOFF_ANALYSIS'].includes(rType) && report.cutoffBandSummary && Array.isArray(report.cutoffBandSummary) && report.cutoffBandSummary.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-rose-500" />
                    <span>12th TNEA Cutoff Band Intelligence Summary</span>
                  </h3>

                  {/* Mobile Card View (Hidden on print) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {(report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0).length > 0
                      ? report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0)
                      : report.cutoffBandSummary
                    ).map((b: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <h4 className="text-xs font-bold text-rose-700">{b.band}</h4>
                          <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{b.attendance_pct}% Active</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-bold text-slate-900">{b.total}</span></div>
                          <div><span className="text-slate-500 font-medium">Attended:</span> <span className="font-bold text-emerald-700">{b.active_solvers}</span></div>
                          <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{b.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500 font-medium">Avg:</span> <span className="font-mono font-bold text-slate-900">{b.avg_solved}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (Clean modern layout matching HOD & Year summaries) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3 text-center">S.No</th>
                          <th className="px-4 py-3">12th Cutoff Band</th>
                          <th className="px-4 py-3 text-center">Total Students</th>
                          <th className="px-4 py-3 text-center">Attended</th>
                          <th className="px-4 py-3 text-center">Not Attended</th>
                          <th className="px-4 py-3 text-center">Participation %</th>
                          <th className="px-4 py-3 text-center">Total Solved</th>
                          <th className="px-4 py-3 text-center">Avg Solved</th>
                          <th className="px-4 py-3 text-center">4/4 Solvers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white">
                        {(report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0).length > 0
                          ? report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0)
                          : report.cutoffBandSummary
                        ).map((b: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-mono text-[11px] font-black">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-black text-rose-700 dark:text-rose-300">{b.band}</td>
                            <td className="px-4 py-2.5 text-center font-black">{b.total}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-400">{b.active_solvers}</td>
                            <td className="px-4 py-2.5 text-center font-black text-rose-600 dark:text-rose-400">{b.not_active}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-400">{b.attendance_pct}%</td>
                            <td className="px-4 py-2.5 text-center font-black">{b.total_solved?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-black">{b.avg_solved}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-400">{b.solvers_4}</td>
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
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.facultySummary.map((f: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              #{idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 truncate">{f.staff_name}</h4>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">{f.department}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                          <div><span className="text-slate-500 font-medium">Assigned:</span> <span className="font-bold text-slate-900">{f.total_assigned}</span> (Act: {f.active_solvers})</div>
                          <div><span className="text-slate-500 font-medium">Active:</span> <span className="font-bold text-emerald-700">{f.active_pct}%</span></div>
                          <div><span className="text-slate-500 font-medium">Solves:</span> <span className="font-bold text-slate-900">{f.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500 font-medium">Avg:</span> <span className="font-mono font-bold text-slate-900">{f.avg_solved}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase table-header-group">
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
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span>Five-Week Longitudinal Performance Matrix</span>
                  </h3>
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {(report.allStudents || report.rows || []).map((s: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0 border border-slate-200/60">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {formatStudentName(s.name || s.student_name)}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-mono leading-tight">
                                {s.reg_no} • {s.dept} ({s.year})
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-emerald-700 block">{s.total_solved ?? 0} Solved ({s.attendance_rate || '0%'})</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-600 font-bold">Contests 1–5:</span>
                          <div className="flex items-center space-x-1.5 font-mono font-bold text-slate-800">
                            <span>{s.c1_solved ?? 0}</span>
                            <span>•</span>
                            <span>{s.c2_solved ?? 0}</span>
                            <span>•</span>
                            <span>{s.c3_solved ?? 0}</span>
                            <span>•</span>
                            <span>{s.c4_solved ?? 0}</span>
                            <span>•</span>
                            <span>{s.c5_solved ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[650px] sm:min-w-[950px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10 table-header-group">
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
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Top Performers Leaderboard</span>
                  </h3>
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.topStudents.map((s: any, idx: number) => {
                      const r = s.rating ?? s.contest_rating ?? s.contestRating ?? s.stats?.contest_rating;
                      const formattedRating = (r !== null && r !== undefined && r !== '' && r !== '—' && !isNaN(Number(r)) && Number(r) > 0)
                        ? Math.round(Number(r)).toLocaleString()
                        : "—";
                      return (
                        <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {formatStudentName(s.name || s.student_name)}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-mono leading-tight">
                                  {s.reg_no} • {s.dept} ({deriveYearLevelFromRegNo(s.reg_no, s.year)})
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-emerald-700 block">{s.total_solved ?? "—"} Solved</span>
                              {formattedRating !== '—' && <span className="text-[10px] font-mono text-slate-600 block">Rating: {formattedRating}</span>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-700 font-bold">E:{s.easy ?? "—"}</span>
                              <span className="text-amber-700 font-bold">M:{s.medium ?? "—"}</span>
                              <span className="text-rose-700 font-bold">H:{s.hard ?? "—"}</span>
                            </div>
                            <span className="text-slate-600 font-mono text-[10px]">Total: {s.total_solved ?? "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase table-header-group">
                        <tr>
                          <th className="px-4 py-3 text-center">Rank</th>
                          <th className="px-4 py-3 text-center">Reg No</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-center">Dept</th>
                          <th className="px-4 py-3 text-center">Year</th>
                          <th className="px-4 py-3 text-center">Easy</th>
                          <th className="px-4 py-3 text-center">Medium</th>
                          <th className="px-4 py-3 text-center">Hard</th>
                          <th className="px-4 py-3 text-center">Total Solved</th>
                          <th className="px-4 py-3 text-center">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                        {report.topStudents.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-4 py-2.5 text-center font-black text-amber-600 dark:text-amber-400">#{idx + 1}</td>
                            <td className="px-4 py-2.5 text-center font-black text-slate-950 dark:text-white font-mono">{s.reg_no}</td>
                            <td className="px-4 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap">{formatStudentName(s.name || s.student_name)}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                            <td className="px-4 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{deriveYearLevelFromRegNo(s.reg_no, s.year)}</td>
                            <td className="px-4 py-2.5 text-center font-black text-emerald-700 dark:text-emerald-300">{s.easy ?? "—"}</td>
                            <td className="px-4 py-2.5 text-center font-black text-amber-700 dark:text-amber-300">{s.medium ?? "—"}</td>
                            <td className="px-4 py-2.5 text-center font-black text-rose-700 dark:text-rose-300">{s.hard ?? "—"}</td>
                            <td className="px-4 py-2.5 text-center font-black text-brand-700 dark:text-brand-300 text-sm">{s.total_solved ?? "—"}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-black text-slate-950 dark:text-white">
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center space-x-2">
                      <Users className="w-4 h-4 text-brand-500" />
                      <span>
                        Full Student Performance Roster ({displayedStudents.length} {displayedStudents.length === allRows.length ? 'Students' : `of ${allRows.length} Students`})
                      </span>
                    </h3>
                    {activeFilter && (
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                          Active: <span className="underline font-black">{activeFilter.replace('METRIC_', '').replace('CAT_', '').replace(/_/g, ' ')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveFilter(null)}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-black text-[10px] transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <X className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {activeFilter && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs shadow-2xs animate-fade-in print:hidden">
                      <div className="flex items-center space-x-2">
                        <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="font-bold text-indigo-950 dark:text-indigo-200">
                          Filtering students for: <span className="font-black text-indigo-700 dark:text-indigo-300">{activeFilter.replace('METRIC_', '').replace('CAT_', '').replace(/_/g, ' ')}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-black bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200 text-[10px]">
                          {displayedStudents.length} Solvers Found
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveFilter(null)}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-navy-900 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-black text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                      >
                        <X className="w-3 h-3" />
                        <span>Reset Table</span>
                      </button>
                    </div>
                  )}

                  {displayedStudents.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No students match the selected filter category ({activeFilter}).</p>
                      <button
                        type="button"
                        onClick={() => setActiveFilter(null)}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-black shadow-xs hover:bg-brand-700 transition-all cursor-pointer"
                      >
                        Show All Students
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card View (< sm) */}
                      <div className="block sm:hidden print:hidden space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {displayedStudents.map((s: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {formatStudentName(s.name || s.student_name)}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-mono leading-tight">
                                    {s.reg_no} • {s.dept} ({deriveYearLevelFromRegNo(s.reg_no, s.year)})
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md block text-center mb-0.5 ${s.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                                  {s.status}
                                </span>
                                <span className="text-xs font-bold text-emerald-700 block">{s.total_solved !== null ? s.total_solved : "—"} Solved</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-50/80 rounded-lg border border-slate-200/60 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-700 font-bold">E:{s.easy ?? "—"}</span>
                                <span className="text-amber-700 font-bold">M:{s.medium ?? "—"}</span>
                                <span className="text-rose-700 font-bold">H:{s.hard ?? "—"}</span>
                              </div>
                              <span className="text-slate-500 font-mono text-[10px]">{s.reg_no}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View (>= sm) */}
                      <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[450px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                        <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[800px] print:min-w-0 print:w-full">
                          <thead className="bg-gradient-to-r from-slate-900 via-[#0e1a33] to-slate-900 text-white font-black uppercase sticky top-0 z-10 table-header-group print:table-header-group print:bg-slate-200 print:text-black">
                            <tr>
                              <th className="px-4 py-3 text-center print:border-b print:border-black">S.No</th>
                              <th className="px-4 py-3 text-center print:border-b print:border-black">Reg No</th>
                              <th className="px-4 py-3 text-left print:border-b print:border-black">Student Name</th>
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
                            {displayedStudents.map((s: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors group">
                                <td className="px-4 py-2.5 text-center text-slate-900 dark:text-slate-100 font-mono text-[11px] font-black print:text-black">{idx + 1}</td>
                                <td className="px-4 py-2.5 font-black text-slate-950 dark:text-white font-mono text-center print:text-black">{s.reg_no}</td>
                                <td className="px-4 py-2.5 text-left font-bold text-slate-950 dark:text-white whitespace-nowrap print:text-black">{formatStudentName(s.name || s.student_name)}</td>
                                <td className="px-4 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-300">{s.dept}</td>
                                <td className="px-4 py-2.5 text-center font-black text-slate-900 dark:text-slate-100">{deriveYearLevelFromRegNo(s.reg_no, s.year)}</td>
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
                    </>
                  )}
                </div>
              )}

            </div>
          )}

          {/* UNIVERSAL SOLVE CONDITION & DIFFICULTY BREAKDOWN (TABLE FOOTER ANALYSIS) */}
          {!isContestReport && (
          <div className="pt-4 space-y-4 print:break-inside-avoid print:mt-6">
                  <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1427] border-2 border-slate-200/90 dark:border-white/10 shadow-xl space-y-5">
                    {/* Header with Title, Report Type Scope & Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white uppercase tracking-wider">
                            Solve Condition &amp; Performance Summary
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                            {rType || 'UNIVERSAL REPORT'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          Aggregated solve condition cohorts, problem difficulty metrics & attendance breakdown for table data above.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black text-slate-700 dark:text-slate-200">
                          <span>In Scope: {allRows.length} Students</span>
                        </span>
                        {activeFilter && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-black text-amber-700 dark:text-amber-300">
                            <span>Filtered View: {conditionStats.totalStudents}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 1. Problem Solve Distribution Cohorts (4/4, 3/4, 2/4, 1/4, 0/4, Not Attended) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Contest / Weekly Solve Distribution Cohorts
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                          Click any cohort card to filter students in the table
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                        {/* 4/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_4')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_4'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-emerald-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">4 Solved (4/4)</span>
                            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s4 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight mt-1">{conditionStats.s4}</p>
                        </div>

                        {/* 3/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_3')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_3'
                              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-teal-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">3 Solved (3/4)</span>
                            <span className="text-[10px] font-black text-teal-800 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s3 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-teal-800 dark:text-teal-300 tracking-tight mt-1">{conditionStats.s3}</p>
                        </div>

                        {/* 2/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_2')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_2'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-brand-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">2 Solved (2/4)</span>
                            <span className="text-[10px] font-black text-brand-800 dark:text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s2 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-brand-800 dark:text-brand-300 tracking-tight mt-1">{conditionStats.s2}</p>
                        </div>

                        {/* 1/4 Solved */}
                        <div
                          onClick={() => toggleFilter('SOLVED_1')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_1'
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-amber-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">1 Solved (1/4)</span>
                            <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s1 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight mt-1">{conditionStats.s1}</p>
                        </div>

                        {/* 0/4 Solved (Attended) */}
                        <div
                          onClick={() => toggleFilter('SOLVED_0')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'SOLVED_0'
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-purple-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">0 Solved (Attended)</span>
                            <span className="text-[10px] font-black text-purple-800 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.s0 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-purple-800 dark:text-purple-300 tracking-tight mt-1">{conditionStats.s0}</p>
                        </div>

                        {/* Not Attended / Absent */}
                        <div
                          onClick={() => toggleFilter('NOT_ATTENDED')}
                          className={`relative overflow-hidden p-3 sm:p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                            activeFilter === 'NOT_ATTENDED'
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                              : 'bg-slate-50/80 dark:bg-navy-900/60 border-slate-200/90 dark:border-white/10 hover:border-rose-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Not Attended</span>
                            <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded-md font-mono">
                              {conditionStats.totalStudents > 0 ? `${((conditionStats.notAttendedCount / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                            </span>
                          </div>
                          <p className="text-2xl font-black text-rose-800 dark:text-rose-300 tracking-tight mt-1">{conditionStats.notAttendedCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Problem Difficulty Solves Split (Easy / Medium / Hard / Total) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Difficulty Solve Distribution (Easy • Medium • Hard)
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Easy Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Easy Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">
                            {conditionStats.totalEasy.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            Foundational Solves
                          </span>
                        </div>

                        {/* Medium Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Medium Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">
                            {conditionStats.totalMed.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                            Core Algorithmic Solves
                          </span>
                        </div>

                        {/* Hard Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">Hard Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">
                            {conditionStats.totalHard.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-400">
                            High Difficulty Solves
                          </span>
                        </div>

                        {/* Total Cumulative Solves */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-brand-500/15 border border-brand-500/30 flex flex-col justify-between shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">Total Solves</span>
                          <p className="text-2xl sm:text-3xl font-black text-brand-800 dark:text-brand-300 tracking-tight my-1">
                            {conditionStats.totalSolves.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-extrabold text-brand-700 dark:text-brand-400">
                            Cumulative Solves
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Official Condition Criteria Reference Strip */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-slate-700 dark:text-slate-300 font-bold">
                        Evaluation Standards: 4/4 (100% Complete) • 3/4 (Advanced) • 2/4 (Intermediate) • 1/4 (Developing) • 0/4 (Participation)
                      </div>
                      {activeFilter && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter(null)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white font-black text-[11px] transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0"
                        >
                          <span>Clear Filter ({conditionStats.totalStudents}/{allRows.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
          </div>
          )}

        </div>

        {/* 4. FOOTER / EXECUTIVE EXPORT ACTIONS - Crisp White & Mobile-Sleek */}
        <div className="px-3.5 py-3 sm:px-5 sm:py-3 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 print:hidden shadow-lg pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <div className="flex items-center justify-between sm:justify-start space-x-2 text-xs font-bold text-slate-700">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-extrabold tracking-wide text-slate-900 text-[11px] sm:text-xs">Official Institutional Dataset</span>
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {allRows.length} Records Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => downloadFile('excel')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-2 px-3.5 py-2.5 min-h-[42px] sm:min-h-[38px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 touch-manipulation group"
              title="Download Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => downloadFile('pdf')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-2 px-3.5 py-2.5 min-h-[42px] sm:min-h-[38px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 touch-manipulation group"
              title="Download PDF document"
            >
              <FileText className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">PDF (.pdf)</span>
            </button>
            <button
              onClick={() => downloadFile('word')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-2 px-3.5 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 touch-manipulation group"
              title="Download Word document"
            >
              <FileText className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Word (.docx)</span>
            </button>
            <button
              onClick={() => window.print()}
              type="button"
              className="flex items-center justify-center space-x-2 px-3.5 py-2 min-h-[38px] bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 touch-manipulation border border-slate-800"
              title="Print / Save as PDF from browser"
            >
              <Printer className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="truncate">Print View</span>
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

