import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X, CheckCircle, XCircle, Loader2, AlertTriangle, WifiOff, Save, Building2, User, Mail, Calendar, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown } from './CustomDropdown';

export interface StudentEditOverlayProps {
  isOpen: boolean;
  student: any | null;
  onClose: () => void;
  onSaveSuccess?: (updatedStudent: any) => void;
}

export interface SecondaryAccountItem {
  id?: number;
  username: string;
  url: string;
}

// LeetCode Validation State Machine 
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
      <div className="flex items-center gap-1.5 text-xs text-brand-500 dark:text-brand-400 mt-1 animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span className="font-semibold">Verifying account with LeetCode...</span>
      </div>
    );
  }

  if (state.status === 'valid') {
    return (
      <div className="flex flex-col gap-0.5 mt-1">
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-bold">Account verified — <span className="font-black">{state.username}</span></span>
        </div>
        {(state.total_solved != null || state.contest_rating != null) && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
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
      <div className="flex items-center gap-1.5 text-xs text-rose-500 dark:text-rose-400 mt-1">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">No LeetCode account found for this username</span>
      </div>
    );
  }

  if (state.status === 'invalid_format') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 mt-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">Invalid format — use https://leetcode.com/u/username/</span>
      </div>
    );
  }

  if (state.status === 'identity_mismatch') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-orange-500 dark:text-orange-400 mt-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">LeetCode returned a different username — check link</span>
      </div>
    );
  }

  if (state.status === 'rate_limited') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-purple-500 dark:text-purple-400 mt-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">LeetCode rate-limited — try again in a moment</span>
      </div>
    );
  }

  if (state.status === 'network_error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">Could not reach LeetCode — check connection</span>
      </div>
    );
  }

  return null;
}

