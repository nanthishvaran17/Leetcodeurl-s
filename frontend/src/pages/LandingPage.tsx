import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CollegeLogo } from '../components/CollegeLogo';
import { Shield, ArrowRight, Users, Layers, Activity, Star, LayoutGrid, List, RefreshCw, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Building2, GraduationCap, RotateCcw, Filter, Search, X, ArrowUpDown, SortAsc, SortDesc, Award, SlidersHorizontal } from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import { CountdownTimer } from '../components/CountdownTimer';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import api, { triggerFullSync, triggerTargetedSync, getSyncStatus, clearApiCache } from '../services/api';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { filterAndSortStudents, formatDepartmentName, normalizeDepartment } from '../utils/filterUtils';
import { getCachedStudents, saveCachedStudents } from '../utils/rosterCache';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';
import { useAuth } from '../context/AuthContext';
import { studentLiveStore } from '../stores/studentLiveStore';
import { MobileStudentShowcaseFilters } from '../components/mobile/MobileStudentShowcaseFilters';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function formatAgo(ts?: string): string {
  if (!ts) return 'Not synced yet';
  const diffMs = Date.now() - parseUtcTime(ts);
  if (diffMs <= 0) return 'Just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface LandingPageProps {
  summaryData: any;
  onViewDashboard: () => void;
  onOpenLogin: () => void;
  onSelectStudent?: (student: StudentData) => void;
  onViewForColleges?: () => void;
}

