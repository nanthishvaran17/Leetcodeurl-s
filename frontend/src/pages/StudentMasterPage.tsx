import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, Trash2, Edit2, ShieldAlert, BadgeInfo, CheckCircle, 
  X, Check, AlertCircle, Building2, LayoutList, Calendar,
  Search, Plus, UploadCloud, RefreshCw, UserPlus, List, LayoutGrid, XCircle, Loader2, AlertTriangle, WifiOff, ChevronLeft, ChevronRight, Mail, User,
  SlidersHorizontal, Filter, RotateCcw, School
} from 'lucide-react';
import { GlobalFilter, GlobalFilterOption } from '../components/GlobalFilter';
import api from '../services/api';
import { clearAllStudentCaches } from '../utils/rosterCache';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { useGlobalData } from '../context/GlobalDataContext';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { studentLiveStore } from '../stores/studentLiveStore';
import { useDepartments } from '../contexts/DepartmentContext';
import { useDepartmentsQuery } from '../hooks/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { MobileFilterDrawer } from '../components/MobileFilterDrawer';
import { normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';

// Validation state machine 
type LcValidationState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'valid';   username: string; canonical_url: string; total_solved?: number; contest_rating?: number }
  | { status: 'not_found';    message: string }
  | { status: 'invalid_format'; message: string }
  | { status: 'identity_mismatch'; message: string }
  | { status: 'rate_limited';  message: string }
  | { status: 'network_error'; message: string }
  | { status: 'fetch_failed';  message: string };

function LcValidationChip({ state }: { state: LcValidationState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'validating') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-brand-500 dark:text-brand-400 mt-1.5 animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="font-semibold">Verifying account with LeetCode...</span>
      </div>
    );
  }

  if (state.status === 'valid') {
    return (
      <div className="flex flex-col gap-0.5 mt-1.5">
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="font-bold">Account verified — <span className="font-black">{state.username}</span></span>
        </div>
        {(state.total_solved != null || state.contest_rating != null) && (
          <div className="text-xs text-slate-600 dark:text-slate-300 pl-5">
            {state.total_solved != null && <span>{state.total_solved} solved</span>}
            {state.total_solved != null && state.contest_rating != null && <span> · </span>}
            {state.contest_rating != null && <span>Rating {state.contest_rating}</span>}
          </div>
        )}
      </div>
    );
  }

  if (state.status === 'not_found') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 mt-1.5">
        <XCircle className="w-3.5 h-3.5" />
        <span className="font-semibold">No LeetCode account found for this username</span>
      </div>
    );
  }

  if (state.status === 'invalid_format') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 mt-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="font-semibold">Invalid format — use https://leetcode.com/u/username/</span>
      </div>
    );
  }

  if (state.status === 'identity_mismatch') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-orange-500 dark:text-orange-400 mt-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="font-semibold">LeetCode returned a different username — check the link</span>
      </div>
    );
  }

  if (state.status === 'rate_limited') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-purple-500 dark:text-purple-400 mt-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="font-semibold">LeetCode rate-limited — wait a moment and try again</span>
      </div>
    );
  }

  if (state.status === 'network_error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-1.5">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="font-semibold">Could not reach LeetCode — check your connection</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 mt-1.5">
      <XCircle className="w-3.5 h-3.5" />
      <span className="font-semibold">{(state as any).message || 'Validation failed'}</span>
    </div>
  );
}

// Map API response validation_status to our local state type
function mapValidationResponse(res: any): LcValidationState {
  const vs = res.validation_status as string;
  switch (vs) {
    case 'VALID':
      return {
        status: 'valid',
        username: res.username,
        canonical_url: res.canonical_url,
        total_solved: res.profile_data?.total_solved,
        contest_rating: res.profile_data?.contest_rating,
      };
    case 'ACCOUNT_NOT_FOUND':
      return { status: 'not_found', message: res.message };
    case 'INVALID_FORMAT':
      return { status: 'invalid_format', message: res.message };
    case 'IDENTITY_MISMATCH':
      return { status: 'identity_mismatch', message: res.message };
    case 'RATE_LIMITED':
      return { status: 'rate_limited', message: res.message };
    case 'NETWORK_ERROR':
      return { status: 'network_error', message: res.message };
    default:
      return { status: 'fetch_failed', message: res.message || 'Validation failed' };
  }
}

