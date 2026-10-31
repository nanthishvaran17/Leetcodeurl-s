import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X, CheckCircle, CheckCircle2, XCircle, Loader2, AlertTriangle, WifiOff, Save, Building2, User, Mail, Calendar, Plus, Trash2, ExternalLink, Trophy, RefreshCw, School } from 'lucide-react';
import { deriveStudentCollege } from '../utils/filterUtils';
import api, { clearApiCache } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { studentLiveStore } from '../stores/studentLiveStore';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown } from './CustomDropdown';
import { useScrollLock } from '../hooks/useScrollLock';

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
  | { status: 'validating'; username?: string }
  | {
      status: 'valid';
      username: string;
      canonical_url: string;
      total_solved?: number;
      easy_solved?: number;
      medium_solved?: number;
      hard_solved?: number;
      contest_rating?: number;
      ranking?: number;
    }
  | { status: 'not_found'; message: string; username?: string }
  | { status: 'invalid_format'; message: string }
  | { status: 'identity_mismatch'; message: string }
  | { status: 'rate_limited'; message: string }
  | { status: 'network_error'; message: string }
  | { status: 'fetch_failed'; message: string };

function LcValidationChip({
  state,
  currentUrl,
  onApplyCanonical,
  onRetry
}: {
  state: LcValidationState;
  currentUrl?: string;
  onApplyCanonical?: (url: string, username: string) => void;
  onRetry?: () => void;
}) {
  if (state.status === 'idle') return null;

  if (state.status === 'validating') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
        <div className="flex-1">
          <p className="font-bold">Live Fetching LeetCode stats...</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Querying LeetCode GraphQL API for verified problems solved & rank.</p>
        </div>
      </div>
    );
  }

  if (state.status === 'valid') {
    return (
      <div className="mt-2.5 p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/5 dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-teal-950/20 border border-emerald-500/30 dark:border-emerald-500/30 shadow-xs space-y-2.5 transition-all">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  LeetCode Account Verified
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Verified
                </span>
              </div>
              <a
                href={state.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>@{state.username}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {state.canonical_url && currentUrl && currentUrl.trim().replace(/\/$/, '') === state.canonical_url.trim().replace(/\/$/, '') ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                URL Synced
              </span>
            ) : onApplyCanonical ? (
              <button
                type="button"
                onClick={() => onApplyCanonical(state.canonical_url, state.username)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Use Canonical URL</span>
              </button>
            ) : null}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Safe to Save
            </span>
          </div>
        </div>

        {/* 4-Column Live Metric Breakdown Grid */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-emerald-500/20">
          <div className="p-2 rounded-lg bg-white/80 dark:bg-navy-900/70 border border-emerald-500/20 flex flex-col items-center justify-center text-center shadow-2xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Solved</span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {state.total_solved != null ? state.total_solved : '0'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 dark:bg-navy-900/70 border border-emerald-500/20 flex flex-col items-center justify-center text-center shadow-2xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Easy</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200">
              {state.easy_solved != null ? state.easy_solved : '0'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 dark:bg-navy-900/70 border border-amber-500/20 flex flex-col items-center justify-center text-center shadow-2xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Medium</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200">
              {state.medium_solved != null ? state.medium_solved : '0'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 dark:bg-navy-900/70 border border-rose-500/20 flex flex-col items-center justify-center text-center shadow-2xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Hard</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200">
              {state.hard_solved != null ? state.hard_solved : '0'}
            </span>
          </div>
        </div>

        {(state.contest_rating != null || state.ranking != null) && (
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 px-1 pt-0.5">
            {state.contest_rating != null ? (
              <span className="flex items-center gap-1 font-semibold">
                <Trophy className="w-3 h-3 text-amber-500" />
                Rating: <strong className="text-amber-600 dark:text-amber-400">{Math.round(state.contest_rating)}</strong>
              </span>
            ) : <span />}
            {state.ranking != null && (
              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Global Rank: #{state.ranking.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.status === 'not_found') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 flex items-start justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">No LeetCode Account Found</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              LeetCode did not find an active profile for this username. Please verify the URL or spelling before adding.
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1 rounded-md text-rose-600 hover:bg-rose-500/10 transition-colors shrink-0"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (state.status === 'invalid_format') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Invalid Profile URL Format</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            Use standard format: <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">https://leetcode.com/u/username/</code> or just the username handle.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'identity_mismatch') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-orange-500/10 dark:bg-orange-950/30 border border-orange-500/30 flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300">
        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Identity Mismatch Warning</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            LeetCode profile returned a different username. Check that this link belongs to this student.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'rate_limited') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/30 flex items-start justify-between gap-2 text-xs text-purple-700 dark:text-purple-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">LeetCode Rate-Limited</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Too many requests to LeetCode API. Please wait a moment and click verify again.
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1 rounded-md text-purple-600 hover:bg-purple-500/10 transition-colors shrink-0"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (state.status === 'network_error' || state.status === 'fetch_failed') {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-slate-500/10 dark:bg-slate-800/40 border border-slate-500/30 flex items-start justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
        <div className="flex items-start gap-2">
          <WifiOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Could Not Reach LeetCode</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {state.message || 'Network timeout or LeetCode service is temporarily unreachable.'}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors shrink-0 flex items-center gap-1 font-bold text-[10px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
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

export const resolveYearLevelFromRegNo = (regNoStr: string, currentYearVal?: any): string => {
  const norm = (regNoStr || '').trim().toUpperCase();
  const match = norm.match(/(?:7322)?(\d{2})[A-Z]{2,4}\d+/);
  if (match && match[1]) {
    const batch = parseInt(match[1], 10);
    if (batch === 26) return "1";
    if (batch === 25) return "2";
    if (batch === 24) return "3";
    if (batch === 23) return "4";
  }
  if (currentYearVal != null && currentYearVal !== '') {
    const valStr = String(currentYearVal).trim().toUpperCase();
    if (valStr === '1' || valStr === 'I' || valStr === '1ST YEAR' || valStr === '1ST') return "1";
    if (valStr === '2' || valStr === 'II' || valStr === '2ND YEAR' || valStr === '2ND') return "2";
    if (valStr === '3' || valStr === 'III' || valStr === '3RD YEAR' || valStr === '3RD') return "3";
    if (valStr === '4' || valStr === 'IV' || valStr === '4TH YEAR' || valStr === 'FINAL YEAR' || valStr === 'FINAL' || valStr === '4TH') return "4";
  }
  return "3";
};

export const resolveDepartmentFromRegNo = (regNoStr: string, departments?: any[], currentDeptId?: any): number | string => {
  const norm = (regNoStr || '').trim().toUpperCase();
  const match = norm.match(/(?:7322)?(?:\d{2})([A-Z]{2,4})\d+/);
  if (match && match[1]) {
    const code = match[1];
    let targetCode = '';
    if (code === 'CC') targetCode = 'CSE(CS)';
    else if (code === 'CI') targetCode = 'CSE(IOT)';
    else if (code === 'IT') targetCode = 'IT';
    else if (code === 'CS' || code === 'CSE') targetCode = 'CSE';
    else if (code === 'AD' || code === 'AIDS') targetCode = 'AIDS';
    else if (code === 'EE' || code === 'EEE') targetCode = 'EEE';
    else if (code === 'EC' || code === 'ECE') targetCode = 'ECE';
    else if (code === 'AG' || code === 'AGRI') targetCode = 'AGRI';

    if (targetCode && Array.isArray(departments) && departments.length > 0) {
      const found = departments.find(
        (d: any) => d.code === targetCode || d.code?.toUpperCase() === targetCode
      );
      if (found) return found.id;
    }
  }
  return currentDeptId ?? 1;
};


export const StudentEditOverlay: React.FC<StudentEditOverlayProps> = ({
  isOpen,
  student,
  onClose,
  onSaveSuccess
}) => {
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  
  const [canClose, setCanClose] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));
      const timer = setTimeout(() => setCanClose(true), 300);
      return () => {
        clearTimeout(timer);
        window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
      };
    }
  }, [isOpen]);

  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [deptId, setDeptId] = useState<number | string>(1);
  const [yearLevel, setYearLevel] = useState('3');
  const [section, setSection] = useState('');
  const [username, setUsername] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [email, setEmail] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [allocation, setAllocation] = useState('none');
  const [accommodation, setAccommodation] = useState('Day Scholar');
  const [gender, setGender] = useState('Male');
  const [twelfthCutoff, setTwelfthCutoff] = useState('');
  const [college, setCollege] = useState<'NEC' | 'NCT'>('NEC');

  const [secondaryAccounts, setSecondaryAccounts] = useState<SecondaryAccountItem[]>([]);

  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [lcValidation, setLcValidation] = useState<LcValidationState>({ status: 'idle' });

  const initialRef = useRef<any>(null);
  const hasUserEditedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedPrompt) {
          setShowUnsavedPrompt(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showUnsavedPrompt]);
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

  const populateFromStudentData = useCallback((stData: any) => {
    if (!stData) return;
    const initName = stData.name || stData.student_name || '';
    const initRegNo = stData.reg_no || stData.register_number || '';
    const rawDeptId = stData.department_id || stData.department?.id;
    const initDeptId = resolveDepartmentFromRegNo(initRegNo, departments, rawDeptId);
    const initYear = resolveYearLevelFromRegNo(initRegNo, stData.year_level || stData.year);
    const initSec = stData.section?.name || stData.section || '';
    const initUser = stData.username || stData.primary_leetcode_id || stData.canonical_username || '';
    let initUrl = stData.leetcode_url || stData.profile_url || (initUser ? `https://leetcode.com/u/${initUser}/` : '');
    // Automatically fix truncated/mismatched URLs if username is present
    if (initUser && (!initUrl || (initUrl.includes('leetcode.com/u/') && !initUrl.toLowerCase().includes(initUser.toLowerCase())))) {
      initUrl = `https://leetcode.com/u/${initUser}/`;
    }
    const initEmail = stData.email || '';
    const initInstEmail = stData.institutional_email || (initRegNo ? generateEmailFromRegNo(initRegNo) : '');
    const initEmailStatus = stData.email_status || 'pending';
    const initAlloc = stData.allocation || 'none';
    const initAccomm = stData.accommodation || stData.accommodation_type || 'Day Scholar';
    const rawGender = String(stData.gender || '').trim().toUpperCase();
    let initGender = 'Male';
    if (rawGender === 'FEMALE' || rawGender === 'F' || rawGender === 'GIRL') {
      initGender = 'Female';
    } else if (rawGender === 'MALE' || rawGender === 'M' || rawGender === 'BOY') {
      initGender = 'Male';
    } else if (rawGender) {
      initGender = stData.gender;
    } else {
      const nameUpper = String(initName || '').toUpperCase();
      const femaleKeywords = ["SHREE", "DEVI", "PRIYA", "SRI", "DHARSHINI", "VARSHINI", "JANANI", "SOWMIYA", "SHARMILA", "POOMITHA", "RITHIKA", "RITHANIKA", "KIRUTHIKAA", "AMRUTHA", "DHANUSHYA", "HARDIKA", "INIYA", "LAKSANA", "NETHRA", "NIVETHYTHA", "NIVETHA", "PRITHIKA", "RADHISRI", "SUPRIYA", "VEDHASREE", "YAZHINI", "GAYATHRI", "KAVYA", "SNEHA", "SWETHA", "NANDHINI", "ABINAYA", "KEERTHANA", "PAVITHRA", "ANANYA", "DEEPIKA", "ARCHANA", "HARINI", "MONISHA", "SANDHIYA", "SUBHASHINI", "SUBASHREE", "BHUVANESHWARI", "SOUNDARYA", "AISWARYA", "AISHWARYA", "MEENA", "KARTHIKA", "DIVYA", "POOJA", "MADHUMITHA", "MITHRA", "SWATHI", "THANANYA", "SUSHMITHA", "LAVANYA", "HEMA", "PREETHI", "RESHMA", "SARANYA", "SUJITHA", "SUGANYA", "RAMYA", "REVATHI", "GOWRI", "PRIYADHARSHINI", "AARATHANA", "AARSIKA", "SAHANAJ", "SURUTHI", "SUSITHA", "GOWRIPRIYA", "JAYASRI", "JEEVITHA", "PRADEEPA", "THARANYA", "SUVATHI", "KANISHAA", "KANISKA", "JANARANSHINI", "MOWNAVARTHINI", "SRIVIDHYA", "STEFFY", "SUBITHA", "ABIRAMI", "CHRISTINA", "SHRUTI"];
      initGender = femaleKeywords.some(k => nameUpper.includes(k)) ? 'Female' : 'Male';
    }
    const initCutoff = stData.twelfth_cutoff ?? stData.twelfthCutoff ?? stData.cutoff ?? '';
    const formattedCutoff = (initCutoff !== '' && initCutoff !== null && initCutoff !== undefined) ? String(initCutoff) : '';

    const rawAccounts = Array.isArray(stData.secondary_accounts) && stData.secondary_accounts.length > 0
      ? stData.secondary_accounts
      : Array.isArray(stData.leetcode_accounts) && stData.leetcode_accounts.length > 0
      ? stData.leetcode_accounts
      : [];
    let initSecAccounts: SecondaryAccountItem[] = rawAccounts
      .map((acc: any) => ({
        id: acc?.id,
        username: acc?.leetcode_username || acc?.username || '',
        url: acc?.profile_url || (acc?.leetcode_username || acc?.username ? `https://leetcode.com/u/${acc?.leetcode_username || acc?.username}/` : '')
      }))
      .filter((acc: any) => acc.username || acc.url);

    const secHandle = stData.secondary_leetcode_id || stData.secondary_id || stData.secondary_leetcode_url;
    if (secHandle && String(secHandle).trim() !== '') {
      const cleanSec = String(secHandle).replace('https://leetcode.com/u/', '').replace('leetcode.com/u/', '').trim().replace(/\/$/, '');
      if (cleanSec && !initSecAccounts.some(a => a.username?.toLowerCase() === cleanSec.toLowerCase())) {
        initSecAccounts.unshift({
          username: cleanSec,
          url: `https://leetcode.com/u/${cleanSec}/`
        });
      }
    }

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
    setAccommodation(initAccomm);
    setGender(initGender);
    setTwelfthCutoff(formattedCutoff);
    const initCollege = deriveStudentCollege(stData);
    setCollege(initCollege);
    setSecondaryAccounts(initSecAccounts);

    const initTotalSolved = stData.total_solved ?? stData.stats?.total_solved;
    const initEasySolved = stData.easy_solved ?? stData.stats?.easy_solved;
    const initMediumSolved = stData.medium_solved ?? stData.stats?.medium_solved;
    const initHardSolved = stData.hard_solved ?? stData.stats?.hard_solved;
    const initRating = stData.contest_rating ?? stData.stats?.contest_rating;
    const initRanking = stData.ranking ?? stData.stats?.ranking;

    if (initTotalSolved != null && (initUser || initUrl)) {
      setLcValidation({
        status: 'valid',
        username: initUser || 'LeetCode User',
        canonical_url: initUrl || (initUser ? `https://leetcode.com/u/${initUser}/` : ''),
        total_solved: initTotalSolved,
        easy_solved: initEasySolved,
        medium_solved: initMediumSolved,
        hard_solved: initHardSolved,
        contest_rating: initRating,
        ranking: initRanking
      });
    }

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
      accommodation: initAccomm,
      gender: initGender,
      twelfthCutoff: formattedCutoff,
      college: initCollege,
      secondaryAccounts: JSON.stringify(initSecAccounts)
    };
  }, [departments]);

  useEffect(() => {
    if (isOpen && student) {
      hasUserEditedRef.current = false;
      populateFromStudentData(student);
      setErrorMessage(null);
      setShowUnsavedPrompt(false);

      const initHandle = student.leetcode_url || student.username || student.profile_url || student.primary_leetcode_id;
      if (initHandle && student.total_solved == null && student.stats?.total_solved == null) {
        executeValidation(initHandle);
      }

      // Automatically refetch fresh student details from backend API only if user hasn't started typing
      const targetId = student?.id || student?.student_id || student?.reg_no || student?.register_number || student?.register_no;
      if (targetId) {
        let isMounted = true;
        api.get(`/students/${encodeURIComponent(targetId)}`)
          .then(res => {
            if (isMounted && res.data && !hasUserEditedRef.current) {
              populateFromStudentData(res.data);
            }
          })
          .catch(err => {
            console.warn('Failed to refetch student record in edit overlay:', err);
          });
        return () => { isMounted = false; };
      }
    }
  }, [isOpen, student?.id, student?.reg_no]);

  const hasUnsavedChanges = useCallback(() => {
    if (!initialRef.current) return false;
    const init = initialRef.current;
    return (
      name !== init.name ||
      regNo !== init.regNo ||
      college !== init.college ||
      deptId !== init.deptId ||
      yearLevel !== init.yearLevel ||
      section !== init.section ||
      username !== init.username ||
      leetcodeUrl !== init.leetcodeUrl ||
      email !== init.email ||
      institutionalEmail !== init.institutionalEmail ||
      allocation !== init.allocation ||
      accommodation !== init.accommodation ||
      gender !== init.gender ||
      twelfthCutoff !== init.twelfthCutoff ||
      JSON.stringify(secondaryAccounts) !== init.secondaryAccounts
    );
  }, [name, regNo, deptId, yearLevel, section, username, leetcodeUrl, email, institutionalEmail, allocation, accommodation, gender, twelfthCutoff, secondaryAccounts]);


  const handleAddSecondaryAccount = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSecondaryAccounts(prev => [...prev, { username: '', url: '' }]);
  };

  const handleRemoveSecondaryAccount = (idx: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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

  // Lock body scroll reliably while modal is open via reference-counted hook
  useScrollLock(isOpen);

  const executeValidation = useCallback(async (inputVal?: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const raw = (inputVal !== undefined ? inputVal : (leetcodeUrl || username)).trim();
    if (!raw) {
      setLcValidation({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLcValidation({ status: 'validating', username: raw });

    try {
      const studentIdParam = student?.id || student?.student_id || student?.reg_no || 0;
      const res = await api.post(`/students/${encodeURIComponent(studentIdParam)}/validate-leetcode`, {
        leetcode_url: raw.includes('leetcode.com') ? raw : undefined,
        username: !raw.includes('leetcode.com') ? raw : undefined
      }, { signal: controller.signal });

      const vs = res.data?.validation_status;
      if (vs === 'VALID') {
        const canonicalUrl = res.data.canonical_url;
        const verifiedUsername = res.data.username;

        // Automatically populate and show the verified URL and username
        if (canonicalUrl) {
          setLeetcodeUrl(canonicalUrl);
        }
        if (verifiedUsername) {
          setUsername(verifiedUsername);
        }

        setLcValidation({
          status: 'valid',
          username: verifiedUsername,
          canonical_url: canonicalUrl,
          total_solved: res.data.profile_data?.total_solved,
          easy_solved: res.data.profile_data?.easy_solved,
          medium_solved: res.data.profile_data?.medium_solved,
          hard_solved: res.data.profile_data?.hard_solved,
          contest_rating: res.data.profile_data?.contest_rating,
          ranking: res.data.profile_data?.ranking,
        });
      } else if (vs === 'ACCOUNT_NOT_FOUND') {
        setLcValidation({ status: 'not_found', message: res.data?.message || 'No LeetCode profile found' });
      } else if (vs === 'INVALID_FORMAT') {
        setLcValidation({ status: 'invalid_format', message: res.data?.message || 'Invalid format' });
      } else if (vs === 'IDENTITY_MISMATCH') {
        setLcValidation({ status: 'identity_mismatch', message: res.data?.message || 'Identity mismatch' });
      } else if (vs === 'RATE_LIMITED') {
        setLcValidation({ status: 'rate_limited', message: res.data?.message || 'LeetCode rate-limited' });
      } else if (vs === 'NETWORK_ERROR') {
        setLcValidation({ status: 'network_error', message: res.data?.message || 'Network error reaching LeetCode' });
      } else {
        setLcValidation({ status: 'fetch_failed', message: res.data?.message || 'Validation failed' });
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError') {
        setLcValidation({
          status: 'network_error',
          message: err?.response?.data?.message || err?.message || 'Could not verify LeetCode profile'
        });
      }
    }
  }, [leetcodeUrl, username, student?.id, student?.student_id, student?.reg_no]);

  const triggerDebouncedValidation = useCallback((inputVal: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setLcValidation({ status: 'idle' });
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      executeValidation(trimmed);
    }, 100);
  }, [executeValidation]);

  const handleApplyCanonical = useCallback((canonicalUrl: string, canonicalUsername: string) => {
    setLeetcodeUrl(canonicalUrl);
    setUsername(canonicalUsername);
    hasUserEditedRef.current = true;
  }, []);

  const handleUrlChange = (urlVal: string) => {
    setLeetcodeUrl(urlVal);
    const trimmed = urlVal.trim();
    const match = trimmed.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) setUsername(match[1]);
    triggerDebouncedValidation(trimmed);
  };

  const handleUsernameChange = (userVal: string) => {
    let cleanUser = userVal;
    const trimmed = userVal.trim();
    if (trimmed.includes('leetcode.com')) {
      const match = trimmed.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        cleanUser = match[1];
      }
    }
    setUsername(cleanUser);
    const cleanTrimmed = cleanUser.trim();
    if (cleanTrimmed) {
      setLeetcodeUrl(`https://leetcode.com/u/${cleanTrimmed}/`);
    } else {
      setLeetcodeUrl('');
    }
    triggerDebouncedValidation(cleanTrimmed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = student?.id || student?.student_id || student?.reg_no || student?.register_number || student?.register_no;
    if (!student || !targetId || isSaving) return;

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
        username: username.trim(),
        leetcode_url: leetcodeUrl.trim(),
        email: email.trim() || undefined,
        institutional_email: institutionalEmail.trim() || undefined,
        allocation: allocation !== 'none' ? allocation : null,
        accommodation: accommodation,
        gender: gender,
        twelfth_cutoff: twelfthCutoff ? parseFloat(twelfthCutoff) : null,
        college: college,
        secondary_leetcode_id: formattedSecondary[0]?.leetcode_username || null,
        secondary_accounts: formattedSecondary,
        version: student.version
      };

      const res = await api.patch(`/students/${encodeURIComponent(targetId)}`, payload);
      const updated = res.data;

      notify.success('Student Record Updated', `Changes for ${trimmedName} saved successfully.`, { category: 'STUDENT EDIT' });

      // 1. Immediately patch studentLiveStore so every row/card/table on the page reflects the new data
      if (updated && updated.id) {
        studentLiveStore.updateStudent(updated.id, updated);
      }

      // 2. Clear API client cache & roster caches
      clearApiCache();
      import('../utils/rosterCache').then(m => m.clearAllStudentCaches()).catch(() => {});
      localStorage.removeItem('nec_leetcode_students_cache');

      // 3. Invalidate & update React Query across all roles
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-master'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      queryClient.setQueriesData({ queryKey: ['students', 'canonical'] }, (oldData: any) => {
        if (!oldData) return oldData;
        if (Array.isArray(oldData)) {
          return oldData.map((s: any) => s.id === updated.id ? { ...s, ...updated } : s);
        }
        return oldData;
      });

      // 4. Dispatch global sync events
      window.dispatchEvent(new Event('refresh_dashboard_summary'));
      window.dispatchEvent(new CustomEvent('student_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('roster_updated', { detail: updated }));

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


  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  if (!student) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md modal-overlay-responsive"
        style={{ zIndex: 99999999 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <div className="bg-white dark:bg-navy-950 rounded-3xl p-6 shadow-2xl max-w-sm text-center border border-slate-200 dark:border-navy-700 animate-modal-content">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Student Data Loading</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Student information is currently being fetched. Please try again in a moment.</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-slate-950/85 backdrop-blur-md modal-overlay-responsive"
      style={{ zIndex: 99999999 }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !isSaving && canClose) handleAttemptClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-dialog-title"
        className="w-full h-auto max-h-[92dvh] sm:max-h-[88vh] max-w-xl my-0 sm:my-auto bg-white dark:bg-navy-950 rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-slate-100 antialiased flex flex-col relative overflow-hidden mobile-responsive-modal animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden w-12 h-1 bg-slate-400/40 rounded-full mx-auto my-2 shrink-0" />

        {/* Fixed Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0 z-20 shadow-md safe-area-pt">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="edit-student-dialog-title" className="text-sm sm:text-base font-black text-white tracking-tight truncate">EDIT STUDENT RECORD</h3>
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
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 active:scale-95 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 ml-2 touch-manipulation"
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
                      const autoYear = resolveYearLevelFromRegNo(val, yearLevel);
                      setYearLevel(autoYear);
                      const autoDept = resolveDepartmentFromRegNo(val, departments, deptId);
                      if (autoDept) setDeptId(autoDept);
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

              {/* College Campus Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  College Campus <span className="text-rose-500 font-black">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCollege('NEC'); hasUserEditedRef.current = true; }}
                    className={`h-11 sm:h-10 px-3 rounded-xl sm:rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      college === 'NEC'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-50'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>NEC (Nandha Engg)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCollege('NCT'); hasUserEditedRef.current = true; }}
                    className={`h-11 sm:h-10 px-3 rounded-xl sm:rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      college === 'NCT'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-50'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>NCT (Nandha Tech)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <CustomDropdown
                  id="edit-student-dept-select"
                  label="Department *"
                  labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
                  menuWidthClass="w-full min-w-full"
                  triggerClassName="w-full h-11 sm:h-10 flex items-center justify-between px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm sm:text-xs font-bold shadow-xs cursor-pointer"
                  options={departments.map((d: any, index: number) => {
                    const badgeColors = [
                      'bg-purple-500/10 text-purple-600 border-purple-500/20',
                      'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
                      'bg-blue-500/10 text-blue-600 border-blue-500/20',
                      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    ];
                    return {
                      value: String(d.id),
                      label: d.name,
                      badge: d.code || 'DEPT',
                      badgeColor: badgeColors[index % badgeColors.length],
                      icon: Building2
                    };
                  })}
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
                    { value: "1", label: "1st Year", badge: "I YEAR", icon: Calendar },
                    { value: "2", label: "2nd Year", badge: "II YEAR", icon: Calendar },
                    { value: "3", label: "3rd Year", badge: "III YEAR", icon: Calendar },
                    { value: "4", label: "Final Year", badge: "IV YEAR", icon: Calendar }
                  ]}
                  value={yearLevel}
                  onChange={(val) => setYearLevel(val)}
                  icon={Calendar}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    12th Cut-off Score
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="200"
                    value={twelfthCutoff}
                    onChange={(e) => setTwelfthCutoff(e.target.value)}
                    placeholder="e.g. 185.50"
                    className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs font-mono bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  />
                </div>
                <CustomDropdown
                  id="edit-student-gender-select"
                  label="Gender"
                  labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
                  menuWidthClass="w-full min-w-full"
                  triggerClassName="w-full h-11 sm:h-10 flex items-center justify-between px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm sm:text-xs font-bold shadow-xs cursor-pointer"
                  options={[
                    { value: "Male", label: "Male", badge: "MALE", badgeColor: "bg-blue-500/10 text-blue-600 border border-blue-500/20" },
                    { value: "Female", label: "Female", badge: "FEMALE", badgeColor: "bg-pink-500/10 text-pink-600 border border-pink-500/20" }
                  ]}
                  value={gender}
                  onChange={(val) => setGender(val)}
                />
                <CustomDropdown
                  id="edit-student-accommodation-select"
                  label="Accommodation Type"
                  labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
                  menuWidthClass="w-full min-w-full"
                  triggerClassName="w-full h-11 sm:h-10 flex items-center justify-between px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm sm:text-xs font-bold shadow-xs cursor-pointer"
                  options={[
                    { value: "Day Scholar", label: "Day Scholar", badge: "DAY SCHOLAR" },
                    { value: "Hostel", label: "Hostel", badge: "HOSTEL" }
                  ]}
                  value={accommodation}
                  onChange={(val) => setAccommodation(val)}
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">LeetCode Profile URL</label>
                  <button
                    type="button"
                    onClick={() => executeValidation(leetcodeUrl || username)}
                    disabled={lcValidation.status === 'validating'}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
                    title="Live fetch profile stats from LeetCode"
                  >
                    {lcValidation.status === 'validating' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Fetch Live</span>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={leetcodeUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://leetcode.com/u/username/"
                  className="w-full max-w-full box-border h-11 sm:h-10 px-3.5 text-sm sm:text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-xs font-mono"
                />
                <LcValidationChip
                  state={lcValidation}
                  currentUrl={leetcodeUrl}
                  onApplyCanonical={handleApplyCanonical}
                  onRetry={() => executeValidation(leetcodeUrl || username)}
                />
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
            
            {/* Extra safe area spacer so last field clears cleanly and scrolls above keyboard */}
            <div className="h-32 sm:h-8"></div>
          </div>

          {/* Dedicated Fixed Bottom Action Bar: Sits below the scroll container using flex shrink-0 */}
          <div
            className="shrink-0 px-4 pt-3.5 sm:px-6 sm:pt-4 bg-slate-50/95 dark:bg-navy-950/95 backdrop-blur-md border-t border-slate-200 dark:border-navy-800 flex items-center justify-between z-50 shadow-2xl gap-3 w-full safe-area-pb"
          >
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all cursor-pointer min-h-[48px] flex items-center justify-center shadow-xs touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-5 py-3 sm:px-7 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white text-xs sm:text-sm font-black shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer transition-all min-h-[48px] touch-manipulation"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-900 text-xs font-bold text-slate-700 dark:text-slate-300 min-h-[42px] cursor-pointer touch-manipulation active:scale-95"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUnsavedPrompt(false); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white min-h-[42px] cursor-pointer touch-manipulation active:scale-95"
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
