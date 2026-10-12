import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Trophy, Layers, Award, CheckCircle2, UserCheck, Users, HelpCircle, Flame, Filter, Building2, GraduationCap, Target, Printer, ShieldCheck, Sparkles, Zap, TrendingUp, UserX, Clock } from 'lucide-react';
import api from '../services/api';
import { FullScreenLoadingOverlay } from './ui/FullScreenLoadingOverlay';

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

      let sessionTag = '';
      if (report?.contestName) {
        sessionTag += `_${report.contestName.replace(/\s+/g, '_')}`;
      } else if (report?.prevContest && report?.currContest) {
        sessionTag += `_${report.prevContest}_vs_${report.currContest}`;
      }

      const isLiveReport = ['STUDENT_PERFORMANCE', 'ASSIGNED_STUDENTS', 'STAFF_MENTORING'].includes(report?.reportType || '');
      const dateVal = isLiveReport ? '' : (report?.contestDate || report?.sessionDate || report?.session_date || report?.currDate || '');
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
    if (s === 'PUBLIC_ATTENDED' || s === 'PUBLIC' || s === 'PUBLIC_LIVE' || s === 'ATTENDED') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700 leading-none shadow-xs">PUBLIC ATTENDED</span>;
    }
    if (s === 'VIRTUAL_ATTENDED' || s === 'VIRTUAL' || s === 'VIRTUAL_PRACTICE') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-100 text-purple-950 dark:bg-purple-950 dark:text-purple-200 border border-purple-400 dark:border-purple-700 leading-none shadow-xs">VIRTUAL ATTENDED</span>;
    }
    if (s === 'NOT_ATTENDED' || s === 'PUBLIC_NOT_ATTENDED' || s === 'ABSENT') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-400 dark:border-rose-700 leading-none shadow-xs">NOT ATTENDED</span>;
    }
    if (s === 'PENDING_USERNAME' || s === 'PENDING') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-400 dark:border-amber-700 leading-none shadow-xs">PENDING USERNAME</span>;
    }
    if (s === 'DATA_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200 border border-orange-400 dark:border-orange-700 leading-none shadow-xs">DATA ERROR</span>;
    }
    if (s === 'FETCH_FAILED' || s === 'FETCH_ERROR') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-400 dark:border-rose-700 leading-none shadow-xs">FETCH FAILED</span>;
    }
    if (s === 'INVALID_USERNAME' || s === 'USERNAME_NOT_FOUND') {
      return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200 border border-orange-400 dark:border-orange-700 leading-none shadow-xs">INVALID USERNAME</span>;
    }
    return <span className="inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[10px] font-black rounded-full bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-400 leading-none shadow-xs">UNKNOWN</span>;
  };

  return createPortal(
    <div
      className="modal-overlay-responsive animate-modal-backdrop print:bg-white print:p-0 print:static print:w-full print:h-auto print:overflow-visible"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-container-responsive max-w-6xl bg-white dark:bg-[#080d19] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 animate-modal-content print:static print:rounded-none print:shadow-none print:border-none print:max-w-full print:w-full print:h-auto print:overflow-visible print:p-0 flex flex-col overflow-hidden">
        
        {/* Mobile bottom-sheet drag handle */}
        <div className="pt-2.5 pb-1 bg-slate-950 sm:hidden flex justify-center shrink-0">
          <div className="w-12 h-1 rounded-full bg-white/25" />
        </div>

        {/* 1. HEADER BANNER */}
        <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-[#0c162c] to-[#091122] text-white flex items-center justify-between shrink-0 border-b border-white/10 print:bg-white print:text-black print:border-b-2 print:border-black">
          {/* Subtle ambient light glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 border border-brand-400/30 flex items-center justify-center shrink-0 text-brand-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base sm:text-xl text-white tracking-tight print:text-black truncate print:whitespace-normal">
                  {cleanReportTitle(report.title || report.reportTitle) || (isContestReport ? `${report.contestName || 'Contest'} Performance Report` : 'Report Preview')}
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-black tracking-wide shrink-0 shadow-sm print:hidden">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  READY
                </span>
              </div>
              <p className="text-xs text-slate-300/80 print:text-slate-700 font-medium mt-1 truncate print:whitespace-normal flex items-center gap-2">
                {isContestReport && report.contestName && (
                  <span className="font-black text-amber-300 print:text-black px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/20">
                    {report.contestName} ({report.contestDate || report.sessionDate || 'Sunday Session'})
                  </span>
                )}
                <span>Report ID: <span className="font-mono font-bold text-white/90 print:text-slate-600">{report.reportId || report.report_id}</span></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="shrink-0 ml-2 px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-200 hover:text-white border border-white/10 hover:border-rose-400/30 transition-all font-black text-xs flex items-center space-x-1.5 cursor-pointer shadow-md print:hidden touch-manipulation active:scale-95 group"
          >
            <X className="w-4 h-4 text-slate-300 group-hover:text-rose-300 transition-colors" />
            <span>Close</span>
          </button>
        </div>

        {/* 2. DATASET QUALITY & RECONCILIATION BAR */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-[#070D18] border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Dataset Reconciliation:</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-mono text-[11px] font-black">
              Roster: {allRows.length} Students
            </span>
            {isContestReport && (
              <span className="px-2.5 py-0.5 rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/25 font-mono text-[11px] font-black">
                Participants: {
                  (contestSummary.publicAttended !== undefined || contestSummary.virtualAttended !== undefined)
                    ? (contestSummary.publicAttended || 0) + (contestSummary.virtualAttended || 0)
                    : (report.histSummary?.sessionParticipation?.length > 0
                        ? report.histSummary.sessionParticipation[report.histSummary.sessionParticipation.length - 1].attended
                        : allRows.filter((r: any) => (r.totalAttended || 0) > 0 || (r.weeklyData || []).some((w: any) => w.att)).length)
                }
              </span>
            )}
            {activeFilter && (
              <span className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black">
                <Filter className="w-3 h-3 text-amber-500" />
                <span>Filtered: {displayedStudents.length} of {allRows.length} rows</span>
                <button 
                  type="button" 
                  onClick={() => setActiveFilter(null)} 
                  className="ml-1 p-0.5 hover:text-rose-500 font-black touch-manipulation active:scale-90"
                  aria-label="Clear active filter"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold text-[11px] border border-brand-500/20 shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>Nandha Engineering College (Autonomous)</span>
          </div>
        </div>

        {/* 3. SCROLLABLE REPORT CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6 bg-slate-50/80 dark:bg-[#070D18] print:overflow-visible print:h-auto print:p-0 print:space-y-4 print:mt-4">

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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  
                  {/* Total Students */}
                  <div 
                    onClick={() => setActiveFilter(null)}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === null 
                        ? 'bg-gradient-to-br from-indigo-50 via-white to-blue-50/50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950 border-brand-500 ring-2 ring-brand-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-brand-400 dark:hover:border-brand-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Students</span>
                      <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-950 dark:text-white tracking-tight my-1">{contestSummary.totalStudents || allRows.length}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full w-fit border border-brand-500/20">All Roster</span>
                  </div>

                  {/* Public Attended */}
                  <div 
                    onClick={() => toggleFilter('PUBLIC_ATTENDED')}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === 'PUBLIC_ATTENDED' 
                        ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Public Attended</span>
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">{contestSummary.publicAttended ?? 0}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit border border-emerald-500/20">
                      {contestSummary.publicAttendanceRate 
                        ? (String(contestSummary.publicAttendanceRate).endsWith('%') ? contestSummary.publicAttendanceRate : `${contestSummary.publicAttendanceRate}%`)
                        : `${(( (contestSummary.publicAttended || 0) / Math.max(contestSummary.totalStudents || allRows.length, 1) ) * 100).toFixed(1).replace(/\.0$/, '')}%`}
                    </span>
                  </div>

                  {/* Virtual Attended */}
                  <div 
                    onClick={() => toggleFilter('VIRTUAL_ATTENDED')}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === 'VIRTUAL_ATTENDED' 
                        ? 'bg-gradient-to-br from-purple-50 via-white to-fuchsia-50/50 dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-950 border-purple-500 ring-2 ring-purple-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">Virtual Attended</span>
                      <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">{contestSummary.virtualAttended ?? 0}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-purple-800 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full w-fit border border-purple-500/20">
                      {contestSummary.virtualAttendanceRate 
                        ? (String(contestSummary.virtualAttendanceRate).endsWith('%') ? contestSummary.virtualAttendanceRate : `${contestSummary.virtualAttendanceRate}%`)
                        : `${(( (contestSummary.virtualAttended || 0) / Math.max(contestSummary.totalStudents || allRows.length, 1) ) * 100).toFixed(1).replace(/\.0$/, '')}%`}
                    </span>
                  </div>

                  {/* Not Attended */}
                  <div 
                    onClick={() => toggleFilter('NOT_ATTENDED')}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === 'NOT_ATTENDED' 
                        ? 'bg-gradient-to-br from-rose-50 via-white to-pink-50/50 dark:from-rose-950/40 dark:via-slate-900/90 dark:to-slate-950 border-rose-500 ring-2 ring-rose-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Not Attended</span>
                      <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <UserX className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-rose-800 dark:text-rose-300 tracking-tight my-1">{contestSummary.notAttended ?? 0}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full w-fit border border-rose-500/20">Absent</span>
                  </div>

                  {/* Pending Username */}
                  <div 
                    onClick={() => toggleFilter('PENDING_USERNAME')}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === 'PENDING_USERNAME' 
                        ? 'bg-gradient-to-br from-amber-50 via-white to-yellow-50/50 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950 border-amber-500 ring-2 ring-amber-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Pending Username</span>
                      <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">{contestSummary.pendingUsername ?? 0}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit border border-amber-500/20">Unlinked</span>
                  </div>

                  {/* Invalid Username */}
                  <div 
                    onClick={() => toggleFilter('INVALID_USERNAME')}
                    className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                      activeFilter === 'INVALID_USERNAME' 
                        ? 'bg-gradient-to-br from-orange-50 via-white to-red-50/50 dark:from-orange-950/40 dark:via-slate-900/90 dark:to-slate-950 border-orange-500 ring-2 ring-orange-500/30 shadow-md' 
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 dark:text-orange-300">Invalid Username</span>
                      <div className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-orange-800 dark:text-orange-300 tracking-tight my-1">{contestSummary.invalidUsername ?? 0}</p>
                    <span className="inline-flex items-center text-[10px] font-black text-orange-800 dark:text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded-full w-fit border border-orange-500/20">Invalid</span>
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
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'SOLVED_4' 
                          ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">4 Solved (Full)</span>
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Trophy className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">{solveDist.solved4 ?? report.metrics?.['4 Q Solved'] ?? conditionStats.s4 ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit border border-emerald-500/20">Students</span>
                    </div>

                    {/* 3 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_3')}
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'SOLVED_3' 
                          ? 'bg-gradient-to-br from-teal-50 via-white to-cyan-50/50 dark:from-teal-950/40 dark:via-slate-900/90 dark:to-slate-950 border-teal-500 ring-2 ring-teal-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-teal-400 dark:hover:border-teal-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">3 Solved</span>
                        <div className="w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <Target className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-teal-800 dark:text-teal-300 tracking-tight my-1">{solveDist.solved3 ?? report.metrics?.['3 Q Solved'] ?? conditionStats.s3 ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-teal-800 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full w-fit border border-teal-500/20">Students</span>
                    </div>

                    {/* 2 Problems Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_2')}
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'SOLVED_2' 
                          ? 'bg-gradient-to-br from-indigo-50 via-white to-blue-50/50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950 border-brand-500 ring-2 ring-brand-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-brand-400 dark:hover:border-brand-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">2 Solved</span>
                        <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-brand-800 dark:text-brand-300 tracking-tight my-1">{solveDist.solved2 ?? report.metrics?.['2 Q Solved'] ?? conditionStats.s2 ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-brand-800 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full w-fit border border-brand-500/20">Students</span>
                    </div>

                    {/* 1 Problem Solved */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_1')}
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'SOLVED_1' 
                          ? 'bg-gradient-to-br from-amber-50 via-white to-yellow-50/50 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950 border-amber-500 ring-2 ring-amber-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">1 Solved</span>
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Flame className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">{solveDist.solved1 ?? report.metrics?.['1 Q Solved'] ?? conditionStats.s1 ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit border border-amber-500/20">Students</span>
                    </div>

                    {/* 0 Problems Solved (Participated) */}
                    <div 
                      onClick={() => toggleFilter('SOLVED_0')}
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'SOLVED_0' 
                          ? 'bg-gradient-to-br from-purple-50 via-white to-fuchsia-50/50 dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-950 border-purple-500 ring-2 ring-purple-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">0 Solved (Attended)</span>
                        <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">{solveDist.solved0 ?? report.metrics?.['0 Q Solved'] ?? conditionStats.s0 ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-purple-800 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full w-fit border border-purple-500/20">Participants</span>
                    </div>

                    {/* Not Attended */}
                    <div 
                      onClick={() => toggleFilter('NOT_ATTENDED')}
                      className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between min-h-[105px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
                        activeFilter === 'NOT_ATTENDED' 
                          ? 'bg-gradient-to-br from-rose-50 via-white to-pink-50/50 dark:from-rose-950/40 dark:via-slate-900/90 dark:to-slate-950 border-rose-500 ring-2 ring-rose-500/30 shadow-md' 
                          : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Not Attended</span>
                        <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                          <UserX className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-rose-800 dark:text-rose-300 tracking-tight my-1">{solveDist.notParticipated ?? contestSummary.notAttended ?? conditionStats.notAttendedCount ?? 0}</p>
                      <span className="inline-flex items-center text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full w-fit border border-rose-500/20">Absent</span>
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
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.questionWiseResult.map((q: any, i: number) => (
                      <div key={i} className="p-3 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-950 dark:text-white">{q.question}</span>
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 font-bold mt-0.5 space-x-2">
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">{q.solved} Solved</span>
                            <span>•</span>
                            <span className="text-rose-700 dark:text-rose-400 font-bold">{q.not_solved} Unsolved</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-slate-900 dark:text-slate-100 block">Solve Rate</span>
                          <span className="text-sm font-black text-brand-700 dark:text-brand-300">{q.solve_rate}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
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
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2">
                    {report.solveDistributionList.map((sd: any, i: number) => (
                      <div key={i} className="p-3 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-950 dark:text-white">{sd.category}</span>
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">{sd.count} Students</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-slate-900 dark:text-slate-100 block">Percentage</span>
                          <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{sd.percentage}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
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
              {isFridayOfficial && displayOfficialLeaderboard && Array.isArray(displayOfficialLeaderboard) && displayOfficialLeaderboard.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <span>Official Leaderboard & Top Performers</span>
                  </h3>
                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {displayOfficialLeaderboard.slice(0, 25).map((lb: any, i: number) => (
                      <div key={i} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 shrink-0">
                              #{lb.rank}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">{formatStudentName(lb.student_name || lb.student)}</h4>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-black font-mono">{lb.reg_no} • {lb.dept} ({lb.year})</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 block">{lb.solved} Solved</span>
                            <span className="text-[10px] font-mono font-black text-indigo-700 dark:text-indigo-300 block">Score: {lb.score ?? 0}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs pt-0.5">
                          <div className="bg-slate-100 dark:bg-navy-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 min-w-0">
                            <span className="text-slate-900 dark:text-slate-100 text-[10px] uppercase font-black block mb-1">Questions</span>
                            <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] font-black">
                              <span className={`px-1.5 py-0.5 rounded shrink-0 ${lb.q1 === 1 ? "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950" : "text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950"}`}>Q1:{lb.q1 ?? 0}</span>
                              <span className={`px-1.5 py-0.5 rounded shrink-0 ${lb.q2 === 1 ? "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950" : "text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950"}`}>Q2:{lb.q2 ?? 0}</span>
                              <span className={`px-1.5 py-0.5 rounded shrink-0 ${lb.q3 === 1 ? "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950" : "text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950"}`}>Q3:{lb.q3 ?? 0}</span>
                              <span className={`px-1.5 py-0.5 rounded shrink-0 ${lb.q4 === 1 ? "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950" : "text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950"}`}>Q4:{lb.q4 ?? 0}</span>
                            </div>
                          </div>
                          <div className="bg-slate-100 dark:bg-navy-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-left xs:text-right min-w-0">
                            <span className="text-slate-900 dark:text-slate-100 text-[10px] uppercase font-black block mb-1">Rank & Rating</span>
                            <span className="font-black text-amber-700 dark:text-amber-400 text-xs block">
                              Global: {formatRank(lb.global_rank || lb.rank_val || lb.rank)}
                            </span>
                            <span className="font-mono text-slate-950 dark:text-white font-black text-[11px] block mt-0.5">
                              Rating: {formatRating(lb.rating || lb.contest_rating)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
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
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {displayDepartmentResults.map((dr: any, i: number) => (
                      <div key={i} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-black text-brand-700 dark:text-brand-300">{dr.department}</h4>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{dr.participants}/{dr.total_students} ({dr.participation_pct})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-800 dark:text-slate-200 font-bold">Total Solves:</span> <span className="font-black text-slate-950 dark:text-white">{dr.total_solves?.toLocaleString()}</span></div>
                          <div><span className="text-slate-800 dark:text-slate-200 font-bold">Avg Solved:</span> <span className="font-mono font-black text-slate-950 dark:text-white">{dr.average_solved}</span></div>
                          <div className="col-span-2 pt-1">
                            <span className="text-[10px] uppercase font-black text-slate-900 dark:text-slate-100 block mb-1">Solve Distribution (4/4 to 0/4)</span>
                            <div className="flex items-center justify-between text-[10px] font-black bg-slate-100 dark:bg-navy-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                              <span className="text-emerald-700 dark:text-emerald-300">4/4: {dr.solved_4}</span>
                              <span className="text-teal-700 dark:text-teal-300">3/4: {dr.solved_3}</span>
                              <span className="text-brand-700 dark:text-brand-300">2/4: {dr.solved_2}</span>
                              <span className="text-amber-700 dark:text-amber-300">1/4: {dr.solved_1}</span>
                              <span className="text-rose-700 dark:text-rose-300">0/4: {dr.solved_0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
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
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
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
                  <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {(report.rows || []).map((r: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-200 dark:bg-navy-700 text-slate-950 dark:text-white shrink-0">
                              #{r.s_no || idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">{formatStudentName(r.name || r.student_name)}</h4>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-black font-mono">{r.reg_no} • {r.dept} ({r.year})</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-brand-700 dark:text-brand-300 block">{r.total_solved_fraction || `${r.totalSolved} Solved`}</span>
                            {r.attended_solve_fraction && <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 block">Attended: {r.attended_solve_fraction}</span>}
                            <span className={`text-[10px] font-black ${r.consistencyPct >= 75 ? 'text-emerald-700 dark:text-emerald-300' : r.consistencyPct >= 40 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>{r.consistencyPct}% Consistency</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100 dark:bg-navy-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-900 dark:text-slate-100 font-black mr-1">Sessions ({r.contests_attended_fraction || `${r.totalAttended} Attended`}):</span>
                          {(r.weeklyData || []).map((wd: any, widx: number) => (
                            <span key={widx} className={`px-1.5 py-0.5 rounded-md font-mono font-black ${wd.att ? (wd.solved >= 3 ? 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-400' : wd.solved >= 1 ? 'bg-brand-100 text-brand-950 dark:bg-brand-950 dark:text-brand-200 border border-brand-400' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-400') : 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-400'}`}>
                              C{widx + 1}: {wd.att ? wd.solved : '—'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
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
                      <tfoot className="bg-[#E6F0FA] dark:bg-[#162747] text-[#1B365D] dark:text-[#E2E8F0] font-black border-t-2 border-[#16324F] sticky bottom-0 z-10">
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

                {/* Mobile Card View (< sm) */}
                <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {displayedStudents.map((s: any, idx: number) => {
                    const st = (s.status || '').toUpperCase();
                    const isPart = ['PUBLIC_ATTENDED', 'VIRTUAL_ATTENDED', 'PUBLIC', 'VIRTUAL', 'PUBLIC_LIVE', 'VIRTUAL_PRACTICE', 'ATTENDED', 'VERIFIED', 'COMPLETED', 'ATTENDED_SOLVED', 'ATTENDED_ZERO'].includes(st) || (s.total_solved !== undefined && s.total_solved !== null);
                    const cSolved = s.contest_solved !== undefined && s.contest_solved !== null ? s.contest_solved : (s.total_solved !== undefined && s.total_solved !== null ? s.total_solved : (s.solved !== undefined && s.solved !== null ? s.solved : null));
                    return (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-200 dark:bg-navy-700 text-slate-950 dark:text-white shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">{formatStudentName(s.name || s.student_name)}</h4>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-black font-mono">{s.reg_no} • {s.dept} ({s.year})</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {getStatusBadge(s.status)}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs pt-0.5">
                          <div className="bg-slate-100 dark:bg-navy-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 min-w-0">
                            <span className="text-slate-900 dark:text-slate-100 text-[10px] uppercase font-black tracking-wider block mb-1">Contest / Questions</span>
                            <span className={`font-black text-xs block leading-tight ${isPart && cSolved !== null && cSolved > 0 ? 'text-emerald-700 dark:text-emerald-400' : isPart ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
                              {isPart && cSolved !== null ? `${cSolved} Solved` : '0 Solved (Not Attended)'}
                            </span>
                            {s.q1 !== undefined && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5 font-mono text-[10px] font-black">
                                <span className={`px-1.5 py-0.5 rounded border shrink-0 ${s.q1 === 1 ? "text-emerald-800 dark:text-emerald-300 font-black bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700" : "text-rose-800 dark:text-rose-300 font-black bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700"}`}>Q1:{s.q1 ?? 0}</span>
                                <span className={`px-1.5 py-0.5 rounded border shrink-0 ${s.q2 === 1 ? "text-emerald-800 dark:text-emerald-300 font-black bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700" : "text-rose-800 dark:text-rose-300 font-black bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700"}`}>Q2:{s.q2 ?? 0}</span>
                                <span className={`px-1.5 py-0.5 rounded border shrink-0 ${s.q3 === 1 ? "text-emerald-800 dark:text-emerald-300 font-black bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700" : "text-rose-800 dark:text-rose-300 font-black bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700"}`}>Q3:{s.q3 ?? 0}</span>
                                <span className={`px-1.5 py-0.5 rounded border shrink-0 ${s.q4 === 1 ? "text-emerald-800 dark:text-emerald-300 font-black bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700" : "text-rose-800 dark:text-rose-300 font-black bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700"}`}>Q4:{s.q4 ?? 0}</span>
                              </div>
                            )}
                            {(() => {
                              const cDiff = getContestDifficultyBreakdown(s, true);
                              return (
                                <div className="flex flex-wrap items-center gap-1 mt-1 font-mono text-[10px] font-black">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Contest Easy: {cDiff.easy}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200">Med: {cDiff.medium}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200">Hard: {cDiff.hard}</span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="bg-slate-100 dark:bg-navy-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left xs:text-right min-w-0">
                            <span className="text-slate-900 dark:text-slate-100 text-[10px] uppercase font-black tracking-wider block mb-1">Rank & Rating</span>
                            <span className="font-black text-amber-700 dark:text-amber-400 text-xs block">
                              Rank: {formatRank(s.global_rank || s.rank || s.profile_rank || s.contest_global_ranking)}
                            </span>
                            <span className="font-mono text-slate-950 dark:text-white font-black text-[11px] block mt-0.5">
                              Rating: {formatRating(s.rating || s.contest_rating || s.stats?.contest_rating)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                  <table className="w-full text-left text-xs mobile-card-table min-w-[650px] sm:min-w-[950px] print:min-w-0 print:w-full">
                    <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 table-header-group print:table-header-group print:bg-slate-200 print:text-black">
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
                      {/* Mobile Card View (< sm) */}
                      <div className="block sm:hidden print:hidden space-y-2.5">
                        {report.department_summaries.filter((d: any) => (d.total_students || 0) > 0).map((d: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-200 dark:bg-navy-700 text-slate-950 dark:text-white">#{idx + 1}</span>
                                <h4 className="text-xs font-black text-brand-700 dark:text-brand-300">{d.department}</h4>
                              </div>
                              <span className="text-[11px] text-slate-800 dark:text-slate-200 font-black">Coord: {d.coordinator || '—'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Students:</span> <span className="font-black text-slate-950 dark:text-white">{d.total_students}</span> ({d.metrics?.verified} verified)</div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Total Solved:</span> <span className="font-black text-slate-950 dark:text-white">{d.metrics?.total_solved?.toLocaleString()}</span></div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Avg Solved:</span> <span className="font-mono font-black text-slate-950 dark:text-white">{d.metrics?.avg_solved}</span></div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Above 500:</span> <span className="font-black text-purple-700 dark:text-purple-300">{d.metrics?.above_500}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View (>= sm) */}
                      <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
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

                  {/* Batch Summaries */}
                  {report.batch_summaries && Array.isArray(report.batch_summaries) && report.batch_summaries.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Batch-wise Performance Summary</h3>
                      {/* Mobile Card View (< sm) */}
                      <div className="block sm:hidden print:hidden space-y-2.5">
                        {report.batch_summaries.filter((b: any) => (b.total_students || 0) > 0).map((b: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                              <h4 className="text-xs font-black text-brand-700 dark:text-brand-300">{b.batch} ({b.year})</h4>
                              <span className="text-xs font-black text-slate-950 dark:text-white">{b.total_students} Students</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Above 500:</span> <span className="font-black text-purple-700 dark:text-purple-300">{b.categories?.['Above 500'] ?? '—'}</span></div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">250–500:</span> <span className="font-black text-indigo-700 dark:text-indigo-300">{b.categories?.['250 - 500'] ?? '—'}</span></div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">Rating &gt; 1500:</span> <span className="font-black text-emerald-700 dark:text-emerald-300">{b.rating_1500 ?? '—'}</span></div>
                              <div><span className="text-slate-800 dark:text-slate-200 font-bold">4/4 Solvers:</span> <span className="font-black text-emerald-700 dark:text-emerald-300">{b.current_week?.q4 ?? '—'}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View (>= sm) */}
                      <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
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
                              <div key={idx} className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5 transition-all active:scale-[0.98] touch-manipulation">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-200 dark:bg-navy-700 text-slate-950 dark:text-white shrink-0">
                                      #{s.s_no || idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">{formatStudentName(s.name || s.student_name)}</h4>
                                      <p className="text-[11px] text-slate-800 dark:text-slate-200 font-black font-mono">{s.reg_no} • {s.dept} ({s.year})</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-black text-brand-700 dark:text-brand-300 block">{s.total_solved ?? '—'} Solved</span>
                                    <span className="text-[10px] text-slate-800 dark:text-slate-200 font-black block">{s.category || '—'}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] pt-0.5">
                                  <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase">Easy / Med / Hard</div>
                                    <div className="font-black text-emerald-800 dark:text-emerald-300">{s.easy ?? 0}/{s.medium ?? 0}/{s.hard ?? 0}</div>
                                  </div>
                                  <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <div className="text-[9px] font-black text-indigo-800 dark:text-indigo-300 uppercase">Curr Week</div>
                                    <div className="font-black text-indigo-800 dark:text-indigo-300">{formatOutcome(pubResult)}</div>
                                  </div>
                                  <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                    <div className="text-[9px] font-black text-purple-800 dark:text-purple-300 uppercase">Last Week</div>
                                    <div className="font-black text-purple-800 dark:text-purple-300">{formatOutcome(lastPubResult)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Table View (>= sm) */}
                        <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm max-h-[450px] overflow-y-auto">
                          <table className="w-full text-xs min-w-[1000px]">
                            <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10">
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
                      let icon = <Sparkles className="w-4 h-4" />;
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
                        icon = <Flame className="w-4 h-4" />;
                        lightGradient = 'from-amber-50/90 via-white to-orange-50/50';
                        darkGradient = 'dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950';
                        borderColor = 'border-amber-200/90 dark:border-amber-500/25 hover:border-amber-400 dark:hover:border-amber-500/50';
                        iconBox = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';
                        numColor = 'text-amber-950 dark:text-amber-300';
                        titleColor = 'text-amber-800 dark:text-amber-300';
                        chipLabel = 'Active';
                      } else if (k.includes('total_solved') || k.includes('totalsolved')) {
                        fKey = null;
                        icon = <Trophy className="w-4 h-4" />;
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
                        icon = <Zap className="w-4 h-4" />;
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
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {report.departmentSummary.map((d: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300">
                              #{idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-brand-700 dark:text-brand-300">{d.department}</h4>
                          </div>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{d.attendance_pct}% Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">Students:</span> <span className="font-bold text-slate-900 dark:text-white">{d.total}</span> (Active: {d.active_solvers})</div>
                          <div><span className="text-slate-500">Total Solved:</span> <span className="font-bold text-slate-900 dark:text-white">{d.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500">Avg Solved:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{d.avg_solved}</span></div>
                          <div><span className="text-slate-500">4/4 Solvers:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.solvers_4}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase table-header-group">
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
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {report.yearSummary.map((y: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{y.year}</h4>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{y.attendance_pct}% Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">Students:</span> <span className="font-bold text-slate-900 dark:text-white">{y.total}</span></div>
                          <div><span className="text-slate-500">Active Solvers:</span> <span className="font-bold text-slate-900 dark:text-white">{y.active_solvers}</span></div>
                          <div><span className="text-slate-500">Total Solved:</span> <span className="font-bold text-slate-900 dark:text-white">{y.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500">4/4 Solvers:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{y.solvers_4}</span></div>
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
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {(report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0).length > 0
                      ? report.cutoffBandSummary.filter((b: any) => (b.total || 0) > 0)
                      : report.cutoffBandSummary
                    ).map((b: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">{b.band}</h4>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{b.attendance_pct}% Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">Total Students:</span> <span className="font-bold text-slate-900 dark:text-white">{b.total}</span></div>
                          <div><span className="text-slate-500">Attended:</span> <span className="font-bold text-emerald-700 dark:text-emerald-400">{b.active_solvers}</span></div>
                          <div><span className="text-slate-500">Not Attended:</span> <span className="font-bold text-rose-600 dark:text-rose-400">{b.not_active}</span></div>
                          <div><span className="text-slate-500">Total Solved:</span> <span className="font-bold text-slate-900 dark:text-white">{b.total_solved?.toLocaleString()}</span></div>
                          <div className="col-span-2"><span className="text-slate-500">Avg Solved:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{b.avg_solved}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (Clean modern layout matching HOD & Year summaries) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase tracking-wider text-[10px]">
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
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {report.facultySummary.map((f: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300">
                              #{idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{f.staff_name}</h4>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{f.department}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">Assigned:</span> <span className="font-bold text-slate-900 dark:text-white">{f.total_assigned}</span> (Active: {f.active_solvers})</div>
                          <div><span className="text-slate-500">Active %:</span> <span className="font-bold text-brand-600 dark:text-brand-400">{f.active_pct}%</span></div>
                          <div><span className="text-slate-500">Total Solved:</span> <span className="font-bold text-slate-900 dark:text-white">{f.total_solved?.toLocaleString()}</span></div>
                          <div><span className="text-slate-500">Avg Solved:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{f.avg_solved}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase table-header-group">
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
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {(report.allStudents || report.rows || []).map((s: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {formatStudentName(s.name || s.student_name)}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {s.reg_no} • {s.dept} ({s.year})
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border block mb-1 ${
                              s.trajectory?.includes('IMPROVING') ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                              s.trajectory?.includes('STABLE') ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' :
                              s.trajectory?.includes('DECLINING') ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' :
                              'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}>
                              {s.trajectory || 'FOLLOW-UP'}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{s.total_solved ?? 0} Solved ({s.attendance_rate || '0%'})</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-navy-950 p-2 rounded-xl">
                          <span className="text-slate-500 font-medium">Contests 1–5:</span>
                          <div className="flex items-center space-x-2 font-mono font-black text-slate-900 dark:text-white">
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
                      <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 table-header-group">
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
                  {/* Mobile Card View (< sm) */}
                  <div className="block sm:hidden print:hidden space-y-2.5">
                    {report.topStudents.map((s: any, idx: number) => {
                      const r = s.rating ?? s.contest_rating ?? s.contestRating ?? s.stats?.contest_rating;
                      const formattedRating = (r !== null && r !== undefined && r !== '' && r !== '—' && !isNaN(Number(r)) && Number(r) > 0)
                        ? Math.round(Number(r)).toLocaleString()
                        : "—";
                      return (
                        <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {formatStudentName(s.name || s.student_name)}
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {s.reg_no} • {s.dept} ({deriveYearLevelFromRegNo(s.reg_no, s.year)})
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-brand-600 dark:text-brand-400 block">{s.total_solved ?? "—"} Solved</span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Rating: {formattedRating}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center text-[11px]">
                            <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                              <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Easy</div>
                              <div className="font-black text-emerald-700 dark:text-emerald-300">{s.easy ?? "—"}</div>
                            </div>
                            <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">Medium</div>
                              <div className="font-black text-amber-700 dark:text-amber-300">{s.medium ?? "—"}</div>
                            </div>
                            <div className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                              <div className="text-[9px] font-bold text-rose-700 dark:text-rose-400 uppercase">Hard</div>
                              <div className="font-black text-rose-700 dark:text-rose-300">{s.hard ?? "—"}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm">
                    <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[750px]">
                      <thead className="bg-[#16324F] text-white font-black uppercase table-header-group">
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
                      <div className="block sm:hidden print:hidden space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                        {displayedStudents.map((s: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-xs space-y-2">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {formatStudentName(s.name || s.student_name)}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {s.reg_no} • {s.dept} ({deriveYearLevelFromRegNo(s.reg_no, s.year)})
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full block text-center mb-1 ${s.status === 'VERIFIED' ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-300'}`}>
                                  {s.status}
                                </span>
                                <span className="text-xs font-black text-brand-600 dark:text-brand-400 block">{s.total_solved !== null ? s.total_solved : "—"} Solved</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center text-[11px]">
                              <div className="p-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Easy</div>
                                <div className="font-black text-emerald-700 dark:text-emerald-300">{s.easy ?? "—"}</div>
                              </div>
                              <div className="p-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">Medium</div>
                                <div className="font-black text-amber-700 dark:text-amber-300">{s.medium ?? "—"}</div>
                              </div>
                              <div className="p-1 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <div className="text-[9px] font-bold text-rose-700 dark:text-rose-400 uppercase">Hard</div>
                                <div className="font-black text-rose-700 dark:text-rose-300">{s.hard ?? "—"}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View (>= sm) */}
                      <div className="hidden sm:block print:block border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto table-responsive-container shadow-sm max-h-[450px] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
                        <table className="w-full text-left text-xs mobile-card-table min-w-[550px] sm:min-w-[800px] print:min-w-0 print:w-full">
                          <thead className="bg-[#16324F] text-white font-black uppercase sticky top-0 z-10 table-header-group print:table-header-group print:bg-slate-200 print:text-black">
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
          <div className="pt-4 space-y-4 print:break-inside-avoid print:mt-6">
            <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1427] border-2 border-slate-200/90 dark:border-white/10 shadow-xl space-y-5">
              {/* Header with Title, Report Type Scope & Badges */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-brand-500/25 border border-white/20">
                    <Target className="w-5 h-5 text-white" />
                  </div>
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
                      Aggregated solve condition cohorts, problem difficulty metrics &amp; attendance breakdown for table data above.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black text-slate-700 dark:text-slate-200">
                    <Users className="w-3.5 h-3.5 text-brand-500" />
                    <span>In Scope: {allRows.length} Students</span>
                  </span>
                  {activeFilter && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-black text-amber-700 dark:text-amber-300">
                      <Filter className="w-3.5 h-3.5 text-amber-500" />
                      <span>Filtered View: {conditionStats.totalStudents}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 1. Problem Solve Distribution Cohorts (4/4, 3/4, 2/4, 1/4, 0/4, Not Attended) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Contest / Weekly Solve Distribution Cohorts</span>
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
                      <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">4 Solved (4/4)</span>
                      <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">{conditionStats.s4}</p>
                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.s4 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
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
                      <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300">3 Solved (3/4)</span>
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-teal-800 dark:text-teal-300 tracking-tight my-1">{conditionStats.s3}</p>
                    <span className="text-[10px] font-black text-teal-800 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.s3 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
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
                      <span className="text-[10px] font-black uppercase text-brand-800 dark:text-brand-300">2 Solved (2/4)</span>
                      <Zap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-brand-800 dark:text-brand-300 tracking-tight my-1">{conditionStats.s2}</p>
                    <span className="text-[10px] font-black text-brand-800 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.s2 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
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
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">1 Solved (1/4)</span>
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">{conditionStats.s1}</p>
                    <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.s1 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
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
                      <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300">0 Solved (Attended)</span>
                      <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">{conditionStats.s0}</p>
                    <span className="text-[10px] font-black text-purple-800 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.s0 / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
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
                      <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300">Not Attended</span>
                      <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    </div>
                    <p className="text-2xl font-black text-rose-800 dark:text-rose-300 tracking-tight my-1">{conditionStats.notAttendedCount}</p>
                    <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full w-fit">
                      {conditionStats.totalStudents > 0 ? `${((conditionStats.notAttendedCount / conditionStats.totalStudents) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Problem Difficulty Solves Split (Easy / Medium / Hard / Total) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Difficulty Solve Distribution (Easy • Medium • Hard)</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Easy Solves */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">Easy Solves</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-1">
                      {conditionStats.totalEasy.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                      Foundational Solves
                    </span>
                  </div>

                  {/* Medium Solves */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">Medium Solves</span>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-1">
                      {conditionStats.totalMed.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                      Core Algorithmic Solves
                    </span>
                  </div>

                  {/* Hard Solves */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300">Hard Solves</span>
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-purple-800 dark:text-purple-300 tracking-tight my-1">
                      {conditionStats.totalHard.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-400">
                      High Difficulty Solves
                    </span>
                  </div>

                  {/* Total Cumulative Solves */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-brand-500/15 border border-brand-500/30 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-brand-800 dark:text-brand-300">Total Solves</span>
                      <Zap className="w-4 h-4 text-brand-500" />
                    </div>
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
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Evaluation Standards: 4/4 (100% Complete) • 3/4 (Advanced) • 2/4 (Intermediate) • 1/4 (Developing) • 0/4 (Participation)</span>
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

              {/* 4. Official Academic Coordinator Sign-Off Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/90 dark:border-white/10 shadow-xs">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/70 dark:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black text-sm shrink-0 border border-brand-500/20">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Institutional Coordinator Endorsement
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Official departmental record verification and performance appraisal sign-off
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                      Verified Record
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                      Ref: {report?.reportId ? String(report.reportId).slice(0, 8).toUpperCase() : 'INST-LEET'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Academic Coordinator / Faculty In-Charge
                    </span>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {report?.coordinator || report?.academicCoordinator || (report?.departmentResults && report.departmentResults[0]?.coordinator) || 'M. Santhoshkumar'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Department Coordinator / Authorized Reviewer
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Department / Batch Scope
                    </span>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {report?.department && report.department !== 'ALL' ? report.department : 'All Academic Departments'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Academic Year 2026–2027 • Standard LeetCode Track
                    </p>
                  </div>

                  <div className="space-y-1 md:text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Authorized Verification
                    </span>
                    <div className="pt-1 flex md:justify-end">
                      <div className="inline-block border-b-2 border-slate-300 dark:border-white/20 pb-1 w-44 text-center">
                        <span className="text-xs font-serif italic text-slate-700 dark:text-slate-300">Faculty Signatory</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                      {report?.generatedAt ? new Date(report.generatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 4. FOOTER / EXPORT ACTIONS */}
        <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-[#070D18]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-extrabold tracking-wide">Official Institutional Report Dataset</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-slate-200/80 text-slate-700 dark:bg-white/10 dark:text-slate-200 border border-slate-300/60 dark:border-white/10">
              {allRows.length} Records
            </span>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={() => window.print()}
              type="button"
              className="hidden sm:flex items-center justify-center space-x-1.5 px-3.5 py-2.5 min-h-[42px] bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 touch-manipulation border border-white/10"
              title="Print / Save as PDF from browser"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print View</span>
            </button>
            <button
              onClick={() => downloadFile('excel')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 min-h-[42px] bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-emerald-600/25 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 min-w-0 border border-emerald-400/30 touch-manipulation"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => downloadFile('pdf')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 min-h-[42px] bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-rose-600/25 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 min-w-0 border border-rose-400/30 touch-manipulation"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">PDF (.pdf)</span>
            </button>
            <button
              onClick={() => downloadFile('word')}
              type="button"
              disabled={isDownloading}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 min-h-[42px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-indigo-600/25 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 min-w-0 border border-indigo-400/30 touch-manipulation"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Word (.docx)</span>
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