const generateEmailFromRegNo = (regNo: string) => {
  const normalized = regNo.trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.startsWith('7322') && normalized.length === 11) {
    const yearStr = normalized.substring(4, 6);
    const year = parseInt(yearStr, 10);
    if (!isNaN(year) && year <= 24) {
      return `${normalized.substring(4)}@nandhaengg.org`.toLowerCase();
    }
  }
  return `${normalized}@nandhaengg.org`.toLowerCase();
};

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
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [allocation, setAllocation] = useState('none');

  const [secondaryAccounts, setSecondaryAccounts] = useState<SecondaryAccountItem[]>([]);

  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [lcValidation, setLcValidation] = useState<LcValidationState>({ status: 'idle' });

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
          setDepartments([]);
        }
      } catch (e) {
        console.warn('Failed to load departments in edit overlay:', e);
      }
    };
    fetchDepts();
  }, []);

  useEffect(() => {
    if (isOpen && student) {
      const initName = student.name || student.student_name || '';
      const initRegNo = student.reg_no || student.register_number || '';
      const initDeptId = student.department_id || student.department?.id || 1;
      const initYear = student.year_level || student.year || 'III';
      const initSec = student.section?.name || student.section || 'A';
      const initUser = student.username || student.canonical_username || '';
      const initUrl = student.leetcode_url || student.profile_url || '';
      const initEmail = student.email || '';
      const initInstEmail = student.institutional_email || (initRegNo ? generateEmailFromRegNo(initRegNo) : '');
      const initEmailStatus = student.email_status || 'pending';
      const initAlloc = student.allocation || 'none';

      const initSecAccounts: SecondaryAccountItem[] = (student.leetcode_accounts || []).map((acc: any) => ({
        id: acc.id,
        username: acc.leetcode_username || acc.username || '',
        url: acc.profile_url || (acc.leetcode_username || acc.username ? `https://leetcode.com/u/${acc.leetcode_username || acc.username}/` : '')
      }));

      setName(initName);
      setRegNo(initRegNo);
      setDeptId(initDeptId);
      setYearLevel(initYear);
      setSection(initSec);
      setUsername(initUser);
      setLeetcodeUrl(initUrl);
      setEmail(initEmail);
      setInstitutionalEmail(initInstEmail);
      setEmailStatus(initEmailStatus);
      setAllocation(initAlloc);
      setSecondaryAccounts(initSecAccounts);

      initialRef.current = {
        name: initName,
        regNo: initRegNo,
        deptId: initDeptId,
        yearLevel: initYear,
        section: initSec,
        username: initUser,
        leetcodeUrl: initUrl,
        email: initEmail,
        institutionalEmail: initInstEmail,
        allocation: initAlloc,
        secondaryAccounts: JSON.stringify(initSecAccounts)
      };
      setErrorMessage(null);
      setShowUnsavedPrompt(false);
      setLcValidation({ status: 'idle' });
    }
  }, [isOpen, student]);

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
      email !== init.email ||
      institutionalEmail !== init.institutionalEmail ||
      allocation !== init.allocation ||
      JSON.stringify(secondaryAccounts) !== init.secondaryAccounts
    );
  }, [name, regNo, deptId, yearLevel, section, username, leetcodeUrl, email, institutionalEmail, allocation, secondaryAccounts]);

  const handleAddSecondaryAccount = () => {
    setSecondaryAccounts(prev => [...prev, { username: '', url: '' }]);
  };

  const handleRemoveSecondaryAccount = (idx: number) => {
    setSecondaryAccounts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSecondaryUsernameChange = (idx: number, val: string) => {
    setSecondaryAccounts(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], username: val };
      const trimmed = val.trim();
      if (trimmed && !trimmed.includes('leetcode.com')) {
        copy[idx].url = `https://leetcode.com/u/${trimmed}/`;
      }
      return copy;
    });
  };

  const handleSecondaryUrlChange = (idx: number, val: string) => {
    setSecondaryAccounts(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], url: val };
      const trimmed = val.trim();
      const match = trimmed.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        copy[idx].username = match[1];
      }
      return copy;
    });
  };

  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Handle ESC key
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

  // Lock body scroll while modal is open
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
    if (!student || !student.id || isSaving) return;

    const trimmedName = name.trim();
    const trimmedRegNo = regNo.trim().toUpperCase();

    if (!trimmedName) {
      setErrorMessage('Student Full Name is required.');
      return;
    }

    if (!trimmedRegNo) {
      setErrorMessage('Register Number is required.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid personal email address (e.g. name@domain.com).');
      return;
    }

    if (institutionalEmail.trim() && !emailRegex.test(institutionalEmail.trim())) {
      setErrorMessage('Please enter a valid institutional email address (e.g. 7322...@nandhaengg.org).');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const formattedSecondary = secondaryAccounts
        .filter(a => a.username.trim() || a.url.trim())
        .map(a => {
          const u = a.username.trim() || (a.url.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i)?.[1] || '');
          const url = a.url.trim() || (u ? `https://leetcode.com/u/${u}/` : '');
          return { leetcode_username: u, profile_url: url };
        });

      const payload = {
        name: trimmedName,
        reg_no: trimmedRegNo,
        department_id: deptId,
        year_level: yearLevel,
        section: section.trim(),
        username: username.trim() || undefined,
        leetcode_url: leetcodeUrl.trim() || undefined,
        email: email.trim() || undefined,
        institutional_email: institutionalEmail.trim() || undefined,
        allocation: allocation !== 'none' ? allocation : null,
        secondary_accounts: formattedSecondary,
        version: student.version
      };

      const studentId = student.id || student.student_id;
      const res = await api.patch(`/students/${studentId}`, payload);
      const updated = res.data;

      notify.success('Student Record Updated', `Changes for ${trimmedName} saved successfully.`, { category: 'STUDENT EDIT' });

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
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) handleAttemptClose(); }}
    >
      {/* Responsive Modal Card: h-full precisely respects fixed inset-0 boundaries on mobile */}
      <div
        className="w-full h-full sm:h-auto sm:max-h-[88vh] max-w-xl bg-white dark:bg-navy-950 sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-slate-100 antialiased flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0 z-20 shadow-md">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">EDIT STUDENT RECORD</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 font-mono font-medium truncate">
                <span>{student.reg_no || student.register_number || 'ID: ' + student.id}</span>
                {name && <span className="text-slate-400 font-sans"> · {name}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            title="Close"
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 active:scale-95 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form id="edit-student-form" onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 relative">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center space-x-2 animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Section 1: Student Information */}
            <div className="space-y-3 sm:space-y-3.5">
              <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500 text-white font-black text-[10px]">1</span>
                <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Student Information
                </h4>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Student Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. NANTHISHVARAN M"
                  className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Register Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegNo(val);
                      if (val.trim()) {
                        setInstitutionalEmail(generateEmailFromRegNo(val));
                      } else {
                        setInstitutionalEmail('');
                      }
                    }}
                    required
                    placeholder="e.g. 732223CS101"
                    className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs font-mono bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Personal Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. student@gmail.com"
                    className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Institutional Email <span className="text-rose-500">*</span></span>
                  {emailStatus === 'generated' && <span className="text-[10px] text-emerald-500 font-bold">ASSIGNED</span>}
                  {emailStatus === 'needs_verification' && <span className="text-[10px] text-amber-500 font-bold">NEEDS VERIFICATION</span>}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    value={institutionalEmail}
                    readOnly
                    placeholder="Auto-generated from Register Number"
                    className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs font-mono bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-700 dark:text-slate-300 font-bold outline-none shadow-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <CustomDropdown
                  id="edit-student-dept-select"
                  label="Department *"
                  labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
                  menuWidthClass="w-full min-w-full"
                  triggerClassName="w-full h-11 sm:h-10 flex items-center justify-between px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm sm:text-xs font-bold shadow-xs cursor-pointer"
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
                  labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
                  menuWidthClass="w-full min-w-full"
                  triggerClassName="w-full h-11 sm:h-10 flex items-center justify-between px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm sm:text-xs font-bold shadow-xs cursor-pointer"
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

            {/* Section 2: Primary LeetCode Account */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 shadow-xs space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[10px]">2</span>
                  <h4 className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide">Primary LeetCode Account</h4>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Primary
                </span>
              </div>
              
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Used for live problem-solving metrics, weekly progress reports, and institutional rankings.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">LeetCode Username Handle</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="e.g. nanthish_17"
                  className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs font-mono bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">LeetCode Profile URL</label>
                <input
                  type="text"
                  value={leetcodeUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://leetcode.com/u/username/"
                  className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
                <LcValidationChip state={lcValidation} />
              </div>
            </div>

            {/* Section 3: Secondary LeetCode Accounts */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500 text-white font-black text-[10px]">3</span>
                  <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Secondary LeetCode Accounts</h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddSecondaryAccount}
                  className="px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer flex items-center space-x-1 min-h-[38px] active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Secondary</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Tracked for live contest participation and integrity verification.
              </p>

              {secondaryAccounts.length > 0 ? (
                <div className="space-y-3">
                  {secondaryAccounts.map((acc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-indigo-100 dark:border-navy-700 space-y-2.5 shadow-xs relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/40">
                          Account #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSecondaryAccount(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
                          title="Remove Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Secondary Username</label>
                        <input
                          type="text"
                          value={acc.username}
                          onChange={(e) => handleSecondaryUsernameChange(idx, e.target.value)}
                          placeholder="e.g. user_contest_alt"
                          className="w-full max-w-full box-border h-10 px-3 text-xs font-mono bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Secondary Profile URL</label>
                        <input
                          type="text"
                          value={acc.url}
                          onChange={(e) => handleSecondaryUrlChange(idx, e.target.value)}
                          placeholder="https://leetcode.com/u/user_contest_alt/"
                          className="w-full max-w-full box-border h-10 px-3 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-white/60 dark:bg-navy-950/60 border border-dashed border-slate-300 dark:border-navy-700 text-center space-y-2">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">No secondary LeetCode accounts linked.</span>
                </div>
              )}
            </div>
            
            {/* Small safe area spacer so last field clears cleanly */}
            <div className="h-4 sm:h-2"></div>
          </div>

          {/* Dedicated Fixed Bottom Action Bar: Sits below the scroll container using flex shrink-0 */}
          <div
            className="shrink-0 px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-50/95 dark:bg-navy-950/95 backdrop-blur-md border-t border-slate-200 dark:border-navy-800 flex items-center justify-between z-50 shadow-2xl gap-3 w-full"
            style={{ paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all cursor-pointer min-h-[48px] flex items-center justify-center shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-5 py-3 sm:px-7 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white text-xs sm:text-sm font-black shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer transition-all min-h-[48px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>

        {/* Unsaved Prompt Modal */}
        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm sm:rounded-3xl">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-navy-950 p-6 shadow-2xl space-y-4 text-center border border-slate-200 dark:border-navy-700">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Discard Changes?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">You have unsaved changes. Are you sure you want to discard them?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnsavedPrompt(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-900 text-xs font-bold text-slate-700 dark:text-slate-300 min-h-[42px] cursor-pointer"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUnsavedPrompt(false); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white min-h-[42px] cursor-pointer"
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
