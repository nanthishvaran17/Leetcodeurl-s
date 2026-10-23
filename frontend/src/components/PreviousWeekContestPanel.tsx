import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { useDebounce } from '../hooks/useDebounce';
import { triggerHaptic } from '../utils/haptics';
import { 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  Award, 
  UserX, 
  HelpCircle, 
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  Clock,
  Building2,
  GraduationCap,
  ChevronDown,
  Check,
  Activity,
  Timer,
  Target,
  ExternalLink,
  ArrowRight,
  FileText,
  Calendar,
  X,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';
import api from '../services/api';
import { useContestWebSocket } from '../hooks/useContestWebSocket';
import { fetchWithCacheDedupe, getCachedContestData } from '../services/contestCache';
import { useAuth } from '../context/AuthContext';
import { downloadManager } from '../services/download/downloadManager';
import { ContestForensicModal } from './ContestForensicModal';

export interface PreviousWeekSummary {
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
  metrics?: {
    PUBLIC: number;
    VIRTUAL: number;
    NOT_PARTICIPATED: number;
    NOT_VERIFIED: number;
    MISSING_LEETCODE_USERNAME: number;
    TOTAL_STUDENTS: number;
  };
}

export interface ParticipationRecord {
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
  recently_updated?: boolean;
  _clean_reg?: string;
}

interface PreviousWeekContestPanelProps {
  onStudentClick?: (student: any) => void;
  sessionId?: number | null;
}

export const formatContestTime = (r: ParticipationRecord) => {
  const val = r.finish_time;
  
  if (val) {
    const strVal = String(val).trim();
    
    // If numeric seconds (e.g. "2520")
    if (/^\d+$/.test(strVal)) {
      const totalSec = parseInt(strVal, 10);
      if (totalSec > 0) {
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) {
          return `${hrs}h ${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
        }
        return `${mins}m ${secs}s`;
      }
    }

    // If HH:MM:SS format e.g. "00:42:15" or "1:15:30"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(strVal)) {
      const parts = strVal.split(':').map(Number);
      if (parts.length === 3) {
        const [h, m, s] = parts;
        if (h > 0) return `${h}h ${m}m ${s > 0 ? `${s}s` : ''}`.trim();
        return `${m}m ${s}s`;
      } else if (parts.length === 2) {
        const [m, s] = parts;
        return `${m}m ${s}s`;
      }
    }

    return strVal;
  }

  // Also check if any q_observed_seconds exist on the record
  const observedSecs = [
    (r as any).q1_observed_seconds,
    (r as any).q2_observed_seconds,
    (r as any).q3_observed_seconds,
    (r as any).q4_observed_seconds
  ].filter(s => typeof s === 'number' && s > 0);

  if (observedSecs.length > 0) {
    const maxSec = Math.max(...observedSecs);
    const hrs = Math.floor(maxSec / 3600);
    const mins = Math.floor((maxSec % 3600) / 60);
    const secs = maxSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
    }
    return `${mins}m ${secs}s`;
  }

  // True honest state: If genuine timing telemetry is not recorded yet, return '—' (no fake static 14m/28m)
  return '—';
};

export const getStartTimeInfo = (contestTitle?: string) => {
  const title = contestTitle?.toLowerCase() || '';
  const isBiweekly = title.includes('biweekly');
  const startHour = isBiweekly ? 20 : 8; // 8 PM for Biweekly, 8 AM for Weekly
  const startMinute = 0;
  
  const displayHour = startHour > 12 ? startHour - 12 : startHour;
  const ampm = startHour >= 12 ? 'PM' : 'AM';
  const padHour = displayHour.toString().padStart(2, '0');
  const padMinute = startMinute.toString().padStart(2, '0');
  
  return {
    hour24: startHour,
    minute: startMinute,
    formatted: `${padHour}:${padMinute} ${ampm} IST`
  };
};

export const normalizeYear = (val: string | null | undefined, regNo?: string | null): string => {
  if (val) {
    const s = String(val).toUpperCase().replace(/YEAR/gi, '').trim();
    if (s === '1' || s === 'I' || s === '1ST' || s === 'FIRST') return 'I';
    if (s === '2' || s === 'II' || s === '2ND' || s === 'SECOND') return 'II';
    if (s === '3' || s === 'III' || s === '3RD' || s === 'THIRD') return 'III';
    if (s === '4' || s === 'IV' || s === '4TH' || s === 'FOURTH' || s === 'FINAL') return 'IV';
  }
  if (regNo) {
    const r = String(regNo).toUpperCase().trim();
    if (r.includes('732225') || r.includes('73225') || r.startsWith('25') || r.includes('25CC') || r.includes('25CI') || r.includes('25CS') || r.includes('25IT')) return 'II';
    if (r.includes('732224') || r.startsWith('24') || r.includes('24CC') || r.includes('24CI') || r.includes('24CS') || r.includes('24IT')) return 'III';
    if (r.includes('732223') || r.startsWith('23') || r.includes('23CC') || r.includes('23CI') || r.includes('23CS') || r.includes('23IT')) return 'IV';
    if (r.includes('732226') || r.startsWith('26') || r.includes('26CC') || r.includes('26CI') || r.includes('26CS') || r.includes('26IT')) return 'I';
  }
  return '';
};

export const formatFinishClockTime = (r: ParticipationRecord, contestTitle?: string): string => {
  if (r.participation_type === 'NOT_PARTICIPATED') return '—';

  const durationStr = formatContestTime(r);
  if (!durationStr || durationStr === '—') return '—';

  let durationMins = 0;
  if (durationStr.includes('h')) {
    const hMatch = durationStr.match(/(\d+)h/);
    if (hMatch) durationMins += parseInt(hMatch[1], 10) * 60;
  }
  if (durationStr.includes('m')) {
    const mMatch = durationStr.match(/(\d+)m/);
    if (mMatch) durationMins += parseInt(mMatch[1], 10);
  }
  if (durationMins === 0 && /^\d+$/.test(durationStr)) {
    durationMins = Math.floor(parseInt(durationStr, 10) / 60);
  }
  if (durationMins === 0) {
    return '—';
  }

  const startInfo = getStartTimeInfo(contestTitle);
  const totalFinishMinutes = (startInfo.hour24 * 60 + startInfo.minute) + durationMins;

  const finishHour24 = Math.floor(totalFinishMinutes / 60);
  const finishMinute = totalFinishMinutes % 60;

  const displayHour = finishHour24 > 12 ? finishHour24 - 12 : finishHour24;
  const ampm = (finishHour24 % 24) >= 12 ? 'PM' : 'AM';
  const padMinute = finishMinute.toString().padStart(2, '0');
  
  // Handle 12 AM / 12 PM display properly
  let displayHourAdj = displayHour;
  if (displayHourAdj === 0) displayHourAdj = 12;
  const padHour = displayHourAdj.toString().padStart(2, '0');

  return `${padHour}:${padMinute} ${ampm} IST`;
};

export const PreviousWeekContestPanel: React.FC<PreviousWeekContestPanelProps> = ({ onStudentClick, sessionId }) => {
  const { user } = useAuth();
  const isFacultyRole = useMemo(() => {
    const role = (user?.role || '').trim().toLowerCase();
    return ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(role);
  }, [user?.role]);

  const userScope = useMemo(() => {
    if (isFacultyRole) return `faculty_${user?.id || 'staff'}`;
    return 'public';
  }, [isFacultyRole, user?.id]);

  const [summary, setSummary] = useState<PreviousWeekSummary | null>(null);

  const isLiveContest = useMemo(() => {
    if (summary?.validation_status === 'LIVE' || summary?.publish_status === 'LIVE') return true;
    try {
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const istMs = utcMs + (5.5 * 60 * 60 * 1000);
      const istDate = new Date(istMs);
      const day = istDate.getDay(); // 0 = Sunday
      const hours = istDate.getHours();
      const mins = istDate.getMinutes();
      const timeInMins = hours * 60 + mins;
      return day === 0 && timeInMins >= 480 && timeInMins <= 570; // 08:00 to 09:30 IST
    } catch {
      return false;
    }
  }, [summary?.validation_status, summary?.publish_status]);
  const [records, setRecords] = useState<ParticipationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [questionTitles, setQuestionTitles] = useState<{q1: string, q2: string, q3: string, q4: string} | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState<boolean>(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [yearDropdownOpen, setYearDropdownOpen] = useState<boolean>(false);
  const [deptSearchText, setDeptSearchText] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useScrollLock(isMobile && (deptDropdownOpen || yearDropdownOpen));

  useEffect(() => {
    if (!deptDropdownOpen) setDeptSearchText('');
  }, [deptDropdownOpen]);

  const [simulatingStudentId, setSimulatingStudentId] = useState<number | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 25);
  const [selectedForensicRecord, setSelectedForensicRecord] = useState<ParticipationRecord | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedTypeFilter, selectedDeptFilter, selectedYearFilter]);

  // Handle Escape key & body scroll lock/unlock for forensic modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedForensicRecord) {
        setSelectedForensicRecord(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (selectedForensicRecord) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedForensicRecord]);

  // Hook up live websocket updates in a batched way
  const { status: wsStatus, lastSyncAt, latestUpdate: wsLatestUpdate } = useContestWebSocket({
    sessionId: sessionId || null,
    onBatchUpdate: (events: any[]) => {
      setRecords(prev => {
        let changed = false;
        const updated = [...prev];
        
        const byStudentId = new Map<number, number>();
        const byRegNo = new Map<string, number>();
        const byUsername = new Map<string, number>();
        
        for (let i = 0; i < updated.length; i++) {
          const r = updated[i];
          if (r.student_id != null) byStudentId.set(r.student_id, i);
          if (r.reg_no) byRegNo.set(r.reg_no.toLowerCase(), i);
          if (r.leetcode_username) byUsername.set(r.leetcode_username.toLowerCase(), i);
        }

        for (const event of events) {
          if (!event) continue;
          
          let idx = -1;
          if (event.studentId != null && byStudentId.has(event.studentId)) idx = byStudentId.get(event.studentId)!;
          else if (event.regNo && byRegNo.has(event.regNo.toLowerCase())) idx = byRegNo.get(event.regNo.toLowerCase())!;
          else if (event.username && byUsername.has(event.username.toLowerCase())) idx = byUsername.get(event.username.toLowerCase())!;
          
          if (idx === -1) continue;
          
          changed = true;
          const newPType = event.participationStatus;
          const currentRec = updated[idx];
          const newSolved = event.solvedCount ?? currentRec.problems_solved;

          updated[idx] = {
            ...currentRec,
            participation_type: newPType ? (
              (newPType === 'PUBLIC_ATTENDED' || newPType === 'PUBLIC') ? 'PUBLIC'
              : (newPType === 'VIRTUAL_ATTENDED' || newPType === 'VIRTUAL') ? 'VIRTUAL'
              : (newPType === 'NOT_ATTENDED' || newPType === 'PUBLIC_NOT_ATTENDED') ? 'NOT_PARTICIPATED'
              : (newPType === 'PENDING') ? 'NOT_VERIFIED'
              : (newPType === 'UNKNOWN' || newPType === 'USERNAME_NOT_FOUND' || newPType === 'DATA_ERROR' || newPType === 'SOURCE_ERROR') ? 'MISSING_LEETCODE_USERNAME'
              : newPType
            ) : (newSolved > 0 && currentRec.participation_type === 'NOT_PARTICIPATED' ? 'PUBLIC' : currentRec.participation_type),
            q1: event.q1 ?? currentRec.q1,
            q2: event.q2 ?? currentRec.q2,
            q3: event.q3 ?? currentRec.q3,
            q4: event.q4 ?? currentRec.q4,
            problems_solved: newSolved,
            official_rank: event.officialRank ?? currentRec.official_rank,
            recently_updated: true,
          };
        }
        
        return changed ? updated : prev;
      });
    },
    onSyncCompleted: () => {
      // Background silent refresh when a full sync cycle finishes
      fetchPreviousWeekData(false, true);
    }
  });

  // Real-time incremental update for individual student events
  useEffect(() => {
    if (!wsLatestUpdate) return;
    const evt = wsLatestUpdate;
    setRecords(prev => {
      const updated = [...prev];
      let idx = evt.student_id != null ? updated.findIndex(r => r.student_id === evt.student_id) : -1;
      if (idx === -1 && evt.people_id) idx = updated.findIndex(r => r.reg_no && r.reg_no.toLowerCase() === evt.people_id.toLowerCase());
      if (idx === -1 && evt.reg_no) idx = updated.findIndex(r => r.reg_no && r.reg_no.toLowerCase() === evt.reg_no.toLowerCase());
      if (idx === -1 && evt.account_id) idx = updated.findIndex(r => (r.leetcode_username || '').toLowerCase() === evt.account_id.toLowerCase());

      if (idx !== -1) {
        const old = updated[idx];
        const solved = evt.activity?.count ?? old.problems_solved;
        updated[idx] = {
          ...old,
          q1: evt.activity?.q1 ?? old.q1,
          q2: evt.activity?.q2 ?? old.q2,
          q3: evt.activity?.q3 ?? old.q3,
          q4: evt.activity?.q4 ?? old.q4,
          problems_solved: solved,
          participation_type: (old.participation_type === 'VIRTUAL' ? 'VIRTUAL' : (solved > 0 ? 'PUBLIC' : old.participation_type)),
          recently_updated: true
        };
        return updated;
      }
      return prev;
    });
  }, [wsLatestUpdate]);

  const fetchPreviousWeekData = async (forceSync: boolean = false, silent: boolean = false) => {
    let latestSessionId = sessionId;
    
    // Auto-resolve current active session if not provided via props
    if (!latestSessionId) {
      try {
        const currentRes = await api.get('/contests/current-session');
        if (currentRes?.data?.sessionId || currentRes?.data?.id) {
          latestSessionId = currentRes.data.sessionId || currentRes.data.id;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!latestSessionId) {
      setLoading(false);
      return;
    }
    
    try {
      if (forceSync) {
        setSyncing(true);
      } else if (!silent && !summary) {
        setLoading(true);
      }
      setError(null);

      // 1. Instant Cache Hydration from memory/local storage (0ms load time!)
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('cache_prev_panel_') && !k.endsWith('_v32')) {
            localStorage.removeItem(k);
          }
        }
        if (isFacultyRole) {
          localStorage.removeItem(`cache_prev_panel_${latestSessionId}`);
        }
        const localKey = `cache_prev_panel_${userScope}_${latestSessionId}_v32`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.v === 'v32' && parsed.summary) {
            setSummary(parsed.summary);
            setLoading(false);
          } else {
            localStorage.removeItem(localKey);
          }
          if (parsed.v === 'v32' && parsed.records && Array.isArray(parsed.records) && records.length === 0) {
            const safeRecords = parsed.records;
            setRecords(safeRecords);
          }
        }
      } catch (e) {
        // Ignore storage read errors
      }

      if (forceSync && latestSessionId) {
        try {
          const keys = Object.keys(localStorage);
          for (const k of keys) {
            if (k.includes('cache_prev_panel_')) {
              localStorage.removeItem(k);
            }
          }
        } catch (e) {}
        await api.post(`/contests/sessions/${latestSessionId}/sync`);
        // Automatic multi-pass background refresh (+1s, +3s, +5s) so UI updates without manual clicks
        setTimeout(() => fetchPreviousWeekData(false, true), 1000);
        setTimeout(() => fetchPreviousWeekData(false, true), 3000);
        setTimeout(() => fetchPreviousWeekData(false, true), 5000);
      }

      // 2. Stream Summary First (Ultra-fast ~20ms response) to clear loading state immediately
      const summaryPromise = api.get(`/contests/sessions/${latestSessionId}/summary`)
        .then(r => r.data)
        .catch(() => null);

      const matrixPromise = api.get(`/contests/sessions/${latestSessionId}/matrix`)
        .then(r => r.data)
        .catch(() => null);

      api.get(`/contests/sessions/${latestSessionId}/metadata`)
        .then(r => {
          let slugs = r.data?.problemSlugs;
          
          // Hardcode fallback for Recent Contests if the backend cache is stuck returning an empty array due to Cloudflare blocks
          const fallbackMap: Record<string, string[]> = {
            'weekly-contest-523': [
              "three-fibonacci-sum",
              "prime-subset-selection-i",
              "design-bus-seat-booking-system",
              "prime-subset-selection-ii"
            ],
            'weekly-contest-522': [
              "minimum-rotations-to-dial-a-number-i",
              "minimum-rotations-to-dial-a-number-ii",
              "maximum-alternating-subarray-sum-with-one-deletion",
              "count-good-strings"
            ],
            'weekly-contest-521': [
              "rearrange-array-by-removing-distinct-values",
              "maximum-equal-adjacent-pairs-after-at-most-one-replacement",
              "longest-subarray-with-restricted-pair-sums",
              "maximize-meeting-earnings-with-idle-gaps"
            ],
            'weekly-contest-520': [
              "number-of-intersecting-interval-pairs-i",
              "number-of-intersecting-interval-pairs-ii",
              "maximum-pulse-value-after-one-subarray-rotation",
              "lexicographically-largest-power-array"
            ],
            'weekly-contest-519': [
              "count-subarrays-with-distant-sums",
              "cyclically-shift-rows-and-columns",
              "minimum-operations-to-make-every-element-palindromic",
              "minimum-operations-to-make-every-element-palindromic-ii"
            ],
            'weekly-contest-518': [
              "count-rotations-with-exactly-k-equal-adjacent-pairs",
              "count-good-cyclic-rotations",
              "count-robot-groups",
              "minimum-cost-path-with-at-most-k-turns"
            ],
            'weekly-contest-517': [
              "count-integers-appearing-in-a-single-block",
              "sum-of-decoded-numbers",
              "minimum-operations-to-form-subset-sum-i",
              "minimum-operations-to-form-subset-sum-ii"
            ],
            'weekly-contest-516': [
              "find-all-numbers-disappeared-in-an-array-ii",
              "longest-subarray-with-at-most-k-distinct-prime-factors",
              "minimum-cost-to-connect-stations",
              "maximum-operations-to-empty-an-array"
            ],
            'weekly-contest-515': [
              "nearest-available-drone",
              "minimize-the-maximum-waiting-time",
              "maximum-gap-between-stations",
              "minimum-cost-path-with-at-most-k-turns-ii"
            ],
            'weekly-contest-514': [
              "minimum-total-price-after-applying-discounts",
              "weighted-sum-of-a-tree",
              "maximum-area-of-two-non-overlapping-square-submatrices",
              "peaks-in-array-ii"
            ],
            'weekly-contest-513': [
              "maximize-pair-strength-using-gcd",
              "count-subarrays-with-even-odd-ratio-i",
              "count-of-unfinished-tasks-after-each-shift",
              "count-subarrays-with-even-odd-ratio-ii"
            ],
            'weekly-contest-512': [
              "largest-integer-with-given-digit-sum",
              "aggregate-two-time-series",
              "count-valid-sequences",
              "minimum-cost-path-with-alternating-directions-iii"
            ],
            'weekly-contest-511': [
              "even-number-of-knight-moves",
              "count-dominant-nodes-in-a-binary-tree",
              "transform-binary-string-using-subsequence-sort",
              "minimum-number-of-string-groups-through-transformations"
            ],
            'weekly-contest-510': [
              "number-of-elapsed-seconds-between-two-times",
              "minimum-total-cost-to-process-all-elements",
              "create-grid-with-exactly-k-paths-i",
              "maximum-consistent-columns-in-a-grid"
            ]
          };

          if ((!slugs || slugs.length < 4) && r.data?.contestSlug && fallbackMap[r.data.contestSlug]) {
            slugs = fallbackMap[r.data.contestSlug];
          }

          if (slugs && slugs.length >= 4) {
            const formatSlug = (s: string) => s ? s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
            setQuestionTitles({
              q1: formatSlug(slugs[0]) || 'Question 1',
              q2: formatSlug(slugs[1]) || 'Question 2',
              q3: formatSlug(slugs[2]) || 'Question 3',
              q4: formatSlug(slugs[3]) || 'Question 4'
            });
          } else {
            setQuestionTitles(null);
          }
        })
        .catch(() => setQuestionTitles(null));

      const summaryData = await summaryPromise;
      if (summaryData) {
        const newSummary: PreviousWeekSummary = {
          session_id: summaryData.sessionId,
          contest_slug: summaryData.contestId || `weekly-contest-${summaryData.contestNumber}`,
          contest_title: summaryData.contestName || `Weekly Contest ${summaryData.contestNumber}`,
          target_date_ist: summaryData.sessionDate || '20.09.2026',
          validation_status: summaryData.status,
          publish_status: summaryData.status,
          cache_state: 'HIT',
          dataset_version: 1,
          sync_id: 'live',
          sync_started_at: '',
          metrics: {
            PUBLIC: summaryData.publicParticipants ?? summaryData.participantCount ?? 0,
            VIRTUAL: summaryData.virtualParticipants ?? 0,
            NOT_PARTICIPATED: summaryData.notParticipated ?? Math.max(0, (summaryData.totalStudents || 0) - (summaryData.participantCount || 0)),
            NOT_VERIFIED: summaryData.pendingVerification ?? 0,
            MISSING_LEETCODE_USERNAME: summaryData.missingUsername ?? 0,
            TOTAL_STUDENTS: summaryData.totalStudents || 0,
          }
        };
        setSummary(newSummary);
        setLoading(false); // Unblock UI immediately!
      }

      // 3. Matrix Stream Update
      const matrixData = await matrixPromise;
      const rows = (matrixData?.rows && Array.isArray(matrixData.rows) && matrixData.rows.length > 0)
        ? matrixData.rows
        : (matrixData?.items && Array.isArray(matrixData.items) && matrixData.items.length > 0)
          ? matrixData.items
          : [];
      if (rows.length > 0) {
        const mappedRecords: ParticipationRecord[] = rows.map((row: any) => {
          const usernameStr = (row.username || '').toString().trim();
          const pStatusStr = (row.participation_status || row.status || '').toString().toUpperCase();
          const isMissingHandle = (!usernameStr || usernameStr === '' || usernameStr === 'USERNAME_NOT_FOUND' || usernameStr === 'UNLINKED' || usernameStr === 'NO_HANDLE' || pStatusStr === 'USERNAME_NOT_FOUND');
          const q1Val = (Number(row.q1) === 1 || row.q1 === 1 || row.q1 === '1') ? 1 : 0;
          const q2Val = (Number(row.q2) === 1 || row.q2 === 1 || row.q2 === '1') ? 1 : 0;
          const q3Val = (Number(row.q3) === 1 || row.q3 === 1 || row.q3 === '1') ? 1 : 0;
          const q4Val = (Number(row.q4) === 1 || row.q4 === 1 || row.q4 === '1') ? 1 : 0;
          const binarySum = q1Val + q2Val + q3Val + q4Val;

          const tcsNum = Number(row.total_contest_solved ?? row.total_solved ?? row.problems_solved);
          const finalSolved = (!isNaN(tcsNum) && tcsNum > 0) ? tcsNum : binarySum;

          return {
            id: row.s_no,
            session_id: latestSessionId!,
            contest_slug: row.contest_id,
            contest_title: row.contest_name,
            student_id: row.student_id,
            leetcode_username: usernameStr,
            student_name: row.name || row.student_name || row.studentName || 'Student',
            reg_no: row.reg_no || row.register_number || row.regNo || '',
            department_name: row.dept || row.department || row.department_name || 'CSE',
            year_level: row.year || row.year_level || '',
            participation_type: isMissingHandle ? 'MISSING_LEETCODE_USERNAME'
              : (finalSolved > 0) ? (pStatusStr.includes('VIRTUAL') ? 'VIRTUAL' : 'PUBLIC')
              : (pStatusStr === 'PUBLIC_ATTENDED' || pStatusStr === 'PUBLIC') ? 'PUBLIC' 
              : (pStatusStr === 'VIRTUAL_ATTENDED' || pStatusStr === 'VIRTUAL') ? 'VIRTUAL'
              : (pStatusStr === 'PENDING' || pStatusStr === 'NOT_VERIFIED') ? 'NOT_VERIFIED'
              : 'NOT_PARTICIPATED',
            official_rank: row.rank !== '' && row.rank !== null ? row.rank : null,
            official_score: row.score !== '' && row.score !== null ? row.score : null,
            q1: q1Val,
            q2: q2Val,
            q3: q3Val,
            q4: q4Val,
            q_timing: (row as any).q_timing || null,
            problems_solved: finalSolved,
            finish_time: null,
            source: row.source_status || 'UNKNOWN',
            verification_status: pStatusStr === 'USERNAME_NOT_FOUND' ? 'USERNAME_NOT_FOUND' : (row.source_status || 'UNKNOWN'),
            _clean_reg: row.reg_no ? row.reg_no.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
          };
        });
        const finalRecords = mappedRecords;
        setRecords(finalRecords);

        // Store in localStorage for 0ms instant reload on next visit with v28 version tag!
        try {
          if (summaryData) {
            const pubCount = finalRecords.filter(r => r.participation_type === 'PUBLIC').length;
            const notAttCount = finalRecords.filter(r => r.participation_type === 'NOT_PARTICIPATED').length;
            const missingCount = finalRecords.filter(r => r.participation_type === 'MISSING_LEETCODE_USERNAME').length;
            const virtCount = finalRecords.filter(r => r.participation_type === 'VIRTUAL').length;

            const scopedSummary = isFacultyRole
              ? {
                  ...summaryData,
                  totalStudents: finalRecords.length,
                  publicParticipants: pubCount,
                  participantCount: pubCount + virtCount,
                  virtualParticipants: virtCount,
                  notParticipated: notAttCount,
                  missingUsername: missingCount,
                }
              : summaryData;

            localStorage.setItem(`cache_prev_panel_${userScope}_${latestSessionId}_v32`, JSON.stringify({
              v: 'v32',
              summary: {
                session_id: scopedSummary.sessionId,
                contest_slug: scopedSummary.contestId || `weekly-contest-${scopedSummary.contestNumber}`,
                contest_title: scopedSummary.contestName,
                target_date_ist: scopedSummary.sessionDate,
                validation_status: scopedSummary.status,
                publish_status: scopedSummary.status,
                cache_state: 'HIT',
                dataset_version: 1,
                sync_id: 'live',
                sync_started_at: '',
                metrics: {
                  PUBLIC: scopedSummary.publicParticipants ?? 0,
                  VIRTUAL: scopedSummary.virtualParticipants ?? 0,
                  NOT_PARTICIPATED: scopedSummary.notParticipated ?? 0,
                  NOT_VERIFIED: scopedSummary.pendingVerification ?? 0,
                  MISSING_LEETCODE_USERNAME: scopedSummary.missingUsername ?? 0,
                  TOTAL_STUDENTS: scopedSummary.totalStudents || finalRecords.length,
                }
              },
              records: finalRecords,
              ts: Date.now()
            }));
          }
        } catch (e) {
          // Ignore quota errors
        }
      }
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load Previous Week Contest data.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setSyncing(false);
      }
    }
  };

  // Initial load when sessionId prop changes or mounts
  useEffect(() => {
    // 1. Try instant hydration for the specific target sessionId if available
    try {
      if (sessionId) {
        if (isFacultyRole) {
          localStorage.removeItem(`cache_prev_panel_${sessionId}`);
        }
        const stored = localStorage.getItem(`cache_prev_panel_${userScope}_${sessionId}_v18`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.v === 'v18' && parsed.summary) {
            setSummary(parsed.summary);
            setLoading(false);
          } else {
            localStorage.removeItem(`cache_prev_panel_${userScope}_${sessionId}_v18`);
          }
          if (parsed.v === 'v18' && parsed.records && Array.isArray(parsed.records)) {
            const safeRecords = parsed.records;
            setRecords(safeRecords);
          }
        }
      } else {
        setSummary(null);
        setRecords([]);
      }
    } catch (e) {}

    fetchPreviousWeekData();

    // Safety timeout: Never keep loading spinner stuck for more than 1.2s under any network condition
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Silent automatic background polling every 8 seconds so UI updates seamlessly without manual reloads
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPreviousWeekData(false, true);
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleSimulateStep = async (studentId: number, currentSolved: number) => {
    try {
      setSimulatingStudentId(studentId);
      const nextTarget = (currentSolved % 4) + 1;
      await api.post('/contests/live/simulate-step', {
        student_id: studentId,
        target_solved: nextTarget
      });
      // Quick silent re-fetch
      setTimeout(() => fetchPreviousWeekData(false, true), 300);
    } catch (err) {
      console.error('Simulate step failed:', err);
    } finally {
      setTimeout(() => setSimulatingStudentId(null), 500);
    }
  };

  const getDeptInfo = (code: string) => {
    const c = (code || '').toUpperCase().trim();
    if (c.includes('IOT') || c.includes('CI') || c.includes('INTERNET OF THINGS')) {
      return {
        key: 'CSE(IOT)',
        code: 'CSE(IOT)',
        label: 'Computer Science & Engg (IoT)',
        color: 'text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      };
    }
    if (c.includes('CYBER') || c === 'CSE(CS)' || (c.includes('CS') && !c.includes('IOT'))) {
      return {
        key: 'CSE(CS)',
        code: 'CSE(CS)',
        label: 'Computer Science & Engg (Cyber Security)',
        color: 'text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      };
    }
    if (c === 'IT' || c.includes('INFORMATION')) {
      return {
        key: 'IT',
        code: 'IT',
        label: 'Information Technology',
        color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      };
    }
    if (c === 'CSE' || c.includes('COMPUTER SCIENCE')) {
      return {
        key: 'CSE',
        code: 'CSE',
        label: 'Computer Science & Engineering',
        color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      };
    }
    if (c === 'ECE' || c.includes('ELECTRONICS')) {
      return {
        key: 'ECE',
        code: 'ECE',
        label: 'Electronics & Communication Engg',
        color: 'text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      };
    }
    if (c === 'EEE' || c.includes('ELECTRICAL')) {
      return {
        key: 'EEE',
        code: 'EEE',
        label: 'Electrical & Electronics Engg',
        color: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      };
    }
    if (c === 'MECH' || c.includes('MECHANICAL')) {
      return {
        key: 'MECH',
        code: 'MECH',
        label: 'Mechanical Engineering',
        color: 'text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800'
      };
    }
    if (c && c !== 'ALL') {
      return {
        key: c,
        code: c.length > 8 ? c.substring(0, 8) : c,
        label: code,
        color: 'text-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800'
      };
    }
    return {
      key: 'ALL',
      code: 'ALL',
      label: 'All Departments',
      color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
    };
  };

  const deptOptions = useMemo(() => {
    const optsMap = new Map<string, { value: string; label: string; code: string; color: string }>();

    if (isFacultyRole) {
      optsMap.set('ALL', {
        value: 'ALL',
        label: 'My Allocated Mentees',
        code: 'MENTEES',
        color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      });
      optsMap.set('CSE(CS)', {
        value: 'CSE(CS)',
        label: 'Computer Science & Engg (Cyber Security)',
        code: 'CSE(CS)',
        color: 'text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      });
      return Array.from(optsMap.values());
    }

    // Always add 'ALL' option first
    optsMap.set('ALL', {
      value: 'ALL',
      label: 'All Departments',
      code: 'ALL',
      color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
    });

    records.forEach((r) => {
      if (r.department_name) {
        const info = getDeptInfo(r.department_name);
        if (info.key !== 'ALL' && !optsMap.has(info.key)) {
          optsMap.set(info.key, {
            value: info.key,
            label: info.label,
            code: info.code,
            color: info.color
          });
        }
      }
    });

    return Array.from(optsMap.values());
  }, [records, isFacultyRole]);

  const yearOptions = useMemo(() => [
    { value: 'ALL', label: 'All Academic Years', shortLabel: 'All Years', code: 'ALL', color: 'text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800', desc: 'All batches and cohorts' },
    { value: 'I',   label: 'I Year (First Year)',  shortLabel: 'I Year',    code: 'I',   color: 'text-sky-700 bg-sky-50 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800', desc: 'Batch 2026 – 2030' },
    { value: 'II',  label: 'II Year (Second Year)', shortLabel: 'II Year',   code: 'II',  color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', desc: 'Batch 2025 – 2029' },
    { value: 'III', label: 'III Year (Third Year)', shortLabel: 'III Year',  code: 'III', color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', desc: 'Batch 2024 – 2028' },
    { value: 'IV',  label: 'IV Year (Final Year)', shortLabel: 'IV Year',   code: 'IV',  color: 'text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800', desc: 'Batch 2023 – 2027' },
  ], []);

  const filteredDeptOptions = useMemo(() => {
    if (!deptSearchText.trim()) return deptOptions;
    const q = deptSearchText.toLowerCase().trim();
    return deptOptions.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      opt.code.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q)
    );
  }, [deptOptions, deptSearchText]);

  const getParticipationCategory = (r: ParticipationRecord): 'PUBLIC' | 'VIRTUAL' | 'NOT_PARTICIPATED' | 'NOT_VERIFIED' | 'MISSING_LEETCODE_USERNAME' => {
    const isMissing = r.participation_type === 'MISSING_LEETCODE_USERNAME' || !r.leetcode_username || r.leetcode_username.trim() === '' || r.leetcode_username === 'USERNAME_NOT_FOUND' || r.leetcode_username === 'UNLINKED' || r.leetcode_username === 'NO_HANDLE';
    if (isMissing) return 'MISSING_LEETCODE_USERNAME';

    const pType = (r.participation_type as string) || '';
    if (pType === 'PUBLIC' || pType === 'PUBLIC_ATTENDED' || (r.problems_solved > 0 && !pType.includes('VIRTUAL'))) return 'PUBLIC';
    if (pType === 'VIRTUAL' || pType === 'VIRTUAL_ATTENDED') return 'VIRTUAL';
    if (pType === 'NOT_VERIFIED' || r.verification_status === 'NOT_VERIFIED' || r.verification_status === 'PENDING') return 'NOT_VERIFIED';
    return 'NOT_PARTICIPATED';
  };

  // Reset page to 1 whenever active filters change
  useEffect(() => {
    setPage(1);
  }, [selectedTypeFilter, selectedDeptFilter, selectedYearFilter, searchTerm]);

  const filteredRecords = useMemo(() => {
    const isTypeAll = selectedTypeFilter === 'ALL';
    const isDeptAll = selectedDeptFilter === 'ALL';
    const isYearAll = selectedYearFilter === 'ALL';
    const targetDept = selectedDeptFilter.toUpperCase().trim();
    const targetYear = selectedYearFilter.toUpperCase().trim();
    const query = deferredSearchTerm.toLowerCase().trim();
    const cleanQuery = query ? query.replace(/[^a-z0-9]/g, '') : '';
    const hasSearch = query !== '';

    return records.filter((r) => {
      if (!isTypeAll) {
        if (getParticipationCategory(r) !== selectedTypeFilter) return false;
      }
      if (!isDeptAll) {
        const info = getDeptInfo(r.department_name || '');
        const dName = (r.department_name || '').toUpperCase().trim();
        if (info.key.toUpperCase() !== targetDept && dName !== targetDept) {
          return false;
        }
      }
      if (!isYearAll) {
        const studentYear = normalizeYear(r.year_level, r.reg_no);
        if (studentYear !== targetYear && !r.year_level?.toUpperCase().includes(targetYear)) {
          return false;
        }
      }
      if (hasSearch) {
        if (r.student_name.toLowerCase().includes(query)) return true;
        if (r.reg_no.toLowerCase().includes(query)) return true;
        if ((r.leetcode_username || '').toLowerCase().includes(query)) return true;
        if ((r.department_name || '').toLowerCase().includes(query)) return true;
        
        if (cleanQuery) {
          const cleanReg = r._clean_reg || r.reg_no.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanReg.includes(cleanQuery)) return true;
        }
        return false;
      }
      return true;
    });
  }, [records, selectedTypeFilter, selectedDeptFilter, selectedYearFilter, deferredSearchTerm, isFacultyRole]);

  // Dynamically calculate metrics directly from real-time records state
  const dynamicMetrics = useMemo(() => {
    const counts = {
      PUBLIC: 0,
      VIRTUAL: 0,
      NOT_PARTICIPATED: 0,
      NOT_VERIFIED: 0,
      MISSING_LEETCODE_USERNAME: 0,
      TOTAL_STUDENTS: 0,
    };
    records.forEach(r => {
      if (selectedDeptFilter !== 'ALL') {
        const info = getDeptInfo(r.department_name || '');
        const dName = (r.department_name || '').toUpperCase().trim();
        const targetDept = selectedDeptFilter.toUpperCase().trim();
        if (info.key.toUpperCase() !== targetDept && dName !== targetDept) {
          return;
        }
      }
      if (selectedYearFilter !== 'ALL') {
        const studentYear = normalizeYear(r.year_level, r.reg_no);
        const targetYear = selectedYearFilter.toUpperCase().trim();
        if (studentYear !== targetYear && !r.year_level?.toUpperCase().includes(targetYear)) {
          return;
        }
      }
      const cat = getParticipationCategory(r);
      counts[cat]++;
    });
    counts.TOTAL_STUDENTS = counts.PUBLIC + counts.VIRTUAL + counts.NOT_PARTICIPATED + counts.NOT_VERIFIED + counts.MISSING_LEETCODE_USERNAME;

    if (records.length === 0 && summary?.metrics) {
      if (isFacultyRole) {
        return {
          ...summary.metrics,
          TOTAL_STUDENTS: Math.min(20, summary.metrics.TOTAL_STUDENTS),
        };
      }
      return summary.metrics;
    }
    return counts;
  }, [records, summary?.metrics, selectedDeptFilter, selectedYearFilter, isFacultyRole]);

  if (loading && !summary) {
    return (
      <div className="p-8 text-center bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Discovering & Analyzing LeetCode Contest Telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-36 sm:pb-24">

      {/* Top Banner Card — Modern Glassmorphic Tech Aesthetic */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 border border-indigo-500/30 shadow-2xl mb-3 sm:mb-4">
        {/* Glow ambient background elements */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/15 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 bg-brand-500/10 blur-3xl rounded-full" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-mono font-bold shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Target: {summary?.target_date_ist || '—'}</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                {summary?.contest_title || (sessionId ? `Weekly Contest ${sessionId}` : 'Weekly Contest')}
              </span>
            </h2>

            <p className="text-xs sm:text-[13px] text-slate-300 font-medium leading-relaxed">
              Authoritative question-level contest telemetry • Realtime Ingestion
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
            <button
              onClick={() => {
                triggerHaptic('medium');
                fetchPreviousWeekData(true);
              }}
              disabled={syncing}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-brand-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Re-Syncing Live...' : 'Force Live Re-Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Disconnection Notice if completely offline */}
      {wsStatus !== 'LIVE' && (
        <div className="p-2 sm:p-3.5 my-1.5 sm:my-2 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-between shadow-2xs gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-ping" />
            <span className="text-[10px] sm:text-xs truncate">Auto-Sync active • {lastSyncAt || 'Live'}</span>
          </div>
          <button
            onClick={() => fetchPreviousWeekData(false, true)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10.5px] sm:text-xs font-black hover:bg-indigo-500 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            Sync
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid — Perfectly Balanced Symmetrical Grid (2-col mobile with full-width 5th card, 5-col desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {/* Card 1: PUBLIC / LIVE */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('PUBLIC'); }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
            selectedTypeFilter === 'PUBLIC'
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-950/70 dark:to-emerald-900/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg scale-[1.01]'
              : 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider truncate">Public / Live</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {dynamicMetrics.PUBLIC}
            </p>
            {selectedTypeFilter === 'PUBLIC' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase bg-emerald-600 text-white">Active</span>
            )}
          </div>
        </button>

        {/* Card 2: VIRTUAL PRACTICE */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('VIRTUAL'); }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
            selectedTypeFilter === 'VIRTUAL'
              ? 'bg-gradient-to-br from-purple-50 to-purple-100/80 dark:from-purple-950/70 dark:to-purple-900/50 border-purple-500 ring-2 ring-purple-500/40 shadow-lg scale-[1.01]'
              : 'bg-purple-50/50 dark:bg-purple-950/25 border-purple-200/80 dark:border-purple-800/40 hover:border-purple-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-purple-800 dark:text-purple-300 tracking-wider truncate">Virtual Practice</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
              {dynamicMetrics.VIRTUAL}
            </p>
            {selectedTypeFilter === 'VIRTUAL' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase bg-purple-600 text-white">Active</span>
            )}
          </div>
        </button>

        {/* Card 3: NOT ATTENDED */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('NOT_PARTICIPATED'); }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
            selectedTypeFilter === 'NOT_PARTICIPATED'
              ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 dark:from-rose-950/70 dark:to-rose-900/50 border-rose-500 ring-2 ring-rose-500/40 shadow-lg scale-[1.01]'
              : 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-800/40 hover:border-rose-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-rose-800 dark:text-rose-300 tracking-wider truncate">Not Attended</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
              {dynamicMetrics.NOT_PARTICIPATED}
            </p>
            {selectedTypeFilter === 'NOT_PARTICIPATED' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase bg-rose-600 text-white">Active</span>
            )}
          </div>
        </button>

        {/* Card 4: PENDING VERIFICATION */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('NOT_VERIFIED'); }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
            selectedTypeFilter === 'NOT_VERIFIED'
              ? 'bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-950/70 dark:to-amber-900/50 border-amber-500 ring-2 ring-amber-500/40 shadow-lg scale-[1.01]'
              : 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/40 hover:border-amber-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider truncate">Pending Verification</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
              {dynamicMetrics.NOT_VERIFIED}
            </p>
            {selectedTypeFilter === 'NOT_VERIFIED' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase bg-amber-600 text-white">Active</span>
            )}
          </div>
        </button>

        {/* Card 5: NO LEETCODE HANDLE — col-span-2 on mobile so NO awkward gaps! */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('MISSING_LEETCODE_USERNAME'); }}
          className={`col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-row sm:flex-col justify-between items-center sm:items-stretch group active:scale-[0.98] ${
            selectedTypeFilter === 'MISSING_LEETCODE_USERNAME'
              ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border-slate-500 ring-2 ring-slate-500/40 shadow-lg scale-[1.01]'
              : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-wider block">No LeetCode Handle</span>
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium sm:hidden">Unlinked Profiles</span>
            </div>
          </div>
          <div className="mt-0 sm:mt-2.5 flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-slate-800 dark:text-slate-200">
              {dynamicMetrics.MISSING_LEETCODE_USERNAME}
            </p>
            {selectedTypeFilter === 'MISSING_LEETCODE_USERNAME' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase bg-slate-700 text-white">Active</span>
            )}
          </div>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-3 p-3.5 sm:p-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search Bar + Filters Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md lg:max-w-lg shrink-0 flex items-center">
            <input
              type="text"
              placeholder="Search student, reg no, or LeetCode username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-10 pr-9 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-navy-900 text-left transition-all shadow-inner"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 z-10 text-slate-500 dark:text-slate-400">
              <Search className="w-4 h-4 stroke-[2.5]" />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Department and Academic Year Selector Boxes */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {/* 1. Department Box */}
            {(() => {
              const currentObj = deptOptions.find(o => o.value === selectedDeptFilter) || deptOptions[0];
              const isDeptActive = selectedDeptFilter !== 'ALL';

              return (
                <div
                  className="relative flex-1 sm:flex-initial"
                  onBlur={(e) => { 
                    if (!isMobile && !e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDeptDropdownOpen(false); 
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDeptDropdownOpen(p => !p);
                      setYearDropdownOpen(false);
                    }}
                    className={`w-full sm:w-auto min-h-[42px] flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl border shadow-xs text-left transition-all active:scale-[0.97] focus:outline-none cursor-pointer ${
                      deptDropdownOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-950/50'
                        : isDeptActive
                        ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-400/30'
                        : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                    title={`Filter by Department: ${currentObj.label}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className={`w-3.5 h-3.5 shrink-0 ${isDeptActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`} />
                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${currentObj.color}`}>{currentObj.code}</span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[85px] sm:max-w-[130px]">{currentObj.label}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${deptDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Desktop Dropdown Popover */}
                  {!isMobile && deptDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-1 animate-scale-in">
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
                        <span>Select Department</span>
                        {isDeptActive && (
                          <button
                            type="button"
                            onClick={() => { setSelectedDeptFilter('ALL'); setDeptDropdownOpen(false); }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer lowercase font-medium"
                          >
                            clear
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {deptOptions.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { 
                              triggerHaptic('light');
                              setSelectedDeptFilter(opt.value); 
                              setDeptDropdownOpen(false); 
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer ${selectedDeptFilter === opt.value ? 'bg-indigo-50/80 dark:bg-indigo-950/60' : ''}`}
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${opt.color}`}>{opt.code}</span>
                            <span className={`text-xs truncate flex-1 ${selectedDeptFilter === opt.value ? 'text-indigo-950 dark:text-indigo-200 font-extrabold' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>{opt.label}</span>
                            {selectedDeptFilter === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Academic Year Box */}
            {(() => {
              const currentYearObj = yearOptions.find(o => o.value === selectedYearFilter) || yearOptions[0];
              const isYearActive = selectedYearFilter !== 'ALL';

              return (
                <div
                  className="relative flex-1 sm:flex-initial"
                  onBlur={(e) => { 
                    if (!isMobile && !e.currentTarget.contains(e.relatedTarget as Node)) {
                      setYearDropdownOpen(false); 
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setYearDropdownOpen(p => !p);
                      setDeptDropdownOpen(false);
                    }}
                    className={`w-full sm:w-auto min-h-[42px] flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl border shadow-xs text-left transition-all active:scale-[0.97] focus:outline-none cursor-pointer ${
                      yearDropdownOpen
                        ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/70 dark:bg-purple-950/50'
                        : isYearActive
                        ? 'border-purple-400 bg-purple-50/40 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-1 ring-purple-400/30'
                        : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                    }`}
                    title={`Filter by Academic Year: ${currentYearObj.label}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${isYearActive ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500'}`} />
                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${currentYearObj.color}`}>{currentYearObj.code}</span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[80px] sm:max-w-[110px]">{currentYearObj.shortLabel || currentYearObj.label}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Desktop Dropdown Popover */}
                  {!isMobile && yearDropdownOpen && (
                    <div className="absolute z-50 top-full right-0 sm:left-0 sm:right-auto mt-1.5 w-60 max-w-[calc(100vw-2.5rem)] bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-1 animate-scale-in">
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
                        <span>Select Academic Year</span>
                        {isYearActive && (
                          <button
                            type="button"
                            onClick={() => { setSelectedYearFilter('ALL'); setYearDropdownOpen(false); }}
                            className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer lowercase font-medium"
                          >
                            clear
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {yearOptions.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { 
                              triggerHaptic('light');
                              setSelectedYearFilter(opt.value); 
                              setYearDropdownOpen(false); 
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer ${selectedYearFilter === opt.value ? 'bg-purple-50/80 dark:bg-purple-950/60' : ''}`}
                          >
                            <GraduationCap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${opt.color}`}>{opt.code}</span>
                            <span className={`text-xs truncate flex-1 ${selectedYearFilter === opt.value ? 'text-purple-950 dark:text-purple-200 font-extrabold' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>{opt.label}</span>
                            {selectedYearFilter === opt.value && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ========================================================================= */}
          {/* NATIVE MOBILE UI: Department Bottom Sheet Drawer (Portaled to document.body) */}
          {/* ========================================================================= */}
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {isMobile && deptDropdownOpen && (
                <div className="fixed inset-0 z-[100050] flex flex-col justify-end">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setDeptDropdownOpen(false)}
                    className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
                  />

                  {/* Bottom Sheet Drawer */}
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-navy-950 rounded-t-[28px] border-t border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))]"
                  >
                    {/* Pull Handle */}
                    <div className="pt-2.5 pb-1 flex justify-center cursor-pointer" onClick={() => setDeptDropdownOpen(false)}>
                      <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 transition-colors" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-white/[0.08]">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white font-display">
                            Select Department
                          </h3>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {deptOptions.length} departments available
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {selectedDeptFilter !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setSelectedDeptFilter('ALL');
                              setDeptDropdownOpen(false);
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeptDropdownOpen(false)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Search inside Department Sheet */}
                    {deptOptions.length > 3 && (
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-navy-900/40">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Search department name or code..."
                            value={deptSearchText}
                            onChange={(e) => setDeptSearchText(e.target.value)}
                            autoComplete="off"
                            className="w-full pl-9 pr-8 py-2 text-xs font-bold rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                          />
                          <div className="pointer-events-none absolute left-3 text-slate-400">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          {deptSearchText && (
                            <button
                              type="button"
                              onClick={() => setDeptSearchText('')}
                              className="absolute right-2.5 text-slate-400 hover:text-rose-500 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Department Options List */}
                    <div className="overflow-y-auto px-3.5 py-2.5 space-y-1.5 flex-1 min-h-0">
                      {filteredDeptOptions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 font-medium">
                          No matching department found
                        </div>
                      ) : (
                        filteredDeptOptions.map((opt) => {
                          const isSelected = selectedDeptFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setSelectedDeptFilter(opt.value);
                                setDeptDropdownOpen(false);
                              }}
                              className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-2 border-indigo-500 dark:border-indigo-500/80 shadow-xs'
                                  : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                }`}>
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${opt.color}`}>
                                      {opt.code}
                                    </span>
                                    {isSelected && (
                                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-xs mt-0.5 font-bold leading-snug break-words ${
                                    isSelected ? 'text-indigo-950 dark:text-indigo-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                  }`}>
                                    {opt.label}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* ========================================================================= */}
          {/* NATIVE MOBILE UI: Academic Year Bottom Sheet Drawer (Portaled to document.body) */}
          {/* ========================================================================= */}
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {isMobile && yearDropdownOpen && (
                <div className="fixed inset-0 z-[100050] flex flex-col justify-end">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setYearDropdownOpen(false)}
                    className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
                  />

                  {/* Bottom Sheet Drawer */}
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-navy-950 rounded-t-[28px] border-t border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))]"
                  >
                    {/* Pull Handle */}
                    <div className="pt-2.5 pb-1 flex justify-center cursor-pointer" onClick={() => setYearDropdownOpen(false)}>
                      <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 transition-colors" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-white/[0.08]">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white font-display">
                            Select Academic Year
                          </h3>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Filter students by study year and cohort
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {selectedYearFilter !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setSelectedYearFilter('ALL');
                              setYearDropdownOpen(false);
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setYearDropdownOpen(false)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Year Options List */}
                    <div className="overflow-y-auto px-3.5 py-2.5 space-y-1.5 flex-1 min-h-0">
                      {yearOptions.map((opt) => {
                        const isSelected = selectedYearFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setSelectedYearFilter(opt.value);
                              setYearDropdownOpen(false);
                            }}
                            className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                              isSelected
                                ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-500 dark:border-purple-500/80 shadow-xs'
                                : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected 
                                  ? 'bg-purple-600 text-white' 
                                  : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                              }`}>
                                <GraduationCap className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${opt.color}`}>
                                    {opt.code}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs mt-0.5 font-bold leading-snug ${
                                  isSelected ? 'text-purple-950 dark:text-purple-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                }`}>
                                  {opt.label}
                                </span>
                                {opt.desc && (
                                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                    {opt.desc}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>

        {/* Sub-strip: Active Filter Tags & Count Display */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Active Status Filter Chip */}
            {selectedTypeFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('ALL')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition cursor-pointer"
                title="Clear status filter"
              >
                <span>Status: {
                  selectedTypeFilter === 'PUBLIC' ? 'Public / Live' :
                  selectedTypeFilter === 'VIRTUAL' ? 'Virtual Practice' :
                  selectedTypeFilter === 'NOT_PARTICIPATED' ? 'Not Attended' :
                  selectedTypeFilter === 'NOT_VERIFIED' ? 'Pending Verification' :
                  'No Handle'
                }</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Active Dept Filter Chip */}
            {selectedDeptFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('ALL')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition cursor-pointer"
                title="Clear department filter"
              >
                <span>Dept: {selectedDeptFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Active Year Filter Chip */}
            {selectedYearFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedYearFilter('ALL')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition cursor-pointer"
                title="Clear year filter"
              >
                <span>Year: {selectedYearFilter} Year</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Clear All Filters Button */}
            {(selectedTypeFilter !== 'ALL' || selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTypeFilter('ALL');
                  setSelectedDeptFilter('ALL');
                  setSelectedYearFilter('ALL');
                  setSearchTerm('');
                }}
                className="text-[10.5px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 underline decoration-dotted ml-1 cursor-pointer"
              >
                Reset All
              </button>
            )}
          </div>

          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono ml-auto">
            Showing {filteredRecords.length} / {records.length} Students
          </span>
        </div>
      </div>

      {/* Mobile-Friendly Cards View (block md:hidden, no horizontal table scroll) */}
      <div className="flex flex-col gap-3.5 md:hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-800 text-slate-400 text-xs font-bold">
            No participation records found matching your active filters.
          </div>
        ) : (
          filteredRecords.slice((page - 1) * pageSize, page * pageSize).map((r, idx) => {
            const cat = getParticipationCategory(r);
            const isMissingHandle = cat === 'MISSING_LEETCODE_USERNAME';
            const isAbsent = cat === 'NOT_PARTICIPATED';
            const isPending = cat === 'NOT_VERIFIED';
            const isPublic = cat === 'PUBLIC';
            const isVirtual = cat === 'VIRTUAL';
            const cleanYear = r.year_level ? r.year_level.replace(/(?:\s*Year)+/gi, '').trim() + ' Year' : '';
            const rankIndex = (page - 1) * pageSize + idx + 1;

            return (
              <div
                key={`${r.student_id}-${idx}`}
                onClick={() => setSelectedForensicRecord(r)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-navy-900 shadow-xs hover:shadow-lg space-y-3 relative overflow-hidden active:scale-[0.99] group ${
                  r.recently_updated
                    ? 'border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-navy-800 hover:border-brand-500/50'
                }`}
              >
                {/* Header: Rank + Student Name + Status Pill */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-brand-50 dark:from-navy-800 dark:to-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                      #{rankIndex}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white truncate tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {r.student_name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono font-bold mt-0.5">
                        <span>{r.reg_no}</span>
                        {cleanYear && <span className="text-slate-400">• {cleanYear}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isPublic && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs whitespace-nowrap flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {isVirtual && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-500/30 shadow-2xs whitespace-nowrap flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        VIRTUAL
                      </span>
                    )}
                    {isAbsent && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 shadow-2xs whitespace-nowrap">
                        NOT ATTENDED
                      </span>
                    )}
                    {(isMissingHandle || isPending) && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 shadow-2xs whitespace-nowrap">
                        {isMissingHandle ? 'NO HANDLE' : 'PENDING'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags Strip: Dept + LeetCode Handle */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-navy-800/80 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.department_name && (() => {
                      const deptInfo = getDeptInfo(r.department_name);
                      return (
                        <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase border shrink-0 whitespace-nowrap ${deptInfo.color}`}>
                          {deptInfo.code || r.department_name}
                        </span>
                      );
                    })()}
                    {r.leetcode_username ? (
                      <a
                        href={`https://leetcode.com/u/${r.leetcode_username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="font-mono text-brand-600 dark:text-brand-400 hover:underline font-bold text-xs truncate inline-flex items-center gap-0.5 max-w-[130px] sm:max-w-none"
                      >
                        <span>@{r.leetcode_username}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-mono text-slate-400 italic text-xs font-semibold">No Handle</span>
                    )}
                  </div>

                  {(isPublic || isVirtual) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-mono font-black border border-indigo-500/20 shrink-0">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span>{formatContestTime(r)}</span>
                    </span>
                  )}
                </div>

                {/* Middle: Q1-Q4 Solve Question Pills - Ultra High Contrast & Visual Excellence */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-brand-500 inline-block animate-pulse"></span>
                      SOLVE MATRIX
                    </span>
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                      r.problems_solved > 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-200/70 text-slate-600 dark:bg-navy-800 dark:text-slate-400 border-transparent'
                    }`}>
                      {r.problems_solved} / 4 SOLVED
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 font-mono">
                    {[
                      { label: 'Q1', val: r.q1 },
                      { label: 'Q2', val: r.q2 },
                      { label: 'Q3', val: r.q3 },
                      { label: 'Q4', val: r.q4 }
                    ].map(q => (
                      <div
                        key={q.label}
                        className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 text-xs text-center border transition-all ${
                          q.val
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-500 shadow-xs font-black'
                            : 'bg-white dark:bg-navy-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-navy-800 font-bold'
                        }`}
                      >
                        <span className={`text-[11px] font-bold ${q.val ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {q.label}
                        </span>
                        {q.val ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                        ) : (
                          <span className="text-[11px] font-black text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 shadow-sm">
        <table className="w-full text-left border-collapse text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/50 text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              <th className="py-3.5 px-4 text-center">S.No</th>
              <th className="py-3.5 px-4">Student Details</th>
              <th className="py-3.5 px-4">LeetCode Handle</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-3 text-center">Q1</th>
              <th className="py-3.5 px-3 text-center">Q2</th>
              <th className="py-3.5 px-3 text-center">Q3</th>
              <th className="py-3.5 px-3 text-center">Q4</th>
              <th className="py-3.5 px-4 text-center">Solved</th>
              <th className="py-3.5 px-4 text-center">Contest Timing</th>
              <th className="py-3.5 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  No participation records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRecords.slice((page - 1) * pageSize, page * pageSize).map((r, idx) => {
                const cat = getParticipationCategory(r);
                const isMissingHandle = cat === 'MISSING_LEETCODE_USERNAME';
                const isAbsent = cat === 'NOT_PARTICIPATED';
                const isPending = cat === 'NOT_VERIFIED';
                const isPublic = cat === 'PUBLIC';
                const isVirtual = cat === 'VIRTUAL';
                const cleanYear = r.year_level ? r.year_level.replace(/(?:\s*Year)+/gi, '').trim() + ' Year' : '';
                const rankIndex = (page - 1) * pageSize + idx + 1;

                return (
                  <tr 
                    key={`${r.student_id}-${idx}`}
                    className={`hover:bg-slate-50/80 dark:hover:bg-navy-900/80 transition-colors ${
                      r.recently_updated ? 'bg-emerald-500/10 dark:bg-emerald-950/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                      {rankIndex}
                    </td>
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => setSelectedForensicRecord(r)}
                        className="cursor-pointer group"
                      >
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {r.student_name}
                        </p>
                        <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          {r.reg_no} {cleanYear && `• ${cleanYear}`}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.leetcode_username ? (
                        <a
                          href={`https://leetcode.com/u/${r.leetcode_username}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          @{r.leetcode_username}
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 italic">
                          No Handle
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {r.department_name || '—'}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q1 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q1 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q2 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q2 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q3 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q3 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[11px] font-mono font-bold ${
                        r.q4 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {r.q4 ? '1' : '0'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 dark:text-white">
                      {r.problems_solved} / 4
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[11px] font-semibold whitespace-nowrap">
                      {isPublic ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold border border-emerald-500/20 shadow-2xs" title="Total contest duration taken by student">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{formatContestTime(r)}</span>
                        </span>
                      ) : isVirtual ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-bold border border-purple-500/20 shadow-2xs" title="Virtual practice time duration">
                          <Clock className="w-3.5 h-3.5 text-purple-500" />
                          <span>{formatContestTime(r)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isPublic && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          LIVE
                        </span>
                      )}
                      {isVirtual && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          VIRTUAL
                        </span>
                      )}
                      {isAbsent && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          NOT PARTICIPATED
                        </span>
                      )}
                      {(isMissingHandle || isPending) && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Participation mode pending verification">
                          {isMissingHandle ? 'NO HANDLE' : 'PENDING VERIFICATION'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      {filteredRecords.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-600 dark:text-slate-300 font-semibold border-t border-slate-100 dark:border-navy-800 mb-12 sm:mb-6">
          <div className="text-center sm:text-left text-[11px] sm:text-xs">
            Showing <strong className="text-slate-900 dark:text-white font-black">{Math.min((page - 1) * pageSize + 1, filteredRecords.length)}</strong> to{' '}
            <strong className="text-slate-900 dark:text-white font-black">{Math.min(page * pageSize, filteredRecords.length)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-black">{filteredRecords.length}</strong> Students
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[10.5px] sm:text-[11px] font-bold">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 px-1 font-mono">Show:</span>
              {[10, 25, 50, 100].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => { setPageSize(sz); setPage(1); }}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    pageSize === sz
                      ? 'bg-brand-600 text-white shadow-xs font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-100 text-xs transition font-bold cursor-pointer shadow-xs"
              >
                Previous
              </button>
              <span className="text-xs font-mono font-black text-slate-900 dark:text-white px-1 whitespace-nowrap">
                {page} / {Math.ceil(filteredRecords.length / pageSize) || 1}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(filteredRecords.length / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-100 text-xs transition font-bold cursor-pointer shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEST FORENSICS & TELEMETRY DETAIL MODAL */}
      <ContestForensicModal
        record={selectedForensicRecord}
        onClose={() => setSelectedForensicRecord(null)}
        summary={summary}
        questionTitles={questionTitles}
        isLiveContest={isLiveContest}
        onStudentClick={onStudentClick}
      />
    </div>
  );
};

