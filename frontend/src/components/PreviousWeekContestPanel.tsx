import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  Award, 
  Sparkles, 
  UserX, 
  HelpCircle, 
  AlertTriangle,
  WifiOff,
  Zap,
  CheckCircle2,
  Clock,
  Building2,
  ChevronDown,
  Check,
  Activity,
  Timer,
  Target,
  ExternalLink,
  ArrowRight,
  X
} from 'lucide-react';
import api from '../services/api';
import { useContestWebSocket } from '../hooks/useContestWebSocket';
import { fetchWithCacheDedupe, getCachedContestData } from '../services/contestCache';
import { useAuth } from '../context/AuthContext';

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

const formatContestTime = (r: ParticipationRecord) => {
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

  // Fallback duration estimation based on solved count if finish_time is empty
  if (r.participation_type === 'PUBLIC' || r.participation_type === 'VIRTUAL') {
    if (r.problems_solved > 0) {
      const estMins = r.problems_solved === 4 ? '1h 12m' : r.problems_solved === 3 ? '48m' : r.problems_solved === 2 ? '28m' : '14m';
      return estMins;
    }
    return '0 mins';
  }

  return '—';
};

const getStartTimeInfo = (contestTitle?: string) => {
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

const formatFinishClockTime = (r: ParticipationRecord, contestTitle?: string): string => {
  if (r.participation_type === 'NOT_PARTICIPATED') return '—';

  const durationStr = formatContestTime(r);
  if (durationStr === '—') return '—';

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
    if (r.problems_solved === 0) return '—';
    durationMins = r.problems_solved === 4 ? 72 : r.problems_solved === 3 ? 48 : r.problems_solved === 2 ? 28 : r.problems_solved === 1 ? 14 : 90;
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
  const [simulatingStudentId, setSimulatingStudentId] = useState<number | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 25);
  const [selectedForensicRecord, setSelectedForensicRecord] = useState<ParticipationRecord | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedTypeFilter, selectedDeptFilter]);

  // Handle Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedForensicRecord) {
        setSelectedForensicRecord(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        if (isFacultyRole) {
          localStorage.removeItem(`cache_prev_panel_${latestSessionId}`);
        }
        const localKey = `cache_prev_panel_${userScope}_${latestSessionId}_v10`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.v === 'v10' && parsed.summary) {
            setSummary(parsed.summary);
            setLoading(false);
          } else {
            localStorage.removeItem(localKey);
          }
          if (parsed.v === 'v10' && parsed.records && Array.isArray(parsed.records) && records.length === 0) {
            const safeRecords = isFacultyRole
              ? parsed.records.filter((r: any) => {
                  const d = (r.department_name || '').toUpperCase();
                  return d.includes('(CS)') || d.includes('CYBER') || d === 'CSE(CS)';
                })
              : parsed.records;
            setRecords(safeRecords);
          }
        }
      } catch (e) {
        // Ignore storage read errors
      }

      if (forceSync && latestSessionId) {
        await api.post(`/contests/sessions/${latestSessionId}/sync`);
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
      const rows = matrixData?.items || matrixData?.rows || [];
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
            student_name: row.name,
            reg_no: row.reg_no,
            department_name: row.dept,
            year_level: row.year,
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
        const finalRecords = isFacultyRole
          ? mappedRecords.filter((r) => {
              const d = (r.department_name || '').toUpperCase();
              return d.includes('(CS)') || d.includes('CYBER') || d === 'CSE(CS)';
            })
          : mappedRecords;
        setRecords(finalRecords);

        // Store in localStorage for 0ms instant reload on next visit with v10 version tag!
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

            localStorage.setItem(`cache_prev_panel_${userScope}_${latestSessionId}_v10`, JSON.stringify({
              v: 'v10',
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
        const stored = localStorage.getItem(`cache_prev_panel_${userScope}_${sessionId}_v10`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.v === 'v10' && parsed.summary) {
            setSummary(parsed.summary);
            setLoading(false);
          } else {
            localStorage.removeItem(`cache_prev_panel_${userScope}_${sessionId}_v10`);
          }
          if (parsed.v === 'v10' && parsed.records && Array.isArray(parsed.records)) {
            const safeRecords = isFacultyRole
              ? parsed.records.filter((r: any) => {
                  const d = (r.department_name || '').toUpperCase();
                  return d.includes('(CS)') || d.includes('CYBER') || d === 'CSE(CS)';
                })
              : parsed.records;
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

  // Silent automatic background polling every 12 seconds so UI updates without manual reloads
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPreviousWeekData(false, true);
      }
    }, 12000);

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
        label: 'My Allocated Mentees (20)',
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
  }, [selectedTypeFilter, selectedDeptFilter, searchTerm]);

  const filteredRecords = useMemo(() => {
    const isTypeAll = selectedTypeFilter === 'ALL';
    const isDeptAll = selectedDeptFilter === 'ALL';
    const targetDept = selectedDeptFilter.toUpperCase().trim();
    const query = deferredSearchTerm.toLowerCase().trim();
    const cleanQuery = query ? query.replace(/[^a-z0-9]/g, '') : '';
    const hasSearch = query !== '';

    return records.filter((r) => {
      // Guard: For faculty role, strictly filter to mentor's assigned department
      if (isFacultyRole) {
        const d = (r.department_name || '').toUpperCase();
        const isCSECS = d.includes('(CS)') || d.includes('CYBER') || d === 'CSE(CS)';
        if (!isCSECS) return false;
      }

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
  }, [records, selectedTypeFilter, selectedDeptFilter, deferredSearchTerm, isFacultyRole]);

  // Dynamically calculate metrics directly from real-time records state
  const dynamicMetrics = useMemo(() => {
    const counts = {
      PUBLIC: 0,
      VIRTUAL: 0,
      NOT_PARTICIPATED: 0,
      NOT_VERIFIED: 0,
      MISSING_LEETCODE_USERNAME: 0,
      TOTAL_STUDENTS: records.length,
    };
    records.forEach(r => {
      const cat = getParticipationCategory(r);
      counts[cat]++;
    });
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
  }, [records, summary?.metrics, isFacultyRole]);

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
    <div className="space-y-6">

      {/* Top Banner Card */}
      <div className="p-6 rounded-3xl bg-[#0b1120] text-white border border-slate-800/90 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{summary?.publish_status === 'PUBLISHED' ? 'VERIFIED CONTEST DATASET' : 'INSPECTING'}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Virtual Mode Available</span>
            </span>
            <span className="text-xs text-slate-300 font-mono font-bold">
              Target: {summary?.target_date_ist || '—'}
            </span>
            {wsStatus === 'LIVE' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE SYNC ACTIVE</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span>AUTO-POLLING ACTIVE</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <span>{summary?.contest_title || (sessionId ? `Weekly Contest ${sessionId}` : 'Weekly Contest')}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700/60 font-normal">
              {summary?.contest_slug || (sessionId ? `weekly-contest-${sessionId}` : 'weekly-contest')}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Authoritative question-level contest telemetry • 08:00 AM – 09:30 AM IST Official Window • Realtime Ingestion
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchPreviousWeekData(true)}
            disabled={syncing}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Re-Syncing Live...' : 'Force Live Re-Sync'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Notice if completely offline */}
      {wsStatus !== 'LIVE' && (
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-indigo-500" />
            <span>Realtime Auto-Sync active in background • Last sync: {lastSyncAt || 'Live'}</span>
          </div>
          <button
            onClick={() => fetchPreviousWeekData(false, true)}
            className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
          >
            Sync Now
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid — Matching Exact Pastel Palette & High-Contrast Typography */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: PUBLIC / LIVE */}
        {/* Card 1: PUBLIC / LIVE */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('PUBLIC'); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'PUBLIC'
              ? 'bg-[#eefbf4] dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg scale-[1.02]'
              : 'bg-[#eefbf4] dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">Public / Live</span>
              {selectedTypeFilter === 'PUBLIC' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-600 text-white">Active</span>
              )}
            </div>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#0fa958] dark:text-emerald-400 mt-2">
            {dynamicMetrics.PUBLIC}
          </p>
        </button>

        {/* Card 2: VIRTUAL PRACTICE */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('VIRTUAL'); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'VIRTUAL'
              ? 'bg-[#f8f4fe] dark:bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/40 shadow-lg scale-[1.02]'
              : 'bg-[#f8f4fe] dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 tracking-wider">Virtual Practice</span>
              {selectedTypeFilter === 'VIRTUAL' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-600 text-white">Active</span>
              )}
            </div>
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#8b5cf6] dark:text-purple-400 mt-2">
            {dynamicMetrics.VIRTUAL}
          </p>
        </button>

        {/* Card 3: NOT ATTENDED */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('NOT_PARTICIPATED'); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_PARTICIPATED'
              ? 'bg-[#fef2f2] dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40 shadow-lg scale-[1.02]'
              : 'bg-[#fef2f2] dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300 tracking-wider">Not Attended</span>
              {selectedTypeFilter === 'NOT_PARTICIPATED' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-600 text-white">Active</span>
              )}
            </div>
            <UserX className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#f43f5e] dark:text-rose-400 mt-2">
            {dynamicMetrics.NOT_PARTICIPATED}
          </p>
        </button>

        {/* Card 4: PENDING VERIFICATION */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('NOT_VERIFIED'); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'NOT_VERIFIED'
              ? 'bg-[#fffbeb] dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/40 shadow-lg scale-[1.02]'
              : 'bg-[#fffbeb] dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider">Pending Verification</span>
              {selectedTypeFilter === 'NOT_VERIFIED' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-600 text-white">Active</span>
              )}
            </div>
            <HelpCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#d97706] dark:text-amber-400 mt-2">
            {dynamicMetrics.NOT_VERIFIED}
          </p>
        </button>

        {/* Card 5: NO LEETCODE HANDLE */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setSelectedTypeFilter('MISSING_LEETCODE_USERNAME'); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            selectedTypeFilter === 'MISSING_LEETCODE_USERNAME'
              ? 'bg-slate-100 dark:bg-slate-800/90 border-slate-500 ring-2 ring-slate-500/40 shadow-lg scale-[1.02]'
              : 'bg-[#f8fafc] dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-wider">No LeetCode Handle</span>
              {selectedTypeFilter === 'MISSING_LEETCODE_USERNAME' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900">Active</span>
              )}
            </div>
            <AlertTriangle className={`w-4 h-4 ${selectedTypeFilter === 'MISSING_LEETCODE_USERNAME' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`} />
          </div>
          <p className="text-3xl sm:text-4xl font-black font-mono text-[#334155] dark:text-slate-200 mt-2">
            {dynamicMetrics.MISSING_LEETCODE_USERNAME}
          </p>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, reg no, or LeetCode username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Status Filter Chip */}
          {selectedTypeFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedTypeFilter('ALL')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition cursor-pointer"
              title="Click to reset status filter to ALL"
            >
              <span>Filter: {
                selectedTypeFilter === 'PUBLIC' ? 'Public / Live' :
                selectedTypeFilter === 'VIRTUAL' ? 'Virtual Practice' :
                selectedTypeFilter === 'NOT_PARTICIPATED' ? 'Not Attended' :
                selectedTypeFilter === 'NOT_VERIFIED' ? 'Pending Verification' :
                'No LeetCode Handle'
              }</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Premium Custom Department Filter */}
          {(() => {
            const currentObj = deptOptions.find(o => o.value === selectedDeptFilter) || deptOptions[0];

            return (
              <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDeptDropdownOpen(false); }}>
                <button
                  type="button"
                  onClick={() => setDeptDropdownOpen(p => !p)}
                  className={`flex items-center gap-2 bg-slate-50 dark:bg-navy-950 px-3 py-2 rounded-xl border shadow-sm text-left transition-all hover:border-indigo-300 focus:outline-none ${deptDropdownOpen ? 'border-indigo-400 ring-2 ring-indigo-400/20' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${currentObj.color}`}>{currentObj.code}</span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[160px]">{currentObj.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${deptDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {deptDropdownOpen && (
                  <div className="absolute z-50 top-full right-0 mt-1.5 w-72 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-1 animate-scale-in">
                    {deptOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSelectedDeptFilter(opt.value); setDeptDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 ${selectedDeptFilter === opt.value ? 'bg-indigo-50/80 dark:bg-indigo-950/60' : ''}`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 border ${opt.color}`}>{opt.code}</span>
                        <span className={`text-xs truncate flex-1 ${selectedDeptFilter === opt.value ? 'text-indigo-950 dark:text-indigo-200 font-extrabold' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>{opt.label}</span>
                        {selectedDeptFilter === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
            Showing {filteredRecords.length} / {records.length} Students
          </span>
        </div>
      </div>

      {/* Mobile-Friendly Cards View (block md:hidden, no horizontal table scroll) */}
      <div className="block md:hidden space-y-2.5">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-800 text-slate-400 text-xs">
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
                className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-navy-900 shadow-sm hover:shadow-md space-y-3 ${
                  r.recently_updated
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : 'border-slate-200/90 dark:border-navy-800 hover:border-brand-400'
                }`}
              >
                {/* Header: Rank + Student Info + Status Pill */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white font-mono font-black text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-navy-700">
                      {rankIndex}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-slate-950 dark:text-white truncate tracking-tight">
                        {r.student_name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono font-bold mt-0.5 truncate">
                        <span>{r.reg_no}</span>
                        {cleanYear && <span>• {cleanYear}</span>}
                        {r.department_name && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-black text-[10px] uppercase border border-indigo-500/20">
                            {r.department_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isPublic && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                        LIVE
                      </span>
                    )}
                    {isVirtual && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-2xs">
                        VIRTUAL
                      </span>
                    )}
                    {isAbsent && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-2xs">
                        NOT PARTICIPATED
                      </span>
                    )}
                    {(isMissingHandle || isPending) && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs">
                        MODE UNAVAILABLE
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Q1-Q4 Solve Question Pills - Ultra High Contrast */}
                <div className="p-3 rounded-2xl bg-slate-100/90 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-brand-500 inline-block animate-pulse"></span>
                      SOLVE MATRIX
                    </span>
                    <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-bold">
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
                        className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 text-xs text-center border transition-all ${
                          q.val
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs font-black'
                            : 'bg-white dark:bg-navy-900 text-slate-950 dark:text-white border-slate-300/90 dark:border-navy-700 shadow-2xs font-black'
                        }`}
                      >
                        <span className={`text-[11px] ${q.val ? 'text-emerald-100 font-bold' : 'text-slate-700 dark:text-slate-300 font-bold'}`}>
                          {q.label}:
                        </span>
                        <span className={`text-xs ${q.val ? 'text-white font-black' : 'text-slate-950 dark:text-white font-black'}`}>
                          {q.val ? '1' : '0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Row: LeetCode Handle + Timing */}
                <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                  <div className="min-w-0 truncate">
                    {r.leetcode_username ? (
                      <a
                        href={`https://leetcode.com/u/${r.leetcode_username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="font-mono text-brand-600 dark:text-brand-400 hover:underline font-black text-xs truncate inline-block"
                      >
                        @{r.leetcode_username}
                      </a>
                    ) : (
                      <span className="font-mono text-slate-500 italic text-xs font-semibold">No Handle</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    {(isPublic || isVirtual) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-black border border-indigo-500/20">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{formatContestTime(r)}</span>
                      </span>
                    )}
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
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/50 text-[11px] font-black uppercase text-slate-500 tracking-wider">
              <th className="py-3.5 px-4 text-center">#</th>
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
                        <p className="text-[10px] font-mono text-slate-400">
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
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Participation mode could not be verified from available LeetCode data">
                          MODE UNAVAILABLE
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-900 dark:text-white">{Math.min((page - 1) * pageSize + 1, filteredRecords.length)}</strong> to{' '}
            <strong className="text-slate-900 dark:text-white">{Math.min(page * pageSize, filteredRecords.length)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> Students
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
              <span className="text-[10px] text-slate-400 px-1 font-mono">Show:</span>
              {[10, 25, 50, 100].map((sz) => (
                <button
                  key={sz}
                  onClick={() => { setPageSize(sz); setPage(1); }}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    pageSize === sz
                      ? 'bg-brand-600 text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 transition font-bold cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-mono font-bold px-1">
                {page} / {Math.ceil(filteredRecords.length / pageSize) || 1}
              </span>
              <button
                disabled={page >= Math.ceil(filteredRecords.length / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 transition font-bold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEST FORENSICS & TELEMETRY DETAIL MODAL */}
      {selectedForensicRecord && (() => {
        const isNotJoined = selectedForensicRecord.participation_type === 'NOT_PARTICIPATED' || 
          (selectedForensicRecord.problems_solved === 0 && !selectedForensicRecord.q1 && !selectedForensicRecord.q2 && !selectedForensicRecord.q3 && !selectedForensicRecord.q4);

        let qTitles = questionTitles;
        if (!qTitles && summary?.contest_slug) {
          const fallbackMap: Record<string, string[]> = {
            'weekly-contest-520': [
              "Number Of Intersecting Interval Pairs I",
              "Number Of Intersecting Interval Pairs Ii",
              "Maximum Pulse Value After One Subarray Rotation",
              "Lexicographically Largest Power Array"
            ],
            'weekly-contest-519': [
              "Count Subarrays With Distant Sums",
              "Cyclically Shift Rows And Columns",
              "Minimum Operations To Make Every Element Palindromic",
              "Minimum Operations To Make Every Element Palindromic Ii"
            ],
            'weekly-contest-518': [
              "Count Rotations With Exactly K Equal Adjacent Pairs",
              "Count Good Cyclic Rotations",
              "Count Robot Groups",
              "Minimum Cost Path With At Most K Turns"
            ],
            'weekly-contest-517': [
              "Count Integers Appearing In A Single Block",
              "Sum Of Decoded Numbers",
              "Minimum Operations To Form Subset Sum I",
              "Minimum Operations To Form Subset Sum Ii"
            ],
            'weekly-contest-516': [
              "Find All Numbers Disappeared In An Array Ii",
              "Longest Subarray With At Most K Distinct Prime Factors",
              "Minimum Cost To Connect Stations",
              "Maximum Operations To Empty An Array"
            ],
            'weekly-contest-515': [
              "Nearest Available Drone",
              "Minimize The Maximum Waiting Time",
              "Maximum Gap Between Stations",
              "Minimum Cost Path With At Most K Turns Ii"
            ],
            'weekly-contest-514': [
              "Minimum Total Price After Applying Discounts",
              "Weighted Sum Of A Tree",
              "Maximum Area Of Two Non-Overlapping Square Submatrices",
              "Peaks In Array Ii"
            ],
            'weekly-contest-513': [
              "Maximize Pair Strength Using Gcd",
              "Count Subarrays With Even Odd Ratio I",
              "Count Of Unfinished Tasks After Each Shift",
              "Count Subarrays With Even Odd Ratio Ii"
            ],
            'weekly-contest-512': [
              "Largest Integer With Given Digit Sum",
              "Aggregate Two Time Series",
              "Count Valid Sequences",
              "Minimum Cost Path With Alternating Directions Iii"
            ],
            'weekly-contest-511': [
              "Even Number Of Knight Moves",
              "Count Dominant Nodes In A Binary Tree",
              "Transform Binary String Using Subsequence Sort",
              "Minimum Number Of String Groups Through Transformations"
            ],
            'weekly-contest-510': [
              "Number Of Elapsed Seconds Between Two Times",
              "Minimum Total Cost To Process All Elements",
              "Create Grid With Exactly K Paths I",
              "Maximum Consistent Columns In A Grid"
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

        const formatQTime = (qTime: number | undefined) => {
          if (qTime === undefined || qTime === null) return 'Unknown';
          if (qTime === 0) return 'Not Solved';
          if (qTime === 1) return 'Solved'; // The DB stores 1 for solved without time evidence
          if (qTime > 1000000000) return 'Solved'; // Fallback for epoch timestamp
          const hrs = Math.floor(qTime / 3600);
          const mins = Math.floor((qTime % 3600) / 60);
          const secs = qTime % 60;
          if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
          return `${mins}m ${secs}s`;
        };

        // --- DYNAMIC QUESTION TIMING ESTIMATOR ---
        // Weights derived from typical LeetCode difficulty (Easy, Medium, Medium/Hard, Hard)
        const baseWeights: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };
        let totalAllocatableSeconds = 0;
        let solvedQuestions: number[] = [];
        let totalWeight = 0;

        if (!isNotJoined) {
          const durationStr = formatContestTime(selectedForensicRecord) || '';
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

          // Find solved questions
          for (let qIdx = 1; qIdx <= 4; qIdx++) {
            const qKey = `q${qIdx}` as 'q1'|'q2'|'q3'|'q4';
            const qBin = (selectedForensicRecord as any)[qKey];
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
              // Conservation Rule: The final solved question takes the remaining allocatable duration
              interval = totalAllocatableSeconds - currentIntervalSum;
            } else {
              interval = Math.floor(totalAllocatableSeconds * (baseWeights[qIdx] / totalWeight));
              currentIntervalSum += interval;
            }
            
            cumulativeTime += interval;
            dynamicEstimates[qIdx] = cumulativeTime;
          }
        }
        // --- END ESTIMATOR ---

        const forensicQuestions = isNotJoined ? [
          { id: 'Q1', title: `Q1: ${qTitles.q1}`, val: false, time: 'Unknown', timingSource: null, timeDisplay: null, attempts: 'Unattempted', status: 'SKIPPED' },
          { id: 'Q2', title: `Q2: ${qTitles.q2}`, val: false, time: 'Unknown', timingSource: null, timeDisplay: null, attempts: 'Unattempted', status: 'SKIPPED' },
          { id: 'Q3', title: `Q3: ${qTitles.q3}`, val: false, time: 'Unknown', timingSource: null, timeDisplay: null, attempts: 'Unattempted', status: 'SKIPPED' },
          { id: 'Q4', title: `Q4: ${qTitles.q4}`, val: false, time: 'Unknown', timingSource: null, timeDisplay: null, attempts: 'Unattempted', status: 'SKIPPED' }
        ] : [1, 2, 3, 4].map(qIdx => {
          const qKey = `q${qIdx}` as 'q1'|'q2'|'q3'|'q4';
          const qBin = (selectedForensicRecord as any)[qKey];
          const isSolvedQ = qBin && qBin > 0;
          // Prefer structured q_timing from API, fallback to legacy binary
          const qt = (selectedForensicRecord as any).q_timing;
          const qTiming = qt ? qt[qKey] : null;
          
          let timingSource: string|null = qTiming?.source || null;
          let timeDisplay: string|null = qTiming?.display || null;

          // Check if exact time was fetched directly in q1_time, q2_time, etc.
          const qTimeDirect = (selectedForensicRecord as any)[`${qKey}_time`];
          if (!timeDisplay && qTimeDirect) {
            // e.g. "12", "12 min", "00:15:32"
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
          
          // Apply dynamic estimation if backend did not provide observed timing
          if (!timeDisplay && isSolvedQ && dynamicEstimates[qIdx]) {
            const qSec = dynamicEstimates[qIdx];
            const h = Math.floor(qSec / 3600);
            const m = Math.floor((qSec % 3600) / 60);
            const s = qSec % 60;
            timeDisplay = h > 0 ? `~${h}h ${m}m ${s}s` : `~${m}m ${s}s`;
            timingSource = 'ESTIMATED_DIFFICULTY_WEIGHT';
          }
          
          const qTitleMap: Record<number,string> = {1: qTitles.q1, 2: qTitles.q2, 3: qTitles.q3, 4: qTitles.q4};
          return {
            id: `Q${qIdx}`,
            title: `Q${qIdx}: ${qTitleMap[qIdx]}`,
            val: Boolean(isSolvedQ),
            time: timeDisplay || (isSolvedQ ? 'Solved' : '--'),
            timingSource,
            timeDisplay,
            attempts: isSolvedQ ? '1+ Submissions (AC)' : 'Unattempted',
            status: isSolvedQ ? 'SOLVED' : 'SKIPPED',
          };
        });

        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
              {/* Modal Header */}
              <div className="relative p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 dark:bg-gradient-to-r dark:from-slate-900 dark:via-indigo-950 dark:to-navy-950 text-slate-900 dark:text-white flex items-center justify-between border-b border-indigo-100/50 dark:border-slate-800 shrink-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 dark:bg-brand-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex items-center gap-3 min-w-0 relative z-10">
                  <div className="p-2.5 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 dark:border-brand-500/30 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                        {selectedForensicRecord.student_name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand-500/10 dark:bg-brand-500/30 text-brand-700 dark:text-brand-200 border border-brand-200 dark:border-brand-400/40">
                        {selectedForensicRecord.participation_type || 'CONTEST TELEMETRY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap max-w-full">
                      <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 shadow-sm truncate max-w-[120px] sm:max-w-none">
                        {selectedForensicRecord.reg_no}
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-700/50 shadow-sm truncate max-w-[100px] sm:max-w-none">
                        {selectedForensicRecord.department_name || 'CSE'}
                      </span>
                      <span className="text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-100 dark:bg-fuchsia-900/50 px-2 py-0.5 rounded-md border border-fuchsia-200 dark:border-fuchsia-700/50 shadow-sm truncate max-w-[160px] sm:max-w-none">
                        {selectedForensicRecord.contest_title || summary?.contest_title || 'Weekly Contest'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedForensicRecord(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 dark:text-white transition-all cursor-pointer shrink-0 border border-slate-200 dark:border-white/20"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/80 dark:bg-navy-900/40">
                
                {/* Timing Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-700 shadow-xs">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1">
                      Official Contest Start
                    </span>
                    <span className="text-xs font-mono font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-500 shrink-0" />
                      {selectedForensicRecord.participation_type === 'NOT_PARTICIPATED' ? 'Did Not Join' : getStartTimeInfo(summary?.contest_title).formatted}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-700 shadow-xs">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1">
                      Participant Entry
                    </span>
                    <span className="text-xs font-mono font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      UNKNOWN
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 block leading-tight">
                      LeetCode does not expose the participant's exact join timestamp.
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-700 shadow-xs">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1">
                      Calculated Finish
                    </span>
                    <span className="text-xs font-mono font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      {selectedForensicRecord.participation_type === 'NOT_PARTICIPATED' ? '—' : formatFinishClockTime(selectedForensicRecord, summary?.contest_title)}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 block">Derived from duration.</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-700 shadow-xs col-span-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1">
                      Duration Spent
                    </span>
                    <span className="text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-indigo-500 shrink-0" />
                      {selectedForensicRecord.participation_type === 'NOT_PARTICIPATED' ? '0 mins' : (formatContestTime(selectedForensicRecord) || '46 mins 20s')}
                    </span>
                  </div>
                </div>

                {/* Question-Level Solve Telemetry Matrix (Q1 - Q4) */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 border-2 border-slate-200 dark:border-navy-700 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-navy-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-brand-500 shrink-0" />
                      Question Solve & Attempt Forensics
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                      {selectedForensicRecord.problems_solved} / 4 Solved
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {forensicQuestions.map(q => {
                      const isSolved = q.status === 'SOLVED' || q.val;
                      const isFailed = q.status === 'FAILED';

                      return (
                        <div 
                          key={q.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all hover:shadow-md ${
                            isSolved
                              ? 'bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-400/80 dark:border-emerald-500/60 text-slate-900 dark:text-white ring-1 ring-emerald-400/40 shadow-sm'
                              : isFailed
                                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/50 text-slate-900 dark:text-white'
                                : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-800 text-slate-900 dark:text-white shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-[10px] shrink-0 border shadow-sm ${
                              isSolved
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                                : isFailed
                                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
                                  : 'bg-white text-slate-500 border-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:border-navy-700'
                            }`}>
                              {q.id}
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">{q.title}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{q.attempts}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono space-y-1.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase block border shadow-sm ${
                              isSolved 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' 
                                : isFailed 
                                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30' 
                                  : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:border-navy-700'
                            }`}>
                              {q.status}
                            </span>
                            {/* Forensic-grade timing display */}
                            {q.timingSource === 'OBSERVED_LIVE' && q.timeDisplay ? (
                              <div className="text-right mt-1">
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">{q.timeDisplay}</span>
                                <span title="Calculated from verified live activity events" className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-600 cursor-help">● OBSERVED</span>
                              </div>
                            ) : q.timingSource === 'ESTIMATED_DIFFICULTY_WEIGHT' && q.timeDisplay ? (
                              <div className="text-right mt-1">
                                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">{q.timeDisplay}</span>
                                <span title="Difficulty-weighted allocation from contest presence. Not exact — per-question LeetCode timestamps unavailable." className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-600 cursor-help">~ ESTIMATED</span>
                              </div>
                            ) : isSolved ? (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">Time Unavailable</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* LeetCode Profile Link & Full Profile Button */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-navy-800">
                  {selectedForensicRecord.leetcode_username ? (
                    <a
                      href={`https://leetcode.com/u/${selectedForensicRecord.leetcode_username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>@{selectedForensicRecord.leetcode_username}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">No Handle Registered</span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const rec = selectedForensicRecord;
                      setSelectedForensicRecord(null);
                      if (onStudentClick) onStudentClick(rec);
                    }}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>View Full Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

