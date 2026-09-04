import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Users, Trash2, Edit2, ShieldAlert, BadgeInfo, CheckCircle, 
  X, Check, AlertCircle, Sparkles, Building2, LayoutList, Calendar,
  Search, Plus, UploadCloud, RefreshCw, UserPlus, List, LayoutGrid, XCircle, Loader2, AlertTriangle, WifiOff, ChevronLeft, ChevronRight, Mail
} from 'lucide-react';
import { GlobalFilter } from '../components/GlobalFilter';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { useGlobalData } from '../context/GlobalDataContext';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { studentLiveStore } from '../stores/studentLiveStore';
import { useDepartmentsQuery } from '../hooks/useDashboardQueries';
import { useFilters, useFilteredStudents } from '../context/FilterContext';

// ─── Validation state machine ────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────

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
  const { data: globalStudents = [] } = useStudentsQuery();
  const { data: globalDepts = [] } = useDepartmentsQuery();
  const filters = useFilters();
  const filteredStudents = useFilteredStudents();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Student Form State
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState<number>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [email, setEmail] = useState('');
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

  // Derived filtered students locally via global FilterContext
  // (already handled by useFilteredStudents above)

  const serverTotalCount = filteredStudents.length;
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(serverTotalCount / serverPageSize));
  
  // Enforce valid page bounds when filtering changes total count
  useEffect(() => {
    if (serverPage > totalPages) {
      setServerPage(1);
    }
  }, [totalPages, serverPage]);

  // Local Pagination
  const displayedStudents = useMemo(() => {
    const start = (serverPage - 1) * serverPageSize;
    return filteredStudents.slice(start, start + serverPageSize);
  }, [filteredStudents, serverPage, serverPageSize]);

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

  // ── LeetCode URL validation (debounced, 900ms) ─────────────────────────────
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

  // ── Handlers ───────────────────────────────────────────────────────────────

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
        leetcode_url: finalUrl
      });

      const msg = lcValidation.status === 'valid'
        ? `Student added! LeetCode account '${lcValidation.username}' verified. Background sync triggered.`
        : 'Student added! LeetCode profile will be verified during the next sync.';
      notify.success('Student Added Successfully', msg, { category: 'STUDENT REPOSITORY' });

      setShowAddModal(false);
      setRegNo(''); setName(''); setLeetcodeUrl('');
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-brand-500/30">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[10px] sm:text-xs font-black uppercase tracking-wider">
              <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span>STUDENT DIRECTORY • {globalStudents.length} ENROLLED</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight">
                Student Master <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Directory</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide leading-relaxed">
                Manage student profiles, LeetCode connectivity, and live synchronization across all institutional departments.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 p-1 bg-white/5 rounded-lg border border-white/10 shadow-inner">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-4 lg:mt-0 justify-end">

              <button
                onClick={onOpenImport}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-brand-300" />
                <span>Bulk Import</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-bold text-[11px] uppercase tracking-wider shadow-md shadow-brand-500/20 flex items-center space-x-1.5 transition-all cursor-pointer border border-brand-400/50"
              >
                <Plus className="w-3.5 h-3.5" />
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
              Showing <span className="text-slate-900 dark:text-white font-bold">{serverTotalCount}</span> of <span className="text-slate-900 dark:text-white font-bold">{globalStudents.length}</span> students
            </span>
          ) : (
            <span>Showing all {globalStudents.length} students</span>
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
          <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm animate-modal-content">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-navy-950/50 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Add New Student Record</h3>
              <button onClick={handleCloseAddModal} className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
               
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-5 flex-1 min-h-0 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Register Number</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g. 732224CC001"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Student Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AJAY A"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <GlobalFilter
                  value={deptId?.toString() || ""}
                  onChange={(val) => setDeptId(Number(val))}
                  dropdownWidth="w-full"
                  options={departments.map((d: any) => ({ value: String(d.id), label: `${d.name} (${d.code})`, pillText: d.code }))}
                  icon={<Building2 className="w-5 h-5" />}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Year Level</label>
                <GlobalFilter
                  value={yearLevel}
                  onChange={(val) => setYearLevel(val)}
                  dropdownWidth="w-full"
                  options={[
                    { value: "II", label: "II Year" },
                    { value: "III", label: "III Year" },
                    { value: "IV", label: "IV Year" }
                  ]}
                  icon={<Calendar className="w-5 h-5" />}
                />
              </div>

              {/* ── LeetCode URL with live validation ── */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">LeetCode Profile Link</label>
                <div className="relative">
                  <input
                    type="text"
                    id="add-student-leetcode-url"
                    value={leetcodeUrl}
                    onChange={(e) => handleLcUrlChange(e.target.value)}
                    placeholder="e.g. https://leetcode.com/u/ajay_a/"
                    className={`w-full p-2.5 pr-9 rounded-xl border bg-white dark:bg-navy-950 transition-colors ${
                      lcValidation.status === 'valid'
                        ? 'border-emerald-400 focus:ring-emerald-400'
                        : lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format'
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-slate-300 dark:border-slate-700'
                    } focus:outline-none focus:ring-2`}
                  />
                  {/* Inline status icon */}
                  <div className="absolute right-2.5 top-2.5 pointer-events-none">
                    {lcValidation.status === 'validating' && <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />}
                    {lcValidation.status === 'valid' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {(lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format') && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    {(lcValidation.status === 'rate_limited' || lcValidation.status === 'network_error' || lcValidation.status === 'fetch_failed') && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
                {/* Validation chip */}
                <LcValidationChip state={lcValidation} />
                {/* If validation hard-failed, offer a skip hint */}
                {!saveAllowed && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Fix the URL above, or clear it to save without a LeetCode link.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !saveAllowed}
                  title={!saveAllowed ? 'Fix the LeetCode URL to continue' : undefined}
                  className={`px-4 py-2 rounded-xl font-bold shadow-md transition-all ${
                    loading || !saveAllowed
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30'
                  }`}
                >
                  {loading
                    ? 'Adding...'
                    : lcValidation.status === 'valid'
                    ? `Save & Sync (${lcValidation.username})`
                    : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
