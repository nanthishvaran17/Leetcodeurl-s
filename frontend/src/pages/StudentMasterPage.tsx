import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, UploadCloud, RefreshCw, UserPlus, List, LayoutGrid, CheckCircle, XCircle, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { collection, getDocs } from 'firebase/firestore';
import { getOrInitDb } from '../services/firebase';

import { CANONICAL_ROSTER } from '../data/canonicalRoster';

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
      <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 mt-1.5 animate-pulse">
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
          <span className="font-bold">Account verified ✓ — <span className="font-black">{state.username}</span></span>
        </div>
        {(state.total_solved != null || state.contest_rating != null) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 pl-5">
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
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
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

export const StudentMasterPage: React.FC<StudentMasterPageProps> = ({
  onSelectStudent,
  onOpenImport
}) => {
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
  }, [search]);

  const fetchStudents = async () => {
    try {
      const res = await api.get(`/students?search=${search}`);
      if (res.data && Array.isArray(res.data)) {
        setStudents(res.data);
      }
    } catch (err) {
      console.warn("REST API request delayed or offline", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
      if (res.data.length > 0) setDeptId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

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
        ? `✅ Student added! LeetCode account '${lcValidation.username}' verified. Background sync triggered.`
        : '✅ Student added! LeetCode profile will be verified during the next sync.';
      alert(msg);

      setShowAddModal(false);
      setRegNo(''); setName(''); setLeetcodeUrl('');
      setLcValidation({ status: 'idle' });
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to add student.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (student: StudentData) => {
    if (!confirm(`Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/students/${student.id}`);
      alert(`Student "${student.name}" deleted successfully!`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete student record.");
    }
  };

  const handleBulkDeleteStudents = async (studentIds: number[]) => {
    if (!confirm(`Are you sure you want to delete ${studentIds.length} selected student records? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.post('/students/bulk-delete', { student_ids: studentIds });
      alert(`✅ Successfully deleted ${res.data.count || studentIds.length} student records!`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to bulk delete student records.");
    }
  };

  const handleSyncSingleStudent = async (studentId: number) => {
    try {
      const res = await api.post(`/students/${studentId}/refresh`);
      alert(`✓ ${res.data?.message || 'Student profile synced successfully!'}`);
      fetchStudents();
    } catch (err: any) {
      alert(`❌ Sync Failed: ${err.response?.data?.detail || err.message || 'Unable to fetch LeetCode profile statistics.'}`);
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
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>STUDENT REPOSITORY • {students.length} ENROLLED STUDENTS</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Student Master <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Management Registry</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Manage student profiles across Cyber Security &amp; IoT, LeetCode profile links, and live sync status
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 p-1.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'table'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'cards'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>3D Cards</span>
              </button>
            </div>

            <button
              onClick={onOpenImport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs flex items-center space-x-2 backdrop-blur-md transition-all transform hover:scale-105"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Bulk Excel Import</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-500/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name, register number or LeetCode username..."
          className="w-full pl-10 pr-24 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none glass-card"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2.5 text-xs font-bold px-3 py-1 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors"
          >
            ✕ Clear Search
          </button>
        )}
      </div>

      {/* Leaderboard / Student Master Table / Flip Cards */}
      {viewMode === 'table' ? (
        <LeaderboardTable
          students={students}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={handleSyncSingleStudent}
          onDeleteStudent={handleDeleteStudent}
          onBulkDeleteStudents={handleBulkDeleteStudents}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {students.map((st) => (
            <StudentFlipCard
              key={st.id}
              student={st}
              onSelectStudent={onSelectStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-md max-h-[calc(100vh-3rem)] glass-card rounded-3xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden my-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-navy-900/50 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Add New Student Record</h3>
              <button onClick={handleCloseAddModal} className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-5 flex-1 min-h-0 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Register Number</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g. 732224CC001"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AJAY A"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Year Level</label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                >
                  <option value="II">II Year</option>
                  <option value="III">III Year</option>
                  <option value="IV">IV Year</option>
                </select>
              </div>

              {/* ── LeetCode URL with live validation ── */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">LeetCode Profile Link</label>
                <div className="relative">
                  <input
                    type="text"
                    id="add-student-leetcode-url"
                    value={leetcodeUrl}
                    onChange={(e) => handleLcUrlChange(e.target.value)}
                    placeholder="e.g. https://leetcode.com/u/ajay_a/"
                    required
                    className={`w-full p-2.5 pr-9 rounded-xl border bg-white dark:bg-navy-900 transition-colors ${
                      lcValidation.status === 'valid'
                        ? 'border-emerald-400 focus:ring-emerald-400'
                        : lcValidation.status === 'not_found' || lcValidation.status === 'identity_mismatch' || lcValidation.status === 'invalid_format'
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-gray-300 dark:border-gray-700'
                    } focus:outline-none focus:ring-2`}
                  />
                  {/* Inline status icon */}
                  <div className="absolute right-2.5 top-2.5 pointer-events-none">
                    {lcValidation.status === 'validating' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Fix the URL above, or clear it to save without a LeetCode link.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !saveAllowed}
                  title={!saveAllowed ? 'Fix the LeetCode URL to continue' : undefined}
                  className={`px-4 py-2 rounded-xl font-bold shadow-md transition-all ${
                    loading || !saveAllowed
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
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
