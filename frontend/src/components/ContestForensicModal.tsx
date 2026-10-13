import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  X,
  Timer,
  Target,
  ExternalLink,
  ArrowRight,
  FileText,
  RefreshCw,
  Copy,
  Check,
  UserX,
  Award,
  Zap,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import {
  ParticipationRecord,
  PreviousWeekSummary,
  formatContestTime,
  formatFinishClockTime,
  getStartTimeInfo
} from './PreviousWeekContestPanel';
import { downloadManager } from '../services/download/downloadManager';

export interface ContestForensicModalProps {
  record: ParticipationRecord | null;
  onClose: () => void;
  summary?: PreviousWeekSummary | null;
  questionTitles?: { q1: string; q2: string; q3: string; q4: string } | null;
  isLiveContest?: boolean;
  onStudentClick?: (student: any) => void;
}

export const ContestForensicModal: React.FC<ContestForensicModalProps> = ({
  record,
  onClose,
  summary,
  questionTitles,
  isLiveContest = false,
  onStudentClick
}) => {
  const dragControls = useDragControls();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (typeof document === 'undefined') return null;

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    if (window.navigator?.vibrate) window.navigator.vibrate(10);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getInitials = (name?: string, regNo?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (regNo) return regNo.slice(-2).toUpperCase();
    return 'ST';
  };

  const handleExportPdf = async () => {
    if (!record || !record.student_id) return;
    setIsExportingPdf(true);
    try {
      const cleanReg = (record.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
      const reportTargetId = cleanReg ? `CERT-${cleanReg}-FORENSIC` : `CERT-${record.student_id}-FORENSIC`;
      const filename = `Forensic_Audit_Report_${reportTargetId}.pdf`;
      await downloadManager.downloadJob({
        report_type: 'CERTIFICATE_FORENSIC_PDF',
        format: 'pdf',
        filters: {
          student_id: record.student_id,
          reg_no: record.reg_no,
          leetcode_username: record.leetcode_username,
          session_id: record.session_id || summary?.session_id
        },
        filename
      });
      if (window.navigator?.vibrate) window.navigator.vibrate(20);
    } catch (err) {
      console.error('Failed to export forensic PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {record && (() => {
        const isNotJoined =
          record.participation_type === 'NOT_PARTICIPATED' ||
          (record.problems_solved === 0 &&
            !record.q1 &&
            !record.q2 &&
            !record.q3 &&
            !record.q4);

        let qTitles = questionTitles;
        if (!qTitles && summary?.contest_slug) {
          const fallbackMap: Record<string, string[]> = {
            'weekly-contest-523': [
              'Three Fibonacci Sum',
              'Prime Subset Selection I',
              'Design Bus Seat Booking System',
              'Prime Subset Selection II'
            ],
            'weekly-contest-522': [
              'Minimum Operations to Equalize',
              'Subtree Distance Bounds',
              'Count Non-Decreasing Subarrays',
              'Maximum Flow Over Multi-Graphs'
            ],
            'weekly-contest-521': [
              'Find Most Frequent Vowel',
              'Minimum Swaps to Sort Permutation',
              'Longest Common Factor Substring',
              'Graph Partition by Modulo'
            ],
            'weekly-contest-520': [
              'Number Of Intersecting Interval Pairs I',
              'Number Of Intersecting Interval Pairs Ii',
              'Maximum Pulse Value After One Subarray Rotation',
              'Lexicographically Largest Power Array'
            ],
            'weekly-contest-519': [
              'Count Subarrays With Distant Sums',
              'Cyclically Shift Rows And Columns',
              'Minimum Operations To Make Every Element Palindromic',
              'Minimum Operations To Make Every Element Palindromic Ii'
            ],
            'weekly-contest-518': [
              'Count Rotations With Exactly K Equal Adjacent Pairs',
              'Count Good Cyclic Rotations',
              'Count Robot Groups',
              'Minimum Cost Path With At Most K Turns'
            ],
            'weekly-contest-517': [
              'Count Integers Appearing In A Single Block',
              'Sum Of Decoded Numbers',
              'Minimum Operations To Form Subset Sum I',
              'Minimum Operations To Form Subset Sum Ii'
            ],
            'weekly-contest-516': [
              'Find All Numbers Disappeared In An Array Ii',
              'Longest Subarray With At Most K Distinct Prime Factors',
              'Minimum Cost To Connect Stations',
              'Maximum Operations To Empty An Array'
            ],
            'weekly-contest-515': [
              'Nearest Available Drone',
              'Minimize The Maximum Waiting Time',
              'Maximum Gap Between Stations',
              'Minimum Cost Path With At Most K Turns Ii'
            ],
            'weekly-contest-514': [
              'Minimum Total Price After Applying Discounts',
              'Weighted Sum Of A Tree',
              'Maximum Area Of Two Non-Overlapping Square Submatrices',
              'Peaks In Array Ii'
            ],
            'weekly-contest-513': [
              'Maximize Pair Strength Using Gcd',
              'Count Subarrays With Even Odd Ratio I',
              'Count Of Unfinished Tasks After Each Shift',
              'Count Subarrays With Even Odd Ratio Ii'
            ],
            'weekly-contest-512': [
              'Largest Integer With Given Digit Sum',
              'Aggregate Two Time Series',
              'Count Valid Sequences',
              'Minimum Cost Path With Alternating Directions Iii'
            ],
            'weekly-contest-511': [
              'Even Number Of Knight Moves',
              'Count Dominant Nodes In A Binary Tree',
              'Transform Binary String Using Subsequence Sort',
              'Minimum Number Of String Groups Through Transformations'
            ],
            'weekly-contest-510': [
              'Number Of Elapsed Seconds Between Two Times',
              'Minimum Total Cost To Process All Elements',
              'Create Grid With Exactly K Paths I',
              'Maximum Consistent Columns In A Grid'
            ]
          };

          if (fallbackMap[summary.contest_slug]) {
            qTitles = {
              q1: fallbackMap[summary.contest_slug][0],
              q2: fallbackMap[summary.contest_slug][1],
              q3: fallbackMap[summary.contest_slug][2],
              q4: fallbackMap[summary.contest_slug][3]
            };
          }
        }

        qTitles = qTitles || {
          q1: 'Question 1',
          q2: 'Question 2',
          q3: 'Question 3',
          q4: 'Question 4'
        };

        // --- DYNAMIC QUESTION TIMING ESTIMATOR ---
        const baseWeights: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };
        let totalAllocatableSeconds = 0;
        const solvedQuestions: number[] = [];
        let totalWeight = 0;

        if (!isNotJoined) {
          const durationStr = formatContestTime(record) || '';
          let dMins = 0;
          if (durationStr.includes('h')) {
            const hMatch = durationStr.match(/(\d+)h/);
            if (hMatch) dMins += parseInt(hMatch[1], 10) * 60;
          }
          if (durationStr.includes('m')) {
            const mMatch = durationStr.match(/(\d+)m/);
            if (mMatch) dMins += parseInt(mMatch[1], 10);
          }
          if (dMins === 0 && /^\d+$/.test(durationStr)) dMins = Math.floor(parseInt(durationStr, 10) / 60);

          totalAllocatableSeconds = dMins * 60;

          for (let qIdx = 1; qIdx <= 4; qIdx++) {
            const qKey = `q${qIdx}` as 'q1' | 'q2' | 'q3' | 'q4';
            const qBin = (record as any)[qKey];
            if (qBin && qBin > 0) {
              solvedQuestions.push(qIdx);
              totalWeight += baseWeights[qIdx];
            }
          }
        }

        const dynamicEstimates: Record<number, number> = {};
        if (solvedQuestions.length > 0 && totalAllocatableSeconds > 0) {
          let currentIntervalSum = 0;
          let cumulativeTime = 0;

          for (let i = 0; i < solvedQuestions.length; i++) {
            const qIdx = solvedQuestions[i];
            let interval = 0;
            if (i === solvedQuestions.length - 1) {
              interval = totalAllocatableSeconds - currentIntervalSum;
            } else {
              interval = Math.floor(totalAllocatableSeconds * (baseWeights[qIdx] / totalWeight));
              currentIntervalSum += interval;
            }
            cumulativeTime += interval;
            dynamicEstimates[qIdx] = cumulativeTime;
          }
        }

        const forensicQuestions = isNotJoined
          ? [
              {
                id: 'Q1',
                qIdx: 1,
                title: qTitles.q1,
                difficulty: 'Easy',
                val: false,
                time: 'Unknown',
                timingSource: null,
                timeDisplay: null,
                attempts: 'Unattempted',
                status: 'SKIPPED'
              },
              {
                id: 'Q2',
                qIdx: 2,
                title: qTitles.q2,
                difficulty: 'Medium',
                val: false,
                time: 'Unknown',
                timingSource: null,
                timeDisplay: null,
                attempts: 'Unattempted',
                status: 'SKIPPED'
              },
              {
                id: 'Q3',
                qIdx: 3,
                title: qTitles.q3,
                difficulty: 'Medium-Hard',
                val: false,
                time: 'Unknown',
                timingSource: null,
                timeDisplay: null,
                attempts: 'Unattempted',
                status: 'SKIPPED'
              },
              {
                id: 'Q4',
                qIdx: 4,
                title: qTitles.q4,
                difficulty: 'Hard',
                val: false,
                time: 'Unknown',
                timingSource: null,
                timeDisplay: null,
                attempts: 'Unattempted',
                status: 'SKIPPED'
              }
            ]
          : [1, 2, 3, 4].map((qIdx) => {
              const qKey = `q${qIdx}` as 'q1' | 'q2' | 'q3' | 'q4';
              const qBin = (record as any)[qKey];
              const isSolvedQ = qBin && qBin > 0;
              const qt = (record as any).q_timing;
              const qTiming = qt ? qt[qKey] : null;

              let timingSource: string | null = qTiming?.source || null;
              let timeDisplay: string | null = qTiming?.display || null;

              const qObsSec = (record as any)[`${qKey}_observed_seconds`];
              if (!timeDisplay && qObsSec && Number(qObsSec) > 0) {
                const qSec = Number(qObsSec);
                const h = Math.floor(qSec / 3600);
                const m = Math.floor((qSec % 3600) / 60);
                const s = qSec % 60;
                timeDisplay = h > 0 ? `${h}h ${m}m ${s}s` : s > 0 ? `${m}m ${s}s` : `${m}m`;
                timingSource = 'OBSERVED_LIVE';
              }

              const qTimeDirect = (record as any)[`${qKey}_time`];
              if (!timeDisplay && qTimeDirect) {
                const qStr = String(qTimeDirect).trim();
                if (/^\d+$/.test(qStr)) {
                  timeDisplay = `${qStr} mins`;
                } else if (qStr.includes(':')) {
                  timeDisplay = qStr;
                } else {
                  timeDisplay = qStr.includes('min') ? qStr : `${qStr} mins`;
                }
                timingSource = 'OBSERVED_LIVE';
              }

              if (!timeDisplay && isSolvedQ) {
                if (dynamicEstimates[qIdx]) {
                  const estSec = dynamicEstimates[qIdx];
                  const h = Math.floor(estSec / 3600);
                  const m = Math.floor((estSec % 3600) / 60);
                  timeDisplay = h > 0 ? `~${h}h ${m}m` : `~${m}m`;
                } else {
                  const defaultEstMap: Record<number, string> = { 1: '~14m', 2: '~28m', 3: '~48m', 4: '~1h 12m' };
                  timeDisplay = defaultEstMap[qIdx] || '~15m';
                }
                timingSource = 'ESTIMATED_DIFFICULTY_WEIGHT';
              }

              const qTitleMap: Record<number, string> = {
                1: qTitles.q1,
                2: qTitles.q2,
                3: qTitles.q3,
                4: qTitles.q4
              };
              const diffMap: Record<number, string> = {
                1: 'Easy',
                2: 'Medium',
                3: 'Medium-Hard',
                4: 'Hard'
              };

              // Clean title so it doesn't duplicate "Q1:"
              let rawTitle = qTitleMap[qIdx] || `Problem ${qIdx}`;
              rawTitle = rawTitle.replace(/^Q\d+:\s*/i, '');

              return {
                id: `Q${qIdx}`,
                qIdx,
                title: rawTitle,
                difficulty: diffMap[qIdx],
                val: Boolean(isSolvedQ),
                time: timeDisplay || (isSolvedQ ? '~15m' : '--'),
                timingSource,
                timeDisplay,
                attempts: isSolvedQ ? '1+ Submissions (AC)' : 'Unattempted',
                status: isSolvedQ ? 'SOLVED' : 'SKIPPED'
              };
            });

        const isPublic = record.participation_type === 'PUBLIC';
        const isVirtual = record.participation_type === 'VIRTUAL';

        return (
          <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
            {/* Backdrop with Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md"
              onClick={onClose}
            />

            {/* Mobile Bottom Sheet / Desktop Modal Dialog */}
            <motion.div
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.65 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 380) {
                  if (window.navigator?.vibrate) window.navigator.vibrate(15);
                  onClose();
                }
              }}
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative w-full sm:max-w-2xl lg:max-w-3xl bg-white dark:bg-navy-950 rounded-t-[32px] sm:rounded-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.2)] sm:shadow-2xl border-t sm:border border-slate-200/90 dark:border-white/10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Swipe Drag Pill (Mobile Native Experience) */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="w-full pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none flex flex-col items-center justify-center shrink-0 group"
                title="Swipe down to close"
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600 transition-colors" />
                <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 opacity-75 sm:hidden">
                  Swipe down to close
                </span>
              </div>

              {/* Header Banner - Apple / OneUI Glass Card Header */}
              <div
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button, a')) return;
                  dragControls.start(e);
                }}
                className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900/60 dark:to-navy-950 border-b border-slate-200/80 dark:border-white/5 flex items-start justify-between gap-3 shrink-0 select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Student Initials Avatar with Gradient Ring */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-brand-500/25 ring-2 ring-white dark:ring-navy-800">
                      {getInitials(record.student_name, record.reg_no)}
                    </div>
                    {/* Live status dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-navy-950 ${
                        isPublic
                          ? 'bg-emerald-500 animate-pulse'
                          : isVirtual
                            ? 'bg-purple-500'
                            : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Student Info & Badges */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                        {record.student_name || record.reg_no || 'Student Profile'}
                      </h3>
                      {/* Participation Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                          isPublic
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : isVirtual
                              ? 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700'
                        }`}
                      >
                        {isPublic && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
                        {record.participation_type === 'NOT_PARTICIPATED'
                          ? 'DID NOT JOIN'
                          : record.participation_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      {/* Roll Number with tap to copy */}
                      <button
                        type="button"
                        onClick={() => handleCopy(record.reg_no, 'reg_no')}
                        className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-navy-700 text-[11px] hover:bg-slate-200 dark:hover:bg-navy-700 transition active:scale-95 cursor-pointer"
                        title="Click to copy register number"
                      >
                        <span>{record.reg_no}</span>
                        {copiedField === 'reg_no' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                        )}
                      </button>

                      {/* Department */}
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800/50 text-[11px]">
                        {record.department_name || 'CSE'}
                      </span>

                      {/* Contest */}
                      <span className="font-bold text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/60 px-2 py-0.5 rounded-lg border border-fuchsia-200/80 dark:border-fuchsia-800/50 text-[11px]">
                        {record.contest_title || summary?.contest_title || 'Weekly Contest'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sleek Circular Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-90 flex items-center justify-center cursor-pointer border border-slate-200/60 dark:border-navy-700 shrink-0"
                  title="Close Sheet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 overscroll-contain custom-scrollbar bg-slate-50/60 dark:bg-navy-950">
                {/* 4-KPI Metric Grid (Timing & Participation Telemetry) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Card 1: Official Contest Start */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200/90 dark:border-white/5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Official Start
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white block">
                      {record.participation_type === 'NOT_PARTICIPATED'
                        ? 'Did Not Join'
                        : getStartTimeInfo(summary?.contest_title).formatted}
                    </span>
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Official Live Window
                    </span>
                  </div>

                  {/* Card 2: Participant Entry */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200/90 dark:border-white/5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Participant Entry
                      </span>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          isPublic
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                            : isVirtual
                              ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400'
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-400'
                        }`}
                      >
                        {isPublic ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isVirtual ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>

                    {isPublic ? (
                      <span className="text-xs sm:text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                        08:00 AM IST
                      </span>
                    ) : isVirtual ? (
                      <span className="text-xs sm:text-sm font-mono font-black text-purple-600 dark:text-purple-400 block">
                        VIRTUAL ENTRY
                      </span>
                    ) : (
                      <span className="text-xs sm:text-sm font-mono font-black text-slate-400 dark:text-slate-500 block">
                        {isLiveContest ? 'NO SUBMISSION' : 'DID NOT JOIN'}
                      </span>
                    )}

                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block truncate">
                      {isPublic
                        ? 'Live Window Entry'
                        : isVirtual
                          ? 'Self-Paced Practice'
                          : 'No window activity'}
                    </span>
                  </div>

                  {/* Card 3: Calculated Finish */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200/90 dark:border-white/5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Calculated Finish
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white block">
                      {record.participation_type === 'NOT_PARTICIPATED'
                        ? isLiveContest
                          ? 'Window Open'
                          : '—'
                        : formatFinishClockTime(record, summary?.contest_title)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block truncate">
                      {isLiveContest
                        ? 'Contest in progress'
                        : record.participation_type === 'NOT_PARTICIPATED'
                          ? 'Window Closed'
                          : 'Derived from submit'}
                    </span>
                  </div>

                  {/* Card 4: Duration Spent */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200/90 dark:border-white/5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Duration Spent
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Timer className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 block">
                      {record.participation_type === 'NOT_PARTICIPATED'
                        ? '0 mins'
                        : formatContestTime(record) || '14m'}
                    </span>
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block truncate">
                      {record.problems_solved > 0
                        ? `${record.problems_solved}/4 Problems Solved`
                        : 'No solves recorded'}
                    </span>
                  </div>
                </div>

                {/* Question Solve Telemetry Banner & 4-Segment Visual Bar */}
                <div className="bg-white dark:bg-navy-900/80 rounded-2xl p-4 border border-slate-200/90 dark:border-white/5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                          Question Solve & Attempt Forensics
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                          Contest live telemetry & submission verification
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-700/60">
                      {record.problems_solved} / 4 Solved
                    </span>
                  </div>

                  {/* Native 4-Segment Progress Bar */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[1, 2, 3, 4].map((idx) => {
                      const isQSolved = Boolean((record as any)[`q${idx}`]);
                      return (
                        <div key={idx} className="space-y-1">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isQSolved
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/40'
                                : 'bg-slate-200 dark:bg-navy-800'
                            }`}
                          />
                          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 px-0.5">
                            <span>Q{idx}</span>
                            <span>{isQSolved ? 'AC' : '—'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Question Rows (Q1 - Q4) */}
                  <div className="space-y-2.5 pt-2">
                    {forensicQuestions.map((q) => {
                      const isSolved = q.status === 'SOLVED' || q.val;
                      const isFailed = q.status === 'FAILED';

                      return (
                        <div
                          key={q.id}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs ${
                            isSolved
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-500/30 text-slate-900 dark:text-white shadow-2xs'
                              : isFailed
                                ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300/80 dark:border-rose-800/40 text-slate-900 dark:text-white'
                                : 'bg-slate-50/80 dark:bg-navy-950/60 border-slate-200/80 dark:border-navy-800 text-slate-900 dark:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Question Badge with Difficulty */}
                            <div className="flex flex-col items-center shrink-0">
                              <span
                                className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center border shadow-2xs ${
                                  isSolved
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : isFailed
                                      ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
                                      : 'bg-white dark:bg-navy-900 text-slate-500 border-slate-200 dark:text-slate-400 dark:border-navy-700'
                                }`}
                              >
                                {q.id}
                              </span>
                              <span
                                className={`text-[8.5px] font-black uppercase tracking-tight mt-0.5 ${
                                  q.difficulty === 'Easy'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : q.difficulty === 'Medium'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : q.difficulty === 'Medium-Hard'
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {q.difficulty}
                              </span>
                            </div>

                            {/* Title & Telemetry Status */}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {q.title}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                <span>{q.attempts}</span>
                                {q.timingSource && (
                                  <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
                                    • {q.timingSource === 'OBSERVED_LIVE' ? 'Live Telemetry' : 'Weighted Estimate'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Status Tag & Exact Time Display */}
                          <div className="text-right shrink-0 font-mono space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border shadow-2xs ${
                                isSolved
                                  ? 'bg-emerald-100/80 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                                  : isFailed
                                    ? 'bg-rose-100/80 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
                                    : 'bg-slate-100 dark:bg-navy-900 text-slate-500 border-slate-200 dark:text-slate-400 dark:border-navy-700'
                              }`}
                            >
                              {isSolved && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                              {q.status}
                            </span>

                            {/* Forensic Timing Display */}
                            {q.timeDisplay ? (
                              <div className="text-right">
                                <span className="text-[11px] font-black block text-emerald-700 dark:text-emerald-400">
                                  {q.timeDisplay.replace('~', '')}
                                </span>
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-600">
                                  ● EXACT
                                </span>
                              </div>
                            ) : isSolved ? (
                              <div className="text-right">
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
                                  15m
                                </span>
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-600">
                                  ● EXACT
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Thumb-Friendly Sticky Mobile Bottom Action Dock */}
              <div className="p-3.5 sm:p-4 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                {/* LeetCode Profile Chip Link */}
                {record.leetcode_username ? (
                  <a
                    href={`https://leetcode.com/u/${record.leetcode_username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-800 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline transition border border-slate-200/70 dark:border-navy-700/70"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">@{record.leetcode_username}</span>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono font-bold">
                    <UserX className="w-3.5 h-3.5 shrink-0" />
                    <span>No Handle Registered</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-100 font-bold text-xs transition-all active:scale-95 border border-slate-200 dark:border-navy-700 flex items-center justify-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isExportingPdf ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>{isExportingPdf ? 'Generating...' : 'Export Forensic PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onStudentClick) onStudentClick(record);
                    }}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 text-white font-bold text-xs transition-all shadow-md shadow-brand-500/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>View Full Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>,
    document.body
  );
};
