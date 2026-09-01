import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X, CheckCircle, XCircle, Loader2, AlertTriangle, WifiOff, Save, Building2, User, Code2, Mail, Calendar } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown } from './CustomDropdown';

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

  return null;
}

export const StudentEditOverlay: React.FC<StudentEditOverlayProps> = ({
  isOpen,
  student,
  onClose,
  onSaveSuccess
}) => {
  const { notify } = useNotification();

  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [deptId, setDeptId] = useState<number | string>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [section, setSection] = useState('A');
  const [username, setUsername] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [email, setEmail] = useState('');

  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [lcValidation, setLcValidation] = useState<LcValidationState>({ status: 'idle' });

  const scrollPosRef = useRef(0);
  const initialRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setDepartments(res.data);
        } else {
          setDepartments([
            { id: 1, name: 'Computer Science and Engineering (Cyber Security)', code: 'CSE(CS)' },
            { id: 2, name: 'Computer Science and Engineering (IoT)', code: 'CSE(IOT)' }
          ]);
        }
      } catch (e) {
        console.warn('Failed to load departments in edit overlay:', e);
      }
    };
    fetchDepts();
  }, []);

  useEffect(() => {
    if (isOpen && student) {
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

      initialRef.current = { name: initName, regNo: initRegNo, deptId: initDeptId, yearLevel: initYear, section: initSec, username: initUser, leetcodeUrl: initUrl, email: initEmail };
      setErrorMessage(null);
      setShowUnsavedPrompt(false);
      setLcValidation({ status: 'idle' });
    }
  }, [isOpen, student]);

  const hasUnsavedChanges = useCallback(() => {
    if (!initialRef.current) return false;
    const init = initialRef.current;
    return name !== init.name || regNo !== init.regNo || deptId !== init.deptId || yearLevel !== init.yearLevel || section !== init.section || username !== init.username || leetcodeUrl !== init.leetcodeUrl || email !== init.email;
  }, [name, regNo, deptId, yearLevel, section, username, leetcodeUrl, email]);

  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

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

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || '';
      };
    }
  }, [isOpen]);

  const triggerDebouncedValidation = useCallback((inputVal: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

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
        const res = await api.post(`/students/${student?.id || 0}/validate-leetcode`, {
          leetcode_url: trimmed.includes('leetcode.com') ? trimmed : undefined,
          username: !trimmed.includes('leetcode.com') ? trimmed : undefined
        }, { signal: controller.signal });
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
          setLcValidation({ status: 'fetch_failed', message: res.data?.message || 'Validation failed' });
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') setLcValidation({ status: 'idle' });
      }
    }, 450);
  }, [student?.id]);

  const handleUrlChange = (urlVal: string) => {
    setLeetcodeUrl(urlVal);
    const trimmed = urlVal.trim();
    const match = trimmed.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) setUsername(match[1]);
    triggerDebouncedValidation(trimmed);
  };

  const handleUsernameChange = (userVal: string) => {
    setUsername(userVal);
    const trimmed = userVal.trim();
    if (trimmed && !trimmed.includes('leetcode.com')) setLeetcodeUrl(`https://leetcode.com/u/${trimmed}/`);
    triggerDebouncedValidation(trimmed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !student.id) return;
    if (!name.trim()) { setErrorMessage('Student Full Name is required.'); return; }

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

      const studentId = student.id || student.student_id;
      const res = await api.patch(`/students/${studentId}`, payload);
      const updated = res.data;

      notify.info('Student Record Updated', `Changes for ${name} saved successfully across the system.`, { category: 'STUDENT EDIT' });

      localStorage.removeItem('nec_leetcode_students_cache');
      window.dispatchEvent(new Event('refresh_dashboard_summary'));

      if (onSaveSuccess) onSaveSuccess(updated);
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
      className="modal-overlay-responsive animate-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) handleAttemptClose(); }}
    >
      <div
        className="modal-container-responsive max-w-xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-700 animate-modal-content text-slate-900 dark:text-slate-100 antialiased overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-30 px-6 py-4 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 rounded-t-3xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">EDIT STUDENT RECORD</h3>
              <p className="text-xs text-slate-300 font-mono font-medium mt-0.5 flex items-center space-x-2">
                <span>{student.reg_no || student.register_number || 'ID: ' + student.id}</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={handleAttemptClose} title="Close" className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center space-x-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-500 text-white font-black text-[10px]">1</span>
              <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Student Information
              </h4>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Student Full Name <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-10 px-3.5 text-xs bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Register Number</label>
                <input type="text" value={regNo} onChange={(e) => setRegNo(e.target.value)} className="w-full h-10 px-3.5 text-xs font-mono bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-200">College Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3.5 text-xs bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <CustomDropdown
                id="edit-student-dept-select"
                label="Department *"
                labelClassName="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1"
                menuWidthClass="w-full min-w-full"
                options={departments.map((d: any) => ({
                  value: String(d.id),
                  label: d.code ? `${d.code} - ${d.name}` : d.name,
                  badge: d.code || 'DEPT',
                  badgeColor: d.code === 'CSE(CS)' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
                  icon: Building2
                }))}
                value={deptId?.toString() || "1"}
                onChange={(val) => setDeptId(Number(val))}
                icon={Building2}
              />
              <CustomDropdown
                id="edit-student-year-select"
                label="Year Level *"
                labelClassName="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1"
                menuWidthClass="w-full min-w-full"
                options={[
                  { value: "I", label: "1st Year", badge: "I YEAR", icon: Calendar },
                  { value: "II", label: "2nd Year", badge: "II YEAR", icon: Calendar },
                  { value: "III", label: "3rd Year", badge: "III YEAR", icon: Calendar },
                  { value: "IV", label: "Final Year", badge: "IV YEAR", icon: Calendar }
                ]}
                value={yearLevel}
                onChange={(val) => setYearLevel(val)}
                icon={Calendar}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 shadow-sm space-y-3">
            <div className="flex items-center space-x-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500 text-white font-black text-[10px]">2</span>
              <h4 className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase">LeetCode Information</h4>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-200">LeetCode Username Handle</label>
              <input type="text" value={username} onChange={(e) => handleUsernameChange(e.target.value)} className="w-full h-10 px-3.5 text-xs font-mono bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-200">LeetCode Profile URL</label>
              <input type="text" value={leetcodeUrl} onChange={(e) => handleUrlChange(e.target.value)} className="w-full h-10 px-3.5 text-xs bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" />
              <LcValidationChip state={lcValidation} />
            </div>
          </div>
        </form>

        <div className="sticky bottom-0 z-30 px-6 py-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between rounded-b-3xl shrink-0">
          <button type="button" onClick={handleAttemptClose} className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-all">Cancel</button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-black shadow-md flex items-center space-x-2 disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-3xl">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-navy-900 p-6 shadow-2xl space-y-4 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-sm font-black">Discard Changes?</h4>
              <div className="flex gap-3">
                <button onClick={() => setShowUnsavedPrompt(false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-xs font-bold">Stay</button>
                <button onClick={() => { setShowUnsavedPrompt(false); onClose(); }} className="flex-1 py-2 rounded-xl bg-rose-500 text-xs font-bold text-white">Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
