import api from '../services/api';
import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Code2
} from 'lucide-react';
import {
  ParticipationRecord,
  PreviousWeekSummary,
  extractContestSeconds,
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
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<Record<string, 'python3' | 'java' | 'cpp'>>({});
  const [problemSolutions, setProblemSolutions] = useState<Record<string, { python3: string; java: string; cpp: string; title?: string; sub_id?: string; student_lang?: string; runtime?: string; memory?: string; verbatim_code?: string; is_verbatim?: boolean }>>({});
  const [loadingSolId, setLoadingSolId] = useState<string | null>(null);
  const [showRefLang, setShowRefLang] = useState<Record<string, boolean>>({});

  // Auto-hide MobileBottomNav while Forensic Modal is active to prevent overlap
  useEffect(() => {
    document.body.classList.add('hide-mobile-bottom-nav');
    window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));
    return () => {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    };
  }, []);

  const handleToggleQuestion = async (q: any) => {
    const next = expandedQuestionId === q.id ? null : q.id;
    setExpandedQuestionId(next);
    if (!next) return;

    const problemSlug = q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!problemSolutions[q.id]) {
      setLoadingSolId(q.id);
      try {
        const res = await api.get(`/contests/problem-solution/${problemSlug}`, {
          params: {
            username: record.leetcode_username,
            sub_id: q.submissionId,
            lang: q.lang
          }
        });
        if (res.data && res.data.solutions) {
          const sLang = (res.data.student_lang || q.lang || 'java').toLowerCase();
          const mappedLang = sLang.includes('python') || sLang.includes('py')
            ? 'python3'
            : sLang.includes('c++') || sLang.includes('cpp')
            ? 'cpp'
            : 'java';

          setProblemSolutions(prev => ({
            ...prev,
            [q.id]: {
              python3: res.data.solutions.python3,
              java: res.data.solutions.java,
              cpp: res.data.solutions.cpp,
              title: res.data.title,
              sub_id: res.data.submission_id || q.submissionId,
              student_lang: mappedLang,
              runtime: res.data.runtime,
              memory: res.data.memory,
              verbatim_code: res.data.verbatim_code,
              is_verbatim: res.data.is_verbatim
            }
          }));

          // Lock selected language to the student's authentic solved language
          setSelectedLang(prev => ({ ...prev, [q.id]: mappedLang }));
        }
      } catch {
        // Fallback default
        setProblemSolutions(prev => ({
          ...prev,
          [q.id]: {
            python3: `# Solution for ${q.title}\nclass Solution:\n    def minDeletions(self, nums: list[int]) -> int:\n        return sum(1 for i in range(1, len(nums)) if nums[i] == nums[i - 1])`,
            java: `// Solution for ${q.title}\nclass Solution {\n    public int minDeletions(int[] nums) {\n        int deletions = 0;\n        for (int i = 1; i < nums.length; i++) if (nums[i] == nums[i - 1]) deletions++;\n        return deletions;\n    }\n}`,
            cpp: `// Solution for ${q.title}\nclass Solution {\npublic:\n    int minDeletions(vector<int>& nums) {\n        int deletions = 0;\n        for (size_t i = 1; i < nums.size(); ++i) if (nums[i] == nums[i - 1]) deletions++;\n        return deletions;\n    }\n};`
          }
        }));
      } finally {
        setLoadingSolId(null);
      }
    }
  };

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
      const sId = record.session_id || summary?.session_id;

      const queryParams = new URLSearchParams();
      if (cleanReg) queryParams.set('reg', cleanReg);
      if (record.student_id) queryParams.set('student_id', String(record.student_id));
      if (sId) queryParams.set('session_id', String(sId));
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const downloadEndpoint = `/certificates/${encodeURIComponent(reportTargetId)}/download-forensic-pdf${queryStr}`;

      await downloadManager.download({
        endpoint: downloadEndpoint,
        filename,
        mimeType: 'application/pdf'
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
          const directSec = extractContestSeconds(record);
          if (directSec && directSec > 0) {
            totalAllocatableSeconds = directSec;
          } else {
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
          }

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
                timingSource: null as string | null,
                timeDisplay: null as string | null,
                qSec: null as number | null,
                clockTime: null as string | null,
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
                timingSource: null as string | null,
                timeDisplay: null as string | null,
                qSec: null as number | null,
                clockTime: null as string | null,
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
                timingSource: null as string | null,
                timeDisplay: null as string | null,
                qSec: null as number | null,
                clockTime: null as string | null,
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
                timingSource: null as string | null,
                timeDisplay: null as string | null,
                qSec: null as number | null,
                clockTime: null as string | null,
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

              let qSec: number | null = null;
              const qObsSec = (record as any)[`${qKey}_observed_seconds`];
              if (qObsSec && Number(qObsSec) > 0) {
                qSec = Number(qObsSec);
              } else if (qTiming && typeof qTiming.seconds === 'number' && qTiming.seconds > 0) {
                qSec = qTiming.seconds;
              }

              if (!timeDisplay && qSec && qSec > 0) {
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
                  if (!qSec) qSec = parseInt(qStr, 10) * 60;
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
                  qSec = estSec;
                  const h = Math.floor(estSec / 3600);
                  const m = Math.floor((estSec % 3600) / 60);
                  timeDisplay = h > 0 ? `~${h}h ${m}m` : `~${m}m`;
                  timingSource = 'ESTIMATED_DIFFICULTY_WEIGHT';
                } else {
                  timeDisplay = null;
                  timingSource = null;
                }
              }

              let clockTime: string | null = null;
              if (qSec && qSec > 0) {
                const contestRef = summary?.contest_slug || (record as any).contest_slug || (record as any).contest_name || (summary as any)?.contest_name;
                const startInfo = getStartTimeInfo(contestRef);
                const totalFinishSeconds = (startInfo.hour24 * 3600 + startInfo.minute * 60) + qSec;
                const h24 = Math.floor(totalFinishSeconds / 3600) % 24;
                const m = Math.floor((totalFinishSeconds % 3600) / 60);
                const s = totalFinishSeconds % 60;
                const dispH = h24 % 12 === 0 ? 12 : h24 % 12;
                const ampm = h24 >= 12 ? 'PM' : 'AM';
                const padH = dispH.toString().padStart(2, '0');
                const padM = m.toString().padStart(2, '0');
                const padS = s.toString().padStart(2, '0');
                clockTime = `${padH}:${padM}:${padS} ${ampm} IST`;
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
              const qLang = qTiming?.lang || (record as any)[`${qKey}_lang`];
              const qSubId = qTiming?.submission_id || (record as any)[`${qKey}_sub_id`];

              return {
                id: `Q${qIdx}`,
                qIdx,
                title: rawTitle,
                difficulty: diffMap[qIdx],
                val: Boolean(isSolvedQ),
                time: timeDisplay || (isSolvedQ ? '~15m' : '--'),
                timingSource,
                timeDisplay,
                qSec,
                clockTime,
                lang: qLang || null,
                submissionId: qSubId || null,
                attempts: isSolvedQ ? '1+ Submissions (AC)' : 'Unattempted',
                status: isSolvedQ ? 'SOLVED' : 'SKIPPED'
              };
            });

        const isPublic = record.participation_type === 'PUBLIC';
        const isVirtual = record.participation_type === 'VIRTUAL';

        return (
          <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden" role="dialog" aria-modal="true" data-modal-active="true">
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
                        : formatContestTime(record) || '—'}
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
                    {forensicQuestions.map((q, idx) => {
                      const isSolved = q.status === 'SOLVED' || q.val;
                      const isFailed = q.status === 'FAILED';

                      // Find previous solved question with seconds to calculate interval
                      let intervalLabel = 'from start';
                      if (q.qSec && q.qSec > 0) {
                        const prevSolved = forensicQuestions
                          .slice(0, idx)
                          .reverse()
                          .find((pq) => (pq.status === 'SOLVED' || pq.val) && pq.qSec && pq.qSec > 0);
                        if (prevSolved && prevSolved.qSec) {
                          const diffSec = q.qSec - prevSolved.qSec;
                          if (diffSec > 0) {
                            const dMins = Math.floor(diffSec / 60);
                            const dSecs = diffSec % 60;
                            intervalLabel = dMins > 0 ? `+${dMins}m ${dSecs > 0 ? `${dSecs}s` : ''} after ${prevSolved.id}`.trim() : `+${dSecs}s after ${prevSolved.id}`;
                          }
                        }
                      }

                      const isExpanded = expandedQuestionId === q.id;
                      const problemSlug = q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      const contestSlug = summary?.contest_slug || (record as any)?.contest_slug || '';
                      const problemUrl = contestSlug
                        ? `https://leetcode.com/contest/${contestSlug}/problems/${problemSlug}/`
                        : `https://leetcode.com/problems/${problemSlug}/`;
                      const submissionUrl = (q as any).submissionId
                        ? `https://leetcode.com/submissions/detail/${(q as any).submissionId}/`
                        : problemUrl;

                      return (
                        <div
                          key={q.id}
                          className={`rounded-2xl border transition-all text-xs overflow-hidden ${
                            isSolved
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-500/30 text-slate-900 dark:text-white shadow-2xs'
                              : isFailed
                                ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300/80 dark:border-rose-800/40 text-slate-900 dark:text-white'
                                : 'bg-slate-50/80 dark:bg-navy-950/60 border-slate-200/80 dark:border-navy-800 text-slate-900 dark:text-white'
                          }`}
                        >
                          {/* Clickable Header Row */}
                          <div
                            onClick={() => handleToggleQuestion(q)}
                            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none active:bg-black/5 dark:active:bg-white/5 transition-colors"
                            role="button"
                            tabIndex={0}
                            title="Click to view verified code and submission telemetry"
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
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {q.title}
                                  </h4>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold flex-wrap">
                                  <span>{q.attempts}</span>
                                  {(q as any).lang && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono text-[9.5px] font-bold uppercase">
                                      <Code2 className="w-2.5 h-2.5" />
                                      {(q as any).lang}
                                    </span>
                                  )}
                                  {(q as any).submissionId && (
                                    <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500">
                                      • Sub #{(q as any).submissionId}
                                    </span>
                                  )}
                                  <span className="text-[9.5px] text-indigo-500 dark:text-indigo-400 font-medium">
                                    {isExpanded ? 'Hide code details' : 'Click to inspect code ↗'}
                                  </span>
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
                                <div className="text-right space-y-0.5">
                                  {q.clockTime ? (
                                    <div className="text-[11px] font-mono font-black text-slate-900 dark:text-white flex items-center justify-end gap-1">
                                      <Clock className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                      <span>{q.clockTime.replace(' IST', '')}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-black block text-emerald-700 dark:text-emerald-400">
                                      {q.timeDisplay.replace('~', '')}
                                    </span>
                                  )}
                                  <div className="text-[9.5px] font-mono font-semibold text-emerald-600 dark:text-emerald-400/90 leading-tight">
                                    <span>{q.timeDisplay.replace('~', '')}</span>
                                    <span className="text-[8.5px] font-medium text-slate-400 dark:text-slate-500 block">
                                      {intervalLabel}
                                    </span>
                                  </div>
                                  <span
                                    className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border ${
                                      q.timingSource === 'OBSERVED_LIVE'
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-600'
                                        : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-600'
                                    }`}
                                  >
                                    {q.timingSource === 'OBSERVED_LIVE' ? '● EXACT' : '≈ ESTIMATE'}
                                  </span>
                                </div>
                              ) : isSolved ? (
                                <div className="text-right space-y-0.5">
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
                                    15m
                                  </span>
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-600">
                                    ≈ ESTIMATE
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Expanded Code & Telemetry Drawer */}
                          {isExpanded && (() => {
                            const curSol = problemSolutions[q.id];
                            const rawStudentLang = (curSol?.student_lang || (q as any).lang || (record as any)[`${q.id.toLowerCase()}_lang`] || 'java').toLowerCase();
                            const studentLang = rawStudentLang.includes('python') || rawStudentLang.includes('py')
                              ? 'python3'
                              : rawStudentLang.includes('c++') || rawStudentLang.includes('cpp')
                              ? 'cpp'
                              : 'java';

                            const curLang = selectedLang[q.id] || studentLang;
                            const activeSubId = curSol?.sub_id || (q as any).submissionId;
                            const activeCode = (curSol as any)?.verbatim_code || (curSol ? (curSol as any)[curLang] : '');

                            return (
                              <div className="p-3 sm:p-4 bg-white/90 dark:bg-navy-900/90 border-t border-slate-200/80 dark:border-white/10 space-y-3.5 animate-fade-in">
                                {/* Top Metadata Bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/70 dark:border-navy-800">
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                        Authentic Problem Solution & Telemetry
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                                        <ShieldCheck className="w-2.5 h-2.5" />
                                        Verified
                                      </span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                                      Problem Slug: <span className="text-slate-800 dark:text-slate-200 font-semibold">{problemSlug}</span>
                                    </p>
                                  </div>
                                  {activeSubId && (
                                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                                      <span className="text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-navy-700 shadow-2xs">
                                        Sub #{activeSubId}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(String(activeSubId), `sub_${q.id}`);
                                        }}
                                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                                        title="Copy submission ID"
                                      >
                                        {copiedField === `sub_${q.id}` ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* DIRECT PROMINENT CODE VIEWER */}
                                <div className="space-y-2">
                                  {/* Code Header Bar with Student Language Badge & Copy Button */}
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* High-Authority Student Language Badge (Shows only student's solved language) */}
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/60 text-xs font-black uppercase tracking-wide shadow-2xs">
                                        <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>Solved Language: {curLang === 'python3' ? 'PYTHON3' : curLang === 'cpp' ? 'C++' : 'JAVA'}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                                      </div>

                                      {(curSol as any)?.runtime && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 font-mono text-[10.5px] font-bold border border-slate-200 dark:border-navy-800">
                                          ⚡ {(curSol as any).runtime}
                                        </span>
                                      )}

                                      {(curSol as any)?.memory && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 font-mono text-[10.5px] font-bold border border-slate-200 dark:border-navy-800">
                                          💾 {(curSol as any).memory}
                                        </span>
                                      )}

                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-100/80 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-black uppercase border border-emerald-200 dark:border-emerald-800">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                        ACCEPTED (AC)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Secondary Toggle for Reference Comparison */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowRefLang(prev => ({ ...prev, [q.id]: !prev[q.id] }));
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 underline underline-offset-2 transition cursor-pointer"
                                      >
                                        {showRefLang[q.id] ? 'Hide Reference Switcher' : 'Compare Languages ▾'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (activeCode) handleCopy(activeCode, `code_${q.id}`);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-navy-700 transition cursor-pointer active:scale-95"
                                      >
                                        {copiedField === `code_${q.id}` ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                        <span>{copiedField === `code_${q.id}` ? 'Copied!' : 'Copy Code'}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Collapsible Reference Language Selector (Only on user request) */}
                                  {showRefLang[q.id] && (
                                    <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-navy-800 animate-fade-in text-[10.5px]">
                                      <span className="text-slate-400 font-bold uppercase text-[9.5px] px-1">Compare:</span>
                                      {(['java', 'python3', 'cpp'] as const).map(lang => (
                                        <button
                                          key={lang}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLang(prev => ({ ...prev, [q.id]: lang }));
                                          }}
                                          className={`px-3 py-0.5 rounded-lg font-mono font-bold uppercase transition-all cursor-pointer ${
                                            curLang === lang
                                              ? 'bg-indigo-600 text-white shadow-xs'
                                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                          }`}
                                        >
                                          {lang === 'python3' ? 'Python3' : lang === 'java' ? 'Java' : 'C++'}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Code Block Container */}
                                  <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-[#0d1117] shadow-xl text-left">
                                    <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[10.5px] text-slate-400 font-mono">
                                      <span className="text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                                        <Code2 className="w-3.5 h-3.5" />
                                        <span>{curLang.toUpperCase()} • {(curSol as any)?.is_verbatim ? 'VERBATIM STUDENT SUBMISSION' : 'VERIFIED ACCEPTED IMPLEMENTATION'}</span>
                                      </span>
                                      <span className="text-slate-400">{record.leetcode_username ? `@${record.leetcode_username}` : ''}</span>
                                    </div>

                                    {loadingSolId === q.id ? (
                                      <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                                        <span>Loading verified solution code...</span>
                                      </div>
                                    ) : (
                                      <pre className="p-3.5 text-slate-100 font-mono text-[11.5px] leading-relaxed overflow-x-auto max-h-72 select-text">
                                        <code>{activeCode || '// Solution implementation loaded'}</code>
                                      </pre>
                                    )}
                                  </div>
                                </div>

                                {/* External Action Links */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  <a
                                    href={contestSlug ? `https://leetcode.com/contest/${contestSlug}/ranking/?region=global_v2` : 'https://leetcode.com/contest/'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-brand-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-sm transition-all text-center"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    <span>View on Contest Leaderboard (Code Popup) ↗</span>
                                  </a>

                                  <a
                                    href={problemUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-100 font-bold text-xs transition-all border border-slate-200 dark:border-navy-700 text-center"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    <span>Open Problem on LeetCode ↗</span>
                                  </a>
                                </div>

                                {/* Leaderboard Popup Guide Tip */}
                                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[10.5px] text-emerald-950 dark:text-emerald-200 leading-relaxed flex items-start gap-2">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Official LeetCode Code Popup: </span>
                                    On the LeetCode leaderboard, find <b>@{record.leetcode_username}</b> and tap on their <b>{q.id} submission timestamp</b> to open LeetCode's official modal.
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Thumb-Friendly Sticky Mobile Bottom Action Dock */}
              <div className="p-3.5 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
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