// million-ignore
export const LandingPage: React.FC<LandingPageProps> = ({
  summaryData,
  onViewDashboard,
  onOpenLogin,
  onSelectStudent,
  onViewForColleges
}) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [yearLevel, setYearLevel] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [solvedFilter, setSolvedFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('top_solved');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);
  const [mobileFilterTab, setMobileFilterTab] = useState<'all' | 'department' | 'year' | 'performance' | 'sort'>('all');
  const loggedInUser = useMemo(() => {
    if (user) return user;
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [user]);

  const isFacultyRole = useMemo(() => {
    const roleClean = (loggedInUser?.role || user?.role || '').trim().toLowerCase();
    return ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
  }, [loggedInUser?.role, user?.role]);

  const [students, setStudents] = useState<StudentData[]>(() => {
    try {
      const stored = localStorage.getItem('user');
      const u = stored ? JSON.parse(stored) : null;
      const roleClean = (u?.role || '').trim().toLowerCase();
      const isFaculty = ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
      if (isFaculty && u?.id) {
        // For faculty: load their scoped cache — backend enforces the correct student boundary
        const cached = getCachedStudents(u.id);
        if (cached && cached.length > 0) return cached;
        return [];
      }
    } catch {}
    const cached = getCachedStudents();
    return (cached && cached.length > 0) ? cached : [];
  });

  useEffect(() => {
    // Strictly prevent loading public 302 canonical roster for faculty/staff mentors
    if (!isFacultyRole && (!students || students.length === 0)) {
      import('../data/canonicalRoster').then(m => {
        if (m.CANONICAL_ROSTER && m.CANONICAL_ROSTER.length > 0) {
          setStudents(m.CANONICAL_ROSTER);
        }
      }).catch(() => {});
    }
  }, [isFacultyRole]);

  // Faculty flush guard removed — backend enforces the correct student boundary per role.
  // Previously flushed state when students.length > 30 which incorrectly blocked mentors with > 30 assigned students.
  const [displayCount, setDisplayCount] = useState<number>(32);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    processed: number;
    successful: number;
    failed: number;
    pending_usernames?: number;
    current_student?: string;
    current_username?: string;
    is_running: boolean;
    last_sync_time?: string;
    triggered_by?: string;
  } | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState<boolean>(false);
  const pollTimerRef = useRef<any>(null);

  // Real-time WebSocket streaming subscription for true per-student progress
  useLiveLeaderboard((data) => {
    if (!data) return;

    if (data.type === 'sync_progress') {
      const tot = data.total || summaryData?.total_students || students.length || 0;
      setSyncProgress(prev => {
        const nextProcessed = Math.max(prev?.processed ?? 0, data.processed ?? 0);
        return {
          total: tot,
          processed: nextProcessed,
          successful: data.successful ?? (nextProcessed - (data.failed || 0) - (data.pending || 0)),
          failed: data.failed || 0,
          pending_usernames: data.pending || 0,
          current_student: data.current_student || prev?.current_student,
          current_username: data.current_username || prev?.current_username,
          is_running: true
        };
      });

      // Update student card progressively in React state without full page reload
      if (data.student_update) {
        const u = data.student_update;
        setStudents(prev => prev.map(st => {
          if (st.id === u.id || (st.reg_no && st.reg_no === u.reg_no)) {
            return {
              ...st,
              username: u.username || st.username,
              total_solved: u.total_solved ?? st.total_solved,
              easy_solved: u.easy_solved ?? st.easy_solved,
              medium_solved: u.medium_solved ?? st.medium_solved,
              hard_solved: u.hard_solved ?? st.hard_solved,
              stats: {
                ...st.stats,
                total_solved: u.total_solved ?? st.stats?.total_solved,
                easy_solved: u.easy_solved ?? st.stats?.easy_solved,
                medium_solved: u.medium_solved ?? st.stats?.medium_solved,
                hard_solved: u.hard_solved ?? st.stats?.hard_solved,
                contest_rating: u.contest_rating ?? st.stats?.contest_rating,
                sync_status: u.sync_status || st.stats?.sync_status,
                status: u.status || st.stats?.status,
                last_verified_at: new Date().toISOString()
              }
            };
          }
          return st;
        }));
      }
    } else if (data.type === 'STUDENT_BATCH_UPDATED' && Array.isArray(data.updates)) {
      setStudents(prev => {
        const updateMap = new Map(data.updates.map((u: any) => [u.id, u]));
        return prev.map(st => {
          const u: any = updateMap.get(st.id);
          if (u) {
            return {
              ...st,
              username: u.username || st.username,
              stats: {
                ...st.stats,
                total_solved: u.total_solved ?? st.stats?.total_solved,
                easy_solved: u.easy_solved ?? st.stats?.easy_solved,
                medium_solved: u.medium_solved ?? st.stats?.medium_solved,
                hard_solved: u.hard_solved ?? st.stats?.hard_solved,
                contest_rating: u.contest_rating ?? st.stats?.contest_rating,
                sync_status: u.sync_status || st.stats?.sync_status,
                status: u.status || st.stats?.status,
                last_verified_at: new Date().toISOString()
              }
            };
          }
          return st;
        });
      });
    } else if (data.type === 'STUDENT_UPDATED') {
      setStudents(prev => prev.map(st => {
        if (st.id === data.student_id) {
          return {
            ...st,
            username: data.username || st.username,
            name: data.name || st.name,
            stats: {
              ...(st.stats || {}),
              sync_status: data.sync_status || st.stats?.sync_status,
              total_solved: data.total_solved !== undefined ? data.total_solved : st.stats?.total_solved
            }
          };
        }
        return st;
      }));
    } else if (data.type === 'SYNC_COMPLETED') {
      const isScoped = isFacultyRole || isFiltered;
      const targetCohortCount = (isFiltered ? sortedList : students).length;
      const tot = isScoped && targetCohortCount > 0 ? targetCohortCount : (data.summary?.total_students || summaryData?.total_students || students.length || 0);
      const formattedTime = data.summary?.completed_at_ist || (data.summary?.completed_at ? new Date(data.summary.completed_at.endsWith('Z') ? data.summary.completed_at : data.summary.completed_at + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST' : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST');
      setSyncProgress({
        total: tot,
        processed: tot,
        successful: isScoped && targetCohortCount > 0 ? targetCohortCount : (data.summary?.profile_verified ?? data.summary?.full_dataset_synced ?? (tot - (data.summary?.fetch_failed ?? 0) - (data.summary?.pending_username ?? 0))),
        failed: isScoped ? 0 : (data.summary?.fetch_failed ?? 0),
        pending_usernames: isScoped ? 0 : (data.summary?.pending_username ?? 0),
        is_running: false,
        last_sync_time: formattedTime,
        triggered_by: data.summary?.triggered_by
      });
      setRefreshing(false);
      fetchFilteredStudents();
      window.dispatchEvent(new Event('refresh_dashboard_summary'));
    }
  });

  useEffect(() => {
    if (user) {
      const roleClean = (user.role || '').trim().toLowerCase();
      const isGlobalLeader = ['admin', 'administrator', 'superadmin', 'super_admin', 'super admin', 'principal', 'management', 'director'].includes(roleClean);
      if (!isGlobalLeader) {
        let userDeptCode: string | null = null;
        if (user.authorized_department_codes && user.authorized_department_codes.length > 0) {
          userDeptCode = user.authorized_department_codes[0];
        } else if (user.department) {
          userDeptCode = user.department;
        }
        if (userDeptCode && selectedDept === 'all') {
          setSelectedDept(userDeptCode);
        }
      } else {
        if (selectedDept !== 'all') {
          setSelectedDept('all');
        }
      }
    }
  }, [user]);

  useEffect(() => {
    fetchDepartments();
    fetchFilteredStudents();

    // Check if sync is already running or completed on mount
    const checkInitialSync = async () => {
      try {
        const statusData = await getSyncStatus();
        const totalCount = statusData.total_students || statusData.total || summaryData?.total_students || students.length || 0;
        if (statusData.is_running) {
          setSyncProgress({
            total: totalCount,
            processed: statusData.students_processed ?? statusData.completed ?? 0,
            successful: statusData.successful ?? statusData.success ?? 0,
            failed: statusData.failed ?? 0,
            pending_usernames: statusData.pending_usernames ?? 0,
            current_student: statusData.current_student,
            current_username: statusData.current_username,
            is_running: true,
            last_sync_time: statusData.last_sync_timestamp,
            triggered_by: statusData.triggered_by || statusData.last_triggered_by
          });
          startPollingProgress();
        } else if (statusData.status === 'COMPLETED' || statusData.operation === 'COMPLETED') {
          const compProcessed = statusData.students_processed ?? statusData.completed ?? totalCount;
          const successfulCount = statusData.successful ?? summaryData?.verified_profiles ?? Math.max(0, totalCount - (statusData.failed ?? summaryData?.failed_sync ?? 0) - (statusData.pending_usernames ?? summaryData?.pending_sync ?? 0));
          setSyncProgress({
            total: totalCount,
            processed: compProcessed,
            successful: successfulCount,
            failed: statusData.failed ?? summaryData?.failed_sync ?? 0,
            pending_usernames: statusData.pending_usernames ?? summaryData?.pending_sync ?? 0,
            current_student: undefined,
            current_username: undefined,
            is_running: false,
            last_sync_time: statusData.last_sync_timestamp,
            triggered_by: statusData.triggered_by || statusData.last_triggered_by
          });
        }
      } catch (err) {
        console.warn("Initial sync status check error:", err);
      }
    };
    checkInitialSync();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);


  const startPollingProgress = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let consecutiveErrors = 0;
    let pollCount = 0;

    pollTimerRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const statusData = await getSyncStatus();
        consecutiveErrors = 0;

        const rawComp = statusData.students_processed ?? statusData.completed ?? statusData.processed ?? 0;
        const isScoped = isFacultyRole || isFiltered;
        const targetCohort = isFiltered ? sortedList : students;
        const targetCohortCount = targetCohort.length;
        const totalCount = isScoped && targetCohortCount > 0 ? targetCohortCount : (statusData.total_students || statusData.total || students.length || 0);

        setSyncProgress(prev => {
          const currentProcessed = Math.min(totalCount, Math.max(prev?.processed ?? 0, rawComp));
          return {
            total: totalCount,
            processed: currentProcessed,
            successful: isScoped && targetCohortCount > 0 ? Math.min(targetCohortCount, statusData.successful ?? statusData.success ?? 0) : (statusData.successful ?? statusData.success ?? 0),
            failed: statusData.failed ?? 0,
            pending_usernames: statusData.pending_usernames ?? 0,
            current_student: statusData.current_student || prev?.current_student,
            current_username: statusData.current_username || prev?.current_username,
            is_running: statusData.is_running || (pollCount <= 2),
            last_sync_time: statusData.last_sync_timestamp,
            triggered_by: statusData.triggered_by || statusData.last_triggered_by
          };
        });

        // Stop polling ONLY when sync is no longer running (after warm up) OR when all records are processed
        if ((pollCount > 2 && !statusData.is_running) || (rawComp >= totalCount && totalCount > 0)) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRefreshing(false);
          await fetchFilteredStudents();
          window.dispatchEvent(new Event('refresh_dashboard_summary'));
          setSyncProgress({
            total: totalCount,
            processed: totalCount,
            successful: isScoped && targetCohortCount > 0 ? targetCohortCount : (statusData.successful ?? statusData.success ?? totalCount),
            failed: 0,
            pending_usernames: 0,
            current_student: undefined,
            current_username: undefined,
            is_running: false,
            last_sync_time: statusData.last_sync_timestamp || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST',
            triggered_by: statusData.triggered_by || statusData.last_triggered_by
          });
        }
      } catch (err) {
        consecutiveErrors += 1;
        console.warn(`Sync status poll warning (${consecutiveErrors}/5):`, err);
        if (consecutiveErrors >= 5) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRefreshing(false);
        }
      }
    }, 500);
  };

  const startSyncPolling = startPollingProgress;

  const isFiltered = (selectedDept !== 'all' || yearLevel !== 'all' || solvedFilter !== 'all' || Boolean(nameSearch && nameSearch.trim()));

  const handleRefreshAll = async () => {
    if (refreshing || syncProgress?.is_running) return;
    setRefreshing(true);

    const targetList = isFiltered ? sortedList : students;
    const initialTotal = targetList.length > 0 ? targetList.length : (isFiltered ? sortedList.length : (summaryData?.total_students ?? students.length));
    const devicePlatform = typeof window !== 'undefined' ? (window.navigator.platform || 'Browser') : 'Device';

    const userStr = localStorage.getItem('user');
    const uObj = userStr ? JSON.parse(userStr) : null;
    const isFaculty = isFacultyRole || ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(uObj?.role?.toLowerCase() || '');
    const requesterTag = isFaculty
      ? `Staff Mentor (${targetList.length} Students)`
      : (isFiltered ? `Filtered (${targetList.length} Students)` : `Admin (${devicePlatform})`);

    setSyncProgress({
      total: initialTotal,
      processed: 0,
      successful: 0,
      failed: 0,
      is_running: true,
      triggered_by: requesterTag
    });
    setShowSyncDetails(true);

    try {
      const studentIds = targetList
        .map(s => typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10))
        .filter((id): id is number => !isNaN(id) && id > 0);

      if ((isFiltered || isFaculty) && studentIds.length > 0) {
        const tag = isFaculty ? `Faculty Mentor (${studentIds.length} Students)` : requesterTag;
        await triggerTargetedSync(studentIds, tag);
      } else if (!isFaculty) {
        await triggerFullSync(requesterTag);
      }
      startSyncPolling();
    } catch (err: any) {
      console.error('[LIVE_SYNC_TRIGGER_ERROR]', err);
      setRefreshing(false);
      setSyncProgress({
        total: initialTotal,
        processed: 0,
        successful: 0,
        failed: 0,
        is_running: false
      });
    }
  };

  const handleRefreshStudent = useCallback(async (studentId: number) => {
    setRefreshingId(studentId);
    try {
      const res = await api.post(`/students/${studentId}/refresh`);
      if (res.data?.stats) {
        studentLiveStore.updateStudent(studentId, {
          stats: res.data.stats,
        } as any);
      }
      await fetchFilteredStudents();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  }, [fetchFilteredStudents]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data) && res.data.length >= 1) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.warn("Failed to fetch departments:", err);
    }
  };


  async function fetchFilteredStudents() {
    try {
      if (isFacultyRole) {
        try {
          const res = await api.get('/faculty-assignments/my-students');
          if (res.data && Array.isArray(res.data.students) && res.data.students.length > 0) {
            const facultyStudents = res.data.students.map((st: any) => ({
              ...st,
              department: typeof st.department === 'string' ? st.department : (st.department?.code || st.department?.name || 'CSE(CS)'),
              stats: st.stats || {
                total_solved: st.total_solved || 0,
                easy_solved: st.easy_solved || 0,
                medium_solved: st.medium_solved || 0,
                hard_solved: st.hard_solved || 0,
                contest_rating: st.contest_rating || 0,
                sync_status: st.sync_status || 'verified',
                status: st.status || 'ACTIVE',
                last_verified_at: st.last_synced || new Date().toISOString()
              }
            }));
            setStudents(facultyStudents);
            saveCachedStudents(facultyStudents, user?.id || loggedInUser?.id);
            return;
          }
        } catch (_err) {
          console.warn('Could not load from /faculty-assignments/my-students, falling back to leaderboard-fast');
        }
      }

      // Backend /students/leaderboard-fast already enforces RBAC scoping server-side.
      // For faculty mentors, backend returns ONLY assigned students — no frontend filter needed.
      const res = await api.get(`/students/leaderboard-fast?refresh=true&_t=${Date.now()}`);
      if (res.data && Array.isArray(res.data)) {
        setStudents(res.data);
        saveCachedStudents(res.data, isFacultyRole ? (user?.id || loggedInUser?.id) : undefined);
        return;
      }
      // Fallback to /students if leaderboard-fast fails
      const res2 = await api.get('/students');
      if (res2.data && Array.isArray(res2.data)) {
        setStudents(res2.data);
        saveCachedStudents(res2.data, isFacultyRole ? (user?.id || loggedInUser?.id) : undefined);
        return;
      }
      if (!isFacultyRole) {
        setStudents(prev => {
          if (prev && prev.length > 0) return prev;
          const cached = getCachedStudents();
          return (cached && cached.length > 0) ? cached : [];
        });
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.warn("fetchFilteredStudents error, preserving cached students:", err);
      if (!isFacultyRole) {
        setStudents(prev => {
          if (prev && prev.length > 0) return prev;
          const cached = getCachedStudents();
          return (cached && cached.length > 0) ? cached : [];
        });
      } else {
        setStudents([]);
      }
    }
  };

  useEffect(() => {
    fetchFilteredStudents();

    const handlePull = () => {
      clearApiCache();
      fetchDepartments();
      fetchFilteredStudents();
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => {
      window.removeEventListener('pull_to_refresh', handlePull);
    };
  }, [user?.id, user?.role, isFacultyRole]);

  // --- Combined Canonical Filter Pipeline: Dept + Academic Year + Name Search + Performance Range + Sort ---
  const { filteredAndSorted: sortedList, counts: performanceCounts } = useMemo(() => {
    const { filteredAndSorted, counts } = filterAndSortStudents(students, {
      department: selectedDept,
      academicYear: yearLevel,
      nameSearch,
      performanceRange: solvedFilter,
      sortBy
    });

    // Pre-calculate stable objects for React.memo to prevent DOM thrashing
    const stableList = filteredAndSorted.map((st, idx) => {
      const isSolver = (st.stats?.total_solved || st.total_solved || 0) > 0;
      const computedRank = (isSolver && (sortBy === 'top_solved' || sortBy === 'rating' || sortBy === 'streak') && selectedDept === 'all' && (yearLevel === 'ALL' || yearLevel === 'all') && (solvedFilter === 'ALL' || solvedFilter === 'all')) ? idx + 1 : st.college_rank;
      return {
        ...st,
        college_rank: isSolver ? (computedRank ?? (idx + 1)) : undefined
      };
    });

    return { filteredAndSorted: stableList, counts };
  }, [students, selectedDept, yearLevel, nameSearch, solvedFilter, sortBy]);

  const handleResetFilters = () => {
    setSelectedDept('all');
    setYearLevel('all');
    setNameSearch('');
    setSolvedFilter('all');
    setSortBy('top_solved');
    setDisplayCount(32);
  };

  // Compute live active student counts per department from current roster
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((st: any) => {
      const d = (typeof st.department === 'string' ? st.department : (st.department?.code || st.department?.name || '')).trim().toUpperCase();
      if (d) {
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    return counts;
  }, [students]);

  // Only departments that actually have enrolled students in the database
  const activeDepartmentsWithCounts = useMemo(() => {
    return departments
      .map(d => {
        const code = (d.code || d.name || '').trim().toUpperCase();
        const liveCount = departmentCounts[code] ?? d.student_count ?? 0;
        return {
          ...d,
          student_count: liveCount
        };
      })
      .filter(d => (d.student_count ?? 0) > 0);
  }, [departments, departmentCounts]);



  // Academic Year Dropdown Options (Batches: 2030, 2029, 2028, 2027)
  const yearOptions: DropdownOption[] = [
    { value: 'all', label: 'All Academic Years', badge: 'ALL' },
    { value: '1', label: '1st Year (Batch 2030)', badge: 'I Year' },
    { value: '2', label: '2nd Year (Batch 2029)', badge: 'II Year' },
    { value: '3', label: '3rd Year (Batch 2028)', badge: 'III Year' },
    { value: '4', label: 'Final Year (Batch 2027)', badge: 'IV Year' },
  ];

  // Performance Range Dropdown Options
  const performanceOptions: DropdownOption[] = [
    { value: 'all', label: 'All Solvers', badge: 'ALL', count: performanceCounts.total },
    { value: '500_plus', label: '500+ Solved', badge: '500+', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', count: performanceCounts.above500 },
    { value: '251_500', label: '251–500 Solved', badge: '251-500', badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20', count: performanceCounts.between251And500 },
    { value: '101_250', label: '101–250 Solved', badge: '101-250', badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', count: performanceCounts.between101And250 },
    { value: '1_100', label: '1–100 Solved', badge: '1-100', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', count: performanceCounts.between1And100 },
    { value: 'not_started', label: 'Not Started', badge: '0 Solved', badgeColor: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20', count: performanceCounts.notStarted }
  ];

  // Sort Options
  const sortOptions: DropdownOption[] = [
    { value: 'top_solved', label: 'Top Solvers (Highest First)', icon: Award },
    { value: 'low_solved', label: 'Lowest Solvers First', icon: ArrowUpDown },
    { value: 'name_asc', label: 'Student Name (A → Z)', icon: SortAsc },
    { value: 'name_desc', label: 'Student Name (Z → A)', icon: SortDesc },
    { value: 'streak', label: 'Highest Active Streak', icon: Activity },
    { value: 'rating', label: 'Highest Contest Rating', icon: Star }
  ];

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDept !== 'all') count++;
    if (yearLevel !== 'all') count++;
    if (solvedFilter !== 'all') count++;
    if (sortBy !== 'top_solved') count++;
    return count;
  }, [selectedDept, yearLevel, solvedFilter, sortBy]);

  // Active filter label helpers for mobile quick pills
  const activeDeptLabel = useMemo(() => {
    if (selectedDept === 'all') return 'All Depts';
    const found = departments.find(d => (d.code && d.code.toUpperCase() === selectedDept.toUpperCase()) || String(d.id) === String(selectedDept) || d.name === selectedDept);
    return found ? (found.code || found.name) : selectedDept;
  }, [selectedDept, departments]);

  const activeYearLabel = useMemo(() => {
    if (yearLevel === 'all') return 'All Years';
    const opt = yearOptions.find(o => o.value === yearLevel);
    return opt ? opt.badge || opt.label : yearLevel;
  }, [yearLevel, yearOptions]);

  const activePerformanceLabel = useMemo(() => {
    if (solvedFilter === 'all') return 'All Solvers';
    const opt = performanceOptions.find(o => o.value === solvedFilter);
    return opt ? opt.badge || opt.label : solvedFilter;
  }, [solvedFilter, performanceOptions]);

  const activeSortLabel = useMemo(() => {
    const opt = sortOptions.find(o => o.value === sortBy);
    if (!opt) return 'Top Solvers';
    if (sortBy === 'top_solved') return 'Top Solvers';
    if (sortBy === 'low_solved') return 'Lowest Solvers';
    if (sortBy === 'name_asc') return 'Name (A→Z)';
    if (sortBy === 'name_desc') return 'Name (Z→A)';
    if (sortBy === 'streak') return 'Highest Streak';
    if (sortBy === 'rating') return 'Highest Rating';
    return opt.label;
  }, [sortBy, sortOptions]);

  // Cohort-scoped metrics: strictly scoped to Faculty Mentor's allocated students or filtered cohort
  const isScopedView = isFacultyRole || isFiltered;
  const activeCohortList = isFiltered ? sortedList : students;
  const scopedTotal = activeCohortList.length;

  const cohortSyncMetrics = useMemo(() => {
    if (!isScopedView) return null;

    const total = scopedTotal;
    let successful = 0;
    let failed = 0;
    let pending = 0;

    for (const st of activeCohortList) {
      const syncStatus = String(st.stats?.sync_status || '').toLowerCase().trim();
      const status = String(st.stats?.status || (st as any).status || '').toLowerCase().trim();
      const hasSolved = (st.stats?.total_solved !== null && st.stats?.total_solved !== undefined && Number(st.stats.total_solved) > 0) ||
                        (st.total_solved !== null && st.total_solved !== undefined && Number(st.total_solved) > 0);
      const rawUsername = st.username || (st as any).canonical_username || (st as any).leetcode_username;
      const hasUsername = Boolean(rawUsername && String(rawUsername).trim() && String(rawUsername).trim().toUpperCase() !== 'N/A');

      if (syncStatus === 'failed' || syncStatus === 'invalid_username' || syncStatus === 'mismatch' || syncStatus === 'error' || syncStatus === 'invalid_profile') {
        failed++;
      } else if (!hasUsername || syncStatus === 'pending' || syncStatus === 'pending_username') {
        pending++;
      } else if (syncStatus === 'success' || syncStatus === 'ok' || syncStatus === 'verified' || syncStatus === 'stale' || status === 'verified' || hasSolved) {
        successful++;
      } else if (hasUsername && (st.stats?.total_solved === 0 || st.total_solved === 0)) {
        successful++;
      } else {
        pending++;
      }
    }

    return {
      total,
      successful,
      pending,
      failed
    };
  }, [isScopedView, scopedTotal, activeCohortList]);

  const displayTotal = useMemo(() => {
    if (isScopedView) return scopedTotal;
    return syncProgress?.total ?? (summaryData?.total_students || students.length || 0);
  }, [isScopedView, scopedTotal, syncProgress?.total, summaryData?.total_students, students.length]);

  const displayProcessed = useMemo(() => {
    if (syncProgress?.is_running) {
      return Math.min(displayTotal, syncProgress.processed || 0);
    }
    return displayTotal;
  }, [syncProgress?.is_running, syncProgress?.processed, displayTotal]);

  const displaySuccessful = useMemo(() => {
    if (isScopedView && cohortSyncMetrics) {
      if (syncProgress?.is_running) {
        return Math.min(cohortSyncMetrics.total, syncProgress.successful || 0);
      }
      return cohortSyncMetrics.successful;
    }
    if (syncProgress?.is_running) return syncProgress.successful;
    return syncProgress?.successful ?? (summaryData?.verification?.verified ?? summaryData?.verified_profiles ?? displayTotal);
  }, [isScopedView, cohortSyncMetrics, syncProgress?.is_running, syncProgress?.successful, summaryData, displayTotal]);

  const displayPending = useMemo(() => {
    if (isScopedView && cohortSyncMetrics) {
      if (syncProgress?.is_running) {
        return Math.max(0, syncProgress.pending_usernames ?? cohortSyncMetrics.pending);
      }
      return cohortSyncMetrics.pending;
    }
    if (syncProgress?.is_running) return syncProgress.pending_usernames ?? 0;
    return syncProgress?.pending_usernames ?? (summaryData?.verification?.pending ?? summaryData?.pending_sync ?? 0);
  }, [isScopedView, cohortSyncMetrics, syncProgress?.is_running, syncProgress?.pending_usernames, summaryData]);

  const displayFailed = useMemo(() => {
    if (isScopedView && cohortSyncMetrics) {
      if (syncProgress?.is_running) {
        return syncProgress.failed || 0;
      }
      return cohortSyncMetrics.failed;
    }
    return syncProgress?.failed ?? (summaryData?.failed_sync ?? 0);
  }, [isScopedView, cohortSyncMetrics, syncProgress?.is_running, syncProgress?.failed, summaryData]);

  const displayPercent = useMemo(() => {
    if (displayTotal <= 0) return 100;
    return Math.min(100, Math.round((displayProcessed / Math.max(1, displayTotal)) * 100));
  }, [displayProcessed, displayTotal]);

  const activeDepartmentDescription = useMemo(() => {
    const userName = (user?.name || (user as any)?.full_name || user?.username || '').trim();
    const userRole = (user?.role || '').trim();
    const roleClean = userRole.toLowerCase();
    const isGlobalLeader = ['admin', 'administrator', 'superadmin', 'super_admin', 'super admin', 'principal', 'management', 'director'].includes(roleClean);

    // 1. If user is a Global Executive (Principal, Management, Director, Super Admin)
    if (isGlobalLeader) {
      if (selectedDept && selectedDept !== 'all') {
        const matchedDept = departments.find(d => 
          (d.code && d.code.toUpperCase() === selectedDept.toUpperCase()) ||
          normalizeDepartment(d.code || d.name) === normalizeDepartment(selectedDept)
        );
        const deptFullName = matchedDept ? formatDepartmentName(matchedDept) : formatDepartmentName(selectedDept);
        return (
          <>
            for <span className="font-bold text-white">{userName}</span> {userRole ? <span className="text-emerald-300 font-semibold">({userRole})</span> : null} across <span className="font-bold text-white">{deptFullName}</span> department
          </>
        );
      }
      return (
        <>
          for <span className="font-bold text-white">{userName}</span> {userRole ? <span className="text-emerald-300 font-semibold">({userRole})</span> : null} across <span className="font-bold text-white">all institutional departments</span>
        </>
      );
    }

    // 2. Resolve department(s) for scoped roles (HOD / Faculty Mentor / Staff / Student)
    let userDeptNames: string[] = [];

    if (user?.authorized_department_codes && user.authorized_department_codes.length > 0) {
      userDeptNames = user.authorized_department_codes.map(c => formatDepartmentName(c));
    } else if (user?.department_id) {
      const matched = departments.find(d => d.id === user.department_id);
      if (matched) {
        userDeptNames = [formatDepartmentName(matched)];
      } else {
        userDeptNames = [formatDepartmentName(user.department_id)];
      }
    } else if ((user as any)?.department) {
      userDeptNames = [formatDepartmentName((user as any).department)];
    } else if ((user as any)?.department_name) {
      userDeptNames = [formatDepartmentName((user as any).department_name)];
    } else if ((user as any)?.dept) {
      userDeptNames = [formatDepartmentName((user as any).dept)];
    }

    // Filter out duplicate department names
    userDeptNames = Array.from(new Set(userDeptNames.filter(Boolean)));

    // 3. If user selected a specific department from the dropdown filter (not 'all')
    if (selectedDept && selectedDept !== 'all') {
      const matchedDept = departments.find(d => 
        (d.code && d.code.toUpperCase() === selectedDept.toUpperCase()) ||
        normalizeDepartment(d.code || d.name) === normalizeDepartment(selectedDept)
      );
      const deptFullName = matchedDept ? formatDepartmentName(matchedDept) : formatDepartmentName(selectedDept);
      
      if (userName) {
        return (
          <>
            for <span className="font-bold text-white">{userName}</span> {userRole ? <span className="text-emerald-300 font-semibold">({userRole})</span> : null} across <span className="font-bold text-white">{deptFullName}</span> department
          </>
        );
      }
      return (
        <>
          across <span className="font-bold text-white">{deptFullName}</span> department
        </>
      );
    }

    // 4. If logged-in user has assigned department(s) (HOD / Faculty / Staff / Student)
    if (userDeptNames.length > 0) {
      const isMulti = userDeptNames.length > 1;
      const deptText = userDeptNames.length === 1
        ? <span className="font-bold text-white">{userDeptNames[0]}</span>
        : userDeptNames.length === 2
        ? <><span className="font-bold text-white">{userDeptNames[0]}</span> &amp; <span className="font-bold text-white">{userDeptNames[1]}</span></>
        : <><span className="font-bold text-white">{userDeptNames.slice(0, -1).join(', ')}</span> &amp; <span className="font-bold text-white">{userDeptNames[userDeptNames.length - 1]}</span></>;

      if (userName) {
        return (
          <>
            for <span className="font-bold text-white">{userName}</span> {userRole ? <span className="text-emerald-300 font-semibold">({userRole})</span> : null} across {deptText} {isMulti ? 'departments' : 'department'}
          </>
        );
      }

      return (
        <>
          across {deptText} {isMulti ? 'departments' : 'department'}
        </>
      );
    }

    // 5. Default view across all departments (unauthenticated or unassigned)
    return (
      <>
        across <span className="font-bold text-white">all institutional departments</span>
      </>
    );
  }, [selectedDept, departments, user]);

  return (
    <div className="space-y-4 sm:space-y-6 pt-0 pb-6">

      {/* Hero Section — 2026 Bento Glass Architecture */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c1222] via-[#090d1a] to-[#05070e] text-white p-5 sm:p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.15)] border border-white/[0.09]"
      >
        {/* Ambient Radial Mesh Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/15 via-brand-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4 sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight leading-tight sm:leading-[1.15] font-display">
              LeetCode Performance <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">
                Institutional Intelligence Platform
              </span>
            </h1>

            <p className="text-xs sm:text-sm md:text-[15px] text-slate-300 font-normal max-w-2xl leading-relaxed">
              Real-time competitive programming analytics across all departments, automated Sunday contest verification, and faculty mentoring tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {['Live Solve Tracking', 'Sunday Contest Verification', 'Automated Department Audits', 'Faculty Mentoring Roster'].map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center justify-start px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold tracking-wide bg-white/[0.06] border border-white/10 text-slate-200 backdrop-blur-sm shadow-2xs hover:border-white/20 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2 shrink-0" />
                <span>{tag}</span>
              </span>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 sm:gap-3.5 pt-1.5 sm:pt-2 w-full max-w-xl"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onViewDashboard}
              className="h-10 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-[11.5px] sm:text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1 sm:space-x-2 transition-all cursor-pointer active:scale-95 touch-manipulation"
              title="Open Executive Analytics Dashboard"
            >
              <span className="truncate">
                <span className="hidden sm:inline">View </span>Dashboard
              </span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[3] shrink-0" />
            </motion.button>

            {(() => {
              const processedCount = displayProcessed;
              const totalProgress = displayTotal;

              return (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRefreshAll}
                  disabled={refreshing || syncProgress?.is_running}
                  className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.2] text-white border border-white/15 font-bold text-[11.5px] sm:text-sm backdrop-blur-md shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer touch-manipulation disabled:opacity-60"
                  title="Perform live synchronization for active student roster"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing || syncProgress?.is_running ? 'animate-spin text-cyan-300' : 'text-slate-300'}`} />
                  <span className="truncate">
                    {refreshing || syncProgress?.is_running
                      ? `Syncing ${processedCount}/${totalProgress ?? '...'}`
                      : <><span>Live Sync</span><span className="hidden sm:inline"> Data</span></>}
                  </span>
                </motion.button>
              );
            })()}
            {(() => {
              const activeCohort = (selectedDept !== 'all' || isFiltered) ? sortedList : students;
              const totalStudents = displayTotal;
              const verifiedCount = displaySuccessful;
              const lastVerifiedTs = activeCohort
                .map(s => s.stats?.last_verified_at)
                .filter(Boolean)
                .sort()
                .pop();
              const formattedLastFetched = lastVerifiedTs ? formatAgo(lastVerifiedTs) : 'Just now';

              return (
                <div className={`hidden lg:flex items-center space-x-2 px-3.5 py-2.5 rounded-xl ${verifiedCount > 0
                  ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                  } border font-extrabold text-xs backdrop-blur-md shadow-xs ml-auto`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${verifiedCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className="whitespace-nowrap">
                    {totalStudents !== null
                      ? (verifiedCount > 0 ? `${verifiedCount}/${totalStudents} Verified • ${formattedLastFetched}` : `${verifiedCount}/${totalStudents} Verified • Pending Sync`)
                      : 'Loading status...'}
                  </span>
                </div>
              );
            })()}
          </motion.div>
        </div>
      </motion.div>

      {/* Next Sunday Session Countdown Timer */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
        className="mt-4 sm:mt-8 mb-4 sm:mb-8 space-y-2 sm:space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-1">
          <div className="flex items-center space-x-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${summaryData?.is_session_live ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-brand-500'} animate-pulse shrink-0`} />
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              {summaryData?.is_session_live ? 'Live Sunday Monitoring Session' : 'Next Sunday Session Timer'}
            </span>
          </div>
          <span className={`text-xs font-extrabold px-3.5 py-1.5 rounded-full border shadow-xs whitespace-nowrap self-start sm:self-auto transition-colors ${
            summaryData?.is_session_live
              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/90 dark:border-emerald-500/40 shadow-xs'
              : 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/80 border-brand-200/80 dark:border-brand-500/40 shadow-xs'
          }`}>
            Official Window: 08:00 AM – 09:30 AM IST
          </span>
        </div>
        <CountdownTimer targetSeconds={summaryData?.next_session_countdown_seconds || 86400} isLive={summaryData?.is_session_live} />
      </motion.div>

      {/* Stat Cards Grid — 2026 Bento Grid Architecture */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
        {(() => {
          const activeCohort = (selectedDept !== 'all' || isFiltered) ? sortedList : students;
          const totalStudents = activeCohort.length;

          const calculatedVerified = activeCohort.filter(s =>
            s.stats?.sync_status === 'success' || s.stats?.sync_status === 'OK' || s.stats?.sync_status === 'verified' || (s.stats?.total_solved !== null && (s.stats?.total_solved ?? 0) > 0)
          ).length;
          const calculatedNoUsername = activeCohort.filter(s => !s.username && (!s.leetcode_url || s.leetcode_url.includes('/problemset/'))).length;
          const calculatedFailed = activeCohort.filter(s => s.stats?.sync_status === 'failed' || s.stats?.sync_status === 'mismatch' || s.stats?.sync_status === 'INVALID_USERNAME').length;
          const calculatedPending = Math.max(0, activeCohort.length - (calculatedVerified + calculatedNoUsername + calculatedFailed));
          const calculatedProblems = activeCohort.reduce((acc, s) => acc + (s.stats?.total_solved || (s as any).total_solved || 0), 0);
          const calculatedActiveSolvers = activeCohort.filter(s => (s.stats?.total_solved || (s as any).total_solved || 0) > 0).length;

          const verified = calculatedVerified;
          const pending = calculatedPending;
          const failed = calculatedFailed;
          const noUsername = calculatedNoUsername;

          const activeSolvers = calculatedActiveSolvers;
          const verifiedProblems = calculatedProblems;

          return (
            <>
              {/* Card 1: Total Enrolled */}
              <motion.div
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="glass-panel-elevated bento-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 cursor-default relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded-full bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]">
                    Roster
                  </span>
                </div>
                <div>
                  <h4 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none font-display">
                    <AnimatedNumber value={totalStudents} />
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    {isFacultyRole ? 'Allocated Mentees' : (selectedDept !== 'all' ? 'Dept Enrolled Students' : 'Total Enrolled Students')}
                  </p>
                </div>
              </motion.div>

              {/* Card 2: Verified Profiles */}
              <motion.div
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="glass-panel-elevated bento-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 cursor-default relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    Live
                  </span>
                </div>
                <div>
                  <h4 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none font-display">
                    <AnimatedNumber value={verified} />
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    Verified Profiles
                  </p>
                </div>
                {(pending > 0 || failed > 0 || noUsername > 0) && (
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                    {pending > 0 && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{pending} Pending</span>}
                    {noUsername > 0 && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">{noUsername} No ID</span>}
                    {failed > 0 && <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">{failed} Failed</span>}
                  </div>
                )}
              </motion.div>

              {/* Card 3: Problems Solved */}
              <motion.div
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="glass-panel-elevated bento-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 cursor-default relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    Solved
                  </span>
                </div>
                <div>
                  <h4 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none font-display">
                    <AnimatedNumber value={verifiedProblems} />
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    Problems Solved
                  </p>
                </div>
                <p className="text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40 w-fit">
                  from {activeSolvers.toLocaleString()} active solvers
                </p>
              </motion.div>

              {/* Card 4: Top Ranker */}
              <motion.div
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="glass-panel-elevated bento-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 cursor-default relative group border-amber-500/30 dark:border-amber-500/20"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-500/80 text-amber-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25">
                    #1 Rank
                  </span>
                </div>
                <div>
                  <h4 className="text-lg sm:text-2xl font-black text-amber-500 truncate leading-tight font-display" title={activeCohort.length > 0 ? activeCohort[0].name : (summaryData?.top_college_ranker || 'Top Ranker')}>
                    {activeCohort.length > 0 ? activeCohort[0].name : (summaryData?.top_college_ranker || 'Top Ranker')}
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    {isFacultyRole ? 'Top Mentee (#1)' : (selectedDept !== 'all' ? 'Top Dept Ranker (#1)' : 'College Ranker (#1)')}
                  </p>
                </div>
              </motion.div>
            </>
          );
        })()}
      </div>

      {/* Filters Control Bar — 2026 Mobile-Optimized Glass Architecture */}
      <div className="glass-panel p-3.5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-subtle space-y-3.5 sm:space-y-5 relative z-30 overflow-visible">

        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 dark:border-white/[0.06] pb-2.5 sm:pb-3.5">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-1.5 font-display truncate">
              <Filter className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="truncate">Student Performance Showcase</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium truncate hidden sm:block">
              Filter student records by Department, Academic Year, and LeetCode Problem Solved Range
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Switch */}
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center active:scale-95 touch-manipulation"
              title={viewMode === 'cards' ? 'Switch to Table View' : 'Switch to Grid View'}
            >
              {viewMode === 'cards' ? (
                <List className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>

            {/* Reset Filters Button */}
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation shrink-0"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Search Bar on Top Full-Width for instant mobile accessibility */}
        <div className="relative">
          <input
            id="landing-name-search"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={nameSearch}
            onChange={(e) => {
              setNameSearch(e.target.value);
              setDisplayCount(32);
            }}
            placeholder="Search name, reg no (e.g. 732224CC031)..."
            className="w-full h-11 min-h-[44px] bg-slate-50 dark:bg-navy-950/95 text-slate-900 dark:text-white text-xs font-semibold py-2 px-3.5 pl-9 pr-8 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-inner focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 placeholder-slate-400 dark:placeholder-slate-500 truncate transition-all text-left"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10 text-slate-500 dark:text-slate-400">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          {nameSearch && (
            <button
              type="button"
              onClick={() => { setNameSearch(''); setDisplayCount(32); }}
              className="absolute inset-y-0 right-0 flex items-center px-3 z-10 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile View: Dedicated Sleek Filter Control Bar */}
        <div className="block md:hidden space-y-2.5">
          <div className="flex items-center space-x-2">
            {/* Primary Mobile Filter Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('all');
                setIsMobileFilterOpen(true);
              }}
              className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-navy-900/90 border border-slate-200/90 dark:border-white/[0.09] text-slate-800 dark:text-slate-100 hover:border-brand-500/40 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black tracking-tight">Filter &amp; Sort</span>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-600 text-white shadow-xs">
                    {activeFiltersCount} active
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
              </div>
            </button>

            {/* Quick Mobile Sort Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('sort');
                setIsMobileFilterOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-navy-900/90 border border-slate-200/90 dark:border-white/[0.09] text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-all shadow-xs cursor-pointer shrink-0"
              title="Quick Sort Selection"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold truncate max-w-[95px]">{activeSortLabel}</span>
            </button>
          </div>

          {/* Quick-Filter Horizontal Scrollable Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            {/* Department Quick Chip */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('department');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                selectedDept !== 'all'
                  ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300 border-brand-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <Building2 className="w-3 h-3 shrink-0" />
              <span>Dept: {activeDeptLabel}</span>
              {selectedDept !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Academic Year Quick Chip */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('year');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                yearLevel !== 'all'
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <GraduationCap className="w-3 h-3 shrink-0" />
              <span>Year: {activeYearLabel}</span>
              {yearLevel !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Performance Range Quick Chip */}
            <button
              type="button"
              onClick={() => {
                setMobileFilterTab('performance');
                setIsMobileFilterOpen(true);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                solvedFilter !== 'all'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-100/80 dark:bg-navy-900/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.06]'
              }`}
            >
              <Award className="w-3 h-3 shrink-0" />
              <span>Solved: {activePerformanceLabel}</span>
              {solvedFilter !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 ml-0.5" />
              )}
            </button>

            {/* Clear All Quick Chip */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop View: Full 4-Column Responsive Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">

          {/* 1. Department Filter */}
          <div className="min-w-0">
            {isFacultyRole ? (
              <CustomDropdown
                id="faculty-department-filter"
                label="Mentee Scope"
                options={[
                  { value: 'all', label: 'My Allocated Mentees' },
                  ...departments.map((d: any) => ({
                    value: d.code || d.name,
                    label: d.name || d.code
                  }))
                ]}
                value={selectedDept}
                onChange={(val) => {
                  setSelectedDept(val);
                  setDisplayCount(32);
                }}
                icon={Building2}
                align="left"
              />
            ) : (
              <PremiumDepartmentSelect
                selectedDept={selectedDept === 'all' ? 'ALL' : selectedDept}
                onChange={(val) => {
                  setSelectedDept(val === 'ALL' ? 'all' : val);
                  setDisplayCount(32);
                }}
                useIdAsValue={false}
              />
            )}
          </div>

          {/* 2. Academic Year Filter */}
          <div className="min-w-0">
            <CustomDropdown
              id="academic-year-filter"
              label="Academic Year"
              options={yearOptions}
              value={yearLevel}
              onChange={(val) => {
                setYearLevel(val);
                setDisplayCount(32);
              }}
              icon={GraduationCap}
              align="left"
            />
          </div>

          {/* 3. Performance Range Filter */}
          <div className="min-w-0">
            <CustomDropdown
              id="performance-range-filter"
              label="Performance Range"
              options={performanceOptions}
              value={solvedFilter}
              onChange={(val) => {
                setSolvedFilter(val);
                setDisplayCount(32);
              }}
              icon={Award}
              align="left"
            />
          </div>

          {/* 4. Sort Students */}
          <div className="min-w-0">
            <CustomDropdown
              id="sort-students-filter"
              label="Sort Ranking"
              options={sortOptions}
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              icon={ArrowUpDown}
              align="right"
            />
          </div>

        </div>

      </div>

      {/* 2026 Modern Mobile Filter & Sorting Bottom Sheet Drawer */}
      <MobileStudentShowcaseFilters
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        initialTab={mobileFilterTab}
        selectedDept={selectedDept}
        onSelectDept={(val) => {
          setSelectedDept(val);
          setDisplayCount(32);
        }}
        yearLevel={yearLevel}
        onSelectYear={(val) => {
          setYearLevel(val);
          setDisplayCount(32);
        }}
        solvedFilter={solvedFilter}
        onSelectSolvedFilter={(val) => {
          setSolvedFilter(val);
          setDisplayCount(32);
        }}
        sortBy={sortBy}
        onSelectSortBy={(val) => setSortBy(val)}
        departments={activeDepartmentsWithCounts.length > 0 ? activeDepartmentsWithCounts : departments}
        yearOptions={yearOptions}
        performanceOptions={performanceOptions}
        sortOptions={sortOptions}
        performanceCounts={performanceCounts}
        totalResults={sortedList.length}
        onReset={handleResetFilters}
        isFacultyRole={isFacultyRole}
      />

        {/* Student Showcase Display */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3.5 pb-1">
            <h3 className="font-black text-lg text-slate-900 dark:text-white min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="break-words">Showing {viewMode === 'cards' ? Math.min(displayCount, sortedList.length) : sortedList.length} of {sortedList.length} Students</span>
                {(selectedDept !== 'all' || yearLevel !== 'all' || solvedFilter !== 'all') && (
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1 break-words [overflow-wrap:anywhere]">
                    Filtered by: {[
                      selectedDept !== 'all' ? (departments.find(d => String(d.id) === String(selectedDept) || d.code === selectedDept)?.name || selectedDept) : null,
                      yearLevel !== 'all' ? `${yearLevel} Year` : null,
                      solvedFilter !== 'all' ? `${{
                        '500_plus': '500+', 'above_500': '500+', '251_500': '251–500', '250_500': '251–500',
                        '101_250': '101–250', '1_100': '1–100', 'less_100': '1–100', 'not_started': 'Not Started'
                      }[solvedFilter] ?? ''} Solved` : null
                    ].filter(Boolean).join(' • ')}
                  </span>
                )}
              </div>
            </h3>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleRefreshAll}
                disabled={refreshing || syncProgress?.is_running}
                className={`flex-1 sm:flex-initial min-h-[40px] flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all touch-manipulation active:scale-95 ${refreshing || syncProgress?.is_running
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 cursor-pointer'
                  }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing || syncProgress?.is_running ? 'animate-spin' : ''}`} />
                <span className="truncate">
                  {syncProgress?.is_running
                    ? `Syncing... ${displayProcessed} / ${displayTotal}`
                    : refreshing 
                      ? 'Refreshing...' 
                      : isFiltered 
                        ? `Refresh Filtered (${sortedList.length})` 
                        : (isFacultyRole ? `Refresh My Allocated Students (${sortedList.length})` : 'Refresh Allocated Students')
                  }
                </span>
              </button>

              {syncProgress && (
                <button
                  type="button"
                  onClick={() => setShowSyncDetails(prev => !prev)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    showSyncDetails 
                      ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400' 
                      : 'bg-slate-100 dark:bg-navy-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                  }`}
                  title={showSyncDetails ? "Hide sync progress report" : "Show sync progress report"}
                >
                  <Activity className="w-3.5 h-3.5 text-brand-500" />
                  <span className="hidden sm:inline">{showSyncDetails ? 'Hide Sync Status' : 'Sync Status'}</span>
                  <span className="sm:hidden">{showSyncDetails ? 'Hide' : 'Status'}</span>
                  {showSyncDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Premium Live Sync Progress Bar (Collapsible on demand) */}
          <AnimatePresence>
            {syncProgress && (syncProgress.is_running || showSyncDetails) && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-md sm:shadow-lg space-y-3.5 overflow-hidden relative"
              >
                <div className="flex justify-between items-start gap-2 relative z-10">
                  <div className="space-y-1 min-w-0 pr-2">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center space-x-2">
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncProgress.is_running ? 'animate-spin' : ''}`} />
                      <span className="truncate">
                        {syncProgress.is_running 
                          ? `Syncing ${isFacultyRole ? 'Allocated ' : isFiltered ? 'Filtered ' : ''}Students (${displayProcessed} / ${displayTotal})` 
                          : isFacultyRole
                            ? `Allocated Students Sync Complete (${displayTotal} of ${displayTotal})`
                            : isFiltered
                              ? `Filtered Students Sync Complete (${displayTotal} of ${displayTotal})`
                              : 'Sync Process Complete'
                        }
                      </span>
                    </span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-snug">
                      {syncProgress.is_running
                        ? `Processing Profile (${displayProcessed} / ${displayTotal}): ${syncProgress.current_student || syncProgress.current_username || 'Initializing...'}`
                        : isFacultyRole
                          ? `All ${displayTotal} allocated student statistics are up to date${syncProgress.last_sync_time ? ` • Last synced: ${syncProgress.last_sync_time}` : ''}${syncProgress.triggered_by ? ` • Initiated by: ${syncProgress.triggered_by}` : ''}`
                          : isFiltered
                            ? `All ${displayTotal} filtered student statistics are up to date${syncProgress.last_sync_time ? ` • Last synced: ${syncProgress.last_sync_time}` : ''}${syncProgress.triggered_by ? ` • Initiated by: ${syncProgress.triggered_by}` : ''}`
                            : `Student statistics are up to date${syncProgress.last_sync_time ? ` • Last synced: ${syncProgress.last_sync_time}` : ''}${syncProgress.triggered_by ? ` • Initiated by: ${syncProgress.triggered_by}` : ''}`
                      }
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
                      {displayPercent}%
                    </span>
                    {!syncProgress.is_running && (
                      <button
                        type="button"
                        onClick={() => setShowSyncDetails(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-900 transition-colors cursor-pointer"
                        title="Hide sync report"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-navy-900 h-2 sm:h-2.5 rounded-full overflow-hidden relative z-10 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out relative"
                    style={{ width: `${displayPercent}%` }}
                  >
                    {syncProgress.is_running && (
                      <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 relative z-10 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Successful</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {displaySuccessful}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2 sm:pl-3">
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Pending</span>
                    <span className="text-sm font-black text-amber-500">
                      {displayPending}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2 sm:pl-3">
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Failed</span>
                    <span className="text-sm font-black text-rose-500">
                      {displayFailed}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {sortedList.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {isFacultyRole ? 'No Students Allocated to Your Mentorship Scope' : 'No Student Records in Database'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {isFacultyRole
                    ? 'You do not have any students assigned to your mentoring portfolio at this time. Please contact your Department HOD or Administrator to allocate mentees to you.'
                    : 'All previous student records have been wiped cleanly. Ready for fresh new student dataset import.'}
                </p>
              </div>
              <button
                onClick={handleResetFilters}
                className="w-full sm:w-auto min-h-[42px] justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5 touch-manipulation active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset View</span>
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="space-y-6">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.025 }
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {sortedList.slice(0, displayCount).map((st, idx) => (
                    <motion.div
                      key={st.id}
                      variants={{
                        hidden: { opacity: 0, y: 16, scale: 0.98 },
                        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } }
                      }}
                    >
                      <StudentFlipCard
                        student={st}
                        onSelectStudent={onSelectStudent}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {displayCount < sortedList.length ? (
                <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-extrabold text-center px-2 break-words">
                    Showing <span className="font-black text-brand-600 dark:text-brand-400">{Math.min(displayCount, sortedList.length)}</span> of <span className="font-black text-slate-900 dark:text-white">{sortedList.length}</span> Students
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:space-x-3 w-full sm:w-auto px-4 sm:px-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDisplayCount(prev => prev + 32)}
                      className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-600/30 transition-all cursor-pointer touch-manipulation"
                    >
                      <span>Load More Students (+32)</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setDisplayCount(sortedList.length)}
                      className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-5 py-3 rounded-2xl glass-card hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer touch-manipulation"
                    >
                      Show All {sortedList.length} Students
                    </motion.button>
                  </div>
                </div>
              ) : sortedList.length > 32 ? (
                <div className="flex flex-col items-center justify-center pt-6 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-extrabold text-center px-2 break-words">
                    Showing all <span className="font-black text-brand-600 dark:text-brand-400">{sortedList.length}</span> students
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setDisplayCount(32)}
                    className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer inline-flex items-center space-x-2 shadow-sm"
                  >
                    <ChevronDown className="w-4 h-4 rotate-180" />
                    <span>Collapse to Top 32</span>
                  </motion.button>
                </div>
              ) : null}
          </div>
        ) : (
          <LeaderboardTable
            students={sortedList}
            onSelectStudent={onSelectStudent}
            onRefreshStudent={handleRefreshStudent}
          />
        )}
      </div>

    </div>
  );
};