// Component 

interface StudentMasterPageProps {
  onSelectStudent: (student: StudentData) => void;
  onOpenImport: () => void;
}

import { useNotification } from '../context/NotificationContext';

export const StudentMasterPage: React.FC<StudentMasterPageProps> = ({
  onSelectStudent,
  onOpenImport
}) => {
  const { notify, confirmAction } = useNotification();
  const queryClient = useQueryClient();
  const { refreshAllData } = useGlobalData();
  const { data: globalDepts = [] } = useDepartmentsQuery();
  const { departments: ctxDepts = [] } = useDepartments();
  const filters = useFilters();
  // Removed useFilteredStudents client-side filtering
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.college && filters.college !== 'ALL') count++;
    if (filters.department && filters.department !== 'ALL') count++;
    if (filters.academicYear && filters.academicYear !== 'ALL') count++;
    return count;
  }, [filters.college, filters.department, filters.academicYear]);
  const { data: initialStudents = [] } = useStudentsQuery();
  const globalTotalCount = initialStudents.length > 0 ? initialStudents.length : 0;

  // Local state for debounced search
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '');

  // Sync if filter changes from outside
  useEffect(() => {
    setLocalSearch(filters.searchQuery || '');
  }, [filters.searchQuery]);

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.searchQuery !== localSearch) {
        filters.setSearchQuery(localSearch);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, filters]);

  // New Student Form State
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState<number>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [email, setEmail] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [cutOffScore, setCutOffScore] = useState('');
  const [accommodationType, setAccommodationType] = useState('Day Scholar');
  const [gender, setGender] = useState('Male');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [collegeType, setCollegeType] = useState<'NEC' | 'NCT'>('NEC');

  // LeetCode validation state (per-modal; cleared on open/close)
  const [lcValidation, setLcValidation] = useState<LcValidationState>({ status: 'idle' });
  // Tracks the last validated URL so we don't re-validate unchanged input
  const lastValidatedUrl = useRef('');
  // Temp student_id for validate endpoint — use 0 as a sentinel (endpoint ignores it for validation)
  const VALIDATE_SENTINEL_ID = 0;

  // Debounce timer ref for URL field
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize, setServerPageSize] = useState(50);

  // Use backend paginated API instead of client-side filtering
  const { data: paginatedData, isLoading: isTableLoading, refetch: refetchStudents } = useQuery({
    queryKey: ['students-master', serverPage, serverPageSize, filters.department, filters.academicYear, filters.searchQuery, filters.college, departments.length],
    queryFn: async () => {
      const params: any = { paginated: 'true', page: serverPage, limit: serverPageSize };
      if (filters.searchQuery) params.search = filters.searchQuery;
      if (filters.college && filters.college !== 'ALL') {
        params.college = filters.college;
      }
      
      // Map department CODE to ID
      const allDepts = departments.length > 0 ? departments : (ctxDepts.length > 0 ? ctxDepts : globalDepts);
      if (filters.department && filters.department !== 'ALL') {
        let deptIdToUse: number | undefined;
        if (allDepts.length > 0) {
          const found = allDepts.find((d: any) => 
            (d.code || d.department_code || '').toUpperCase() === filters.department.toUpperCase() || 
            (d.name || d.department_name || '').toUpperCase() === filters.department.toUpperCase() ||
            normalizeDepartment(d) === normalizeDepartment(filters.department)
          );
          if (found) deptIdToUse = found.id || found.department_id;
        }
        if (!deptIdToUse) {
          const deptMap: Record<string, number> = {
            'CSE(CS)': 1, 'CS': 1, 'CYBER': 1, 'CSE_CS': 1, 'CYBER SECURITY': 1,
            'CSE(IOT)': 2, 'IOT': 2, 'CSE_IOT': 2,
            'IT': 4,
            'CSE': 5,
            'AIDS': 10,
            'ECE': 12,
            'AGRI': 17,
            'MECH': 18,
            'CIVIL': 19,
            'EEE': 20
          };
          deptIdToUse = deptMap[filters.department.toUpperCase()];
          if (!deptIdToUse) {
            const norm = normalizeDepartment(filters.department);
            if (norm === 'cse_cs') deptIdToUse = 1;
            else if (norm === 'cse_iot') deptIdToUse = 2;
            else if (norm === 'it') deptIdToUse = 4;
          }
        }
        if (deptIdToUse) params.dept_id = deptIdToUse;
        params.department = filters.department;
      }
      
      if (filters.academicYear && filters.academicYear !== 'ALL') {
        params.year_level = normalizeAcademicYear(filters.academicYear);
      }
      
      const res = await api.get('/students', { params });
      return res.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const displayedStudents = paginatedData?.items || [];
  const serverTotalCount = paginatedData?.total || 0;
  const totalPages = Math.max(1, paginatedData?.total_pages || 1);

  // When filters change, reset to page 1
  useEffect(() => {
    setServerPage(1);
  }, [filters.department, filters.academicYear, filters.searchQuery, filters.college]);

  // Pull-to-refresh listener: clear caches, invalidate React Query and refetch student roster
  useEffect(() => {
    const handlePull = () => {
      clearAllStudentCaches();
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetchStudents();
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [queryClient, refetchStudents]);



  // Load departments via context / global data
  useEffect(() => {
    const list = ctxDepts.length > 0 ? ctxDepts : globalDepts;
    if (list && list.length > 0) {
      const mapped = list.map((d: any) => ({
        id: d.id || d.department_id,
        name: d.name || d.department_name,
        code: d.code || d.department_code
      }));
      setDepartments(mapped);
      if (!deptId) setDeptId(mapped[0].id);
    }
  }, [ctxDepts, globalDepts, deptId]);

  const deptFilterOptions = useMemo<GlobalFilterOption[]>(() => {
    const opts: GlobalFilterOption[] = [{ value: 'ALL', label: 'All Depts', pillText: 'ALL' }];
    departments.forEach((d: any) => {
      opts.push({
        value: d.code,
        label: `${d.code} - ${d.name}`,
        pillText: d.code
      });
    });
    return opts;
  }, [departments]);

  const yearFilterOptions = useMemo<GlobalFilterOption[]>(() => [
    { value: 'ALL', label: 'All Years', pillText: 'ALL' },
    { value: '1st Year', label: '1st Year (I)', pillText: 'Y1' },
    { value: '2nd Year', label: '2nd Year (II)', pillText: 'Y2' },
    { value: '3rd Year', label: '3rd Year (III)', pillText: 'Y3' },
    { value: '4th Year', label: '4th Year (IV)', pillText: 'Y4' },
  ], []);

  // LeetCode URL validation (debounced, 900ms) 
  const validateLcUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setLcValidation({ status: 'idle' });
      lastValidatedUrl.current = '';
      return;
    }

    // Skip validation if URL hasn't changed since last successful validation
    if (trimmed === lastValidatedUrl.current) return;

    // Quick pre-filter: must look like a LeetCode URL or a bare username
    const looksValid = /leetcode\.com\/u\/|leetcode\.com\//.test(trimmed) || /^[a-zA-Z0-9_-]{3,}$/.test(trimmed);
    if (!looksValid) {
      setLcValidation({ status: 'invalid_format', message: 'Use https://leetcode.com/u/username/ or a username' });
      return;
    }

    setLcValidation({ status: 'validating' });
    lastValidatedUrl.current = trimmed;

    try {
      // Use student_id=0 (sentinel); backend extracts username from payload independently
      const res = await api.post(`/students/0/validate-leetcode`, { leetcode_url: trimmed });
      setLcValidation(mapValidationResponse(res.data));
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Endpoint exists but student 0 not found — this is expected for the sentinel ID
        // In that case re-map if the response has a validation_status anyway
        if (err.response?.data?.validation_status) {
          setLcValidation(mapValidationResponse(err.response.data));
        } else {
          // Backend doesn't support sentinel 0 — fall back to format-only check
          setLcValidation({ status: 'idle' });
        }
      } else {
        setLcValidation({ status: 'network_error', message: err.message || 'Network error' });
      }
    }
  }, []);

  const handleLcUrlChange = (value: string) => {
    setLeetcodeUrl(value);
    // Reset to idle immediately while user is still typing
    setLcValidation({ status: 'idle' });
    lastValidatedUrl.current = '';

    // Clear any pending debounce
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Debounce: only validate 900ms after typing stops
    debounceTimer.current = setTimeout(() => {
      validateLcUrl(value);
    }, 900);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  // Handlers 

  const handleOpenAddModal = () => {
    // Reset form + validation state cleanly
    setRegNo(''); setName(''); setLeetcodeUrl(''); setEmail('');
    setCollegeType(filters.college === 'NCT' ? 'NCT' : 'NEC');
    setLcValidation({ status: 'idle' });
    lastValidatedUrl.current = '';
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setLcValidation({ status: 'idle' });
  };

  useScrollLock(showAddModal);
  useEscapeKey(handleCloseAddModal, showAddModal);

  useEffect(() => {
    if (!showAddModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseAddModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAddModal]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    // If we have a validated canonical URL, use it (ensures the saved URL is clean)
    const finalUrl = lcValidation.status === 'valid'
      ? lcValidation.canonical_url
      : leetcodeUrl;

    setLoading(true);
    try {
      await api.post('/students', {
        reg_no: regNo,
        name,
        department_id: deptId,
        year_level: yearLevel,
        college: collegeType,
        email: email || undefined,
        institutional_email: institutionalEmail || undefined,
        accommodation: accommodationType,
        gender: gender,
        twelfth_cutoff: cutOffScore ? parseFloat(cutOffScore) : null,
        leetcode_url: finalUrl
      });

      const msg = lcValidation.status === 'valid'
        ? `Student added! LeetCode account '${lcValidation.username}' verified. Background sync triggered.`
        : 'Student added! LeetCode profile will be verified during the next sync.';
      notify.success('Student Added Successfully', msg, { category: 'STUDENT REPOSITORY' });

      setShowAddModal(false);
      setRegNo(''); setName(''); setLeetcodeUrl('');
      setEmail(''); setInstitutionalEmail(''); setCutOffScore('');
      setAccommodationType('DAY SCHOLAR');
      setGender('Male');
      setLcValidation({ status: 'idle' });
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetchStudents();
    } catch (err: any) {
      notify.error('Failed to Add Student', err.response?.data?.detail || "Failed to add student.", { category: 'STUDENT REPOSITORY' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (student: StudentData) => {
    const confirmed = await confirmAction({
      title: 'Delete Student Record?',
      message: `Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`,
      confirmLabel: 'Delete Record',
      category: 'STUDENT REPOSITORY',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/students/${student.id}`);
      notify.success('Student Record Deleted', `Student "${student.name}" deleted successfully.`, { category: 'STUDENT REPOSITORY' });
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetchStudents();
    } catch (err: any) {
      notify.error('Delete Failed', err.response?.data?.detail || "Failed to delete student record.", { category: 'STUDENT REPOSITORY' });
    }
  };

  const handleBulkDeleteStudents = async (studentIds: number[]) => {
    const confirmed = await confirmAction({
      title: 'Delete Selected Records?',
      message: `Are you sure you want to delete ${studentIds.length} selected student records? This action cannot be undone.`,
      confirmLabel: `Delete ${studentIds.length} Records`,
      category: 'STUDENT REPOSITORY',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await api.post('/students/bulk-delete', { student_ids: studentIds });
      notify.success('Bulk Delete Successful', `Successfully deleted ${res.data.count || studentIds.length} student records.`, { category: 'STUDENT REPOSITORY' });
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetchStudents();
    } catch (err: any) {
      notify.error('Bulk Delete Failed', err.response?.data?.detail || "Failed to bulk delete student records.", { category: 'STUDENT REPOSITORY' });
    }
  };

  const handleSyncSingleStudent = async (studentId: number) => {
    try {
      const res = await api.post(`/students/${studentId}/refresh`);
      if (res.data?.stats) {
        studentLiveStore.updateStudent(studentId, {
          stats: res.data.stats,
          sync_status: res.data.stats.sync_status || res.data.status,
          total_solved: res.data.total_solved ?? res.data.stats.total_solved,
        } as any);
      }
      notify.success('Profile Synced', res.data?.message || 'Student profile synced successfully!', { category: 'SYNC ENGINE' });
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetchStudents();
    } catch (err: any) {
      notify.error('Sync Failed', err.response?.data?.detail || err.message || 'Unable to fetch LeetCode profile statistics.', { category: 'SYNC ENGINE' });
    }
  };

  // Is the save button safe to enable?
  // Allow if: no URL entered (will be validated during next sync)
  //           OR validation passed
  //           OR still validating (user might have entered something valid without waiting)
  // Block if: validation explicitly failed
  const saveAllowed = !leetcodeUrl.trim()
    || lcValidation.status === 'valid'
    || lcValidation.status === 'idle'
    || lcValidation.status === 'validating';

  return (
    <div className="space-y-5 sm:space-y-6 pt-0 animate-fade-in font-sans pb-32 sm:pb-20">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-8 shadow-2xl border border-brand-500/30 backdrop-blur-xl transition-all duration-300">
        {/* Animated Decorative Ambient Light Beams */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl animate-pulse pointer-events-none delay-1000" />
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <div className="space-y-4 max-w-2xl">
            {/* Live Pulsing Badge */}
            <div className="inline-flex items-center px-3 sm:px-3.5 py-1 rounded-xl sm:rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[9px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-xs max-w-full">
              <span className="whitespace-normal sm:whitespace-nowrap leading-tight">STUDENT DIRECTORY — {globalTotalCount || serverTotalCount} ENROLLED</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-black tracking-tight leading-tight">
                Student Master <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 via-teal-200 to-indigo-300 animate-pulse">Directory</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide leading-relaxed">
                Manage student profiles, LeetCode connectivity, and live synchronization across all institutional departments.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-4 lg:justify-end mt-2 lg:mt-0 w-full lg:w-auto">
            {/* View Mode Toggle - Responsive (Visible on Mobile & Desktop) */}
            <div className="flex items-center gap-1.5 p-1 bg-white/10 dark:bg-black/30 rounded-xl border border-white/15 shadow-inner backdrop-blur-md w-full sm:w-auto">
              <button
                onClick={() => setViewMode('table')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer min-h-[36px] ${
                  viewMode === 'table'
                    ? 'bg-gradient-to-r from-white to-slate-100 text-navy-950 shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <List className="w-3.5 h-3.5 shrink-0" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer min-h-[36px] ${
                  viewMode === 'cards'
                    ? 'bg-gradient-to-r from-white to-slate-100 text-navy-950 shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span>Cards</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={onOpenImport}
                className="min-h-[42px] px-3 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer backdrop-blur-md"
              >
                <UploadCloud className="w-4 h-4 text-brand-300 shrink-0" />
                <span className="truncate">Import</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/25 flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer border border-brand-300/40"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">Add Student</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Comprehensive Responsive Filter Bar — Sticky Frosted Glass */}
      <div className="sticky top-14 sm:top-16 z-20 bg-white/95 dark:bg-navy-950/95 backdrop-blur-2xl rounded-2xl p-3.5 sm:p-5 shadow-md border border-slate-200/90 dark:border-white/[0.08] space-y-3 mb-6 sm:mb-8 transition-all">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search + Mobile Filter Button Container */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Live Search Input */}
            <div className="relative flex-1 flex items-center min-w-0">
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search students by name, reg no, username..."
                autoComplete="off"
                className="w-full pl-11 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 focus:outline-none transition-all text-ellipsis"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 z-10 text-slate-600 dark:text-slate-300">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch('');
                    filters.setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
                  title="Clear search"
                >
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>

            {/* Mobile Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-800/80 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs cursor-pointer min-h-[42px] touch-manipulation"
              title="Open Filter Drawer"
            >
              <SlidersHorizontal className="w-4 h-4 text-brand-500" />
              <span className="hidden xs:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-black flex items-center justify-center font-mono">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Inline Filter Controls - Hidden on Mobile (Drawer used instead), Clean Inline on Desktop */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
                        {/* College Campus Quick Segmented Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-navy-800 shrink-0 self-center">
              {(['ALL', 'NEC', 'NCT'] as const).map((col) => {
                const isSelected = (filters.college || 'ALL') === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => filters.setCollege(col)}
                    className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? col === 'NCT'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : col === 'NEC'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>

            {/* Department Filter */}
            <div className="col-span-1 min-w-0 flex-1 sm:w-52 lg:w-56">
              <GlobalFilter
                options={deptFilterOptions}
                value={filters.department}
                onChange={(val) => filters.setDepartment(val)}
                icon={<Building2 className="w-3.5 h-3.5 text-brand-400" />}
                dropdownWidth="w-64"
                showSearch={false}
                placeholder="All Depts"
              />
            </div>

            {/* Academic Year Filter */}
            <div className="col-span-1 min-w-0 flex-1 sm:w-44 lg:w-48">
              <GlobalFilter
                options={yearFilterOptions}
                value={filters.academicYear}
                onChange={(val) => filters.setAcademicYear(val)}
                icon={<Calendar className="w-3.5 h-3.5 text-indigo-400" />}
                dropdownWidth="w-52"
                showSearch={false}
                placeholder="All Years"
              />
            </div>
          </div>
        </div>

        {/* Results Counter & Active Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-navy-800/80 px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="min-w-0 flex-1 break-words flex flex-wrap items-center gap-2">
            {filters.isFilteringActive ? (
              <span>
                Showing <span className="text-slate-900 dark:text-white font-bold">{displayedStudents.length}</span> of <span className="text-slate-900 dark:text-white font-bold">{serverTotalCount}</span> students
              </span>
            ) : (
              <span>Showing all <span className="text-slate-900 dark:text-white font-bold">{serverTotalCount}</span> students</span>
            )}

                        {/* Active College Tag */}
            {filters.college !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${
                filters.college === 'NCT'
                  ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
              }`}>
                College: {filters.college}
                <button type="button" onClick={() => filters.setCollege('ALL')} className="hover:text-rose-500 ml-0.5 cursor-pointer">✕</button>
              </span>
            )}

            {/* Active Department Tag */}
            {filters.department !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-[10.5px] font-bold">
                Dept: {filters.department}
                <button type="button" onClick={() => filters.setDepartment('ALL')} className="hover:text-rose-500 ml-0.5 cursor-pointer">✕</button>
              </span>
            )}

            {/* Active Year Tag */}
            {filters.academicYear !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold">
                Year: {filters.academicYear}
                <button type="button" onClick={() => filters.setAcademicYear('ALL')} className="hover:text-rose-500 ml-0.5 cursor-pointer">✕</button>
              </span>
            )}
          </div>

          {filters.isFilteringActive && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                filters.resetFilters();
              }}
              className="shrink-0 text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile Filter Bottom Drawer */}
      <MobileFilterDrawer
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        departments={departments}
      />

      {isTableLoading ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-950">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Loading student directory...</p>
        </div>
      ) : serverTotalCount === 0 && (filters.isFilteringActive || filters.college !== 'ALL') && (
        <div className="text-center py-16 px-6 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              {filters.college === 'NCT' ? 'No NCT Students Enrolled' : filters.college === 'NEC' ? 'No NEC Students Found' : 'No Students Found'}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              {filters.college === 'NCT'
                ? 'Only NCT students are displayed when the NCT filter is selected. No NCT records were found. Use "Add Student" above to enroll NCT students, or switch to ALL/NEC.'
                : 'Try adjusting your search criteria, department, or academic year filters.'}
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard / Student Master Table / Flip Cards */}
      {serverTotalCount > 0 && (
        <div className="pt-4 sm:pt-5">
          {viewMode === 'table' ? (
            <LeaderboardTable
              students={displayedStudents}
              onSelectStudent={onSelectStudent}
              onRefreshStudent={handleSyncSingleStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkDeleteStudents={handleBulkDeleteStudents}
              serverTotalCount={serverTotalCount}
              serverPage={serverPage}
              serverPageSize={serverPageSize}
              onServerPageChange={(page, size) => {
                setServerPage(page);
                if (size !== serverPageSize) setServerPageSize(size);
              }}
            />
          ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {displayedStudents.map((st) => (
              <StudentFlipCard
                key={st.id}
                student={st}
                onSelectStudent={onSelectStudent}
                onDeleteStudent={handleDeleteStudent}
              />
            ))}
          </div>
          
          {serverTotalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700">
              <div className="text-sm font-semibold text-slate-500 dark:text-navy-300 min-w-0 break-words text-center sm:text-left">
                Showing <span className="text-slate-900 dark:text-white font-bold">{Math.min((serverPage - 1) * serverPageSize + 1, serverTotalCount)}</span> to <span className="text-slate-900 dark:text-white font-bold">{Math.min(serverPage * serverPageSize, serverTotalCount)}</span> of <span className="text-slate-900 dark:text-white font-bold">{serverTotalCount}</span> students
              </div>
              
              <div className="flex items-center gap-2">
                <GlobalFilter
                  value={serverPageSize.toString()}
                  onChange={(val) => {
                    setServerPageSize(Number(val));
                    setServerPage(1);
                  }}
                  dropdownWidth="w-48"
                  options={[
                    { value: "25", label: "25 per page" },
                    { value: "50", label: "50 per page" },
                    { value: "100", label: "100 per page" },
                    { value: "200", label: "200 per page" }
                  ]}
                  icon={<LayoutList className="w-4 h-4" />}
                />

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-1 border border-slate-200 dark:border-navy-700">
                  <button
                    onClick={() => setServerPage(p => Math.max(1, p - 1))}
                    disabled={serverPage === 1}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="px-2 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[3rem] text-center">
                    {serverPage} / {Math.max(1, Math.ceil(serverTotalCount / serverPageSize))}
                  </div>
                  <button
                    onClick={() => setServerPage(p => Math.min(Math.ceil(serverTotalCount / serverPageSize), p + 1))}
                    disabled={serverPage >= Math.ceil(serverTotalCount / serverPageSize)}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay-responsive animate-modal-backdrop select-none"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseAddModal(); }}
        >
          <div className="w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[88vh] max-w-lg my-auto bg-white dark:bg-navy-950 sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-slate-100 antialiased flex flex-col relative overflow-hidden mobile-responsive-modal animate-modal-content">
            
            {/* Fixed Header */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0 z-20 shadow-md safe-area-pt">
              <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 id="add-student-dialog-title" className="text-sm sm:text-base font-black text-white tracking-tight truncate uppercase">ADD STUDENT RECORD</h3>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-mono font-medium truncate">
                    <span>Enroll student into institutional intelligence directory</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                title="Close"
                className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 active:scale-95 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="flex flex-col flex-1 min-h-0 relative">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 bg-white dark:bg-slate-900 custom-scrollbar">
              
              {/* Section 1: Primary Identification */}
              <div className="space-y-3">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-500/20 w-fit">
                  <span className="bg-indigo-500 text-white w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0">1</span>
                  <User className="w-3.5 h-3.5" />
                  IDENTITY & ROSTER INFO
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">
                      Register Number <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. 732224CC001"
                      required
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">
                      Student Name <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. AJAY A"
                      required
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Department & Academic Year */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-500/20 w-fit">
                  <span className="bg-indigo-500 text-white w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0">2</span>
                  ACADEMIC PLACEMENT
                </span>

                {/* College Selection */}
                <div>
                  <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">
                    College Campus <span className="text-rose-500 font-black">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCollegeType('NEC')}
                      className={`h-11 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        collegeType === 'NEC'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <School className="w-3.5 h-3.5" />
                      <span>NEC (Nandha Engg)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollegeType('NCT')}
                      className={`h-11 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        collegeType === 'NCT'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <School className="w-3.5 h-3.5" />
                      <span>NCT (Nandha Tech)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Department</label>
                    <GlobalFilter
                      value={deptId?.toString() || ""}
                      onChange={(val) => setDeptId(Number(val))}
                      dropdownWidth="w-full"
                      options={departments.map((d: any) => ({ value: String(d.id), label: d.name, pillText: d.code }))}
                      icon={<Building2 className="w-4 h-4 text-brand-500" />}
                      placeholder="Select Department"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Year Level</label>
                    <GlobalFilter
                      value={yearLevel}
                      onChange={(val) => setYearLevel(val)}
                      dropdownWidth="w-full"
                      options={[
                        { value: "1", label: "I Year", pillText: "1ST" },
                        { value: "2", label: "II Year", pillText: "2ND" },
                        { value: "3", label: "III Year", pillText: "3RD" },
                        { value: "4", label: "IV Year", pillText: "4TH" }
                      ]}
                      icon={<Calendar className="w-4 h-4 text-amber-400" />}
                      placeholder="Select Academic Year"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Accommodation */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-500/20 w-fit">
                  <span className="bg-indigo-500 text-white w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0">3</span>
                  CONTACT & ACCOMMODATION
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Personal Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. ajay@gmail.com"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Institutional Email</label>
                    <input
                      type="email"
                      value={institutionalEmail}
                      onChange={(e) => setInstitutionalEmail(e.target.value)}
                      placeholder="e.g. 732224CC001@nandhaengg.org"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">12th Cut-off Score</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cutOffScore}
                      onChange={(e) => setCutOffScore(e.target.value)}
                      placeholder="e.g. 185.50"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Gender</label>
                    <GlobalFilter
                      value={gender}
                      onChange={(val) => setGender(val)}
                      dropdownWidth="w-full"
                      options={[
                        { value: "Male", label: "Male", pillText: "MALE" },
                        { value: "Female", label: "Female", pillText: "FEMALE" }
                      ]}
                      icon={<User className="w-4 h-4 text-blue-400" />}
                      placeholder="Select Gender"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1.5">Accommodation</label>
                    <GlobalFilter
                      value={accommodationType}
                      onChange={(val) => setAccommodationType(val)}
                      dropdownWidth="w-full"
                      options={[
                        { value: "DAY SCHOLAR", label: "Day Scholar", pillText: "DAY" },
                        { value: "HOSTEL", label: "Hosteler", pillText: "HOSTEL" }
                      ]}
                      icon={<Building2 className="w-4 h-4 text-emerald-400" />}
                      placeholder="Select Type"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: LeetCode Verification Link */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-500/20 w-fit">
                    <span className="bg-indigo-500 text-white w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0">4</span>
                    LEETCODE LIVE SYNC INTEGRATION
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">AUTOMATIC VERIFICATION</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    id="add-student-leetcode-url"
                    value={leetcodeUrl}
                    onChange={(e) => handleLcUrlChange(e.target.value)}
                    placeholder="e.g. https://leetcode.com/u/ajay_a/"
                    className={`w-full h-11 px-4 pr-10 rounded-xl border-2 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm ${
                      lcValidation.status === 'valid'
                        ? 'border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                        : lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format'
                        ? 'border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                        : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'
                    } focus:outline-none`}
                  />
                  {/* Inline status icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {lcValidation.status === 'validating' && <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />}
                    {lcValidation.status === 'valid' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {(lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format') && (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    {(lcValidation.status === 'rate_limited' || lcValidation.status === 'network_error' || lcValidation.status === 'fetch_failed') && (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </div>

                {/* Validation status chip */}
                <LcValidationChip state={lcValidation} />

                {!saveAllowed && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                    Tip: Fix the LeetCode URL above, or clear it to save record without profile sync.
                  </p>
                )}
              </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-navy-950/50 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0 safe-area-pb">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !saveAllowed}
                  title={!saveAllowed ? 'Fix the LeetCode URL to continue' : undefined}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Enrolling...</span>
                    </>
                  ) : lcValidation.status === 'valid' ? (
                    <>
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Save & Verify ({lcValidation.username})</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span>Save Student Record</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
