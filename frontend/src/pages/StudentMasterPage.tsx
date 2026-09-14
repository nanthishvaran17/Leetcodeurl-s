import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Users, Trash2, Edit2, ShieldAlert, BadgeInfo, CheckCircle, 
  X, Check, AlertCircle, Sparkles, Building2, LayoutList, Calendar,
  Search, Plus, UploadCloud, RefreshCw, UserPlus, List, LayoutGrid, XCircle, Loader2, AlertTriangle, WifiOff, ChevronLeft, ChevronRight, Mail
} from 'lucide-react';
import { GlobalFilter } from '../components/GlobalFilter';
import api from '../services/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { useGlobalData } from '../context/GlobalDataContext';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { studentLiveStore } from '../stores/studentLiveStore';
import { useDepartmentsQuery } from '../hooks/useDashboardQueries';
import { useFilters } from '../context/FilterContext';

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
          <div className="text-xs text-slate-500 dark:text-slate-400 pl-5">
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
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
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
  const filters = useFilters();
  // Removed useFilteredStudents client-side filtering
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Student Form State
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState<number>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [email, setEmail] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [cutOffScore, setCutOffScore] = useState('');
  const [accommodationType, setAccommodationType] = useState('Day Scholar');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');

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
    queryKey: ['students-master', serverPage, serverPageSize, filters.department, filters.academicYear, filters.searchQuery],
    queryFn: async () => {
      const params: any = { paginated: 'true', page: serverPage, limit: serverPageSize };
      if (filters.searchQuery) params.search = filters.searchQuery;
      
      // Map department CODE to ID
      if (filters.department !== 'ALL' && departments.length > 0) {
        const found = departments.find(d => d.code === filters.department || d.name === filters.department);
        if (found) params.dept_id = found.id;
      }
      
      if (filters.academicYear !== 'ALL') params.year_level = filters.academicYear;
      
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
  }, [filters.department, filters.academicYear, filters.searchQuery]);


  // Load departments via global data (if not available, fallback to api)
  useEffect(() => {
    if (globalDepts && globalDepts.length > 0) {
      const mapped = globalDepts.map((d: any) => ({
        id: d.id || d.department_id,
        name: d.name || d.department_name,
        code: d.code || d.department_code
      }));
      setDepartments(mapped);
      if (!deptId) setDeptId(mapped[0].id);
    }
  }, [globalDepts, deptId]);

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
    setLcValidation({ status: 'idle' });
    lastValidatedUrl.current = '';
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setLcValidation({ status: 'idle' });
  };

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
        email: email || undefined,
        institutional_email: institutionalEmail || undefined,
        accommodation: accommodationType,
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
      setLcValidation({ status: 'idle' });
      queryClient.invalidateQueries({ queryKey: ['students'] });
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
      queryClient.invalidateQueries({ queryKey: ['students'] });
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
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: any) {
      notify.error('Bulk Delete Failed', err.response?.data?.detail || "Failed to bulk delete student records.", { category: 'STUDENT REPOSITORY' });
    }
  };

  const handleSyncSingleStudent = async (studentId: number) => {
    try {
      const res = await api.post(`/students/${studentId}/refresh`);
      notify.success('Profile Synced', res.data?.message || 'Student profile synced successfully!', { category: 'SYNC ENGINE' });
      queryClient.invalidateQueries({ queryKey: ['students'] });
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
    <div className="space-y-5 sm:space-y-6 pt-1 sm:pt-0 animate-fade-in font-sans pb-12">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30 backdrop-blur-xl transition-all duration-300">
        {/* Animated Decorative Ambient Light Beams */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl animate-pulse pointer-events-none delay-1000" />
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            {/* Live Pulsing Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>STUDENT DIRECTORY — {serverTotalCount} ENROLLED</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-tight">
                Student Master <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 via-teal-200 to-indigo-300 animate-pulse">Directory</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide leading-relaxed">
                Manage student profiles, LeetCode connectivity, and live synchronization across all institutional departments.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 p-1 bg-white/10 dark:bg-black/30 rounded-xl border border-white/15 shadow-inner backdrop-blur-md">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-gradient-to-r from-white to-slate-100 text-navy-950 shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-gradient-to-r from-white to-slate-100 text-navy-950 shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 justify-end">
              <button
                onClick={onOpenImport}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-[11px] uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
              >
                <UploadCloud className="w-4 h-4 text-brand-300" />
                <span>Bulk Import</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-brand-500/25 flex items-center space-x-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-brand-300/40"
              >
                <Plus className="w-4 h-4" />
                <span>Add Student</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar - Redesigned */}
      <div className="bg-white dark:bg-navy-950 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-navy-700 space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => filters.setSearchQuery(e.target.value)}
            placeholder="Search name, register no, username..."
            className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 focus:outline-none transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => filters.setSearchQuery('')}
              className="absolute right-3 top-3 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear search"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {filters.isFilteringActive ? (
            <span>
              Showing <span className="text-slate-900 dark:text-white font-bold">{displayedStudents.length}</span> of <span className="text-slate-900 dark:text-white font-bold">{serverTotalCount}</span> students
            </span>
          ) : (
            <span>Showing all {serverTotalCount} students</span>
          )}
        </div>
      </div>

      {serverTotalCount === 0 && filters.isFilteringActive && (
        <div className="text-center py-16 px-6 bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-slate-900 dark:text-white">No students found</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Try searching with: <br/>
              • Student name<br/>
              • Register number<br/>
              • LeetCode username<br/>
              • Email
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard / Student Master Table / Flip Cards */}
      {serverTotalCount > 0 && (viewMode === 'table' ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
              <div className="text-sm font-semibold text-slate-500 dark:text-navy-300">
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
                    { value: "20", label: "20 per page" },
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
      ))}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-lg bg-white dark:bg-navy-950 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-modal-content">
            
            {/* Header */}
            <div className="relative p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-navy-900 via-indigo-950 to-navy-900 text-white overflow-hidden">
              {/* Glowing ambient light effect */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-2xl bg-white/10 dark:bg-white/10 backdrop-blur-md border border-white/15 text-brand-400 shadow-inner">
                    <UserPlus className="w-5 h-5 text-brand-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Add New Student Record</h3>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      Enroll student into institutional intelligence directory
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleCloseAddModal} 
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 flex-1 min-h-0 overflow-y-auto space-y-4 text-xs custom-scrollbar">
              
              {/* Section 1: Primary Identification */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 tracking-wider">
                  1. Identity & Roster Info
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      Register Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. 732224CC001"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      Student Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. AJAY A"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Department & Academic Year */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 tracking-wider">
                  2. Academic Placement
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">Department</label>
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
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">Year Level</label>
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
                      icon={<Calendar className="w-4 h-4 text-amber-500" />}
                      placeholder="Select Academic Year"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Accommodation */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 tracking-wider">
                  3. Contact & Accommodation
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">Personal Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. ajay@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">Institutional Email</label>
                    <input
                      type="email"
                      value={institutionalEmail}
                      onChange={(e) => setInstitutionalEmail(e.target.value)}
                      placeholder="e.g. 732224CC001@nandhaengg.org"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">12th Cut-off Score</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cutOffScore}
                      onChange={(e) => setCutOffScore(e.target.value)}
                      placeholder="e.g. 185.50"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">Accommodation</label>
                    <GlobalFilter
                      value={accommodationType}
                      onChange={(val) => setAccommodationType(val)}
                      dropdownWidth="w-full"
                      options={[
                        { value: "DAY SCHOLAR", label: "Day Scholar", pillText: "DAY" },
                        { value: "HOSTEL", label: "Hosteler", pillText: "HOSTEL" }
                      ]}
                      icon={<Building2 className="w-4 h-4 text-emerald-500" />}
                      placeholder="Select Type"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: LeetCode Verification Link */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 tracking-wider">
                    4. LeetCode Live Sync Integration
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">AUTOMATIC VERIFICATION</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    id="add-student-leetcode-url"
                    value={leetcodeUrl}
                    onChange={(e) => handleLcUrlChange(e.target.value)}
                    placeholder="e.g. https://leetcode.com/u/ajay_a/"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-slate-50/70 dark:bg-navy-900/60 font-medium text-slate-900 dark:text-white transition-all shadow-inner ${
                      lcValidation.status === 'valid'
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                        : lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format'
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500/50'
                    } focus:outline-none`}
                  />
                  {/* Inline status icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {lcValidation.status === 'validating' && <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />}
                    {lcValidation.status === 'valid' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {(lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format') && (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )}
                    {(lcValidation.status === 'rate_limited' || lcValidation.status === 'network_error' || lcValidation.status === 'fetch_failed') && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>

                {/* Validation status chip */}
                <LcValidationChip state={lcValidation} />

                {!saveAllowed && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                    Tip: Fix the LeetCode URL above, or clear it to save record without profile sync.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-extrabold hover:bg-slate-100 dark:hover:bg-navy-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !saveAllowed}
                  title={!saveAllowed ? 'Fix the LeetCode URL to continue' : undefined}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2 ${
                    loading || !saveAllowed
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white shadow-brand-500/25 hover:scale-[1.02]'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enrolling...</span>
                    </>
                  ) : lcValidation.status === 'valid' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-white" />
                      <span>Save & Verify ({lcValidation.username})</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 text-white" />
                      <span>Save Student Record</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
