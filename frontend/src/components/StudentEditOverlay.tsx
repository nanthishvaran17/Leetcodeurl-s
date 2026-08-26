import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X, CheckCircle, XCircle, Loader2, AlertTriangle, WifiOff, Save } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

export interface StudentEditOverlayProps {
  isOpen: boolean;
  student: any | null;
  onClose: () => void;
  onSaveSuccess?: (updatedStudent: any) => void;
}

// ─── LeetCode Validation State Machine ───────────────────────────────────────
type LcValidationState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'valid'; username: string; canonical_url: string; total_solved?: number; contest_rating?: number }
  | { status: 'not_found'; message: string }
  | { status: 'invalid_format'; message: string }
  | { status: 'identity_mismatch'; message: string }
  | { status: 'rate_limited'; message: string }
  | { status: 'network_error'; message: string }
  | { status: 'fetch_failed'; message: string };

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
        <span className="font-semibold">LeetCode returned a different username — check link</span>
      </div>
    );
  }

  if (state.status === 'rate_limited') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-purple-500 dark:text-purple-400 mt-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="font-semibold">LeetCode rate-limited — try again in a moment</span>
      </div>
    );
  }

  if (state.status === 'network_error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="font-semibold">Could not reach LeetCode — check connection</span>
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

export const StudentEditOverlay: React.FC<StudentEditOverlayProps> = ({
  isOpen,
  student,
  onClose,
  onSaveSuccess
}) => {
  const { notify } = useNotification();

  // Form Field States
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [deptId, setDeptId] = useState<number>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [section, setSection] = useState('A');
  const [username, setUsername] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [email, setEmail] = useState('');

  // UI States
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [lcValidation, setLcValidation] = useState<LcValidationState>({ status: 'idle' });

  // Initial Snapshot for Unsaved Changes Comparison
  const initialRef = useRef<any>(null);
  const scrollPosRef = useRef<number>(0);
  const debounceTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch departments list
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setDepartments(res.data);
        }
      } catch (e) {
        console.warn('Failed to load departments in edit overlay:', e);
      }
    };
    fetchDepts();
  }, []);

  // Initialize Form Data when student changes
  useEffect(() => {
    if (isOpen && student) {
      // Record scroll position so background does not reset
      scrollPosRef.current = window.scrollY;

      const initName = student.name || student.student_name || '';
      const initRegNo = student.reg_no || student.register_number || '';
      const initDeptId = student.department_id || student.department?.id || 1;
      const initYear = student.year_level || student.year || 'III';
      const initSec = student.section?.name || student.section || 'A';
      const initUser = student.username || student.canonical_username || '';
      const initUrl = student.leetcode_url || student.profile_url || '';
      const initEmail = student.email || '';

      setName(initName);
      setRegNo(initRegNo);
      setDeptId(initDeptId);
      setYearLevel(initYear);
      setSection(initSec);
      setUsername(initUser);
      setLeetcodeUrl(initUrl);
      setEmail(initEmail);

      initialRef.current = {
        name: initName,
        regNo: initRegNo,
        deptId: initDeptId,
        yearLevel: initYear,
        section: initSec,
        username: initUser,
        leetcodeUrl: initUrl,
        email: initEmail
      };

      setErrorMessage(null);
      setShowUnsavedPrompt(false);
      setLcValidation({ status: 'idle' });
    }
  }, [isOpen, student]);

  // Check if form has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!initialRef.current) return false;
    const init = initialRef.current;
    return (
      name !== init.name ||
      regNo !== init.regNo ||
      deptId !== init.deptId ||
      yearLevel !== init.yearLevel ||
      section !== init.section ||
      username !== init.username ||
      leetcodeUrl !== init.leetcodeUrl ||
      email !== init.email
    );
  }, [name, regNo, deptId, yearLevel, section, username, leetcodeUrl, email]);

  // Attempt Close with Unsaved Check
  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Keyboard Event Listener (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleAttemptClose]);

  // Prevent background scrolling when overlay is open (True Fixed Overlay Architecture)
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || '';
      };
    }
  }, [isOpen]);

  // Debounced LeetCode live validation
  const triggerDebouncedValidation = useCallback((inputVal: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = inputVal.trim();
    if (!trimmed) {
      setLcValidation({ status: 'idle' });
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLcValidation({ status: 'validating' });

      try {
        const res = await api.post(
          `/students/${student?.id || 0}/validate-leetcode`,
          { leetcode_url: trimmed.includes('leetcode.com') ? trimmed : undefined, username: !trimmed.includes('leetcode.com') ? trimmed : undefined },
          { signal: controller.signal }
        );
        const vs = res.data?.validation_status;
        if (vs === 'VALID') {
          setLcValidation({
            status: 'valid',
            username: res.data.username,
            canonical_url: res.data.canonical_url,
            total_solved: res.data.profile_data?.total_solved,
            contest_rating: res.data.profile_data?.contest_rating
          });
        } else {
          setLcValidation({ status: 'fetch_failed', message: res.data?.message || 'Validation note' });
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setLcValidation({ status: 'idle' });
        }
      }
    }, 450);
  }, [student?.id]);

  const handleUrlChange = (urlVal: string) => {
    setLeetcodeUrl(urlVal);
    const trimmed = urlVal.trim();
    // Auto extract username handle
    const match = trimmed.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      setUsername(match[1]);
    }
    triggerDebouncedValidation(trimmed);
  };

  const handleUsernameChange = (userVal: string) => {
    setUsername(userVal);
    const trimmed = userVal.trim();
    if (trimmed && !trimmed.includes('leetcode.com')) {
      setLeetcodeUrl(`https://leetcode.com/u/${trimmed}/`);
    }
    triggerDebouncedValidation(trimmed);
  };

  // Submit & Save Form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !student.id) return;

    if (!name.trim()) {
      setErrorMessage('Student Full Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        name: name.trim(),
        reg_no: regNo.trim(),
        department_id: Number(deptId),
        year_level: yearLevel,
        section: section.trim(),
        username: username.trim() || undefined,
        leetcode_url: leetcodeUrl.trim() || undefined,
        email: email.trim() || undefined,
        version: student.version
      };

      const res = await api.patch(`/students/${student.id}`, payload);
      const updated = res.data;

      notify.success('Student Updated', `Record for ${name} updated successfully.`, { category: 'STUDENT EDIT' });

      if (onSaveSuccess) {
        onSaveSuccess(updated);
      }

      // Smoothly close without shifting scroll
      onClose();
    } catch (err: any) {
      console.error('Error saving student edits:', err);
      const detail = err.response?.data?.detail || 'Unable to save student changes. Please check your network and try again.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !student) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Student ${student.name || ''}`}
      className="modal-overlay-responsive animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          handleAttemptClose();
        }
      }}
    >
      <div
        className="modal-container-responsive max-w-xl bg-white dark:bg-navy-900 rounded-3xl shadow-lg border border-gray-200 dark:border-navy-700 animate-modal-content text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Header */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-gray-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Edit Student Record</h3>
              <p className="text-xs text-gray-300 font-mono">
                {student.reg_no || student.register_number || 'ID: ' + student.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            title="Close Editor"
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Inline Error Alert */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center space-x-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Student Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              Student Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. SANTHOSH KUMAR M"
              className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Register Number & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                Register Number
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. 732221104001"
                className="w-full px-4 py-2.5 text-xs font-mono bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                College Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@nandha.edu.in"
                className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Department, Year, Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                Department
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {departments.length > 0 ? (
                  departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.code || d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1}>CSE</option>
                    <option value={2}>IT</option>
                    <option value={3}>ECE</option>
                    <option value={4}>EEE</option>
                    <option value={5}>MECH</option>
                    <option value={6}>CIVIL</option>
                    <option value={7}>AIDS</option>
                    <option value={8}>AIML</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                Year Level
              </label>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="I">I Year</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A, B, C"
                className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* LeetCode Details Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-4">
            <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
              LeetCode Integration Details
            </h4>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                LeetCode Username Handle
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="e.g. AADHISH_S_B"
                className="w-full px-4 py-2.5 text-xs font-mono bg-white dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                LeetCode Profile URL
              </label>
              <input
                type="text"
                value={leetcodeUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://leetcode.com/u/..."
                className="w-full px-4 py-2.5 text-xs bg-white dark:bg-navy-950 border border-gray-300 dark:border-navy-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <LcValidationChip state={lcValidation} />
            </div>
          </div>

        </form>

        {/* Sticky Bottom Footer */}
        <div className="sticky bottom-0 z-20 px-6 py-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-navy-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-lg flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

        {/* Unsaved Changes Warning Sub-Modal */}
        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-navy-900 p-6 border border-gray-200 dark:border-navy-700 shadow-lg space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-gray-900 dark:text-white">Unsaved Changes</h4>
                <p className="text-xs text-gray-500">
                  You have unsaved changes in this student record. Discard them?
                </p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedPrompt(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-navy-800 text-xs font-bold text-gray-700 dark:text-gray-300"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedPrompt(false);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-500 text-xs font-black text-white"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
