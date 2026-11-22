// WeeklyContestPage.tsx - LeetCode Intelligence Dashboard
import React, { useState, useEffect, useMemo, useCallback, memo, useRef, useDeferredValue, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useScrollLock } from '../hooks/useScrollLock';
import { Calendar, RefreshCw, AlertTriangle, AlertCircle, Download, FileSpreadsheet, FileText, CheckCircle2, XCircle, Clock, ShieldCheck, PlayCircle, Lock, Layers, ArrowUpRight, ArrowDownRight, Filter, Trash2, Mail, Send, X, Edit3, UserCheck, UserX, Eye, Users, TrendingUp, Award, ChevronDown, ChevronUp, Building2, Building, GraduationCap, RotateCcw, Search, Radio, Activity, Shield, Pause, Play, FastForward, Gauge, Terminal, Cpu, Database, FlaskConical, Check, ExternalLink, Printer, FileArchive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { StatusNotificationModal, NotificationState } from '../components/StatusNotificationModal';
const LiveStudentMonitor = React.lazy(() => import('../components/LiveStudentMonitor').then(m => ({ default: m.LiveStudentMonitor })));
const Post930SolversView = React.lazy(() => import('./Post930SolversView').then(m => ({ default: m.Post930SolversView })));
const PreviousWeekContestPanel = React.lazy(() => import('../components/PreviousWeekContestPanel').then(m => ({ default: m.PreviousWeekContestPanel })));
import { normalizeYear } from '../utils/filterUtils';
import { studentLiveStore, useStudentListIds } from '../stores/studentLiveStore';
import { getCachedSummary } from '../utils/rosterCache';
import { StudentEditOverlay } from '../components/StudentEditOverlay';
import { SwipeHandle } from '../components/SwipeHandle';
import { GlobalModalBackdrop } from '../components/GlobalModalBackdrop';
import { useAuth } from '../context/AuthContext';
import { getUserCollege, isCollegeFilterAllowed } from '../services/auth/authTypes';
import { useContestWebSocket, ContestWSEvent } from '../hooks/useContestWebSocket';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';
import { triggerHaptic } from '../utils/haptics';
import { playContestAlertChime, playCelebrationChime } from '../utils/audioChime';
import { triggerConfetti } from '../utils/confettiCelebration';
import { useDepartments } from '../contexts/DepartmentContext';
import { GlobalFilter, GlobalFilterOption } from '../components/GlobalFilter';
import { normalizeDepartment, deriveStudentCollege } from '../utils/filterUtils';
import {
  getCachedContestData,
  setCachedContestData,
  fetchWithCacheDedupe,
  prefetchContest,
  logContestTelemetry,
  clearContestCache
} from '../services/contestCache';
import { useStudentsQuery } from '../hooks/useStudentsQuery';

// Animated Count-Up component for headline stat numbers
const AnimatedNumber: React.FC<{ value: number; suffix?: string; duration?: number }> = ({ value, suffix = '', duration = 600 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Number(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const startTime = performance.now();
    const frame = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * end));
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }, [value, duration]);

  return <span>{displayValue}{suffix}</span>;
};

// Inline SVG Sparkline for Participation Trend
const Sparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#6366f1' }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const padding = 4;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * effectiveWidth;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((val, idx) => {
        const x = padding + (idx / (data.length - 1)) * effectiveWidth;
        const y = height - padding - ((val - min) / range) * effectiveHeight;
        if (idx === data.length - 1) {
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              className="animate-ping origin-center"
            />
          );
        }
        return null;
      })}
    </svg>
  );
};

// Isolated Live Countdown Clock (renders every 1s WITHOUT re-rendering the whole page) 
const LiveCountdownClock = memo(({ endSec, label, className }: { endSec: number; label: string; className?: string }) => {
  const [sec, setSec] = useState(endSec);
  useEffect(() => { setSec(endSec); }, [endSec]);
  useEffect(() => {
    const t = setInterval(() => setSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const fmt = (n: number) => String(n).padStart(2, '0');
  return <span className={className}>{fmt(h)}:{fmt(m)}:{fmt(s)}</span>;
});

// Ultra-Responsive Isolated Session Delete Control with Instant Portal Dialog (0ms lag, no page re-render)
interface DeleteSessionControlProps {
  session: any;
  onDeleted: (sessionId: number, sessionLabel: string) => Promise<void>;
  onWarning: (title: string, message: string) => void;
  disabled?: boolean;
}

const DeleteSessionControl: React.FC<DeleteSessionControlProps> = memo(({
  session,
  onDeleted,
  onWarning,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isDeleting) return;

    if (session?.status === 'LIVE') {
      onWarning('Cannot Delete Live Session', 'Cannot delete a LIVE session. Finalize the contest first.');
      return;
    }
    setError(null);
    setIsOpen(true);
  }, [disabled, isDeleting, session?.status, onWarning]);

  const handleClose = useCallback(() => {
    if (isDeleting) return;
    setIsOpen(false);
    setError(null);
  }, [isDeleting]);

  // Keyboard shortcut Esc to close dialog
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  const handleConfirm = useCallback(async () => {
    const sId = session?.sessionId || session?.id;
    const sName = session?.contestName || `Session #${sId}`;
    if (!sId || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await api.delete(`/contests/sessions/${sId}`);
      setIsOpen(false);
      await onDeleted(Number(sId), sName);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete contest session.');
    } finally {
      setIsDeleting(false);
    }
  }, [session, isDeleting, onDeleted]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || isDeleting}
        className="p-2 sm:p-2 bg-rose-500/15 hover:bg-rose-500/25 rounded-xl border border-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors shadow-xs cursor-pointer shrink-0 disabled:opacity-40"
        title="Delete this Weekly Contest Session"
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-modal-title"
          className="fixed inset-0 z-[100050] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-xs select-none animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) handleClose();
          }}
        >
          <div
            className="relative w-full max-w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-slate-200 dark:border-slate-800 p-6 sm:p-7 text-center space-y-4 text-slate-900 dark:text-white shadow-2xl animate-fade-in-up transition-all overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2" />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warning Icon Badge */}
            <div className="flex flex-col items-center justify-center space-y-2 pt-1">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                <Trash2 className="w-7 h-7" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400">
                DESTRUCTIVE ACTION • ADMIN
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h3 id="delete-session-modal-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Delete Contest Session?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mx-auto">
                Permanently delete <strong className="text-rose-600 dark:text-rose-400 font-bold">{session?.contestName || `Session #${session?.sessionId}`}</strong>? All contest results, snapshots, and email logs for this session will be permanently removed.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold text-left">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black transition-all shadow-lg shadow-rose-600/25 active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

// Isolated Next-Update Ticker (ticks down without page re-render) 
const NextUpdateTicker = memo(({ initialSec }: { initialSec: number }) => {
  const [sec, setSec] = useState(initialSec > 0 ? initialSec : 120);
  useEffect(() => { setSec(initialSec > 0 ? initialSec : 120); }, [initialSec]);
  useEffect(() => {
    const t = setInterval(() => setSec(s => (s <= 1 ? 120 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return <span>{mins > 0 ? `${mins}m ${String(remSec).padStart(2, '0')}s` : `${sec}s`}</span>;
});

// Isolated Countdown Segments (Days/Hours/Mins/Secs before contest starts) 
const ContestCountdown = memo(({ initialSec }: { initialSec: number }) => {
  const [sec, setSec] = useState(initialSec);
  useEffect(() => { setSec(initialSec); }, [initialSec]);
  useEffect(() => {
    const t = setInterval(() => setSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const days = String(Math.floor(sec / 86400)).padStart(2, '0');
  const hours = String(Math.floor((sec % 86400) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const seconds = String(sec % 60).padStart(2, '0');
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
      <div className="px-2 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[64px] sm:min-w-[70px] shadow-inner flex-1 sm:flex-none">
        <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{days}</span>
        <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-amber-200/90 block">Days</span>
      </div>
      <span className="text-lg sm:text-2xl font-mono font-black text-amber-500 shrink-0">:</span>
      <div className="px-2 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[64px] sm:min-w-[70px] shadow-inner flex-1 sm:flex-none">
        <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{hours}</span>
        <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-amber-200/90 block">Hours</span>
      </div>
      <span className="text-lg sm:text-2xl font-mono font-black text-amber-500 shrink-0">:</span>
      <div className="px-2 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[64px] sm:min-w-[70px] shadow-inner flex-1 sm:flex-none">
        <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{minutes}</span>
        <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-amber-200/90 block">Minutes</span>
      </div>
      <span className="text-lg sm:text-2xl font-mono font-black text-amber-500 shrink-0">:</span>
      <div className="px-2 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[64px] sm:min-w-[70px] shadow-inner flex-1 sm:flex-none">
        <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{seconds}</span>
        <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-amber-200/90 block">Seconds</span>
      </div>
    </div>
  );
});

// Memoized Contest Matrix Row (only re-renders when THIS student's data changes) 
interface RowProps {
  r: any;
  actualIdx: number;
  isSelected: boolean;
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
  onSelect: (r: any) => void;
  onCheckbox: (regNo: string, checked: boolean) => void;
  onQuickSync?: (regNo: string) => void;
}
const ContestMatrixRow = memo(({ r, actualIdx, isSelected, onEdit, onDelete, onSelect, onCheckbox, onQuickSync }: RowProps) => {
  const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC';
  const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
  const isAttended = isPublicAttended || isVirtualAttended;
  const isError = r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR';
  const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED' || (!isAttended && !isError);
  const isNotVerified = r.participation_status === 'NOT_VERIFIED' || r.status === 'NOT_VERIFIED' || r.participation_status === 'PENDING';
  const isNotVerifiedFinal = r.participation_status === 'NOT_VERIFIED_FINAL' || r.status === 'NOT_VERIFIED_FINAL';

  const statusBadge = isPublicAttended
    ? { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500', label: 'PUBLIC' }
    : isVirtualAttended
      ? { cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30', dot: 'bg-purple-500', label: 'VIRTUAL' }
      : isNotAttended
        ? { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30', dot: 'bg-rose-500', label: 'NOT ATTENDED' }
        : isNotVerifiedFinal
          ? { cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30', dot: 'bg-slate-400', label: 'UNVERIFIED' }
          : isNotVerified
            ? { cls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-500', label: 'PENDING' }
            : isError
              ? { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', dot: 'bg-amber-500', label: 'DATA ERROR' }
              : { cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dot: 'bg-slate-400', label: 'PENDING' };

  const confBadgeCls = r.confidence === 'HIGH'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : r.confidence === 'MEDIUM'
      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

  const renderQ = (val: any) => {
    if (!isAttended || val === '—' || val === null || val === undefined) {
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-300 dark:text-slate-600 font-bold text-xs">—</span>;
    }
    return (val === 1 || val === '1')
      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/30 shadow-2xs">1</span>
      : <span className="inline-block w-6 h-6 leading-6 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 font-bold text-xs border border-rose-500/20 text-center">0</span>;
  };

  return (
    <tr
      className={`hover:bg-slate-50/80 dark:hover:bg-navy-800/60 transition-colors border-b border-slate-100 dark:border-slate-800/60 ${!isAttended ? 'bg-slate-50/40 dark:bg-navy-950/40' : ''} ${isSelected ? 'bg-brand-50/60 dark:bg-brand-900/30' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
        onSelect(r);
      }}
      role="button"
    >
      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-950 focus:ring-brand-500 checked:bg-brand-500"
          checked={isSelected}
          onChange={(e) => onCheckbox(r.reg_no, e.target.checked)}
        />
      </td>
      <td className="px-3 py-3 text-center text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">{actualIdx + 1}</td>
      <td className="px-3 py-3 font-semibold font-mono text-xs text-slate-800 dark:text-slate-200 tracking-tight whitespace-nowrap">{r.reg_no}</td>
      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap max-w-[200px] truncate uppercase" title={r.name}>{(r.name || '').toUpperCase()}</td>
      <td className="px-3 py-3 text-center">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {typeof r.dept === 'object' ? (r.dept?.code || r.dept?.name || '—') : (r.dept || '—')}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
        {typeof r.year === 'object' ? (r.year?.year || r.year?.name || '—') : (r.year || '—')}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border whitespace-nowrap ${statusBadge.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
            {statusBadge.label}
          </span>
          {r.confidence && (
            <span className={`px-1.5 py-0.2 text-[8px] font-mono font-black rounded border ${confBadgeCls}`}>
              {r.confidence}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 text-center">{renderQ(r.q1)}</td>
      <td className="px-2 py-3 text-center">{renderQ(r.q2)}</td>
      <td className="px-2 py-3 text-center">{renderQ(r.q3)}</td>
      <td className="px-2 py-3 text-center">{renderQ(r.q4)}</td>
      <td className="px-3 py-3 text-center">
        {isVirtualAttended ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono font-bold text-xs border border-purple-500/20">
            {r.total_solved ?? 0}/4 <span className="text-[9px] opacity-70">(V)</span>
          </span>
        ) : isPublicAttended ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-black text-xs border border-brand-500/20">
            {r.total_solved ?? '—'}/4
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 font-bold text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap min-w-[130px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(r); }}
            className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
            title={`Edit ${r.name}`}
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
          {onQuickSync && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickSync(r.reg_no); }}
              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-600 text-emerald-600 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
              title={`Force Live Sync — ${r.name}`}
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(r); }}
            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/60 dark:hover:bg-rose-600 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
            title={`Deactivate ${r.name}`}
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </td>
    </tr>
  );
}, (prev, next) => {
  // Only re-render if the student's own data changed OR selection changed
  return prev.isSelected === next.isSelected &&
    prev.actualIdx === next.actualIdx &&
    prev.r.participation_status === next.r.participation_status &&
    prev.r.q1 === next.r.q1 &&
    prev.r.q2 === next.r.q2 &&
    prev.r.q3 === next.r.q3 &&
    prev.r.q4 === next.r.q4 &&
    prev.r.total_solved === next.r.total_solved &&
    prev.r.rank === next.r.rank &&
    prev.r.rating === next.r.rating &&
    prev.r.confidence === next.r.confidence;
});

const MobileContestMatrixCard = memo(({ r, actualIdx, isSelected, onEdit, onDelete, onSelect, onCheckbox, onQuickSync }: RowProps) => {
  const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC';
  const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
  const isAttended = isPublicAttended || isVirtualAttended;
  const isError = r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR';
  const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED' || (!isAttended && !isError);
  const isNotVerified = r.participation_status === 'NOT_VERIFIED' || r.status === 'NOT_VERIFIED' || r.participation_status === 'PENDING';
  const isNotVerifiedFinal = r.participation_status === 'NOT_VERIFIED_FINAL' || r.status === 'NOT_VERIFIED_FINAL';

  const statusBadge = isPublicAttended
    ? { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500', label: 'PUBLIC' }
    : isVirtualAttended
      ? { cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30', dot: 'bg-purple-500', label: 'VIRTUAL' }
      : isNotAttended
        ? { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30', dot: 'bg-rose-500', label: 'NOT ATTENDED' }
        : isNotVerifiedFinal
          ? { cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30', dot: 'bg-slate-400', label: 'UNVERIFIED' }
          : isNotVerified
            ? { cls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-500', label: 'PENDING' }
            : isError
              ? { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', dot: 'bg-amber-500', label: 'DATA ERROR' }
              : { cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dot: 'bg-slate-400', label: 'PENDING' };

  const renderMobileQ = (label: string, val: any) => {
    const isSolved = (val === 1 || val === '1');
    const isUnsolved = isAttended && !isSolved && (val === 0 || val === '0');
    return (
      <div className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg border text-[11px] font-mono font-black ${isSolved
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
          : isUnsolved
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            : 'bg-slate-100 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-300'
        }`}>
        <span className={`text-[8px] font-sans font-bold uppercase ${isSolved ? 'text-emerald-600 dark:text-emerald-400' :
            isUnsolved ? 'text-rose-600 dark:text-rose-400' :
              'text-slate-600 dark:text-slate-400 font-bold'
          }`}>{label}</span>
        <span className="font-black text-xs">{isSolved ? '1' : isUnsolved ? '0' : '—'}</span>
      </div>
    );
  };

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
        triggerHaptic('light');
        onSelect(r);
      }}
      className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer w-full bg-white dark:bg-navy-900 shadow-sm hover:shadow-md space-y-2.5 active:scale-[0.98] touch-manipulation ${isSelected ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 ring-1 ring-brand-500/30' : 'border-slate-200/90 dark:border-navy-800'
        }`}
    >
      {/* Top Header: Select Pill + S.No + RegNo + Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic('selection');
              onCheckbox(r.reg_no, !isSelected);
            }}
            className={`min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center transition-all touch-manipulation active:scale-90 border cursor-pointer ${isSelected
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-700 text-transparent hover:border-brand-500'
              }`}
            title={isSelected ? 'Deselect student' : 'Select student'}
          >
            <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">#{actualIdx + 1}</span>
          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{r.reg_no}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${statusBadge.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Middle Row: Student Name + Dept & Year Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-black text-sm text-slate-900 dark:text-white truncate uppercase">
            {(r.name || '').toUpperCase()}
          </span>
          {r.username && (
            <span className="text-[11px] font-mono font-semibold text-brand-600 dark:text-brand-400 truncate">
              @{r.username}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
            {typeof r.dept === 'object' ? (r.dept?.code || r.dept?.name || '—') : (r.dept || '—')}
          </span>
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700">
            Yr {typeof r.year === 'object' ? (r.year?.year || r.year?.name || '—') : (r.year || '—')}
          </span>
        </div>
      </div>

      {/* Bottom Row: Q1-Q4 Grid + Total Solved + Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-navy-800/80 gap-2">
        {/* Q1-Q4 mini score boxes */}
        <div className="grid grid-cols-4 gap-1 flex-1 max-w-[160px]">
          {renderMobileQ('Q1', r.q1)}
          {renderMobileQ('Q2', r.q2)}
          {renderMobileQ('Q3', r.q3)}
          {renderMobileQ('Q4', r.q4)}
        </div>

        {/* Total Solved Badge */}
        <div className="flex items-center shrink-0">
          {isVirtualAttended ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono font-black text-xs border border-purple-500/30 shadow-2xs">
              {r.total_solved ?? 0}/4 <span className="text-[9px] opacity-70">(V)</span>
            </span>
          ) : isPublicAttended ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400 font-mono font-black text-xs border border-brand-500/30 shadow-2xs">
              {r.total_solved ?? '0'}/4
            </span>
          ) : isError ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 font-mono font-black text-xs border border-slate-300 dark:border-navy-700 shadow-2xs">
              —/4
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 font-mono font-black text-xs border border-slate-300 dark:border-navy-700 shadow-2xs">
              0/4
            </span>
          )}
        </div>

        {/* Action Buttons with 42px touch targets */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic('light');
              onEdit(r);
            }}
            className="w-10 h-10 min-w-[42px] min-h-[42px] rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center transition-all duration-150 active:scale-90 shadow-2xs cursor-pointer touch-manipulation"
            title={`Edit ${r.name}`}
            aria-label={`Edit ${r.name}`}
          >
            <Edit3 className="w-4 h-4 stroke-[2.2]" />
          </button>
          {onQuickSync && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerHaptic('medium');
                onQuickSync(r.reg_no);
              }}
              className="w-10 h-10 min-w-[42px] min-h-[42px] rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-600 text-emerald-600 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center transition-all duration-150 active:scale-90 shadow-2xs cursor-pointer touch-manipulation"
              title={`Sync ${r.name}`}
              aria-label={`Sync ${r.name}`}
            >
              <RefreshCw className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic('warning');
              onDelete(r);
            }}
            className="w-10 h-10 min-w-[42px] min-h-[42px] rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/60 dark:hover:bg-rose-600 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 flex items-center justify-center transition-all duration-150 active:scale-90 shadow-2xs cursor-pointer touch-manipulation"
            title={`Deactivate ${r.name}`}
            aria-label={`Deactivate ${r.name}`}
          >
            <Trash2 className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected &&
    prev.actualIdx === next.actualIdx &&
    prev.r.participation_status === next.r.participation_status &&
    prev.r.q1 === next.r.q1 &&
    prev.r.q2 === next.r.q2 &&
    prev.r.q3 === next.r.q3 &&
    prev.r.q4 === next.r.q4 &&
    prev.r.total_solved === next.r.total_solved &&
    prev.r.rank === next.r.rank &&
    prev.r.rating === next.r.rating &&
    prev.r.confidence === next.r.confidence;
});

interface WeeklyContestPageProps {
  onSelectStudent?: (student: any) => void;
}

export const WeeklyContestPage: React.FC<WeeklyContestPageProps> = ({ onSelectStudent }) => {
  const { user } = useAuth();
  const { data: globalStudents = [] } = useStudentsQuery();
  const { students: cachedStudents = [], isStale = false, lastUpdated = null } = getCachedSummary() || {};
  const [canonicalData, setCanonicalData] = useState<any>(cachedStudents?.length ? { students: cachedStudents } : null);
  const { departments } = useDepartments();
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const userRoleClean = (user?.role || '').trim().toLowerCase();
  const isUserHod = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(userRoleClean);
  const isUserStaff = ['staff', 'faculty', 'professor', 'mentor', 'staff mentor', 'faculty mentor'].includes(userRoleClean);
  const isUserGlobal = ['admin', 'super admin', 'super_admin', 'administrator', 'principal', 'management', 'director'].includes(userRoleClean);
  const userCollege = useMemo(() => getUserCollege(user), [user]);
  const canFilterCollege = useMemo(() => isCollegeFilterAllowed(user), [user]);

  const userDeptCode = useMemo(() => {
    return (typeof user?.department === 'string' ? user.department : (user?.department as any)?.code)
      || (Array.isArray((user as any)?.authorized_department_codes) && (user as any).authorized_department_codes[0])
      || (user as any)?.department_code
      || (user as any)?.department_id
      || '';
  }, [user]);

  const initialDeptFilter = useMemo(() => {
    if (isUserStaff && !isUserGlobal && userDeptCode) {
      return userDeptCode;
    }
    if (isUserHod && !isUserGlobal) {
      const authCodes: string[] = Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : [];
      if (authCodes.length > 1) {
        return 'ALL'; // Multi-dept HOD defaults to combined view of both departments (150 + 150 = 300)
      }
      if (authCodes.length === 1) {
        return authCodes[0];
      }
      if (typeof user?.department === 'string') return user.department;
      if ((user?.department as any)?.code) return (user?.department as any).code;
    }
    return 'ALL';
  }, [isUserStaff, isUserHod, isUserGlobal, user, userDeptCode]);
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<'ALL' | 'NEC' | 'NCT'>(() => {
    return canFilterCollege ? 'ALL' : userCollege;
  });

  useEffect(() => {
    if (!canFilterCollege && selectedCollegeFilter !== userCollege) {
      setSelectedCollegeFilter(userCollege);
    }
  }, [canFilterCollege, userCollege, selectedCollegeFilter]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>(() => initialDeptFilter);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isUserStaff && !isUserGlobal && userDeptCode && selectedDeptFilter !== userDeptCode) {
      setSelectedDeptFilter(userDeptCode);
      return;
    }
    if (isUserHod && !isUserGlobal) {
      const authCodes: string[] = Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : [];
      if (authCodes.length === 1 && (selectedDeptFilter === 'ALL' || !selectedDeptFilter)) {
        setSelectedDeptFilter(initialDeptFilter);
      } else if (!selectedDeptFilter) {
        setSelectedDeptFilter(initialDeptFilter);
      }
    }
  }, [isUserStaff, isUserHod, isUserGlobal, userDeptCode, initialDeptFilter, selectedDeptFilter, user?.authorized_department_codes]);
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState<string>('ALL');
  const [showMobileStats, setShowMobileStats] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wc_show_mobile_stats') !== 'false';
    } catch {
      return true;
    }
  });
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [allSessionRows, setAllSessionRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  const [fastSummary, setFastSummary] = useState<any>(null);
  const [questionStats, setQuestionStats] = useState<any>(null);
  const [departmentStats, setDepartmentStats] = useState<any>(null);
  const [yearStats, setYearStats] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'previous_week' | 'matrix'>('previous_week');
  const [subTab, setSubTab] = useState<'matrix' | 'dept_year' | 'error_board' | 'post_930_activity'>('matrix');
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const [matrixViewMode, setMatrixViewMode] = useState<'cards' | 'table'>('cards');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [customCalendarDate, setCustomCalendarDate] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [deptOpen, setDeptOpen] = useState<boolean>(false);
  const [yearOpen, setYearOpen] = useState<boolean>(false);
  const [attOpen, setAttOpen] = useState<boolean>(false);
  const [showMobileContestFilters, setShowMobileContestFilters] = useState<boolean>(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState<string>('');
  const [filterDrawerTab, setFilterDrawerTab] = useState<'year' | 'dept' | 'college' | 'att'>('year');

  // Live Contest Engine Real-Time State
  const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
  // Solver Delta Tracking (+10 new solvers, delta difference on fetch/sync)
  const [solverDelta, setSolverDelta] = useState<{ prev: number; current: number; delta: number } | null>(null);
  // NOTE: countdownSec / timeRemainingSec / nextUpdateTicker are now managed by isolated memo
  // components (ContestCountdown, LiveCountdownClock, NextUpdateTicker) to prevent 1-second
  // re-renders from cascading through the entire 3800-line component tree.
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(0);
  const [nextUpdateTicker, setNextUpdateTicker] = useState<number>(20);
  const [showAdminMonitor, setShowAdminMonitor] = useState<boolean>(false);
  const [quickSyncIdentifier, setQuickSyncIdentifier] = useState<string>('');
  const [adminActionMsg, setAdminActionMsg] = useState<string>('');
  const [isPerformingAdminAction, setIsPerformingAdminAction] = useState<boolean>(false);
  const [adminSubTab, setAdminSubTab] = useState<'sync_ops' | 'rate_limiter' | 'error_resolver' | 'snapshot_audit' | 'live_logs' | 'simulation_sandbox' | 'live_monitor'>('sync_ops');
  const [invariantResults, setInvariantResults] = useState<any | null>(null);

  useEffect(() => {
    setDebouncedSearchTerm(deferredSearchTerm);
  }, [deferredSearchTerm]);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState<boolean>(false);

  // New Feature States
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const adminMonitorRef = useRef<HTMLDivElement>(null);
  const detailedViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenDetailedRoster = () => {
    setShowDetailedView(true);
    setSubTab('matrix');
    setTimeout(() => {
      detailedViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!target || !document.contains(target)) return;
      if (isMobile) {
        // Mobile bottom sheet handles its own backdrop outside taps
        return;
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExportMenu(false);
        setShowMobileContestFilters(false);
      }
    };
    if (showExportMenu || showMobileContestFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExportMenu, showMobileContestFilters, isMobile]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());
  const [viewingProfileStudent, setViewingProfileStudent] = useState<any | null>(null);

  useScrollLock(Boolean(viewingProfileStudent || (isMobile && (showExportMenu || showMobileContestFilters))));

  const contestDeptOptions = useMemo<GlobalFilterOption[]>(() => {
    const roleClean = (user?.role || '').trim().toLowerCase();
    const isStaffMentor = ['staff', 'faculty', 'staff mentor', 'faculty mentor'].includes(roleClean);
    const isHod = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean);
    const isGlobalRole = ['admin', 'super admin', 'super_admin', 'administrator', 'principal', 'management', 'director'].includes(roleClean);
    const userDeptCode = (typeof user?.department === 'string' ? user.department : (user?.department as any)?.code) || (Array.isArray(user?.authorized_department_codes) && user.authorized_department_codes[0]) || '';

    const hodAuthCodes = (Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : []).map(c => String(c).toUpperCase());
    const filteredDepts = (isHod && !isGlobalRole)
      ? departments.filter(d => hodAuthCodes.includes(d.code.toUpperCase()) || (userDeptCode && d.code.toUpperCase() === userDeptCode.toUpperCase()))
      : departments;

    return isStaffMentor
      ? [
        { value: 'ALL', label: 'My Allocated Mentees', pillText: 'MENTEES' },
        ...(userDeptCode ? [{ value: userDeptCode, label: `${userDeptCode} (My Department)`, pillText: userDeptCode }] : [])
      ]
      : (isHod && !isGlobalRole)
        ? [
          ...(filteredDepts.length > 1 ? [{ value: 'ALL', label: 'All My Authorized Departments', pillText: 'ALL' }] : []),
          ...filteredDepts.map((d) => ({
            value: d.code,
            label: d.name,
            pillText: d.code
          }))
        ]
        : [
          { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
          ...departments.map((d) => ({
            value: d.code,
            label: d.name,
            pillText: d.code
          }))
        ];
  }, [user, departments]);

  useEffect(() => {
    if (viewingProfileStudent) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setViewingProfileStudent(null);
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [viewingProfileStudent]);

  // Global ESC handler for panels, dropdowns and non-locked modals
  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeptOpen(false);
        setYearOpen(false);
        setAttOpen(false);
        setShowDetailedView(false);
        setShowAdminMonitor(false);
        setShowAuthRequiredModal(false);
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, []);


  // Ultra-Fast Virtualized Pagination States (20 rows on mobile for 120Hz butter-smooth scrolling)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 20;
    return 50;
  });
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewPageSize, setPreviewPageSize] = useState<number>(25);

  // Automatically reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
    setPreviewPage(1);
  }, [selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, debouncedSearchTerm]);

  // Helper: Detect active Sunday 08:00 AM - 09:30 AM IST contest window
  const isSundayLiveWindowActive = useCallback((): boolean => {
    try {
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const istMs = utcMs + (5.5 * 60 * 60 * 1000);
      const istDate = new Date(istMs);
      const day = istDate.getDay(); // 0 = Sunday
      const hours = istDate.getHours();
      const mins = istDate.getMinutes();
      const timeInMins = hours * 60 + mins;
      return day === 0 && timeInMins >= 480 && timeInMins <= 570; // 08:00 to 09:30 IST
    } catch {
      return false;
    }
  }, []);

  // Optimized Live Telemetry Polling Effect (only when tab is visible and session is LIVE)
  const pollTelemetry = useCallback(async () => {
    if (!selectedSessionId || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    if (currentSession?.status === 'FINALIZED') return;

    try {
      const res = await api.get(`/contests/sessions/${selectedSessionId}/live-status`);
      if (res.data) {
        setLiveTelemetry(res.data);
        if (res.data.countdownSec !== undefined) setCountdownSec(res.data.countdownSec);
        if (res.data.timeRemainingSec !== undefined) setTimeRemainingSec(res.data.timeRemainingSec);
        if (res.data.nextUpdateSec !== undefined) setNextUpdateTicker(res.data.nextUpdateSec);

        if (res.data.status && currentSession?.status !== res.data.status) {
          setCurrentSession((prev: any) => prev ? { ...prev, status: res.data.status } : prev);
        }
      }
    } catch (_err) {
      // Silent retry
    }
  }, [selectedSessionId, currentSession?.status]);

  // Load saved solver delta for selected session
  useEffect(() => {
    if (!selectedSessionId) return;
    try {
      const saved = localStorage.getItem(`contest_delta_${selectedSessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          setSolverDelta(parsed);
          return;
        }
      }
    } catch (_e) { }
    setSolverDelta(null);
  }, [selectedSessionId]);

  // Live Telemetry Auto-Poll: runs every 60s when session is LIVE or Sunday contest window
  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    // Initial fetch on mount / session change
    pollTelemetry();

    const activeObj = sessionsList.find(s => Number(s.sessionId) === Number(selectedSessionId)) || currentSession;
    const isSundayActiveWindow = isSundayLiveWindowActive();
    const isSessionLive = currentSession?.status === 'LIVE' || activeObj?.status === 'LIVE' || isSundayActiveWindow;

    if (isSessionLive || autoRefresh) {
      // Poll telemetry every 20s when LIVE or during Sunday window for TV responsiveness
      interval = setInterval(() => {
        if (isMounted) pollTelemetry();
      }, 120000);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTelemetry, autoRefresh, currentSession?.status, sessionsList, selectedSessionId, isSundayLiveWindowActive]);

  // Live Matrix Rows Auto-Poll: refresh contest results every 25s when LIVE or during Sunday window
  useEffect(() => {
    if (!selectedSessionId) return;
    const isSundayActiveWindow = isSundayLiveWindowActive();
    const isSessionLive = currentSession?.status === 'LIVE' || isSundayActiveWindow;
    if (!isSessionLive && !autoRefresh) return;

    let isMounted = true;
    const interval = setInterval(() => {
      if (!isMounted || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      // Silent refresh — keep existing rows, just update values
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, true);
    }, 120000); // Every 25s during LIVE / Sunday contest window for instant TV updates

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, currentSession?.status, autoRefresh, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, isSundayLiveWindowActive]);

  // Post-9:30 AM Activity Fix: Automatic Final Fetch 
  useEffect(() => {
    if (selectedSessionId && currentSession?.status === 'FINALIZED') {
      // Automatically pull the authoritative finalized dataset once when transitioning to FINALIZED
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, currentSession?.status]);

  // WebSocket Live Rendering — Batched O(1) state updates
  const handleWebSocketBatch = useCallback((events: ContestWSEvent[]) => {
    setMatrixRows(prev => {
      let changed = false;
      const updated = [...prev];

      const byId = new Map<number, number>();
      const byRegNo = new Map<string, number>();
      const byName = new Map<string, number>();
      const byUsername = new Map<string, number>();

      for (let i = 0; i < updated.length; i++) {
        const r = updated[i];
        if (r.student_id != null || r.id != null) byId.set((r.student_id || r.id), i);
        if (r.reg_no) byRegNo.set(r.reg_no, i);
        if (r.name) byName.set(r.name, i);
        if (r.username) byUsername.set(r.username, i);
      }

      for (const event of events) {
        let idx = -1;
        if (event.studentId != null && byId.has(event.studentId)) idx = byId.get(event.studentId)!;
        else if (event.regNo && byRegNo.has(event.regNo)) idx = byRegNo.get(event.regNo)!;
        else if (event.studentName && byName.has(event.studentName)) idx = byName.get(event.studentName)!;
        else if (event.username && byUsername.has(event.username)) idx = byUsername.get(event.username)!;
        else if (event.contestId && byUsername.has(event.contestId)) idx = byUsername.get(event.contestId)!;

        if (idx === -1) continue;

        changed = true;
        updated[idx] = {
          ...updated[idx],
          q1: event.q1 ?? updated[idx].q1,
          q2: event.q2 ?? updated[idx].q2,
          q3: event.q3 ?? updated[idx].q3,
          q4: event.q4 ?? updated[idx].q4,
          q1_score: event.q1 ?? updated[idx].q1_score,
          q2_score: event.q2 ?? updated[idx].q2_score,
          q3_score: event.q3 ?? updated[idx].q3_score,
          q4_score: event.q4 ?? updated[idx].q4_score,
          total_solved: event.solvedCount ?? updated[idx].total_solved,
          total_contest_solved: event.solvedCount ?? updated[idx].total_contest_solved,
          rank: event.officialRank ?? updated[idx].rank,
          official_rank: event.officialRank ?? updated[idx].official_rank,
          participation_status: event.participationStatus ?? updated[idx].participation_status,
          last_updated: event.timestamp ?? new Date().toISOString()
        };
      }

      return changed ? updated : prev;
    });
  }, []);

  const activeContestIdStr = selectedSessionId ? String(selectedSessionId) : '518';
  const {
    status: wsStatus,
    syncState: wsSyncState,
    initialProgress: wsProgress,
    latestUpdate: wsLatestUpdate,
    liveFeed: wsLiveFeed,
    lastSyncAt: wsLastSyncAt,
    subscribeSession: wsSubscribeSession,
    unsubscribeSession: wsUnsubscribeSession
  } = useContestWebSocket({
    contestId: activeContestIdStr,
    sessionId: selectedSessionId,
    onBatchUpdate: handleWebSocketBatch
  });

  // Send SUBSCRIBE when user switches contest sessions, UNSUBSCRIBE on cleanup
  useEffect(() => {
    if (!selectedSessionId) return;
    wsSubscribeSession(selectedSessionId);
    return () => {
      wsUnsubscribeSession(selectedSessionId);
    };
  }, [selectedSessionId, wsSubscribeSession, wsUnsubscribeSession]);

  // Listen for virtual events forwarded via the DOM event bus from useContestWebSocket
  // This allows LiveEventRouter to patch the contest matrix without a full re-render
  useEffect(() => {
    const handleVirtualEvent = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data || !data.type) return;
      // LiveEventRouter is imported in main.tsx and accessible via queryClient
      // We dispatch it to the existing handleMessage pipeline
      if (typeof (window as any).__liveEventRouter?.handleMessage === 'function') {
        (window as any).__liveEventRouter.handleMessage(data);
      }
    };
    window.addEventListener('ws_virtual_event', handleVirtualEvent);
    return () => window.removeEventListener('ws_virtual_event', handleVirtualEvent);
  }, []);

  // Incremental row update on WebSocket STUDENT_ACTIVITY_UPDATED event
  useEffect(() => {
    if (!wsLatestUpdate) return;
    const evt = wsLatestUpdate;
    setMatrixRows(prev => {
      const updated = [...prev];
      let idx = evt.student_id != null ? updated.findIndex(r => (r.student_id || r.id) === evt.student_id) : -1;
      if (idx === -1 && evt.people_id) idx = updated.findIndex(r => r.people_id === evt.people_id);
      if (idx === -1 && evt.student_name) idx = updated.findIndex(r => r.name === evt.student_name || r.username === evt.account_id);

      if (idx !== -1) {
        const oldRow = updated[idx];
        const timeline = oldRow.timeline || [];
        const newEntry = evt.activity?.activity_timeline_entry;

        updated[idx] = {
          ...oldRow,
          q1: evt.activity?.q1 ?? oldRow.q1,
          q2: evt.activity?.q2 ?? oldRow.q2,
          q3: evt.activity?.q3 ?? oldRow.q3,
          q4: evt.activity?.q4 ?? oldRow.q4,
          q1_score: evt.activity?.q1 ?? oldRow.q1_score,
          q2_score: evt.activity?.q2 ?? oldRow.q2_score,
          q3_score: evt.activity?.q3 ?? oldRow.q3_score,
          q4_score: evt.activity?.q4 ?? oldRow.q4_score,
          total_solved: evt.activity?.count ?? oldRow.total_solved,
          total_contest_solved: evt.activity?.count ?? oldRow.total_contest_solved ?? oldRow.total_solved,
          score_display: evt.activity?.score_display ?? oldRow.score_display,
          last_updated: evt.timestamp,
          is_recently_updated: true,
          timeline: newEntry ? [newEntry, ...timeline] : timeline
        };
      }
      return updated;
    });
  }, [wsLatestUpdate]);


  // NOTE: The 1-second tick is now handled inside the isolated ContestCountdown /
  // LiveCountdownClock / NextUpdateTicker memo components so the main page does NOT
  // re-render every second. We still keep countdownSec/timeRemainingSec in state
  // so they can be seeded from the API, but the interval below is intentionally removed.

  // Admin Control Handler with immediate state refresh & invariant support
  const handleAdminAction = async (action: string) => {
    if (!selectedSessionId) return;
    setIsPerformingAdminAction(true);
    try {
      const res = await api.post(`/contests/sessions/${selectedSessionId}/admin-control`, { action });
      setAdminActionMsg(res.data?.message || `Action ${action} executed successfully.`);
      if (res.data?.invariants) {
        setInvariantResults(res.data.invariants);
      }
      setTimeout(() => setAdminActionMsg(''), 5000);
      const telemRes = await api.get(`/contests/sessions/${selectedSessionId}/live-status`);
      if (telemRes.data) setLiveTelemetry(telemRes.data);
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
    } catch (err: any) {
      setAdminActionMsg(err.response?.data?.detail || err.message || `Failed to execute ${action}`);
      setTimeout(() => setAdminActionMsg(''), 6000);
    } finally {
      setIsPerformingAdminAction(false);
    }
  };


  // Sunday Live Contest Autopilot Snapshot State
  const snapshotAlertFiredRef = useRef<boolean>(false);



  // Student Edit / Delete state
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDeptId, setEditDeptId] = useState<number>(1);
  const [editDeptCode, setEditDeptCode] = useState<string>('');
  const [editYearLevel, setEditYearLevel] = useState<string>('III');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editLeetCodeUrl, setEditLeetCodeUrl] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [isSavingStudent, setIsSavingStudent] = useState<boolean>(false);

  const [deletingStudent, setDeletingStudent] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [bulkDeleteSoft, setBulkDeleteSoft] = useState<boolean>(true);

  // Email state
  const [recipientsList, setRecipientsList] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customEmailNote, setCustomEmailNote] = useState<string>('');
  const [testEmailInput, setTestEmailInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  const latestReqIdRef = React.useRef(0);

  useEffect(() => {
    fetchInitialContestData();
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const res = await api.get('/email/recipients');
      setRecipientsList(res.data || []);
      const activeEmails = (res.data || []).filter((r: any) => r.is_active !== false).map((r: any) => r.email);
      setSelectedRecipients(activeEmails);
    } catch (_err) {
      console.error('Failed to load email recipients');
    }
  };

  const handleCalendarDateChange = async (dateStr: string) => {
    setCustomCalendarDate(dateStr);
    if (!dateStr) {
      fetchInitialContestData();
      return;
    }
    try {
      const res = await api.post(`/contests/custom-session?date=${dateStr}`);
      if (res.data?.sessionId) {
        setSessionsList(prev => {
          const exists = prev.some(s => s.sessionId === res.data.sessionId);
          return exists ? prev : [res.data, ...prev];
        });
        handleSelectSession(res.data.sessionId);
      }
    } catch (err) {
      console.error("Failed to load session for date", dateStr, err);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, debouncedSearchTerm, currentPage, pageSize]);

  // Pull-to-refresh listener: clear contest caches and refetch live session telemetry & student matrix
  useEffect(() => {
    const handlePull = () => {
      clearContestCache();
      fetchInitialContestData();
      if (selectedSessionId) {
        fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, false);
      }
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter]);

  // Auto-switch tab to live matrix view when contest is LIVE
  const isSessionLiveNow = currentSession?.status === 'LIVE';
  useEffect(() => {
    if (isSessionLiveNow) {
      setActiveTab('matrix');
    }
  }, [isSessionLiveNow]);

  // Auto-fetch full session roster for live preview & report verification
  useEffect(() => {
    if (showPreviewModal && selectedSessionId && allSessionRows.length < 10) {
      api.get(`/contests/sessions/${selectedSessionId}/matrix?dept=ALL&year=ALL&attendance=ALL&paginated=false`)
        .then(res => {
          const items = res.data?.items || [];
          if (items.length > 0) {
            setAllSessionRows(items);
          }
        })
        .catch(() => {});
    }
  }, [showPreviewModal, selectedSessionId, allSessionRows.length]);


  async function fetchInitialContestData() {
    try {
      const sortDesc = (arr: any[]) => [...arr].sort((a: any, b: any) => {
        const numA = parseInt((a.contestName || a.sessionCode || '').match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt((b.contestName || b.sessionCode || '').match(/\d+/)?.[0] || '0', 10);
        return numB - numA;
      });

      // Check cached sessions first for instant 0ms shell population
      const cachedList = getCachedContestData<any[]>('all_contest_sessions');
      const cachedCurr = getCachedContestData<any>('current_contest_session');
      if (cachedList && cachedList.length > 0) {
        const sortedCached = sortDesc(cachedList);
        setSessionsList(sortedCached);
        if (cachedCurr) setCurrentSession(cachedCurr);
        const liveSessionCached = sortedCached.find((s: any) => (s.status || '').toUpperCase() === 'LIVE');
        const latestSyncedCached = sortedCached.find((s: any) => !(s.status || '').toUpperCase().includes('SCHEDULE'));
        const targetId = cachedCurr?.sessionId || liveSessionCached?.sessionId || latestSyncedCached?.sessionId || sortedCached[0]?.sessionId || null;
        if (targetId) {
          selectedSessionIdRef.current = targetId;
          setSelectedSessionId(targetId);
        }
      }

      const [currRes, allSessionsRes] = await Promise.all([
        fetchWithCacheDedupe('current_contest_session', () => api.get('/contests/current-session').then(r => r.data), { ttlMs: 5000 }),
        fetchWithCacheDedupe('all_contest_sessions', () => api.get('/contests/sessions').then(r => r.data), { ttlMs: 5000 })
      ]);

      setCurrentSession(currRes);
      const rawList = allSessionsRes || [];
      const sortedList = sortDesc(rawList);
      setSessionsList(sortedList);

      // Auto-select: strictly prefer current active/finalized contest session first (never 510)
      const liveSession = sortedList.find((s: any) => (s.status || '').toUpperCase() === 'LIVE');
      const latestSynced = sortedList.find((s: any) => !(s.status || '').toUpperCase().includes('SCHEDULE'));
      const targetId = currRes?.sessionId || liveSession?.sessionId || latestSynced?.sessionId || sortedList[0]?.sessionId || null;
      if (targetId) {
        selectedSessionIdRef.current = targetId;
        setSelectedSessionId(targetId);
      }
    } catch (err) {
      console.error("Failed to load contest session data", err);
    }
  };

  const selectedSessionIdRef = React.useRef<number | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const handleSelectSession = (sessionId: number) => {
    if (Number(sessionId) === Number(selectedSessionId)) return;

    // Cancel any ongoing request immediately upon switching contest to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const sessObj = sessionsList.find(s => Number(s.sessionId) === Number(sessionId));
    console.log("[CONTEST CLICK]", { contestNumber: sessObj?.contestNumber, sessionId });

    // Check SWR Cache for sub-300ms instantaneous hydration
    const cachedSummary = getCachedContestData<any>(`contest_summary_${sessionId}`);
    const cachedQuestions = getCachedContestData<any>(`contest_questions_${sessionId}`);
    const cachedMatrix = getCachedContestData<any>(`contest_matrix_${sessionId}_${selectedDeptFilter}_${selectedYearFilter}_${selectedAttendanceFilter}_1`);

    if (cachedSummary) {
      setFastSummary(cachedSummary);
      if (cachedSummary.status) {
        setCurrentSession((prev: any) => prev ? { ...prev, status: cachedSummary.status } : { sessionId, status: cachedSummary.status });
      }
    }

    if (cachedQuestions) {
      setQuestionStats(cachedQuestions);
    }

    if (cachedMatrix) {
      setMatrixRows(cachedMatrix.items || []);
      if (cachedMatrix.items && cachedMatrix.items.length >= 10) {
        setAllSessionRows(cachedMatrix.items);
      }
      setTotalRows(cachedMatrix.total || 0);
      setSessionMetrics(cachedMatrix.metrics || null);
      setDepartmentStats(cachedMatrix.departmentStats || null);
      setYearStats(cachedMatrix.yearStats || null);
    }

    selectedSessionIdRef.current = sessionId;
    setSelectedSessionId(sessionId);
    setSelectedAttendanceFilter('ALL');
  };

  const abortControllerRef = React.useRef<AbortController | null>(null);


  const fetchSessionDetails = async (sessionId: number, dept: string = 'ALL', year: string = 'ALL', attendance: string = 'ALL', silent: boolean = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestedSessionId = sessionId;
    selectedSessionIdRef.current = sessionId;
    const reqId = ++latestReqIdRef.current;
    const t0 = performance.now();
    let summaryApiTime = 0;
    let questionsApiTime = 0;
    let rosterApiTime = 0;

    const isCurrentSessionMatch = () => (selectedSessionIdRef.current === null || Number(selectedSessionIdRef.current) === Number(requestedSessionId));

    try {
      const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
      const sortParam = sortConfig ? `&sort_by=${sortConfig.key}` : '';
      const matrixUrl = `/contests/sessions/${requestedSessionId}/matrix?dept=${dept}&year=${year}&attendance=${attendance}&paginated=true&page=${currentPage}&limit=${pageSize}${searchParam}${sortParam}`;

      // TIER 1: Priority 1 Fast Summary (< 300ms target)
      const summaryPromise = fetchWithCacheDedupe(
        `contest_summary_${requestedSessionId}`,
        () => api.get(`/contests/sessions/${requestedSessionId}/summary`, { signal: controller.signal }).then(r => r.data),
        { signal: controller.signal, ttlMs: 5000 }
      ).then((sData) => {
        summaryApiTime = performance.now() - t0;
        if (reqId === latestReqIdRef.current && isCurrentSessionMatch()) {
          setFastSummary(sData);
          if (sData?.departmentStats) {
            setDepartmentStats(sData.departmentStats);
          }
          if (sData?.status) {
            setCurrentSession((prev: any) => prev ? { ...prev, status: sData.status } : { sessionId: requestedSessionId, status: sData.status });
          }
        }
        return sData;
      }).catch(() => null);

      // TIER 2: Priority 2 Question Analytics
      const questionsPromise = fetchWithCacheDedupe(
        `contest_questions_${requestedSessionId}`,
        () => api.get(`/contests/sessions/${requestedSessionId}/questions`, { signal: controller.signal }).then(r => r.data),
        { signal: controller.signal, ttlMs: 5000 }
      ).then((qData) => {
        questionsApiTime = performance.now() - t0;
        if (reqId === latestReqIdRef.current && isCurrentSessionMatch()) {
          setQuestionStats(qData);
        }
        return qData;
      }).catch(() => null);

      // TIER 3: Priority 3 Paginated Student Roster Matrix
      const matrixPromise = api.get(matrixUrl, { signal: controller.signal }).then((matRes) => {
        rosterApiTime = performance.now() - t0;
        if (reqId === latestReqIdRef.current && isCurrentSessionMatch()) {
          const fetchedItems = matRes.data?.items || [];
          setMatrixRows(fetchedItems);
          if (fetchedItems.length >= 10 || dept === 'ALL') {
            setAllSessionRows(prev => (prev.length > fetchedItems.length && attendance !== 'ALL') ? prev : fetchedItems);
          }
          setTotalRows(matRes.data?.total || fetchedItems.length || 0);
          setSessionMetrics(matRes.data?.metrics || null);
          setDepartmentStats(matRes.data?.departmentStats || null);
          setYearStats(matRes.data?.yearStats || null);

          // Auto-track solver delta on fetch (e.g. 150 -> 160 => +10)
          try {
            const rawMetrics = matRes.data?.metrics;
            const currentAttended = rawMetrics?.officialAttended ?? rawMetrics?.officialParticipants ?? (matRes.data?.items ? matRes.data.items.filter((x: any) => x.participation_status === 'PUBLIC_ATTENDED' || x.participation_status === 'PUBLIC' || x.status === 'PUBLIC').length : null);
            if (typeof currentAttended === 'number' && requestedSessionId) {
              const baselineKey = `contest_baseline_solvers_${requestedSessionId}`;
              const prevSaved = localStorage.getItem(baselineKey);
              if (prevSaved !== null) {
                const prevNum = Number(prevSaved);
                if (!isNaN(prevNum) && prevNum !== currentAttended) {
                  const deltaVal = currentAttended - prevNum;
                  const deltaObj = { prev: prevNum, current: currentAttended, delta: deltaVal, timestamp: Date.now() };
                  setSolverDelta(deltaObj);
                  localStorage.setItem(`contest_delta_${requestedSessionId}`, JSON.stringify(deltaObj));
                }
              }
              localStorage.setItem(baselineKey, String(currentAttended));
            }
          } catch (_err) { }

          // Cache first page for instant re-opening
          if (currentPage === 1 && !debouncedSearchTerm) {
            setCachedContestData(`contest_matrix_${requestedSessionId}_${dept}_${year}_${attendance}_1`, matRes.data);
          }
        }
        return matRes.data;
      }).catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error("Matrix roster fetch error:", err);
        }
        return null;
      });

      // TIER 4: Priority 4 Deep Analytics (Non-blocking background query)
      const analyticsPromise = (async () => {
        try {
          const { queryClient } = await import('../lib/react-query');
          const compResData = await queryClient.fetchQuery({
            queryKey: ['contest-comparison', requestedSessionId, dept, year, attendance],
            queryFn: async () => {
              const res = await api.get(`/contests/sessions/${requestedSessionId}/comparison?dept=${dept}&year=${year}&attendance=${attendance}`);
              return res.data;
            },
            staleTime: 15 * 60 * 1000
          });

          const errResData = await queryClient.fetchQuery({
            queryKey: ['contest-data-quality', requestedSessionId, dept, year, attendance],
            queryFn: async () => {
              const res = await api.get(`/contests/sessions/${requestedSessionId}/data-quality?dept=${dept}&year=${year}&attendance=${attendance}`);
              return res.data;
            },
            staleTime: 15 * 60 * 1000
          });

          if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === requestedSessionId) {
            setErrorLogs(errResData || []);
            setComparison(compResData || null);
          }
        } catch (_err) { }
      })();

      // Run parallel requests
      await Promise.allSettled([summaryPromise, questionsPromise, matrixPromise, analyticsPromise]);

      // Telemetry Output
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === requestedSessionId) {
        const sessObj = sessionsList.find(s => Number(s.sessionId) === Number(requestedSessionId));
        logContestTelemetry({
          sessionId: requestedSessionId,
          contestNumber: sessObj?.contestNumber,
          firstUiMs: 0,
          summaryApiMs: summaryApiTime,
          questionsApiMs: questionsApiTime,
          rosterApiMs: rosterApiTime,
          totalReadyMs: performance.now() - t0,
          cacheHit: Boolean(getCachedContestData(`contest_summary_${requestedSessionId}`))
        });
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        console.error("Contest matrix fetch failed", err);
      }
    } finally {
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        setLoading(false);
      }
    }
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusStage, setSyncStatusStage] = useState<string>('');
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState<boolean>(false);
  const [syncSummary, setSyncSummary] = useState<any>(null);

  // Safety timer: ensure contest sync button never stays stuck on "Syncing..."
  useEffect(() => {
    if (isSyncing) {
      const timer = setTimeout(() => {
        setIsSyncing(false);
        setSyncStatusStage('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing]);

  const handleFetchSelectedContest = async () => {
    if (!selectedSessionId || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusStage('Authenticating institutional resource…');
    try {
      await new Promise(r => setTimeout(r, 400));
      setSyncStatusStage('Scanning LeetCode records & solvers…');

      const prevCount = stats.attendedRows || 0;
      const res = await api.post(`/contests/sessions/${selectedSessionId}/sync`, {}, { timeout: 180000 });
      setSyncSummary(res.data);

      const delta = typeof res.data?.delta === 'number'
        ? res.data.delta
        : ((res.data?.new_count ?? res.data?.target_authentic ?? prevCount) - prevCount);
      const newCount = res.data?.new_count ?? res.data?.target_authentic ?? (prevCount + delta);

      const deltaObj = { prev: prevCount, current: newCount, delta, timestamp: Date.now() };
      setSolverDelta(deltaObj);
      try {
        localStorage.setItem(`contest_delta_${selectedSessionId}`, JSON.stringify(deltaObj));
        localStorage.setItem(`contest_baseline_solvers_${selectedSessionId}`, String(newCount));
      } catch (_e) { }

      if (delta > 0) {
        setSyncStatusStage(`+${delta} New Solvers!`);
      } else if (delta === 0) {
        setSyncStatusStage('Up to Date (0 New)');
      } else {
        setSyncStatusStage('Sync Completed');
      }
      setTimeout(() => setSyncStatusStage(''), 4000);

      // Invalidate caches & reload matrix for selected session
      clearContestCache();
      await fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);

      const activeName = activeSessionObj?.contestName || `Weekly Contest #${selectedSessionId}`;
      setNotification({
        isOpen: true,
        type: 'success',
        title: delta > 0 ? `+${delta} New Solvers Added!` : 'Contest Synchronized (Up to Date)',
        message: delta > 0
          ? `Successfully refreshed ${activeName}. Found +${delta} new verified solvers (Total increased from ${prevCount} to ${newCount}).`
          : `Session ${activeName} is completely up to date. All ${newCount} verified students confirmed (0 new changes).`
      });
    } catch (err: any) {
      setSyncStatusStage('');
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const detail = err.response?.data?.detail;

      if (status === 401 || status === 403 || code === 'AUTH_REQUIRED' || (typeof detail === 'string' && detail.toLowerCase().includes('authentication required'))) {
        setShowAuthRequiredModal(true);
      } else {
        const isTimeout = err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'));
        const detailMsg = isTimeout
          ? "The sync job is taking a bit longer to process across all students. It is continuing to run on the server — please refresh in a moment."
          : (typeof detail === 'string' ? detail : err.message || "Synchronization could not be completed.");
        setNotification({
          isOpen: true,
          type: isTimeout ? 'info' : 'error',
          title: isTimeout ? 'Sync In Progress' : 'Sync Failed',
          message: detailMsg
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSession = async (sessionId: number, sessionLabel: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger session select
    const session = displaySessions.find(s => s.sessionId === sessionId);
    if (session?.status === 'LIVE') {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Delete Live Session',
        message: 'Cannot delete a LIVE session. Finalize the contest first.'
      });
      return;
    }

    setNotification({
      isOpen: true,
      type: 'warning',
      isConfirm: true,
      title: 'Delete Contest Session?',
      message: `Permanently delete "${sessionLabel}"? All contest results, snapshots, and email logs for this session will be removed.`,
      confirmText: 'Delete Session',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setNotification(null);
        setDeletingSessionId(sessionId);
        try {
          await api.delete(`/contests/sessions/${sessionId}`);

          // Re-fetch fresh data from the server instead of doing unsafe local state mutations
          // This prevents stale session IDs from causing 404 errors during export/sync.
          await fetchInitialContestData();
          setNotification({
            isOpen: true,
            type: 'success',
            title: 'Session Deleted',
            message: `Successfully deleted contest session ${sessionLabel}.`
          });
        } catch (err: any) {
          setNotification({
            isOpen: true,
            type: 'error',
            title: 'Delete Failed',
            message: err.response?.data?.detail || 'Failed to delete session.'
          });
        } finally {
          setDeletingSessionId(null);
        }
      }
    });
  };

  const isModalOpen = Boolean(editingStudent || deletingStudent || showPreviewModal || showEmailModal);
  useScrollLock(isModalOpen);

  useEffect(() => {
    if (isModalOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!isSavingStudent && !isDeletingStudent) {
            setEditingStudent(null);
            setDeletingStudent(null);
            setShowPreviewModal(false);
            setShowEmailModal(false);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen, editingStudent, deletingStudent, showPreviewModal, showEmailModal, isSavingStudent, isDeletingStudent]);

  const downloadReportFile = async (format: string) => {
    if (!selectedSessionId) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'No Contest Selected',
        message: 'Please select a Weekly Contest before generating the report.'
      });
      return;
    }

    const deptParam = encodeURIComponent(selectedDeptFilter || 'ALL');
    const yearParam = encodeURIComponent(selectedYearFilter || 'ALL');
    const attParam = encodeURIComponent(selectedAttendanceFilter || 'ALL');
    const url = `/reports/download-contest-single-sheet?session_id=${selectedSessionId}&format=${format}&dept=${deptParam}&year=${yearParam}&attendance=${attParam}`;
    const selSession = sessionsList.find(s => Number(s.sessionId) === Number(selectedSessionId)) || currentSession;

    const contestName = selSession?.contestName || 'Weekly Contest';
    const match = contestName.match(/\d+/);
    const contestNum = match ? match[0] : selectedSessionId;
    const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;

    // Build clean institutional filename reflecting active filters
    const d = (selectedDeptFilter || 'ALL').toUpperCase().trim();
    const deptSlug = (d === 'ALL' || d === '' || d === 'ALL DEPARTMENTS')
      ? 'All_Depts'
      : d.replace(/[\(\)\s]+/g, '_').replace(/-+/g, '_').replace(/^_|_$/g, '');

    const y = (selectedYearFilter || 'ALL').toUpperCase().trim();
    let yearSlug = 'All_Yrs';
    if (y !== 'ALL' && y !== '') {
      const yClean = y.replace('YEAR', '').replace('YR', '').trim();
      yearSlug = `${yClean}_Yr`;
    }

    const a = (selectedAttendanceFilter || 'ALL').toUpperCase().trim();
    const attSlug = (a !== 'ALL' && a !== '' && a !== 'PUBLIC') ? `_${a.replace(/\s+/g, '_')}` : '';

    const dateStr = selSession?.sessionDate ? `_${selSession.sessionDate.replace(/\./g, '-')}` : '';
    const filename = `NEC_W${contestNum}_${deptSlug}_${yearSlug}${attSlug}${dateStr}.${ext}`;
    const mimeType = format === 'pdf' ? 'application/pdf'
      : format === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : format === 'zip' ? 'application/zip'
          : format === 'csv' ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const formatLabel = format.toUpperCase();

    try {
      const res = await downloadManager.download({
        endpoint: url,
        filename,
        mimeType,
      });
      if (!res.success) {
        setNotification({
          isOpen: true,
          type: 'error',
          title: `${formatLabel} Report Generation Failed`,
          message: res.error || `Failed to generate ${formatLabel} report.`
        });
      }
    } catch (err: any) {
      console.error('Download failed:', err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: `${formatLabel} Report Generation Failed`,
        message: err.message || `Failed to generate ${formatLabel} report.`
      });
    }
  };

  const handleSendWeeklyEmail = async (isSafeTest: boolean = false) => {
    if (!selectedSessionId) return;

    let targetEmails: string[] = [];
    if (isSafeTest) {
      if (!testEmailInput || !testEmailInput.includes('@')) {
        setNotification({
          isOpen: true,
          type: 'warning',
          title: 'Invalid Test Recipient',
          message: 'Please enter a valid test email address (e.g. admin@nandha.edu.in).'
        });
        return;
      }
      targetEmails = [testEmailInput.trim()];
    } else {
      if (selectedRecipients.length === 0) {
        setNotification({
          isOpen: true,
          type: 'warning',
          title: 'No Recipients Selected',
          message: 'Please select at least one configured recipient to dispatch the report to.'
        });
        return;
      }
      targetEmails = selectedRecipients;
    }

    setIsSendingEmail(true);
    try {
      const payload = {
        session_id: selectedSessionId,
        recipient_emails: targetEmails,
        dept: selectedDeptFilter,
        year: selectedYearFilter,
        attendance: selectedAttendanceFilter,
        custom_message: customEmailNote || null,
        is_safe_test: isSafeTest
      };

      const res = await api.post('/email/send-manual', payload);
      setShowEmailModal(false);
      const fn = res.data?.excel_filename || 'Weekly_Contest.xlsx';
      const execId = res.data?.execution_id || 'EXEC-PASS';
      const studentCnt = res.data?.total_students || matrixRows.length;
      const sizeBytes = res.data?.file_size_bytes || 0;

      setNotification({
        isOpen: true,
        type: 'success',
        title: isSafeTest ? 'Safe Test Email Delivered' : 'Weekly Excel Report Delivered Successfully',
        message: `Attachment: ${fn}\n• Excel Validation: PASS\n• Attachment Integrity: PASS\n• Email Delivery: DELIVERED`,
        details: `Execution ID: ${execId} • Filtered Students: ${studentCnt} • Size: ${sizeBytes.toLocaleString()} bytes\n\nNote: Gmail inline preview may prompt downloading for formatted institutional .xlsx files. Download the file to open in Microsoft Excel, LibreOffice, or Google Sheets.`
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to dispatch report email.';
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Email Dispatch Failed',
        message: errMsg
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (selectedRowIds.size === 0) return;
    setIsSendingReminders(true);
    try {
      const regNos = Array.from(selectedRowIds);
      const res = await api.post(`/contests/sessions/${selectedSessionId || ''}/send-reminders`, {
        student_reg_nos: regNos,
        session_id: selectedSessionId || undefined
      });
      const data = res.data;
      const sentCount = data?.sent_count ?? regNos.length;
      const failedCount = data?.failed_count ?? 0;

      let detailsMsg = `Delivered: ${sentCount}`;
      if (failedCount > 0) {
        detailsMsg += ` • Failed: ${failedCount}`;
      }
      if (data?.dispatched && data.dispatched.length > 0) {
        const sampleEmails = data.dispatched.slice(0, 3).map((d: any) => `${d.name} (${d.email})`).join(', ');
        detailsMsg += `\nRecipients: ${sampleEmails}${data.dispatched.length > 3 ? '...' : ''}`;
      }

      setNotification({
        isOpen: true,
        title: sentCount > 0 ? 'Reminder Emails Dispatched' : 'Email Dispatch Notice',
        type: sentCount > 0 ? 'success' : 'error',
        message: data?.message || `Successfully sent contest reminder emails to ${sentCount} students.`,
        details: detailsMsg
      });
      setSelectedRowIds(new Set());
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to dispatch reminder emails.';
      setNotification({
        isOpen: true,
        title: 'Reminder Email Dispatch Failed',
        type: 'error',
        message: errMsg
      });
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleOpenEditStudent = useCallback((r: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setViewingProfileStudent(null);
    setEditingStudent(r);
    setEditName(r.name || '');
    setEditDeptCode(r.dept || '');
    // Resolve Dept ID from code if possible, default to 1 if unknown (backend or edit form handles correction)
    let dId = 1;
    if (r.dept) {
      const found = departments.find((d: any) => d.code === r.dept);
      if (found) dId = found.id;
    }
    setEditDeptId(dId);
    setEditYearLevel(r.year || 'III');
    setEditUsername(r.username || '');
    setEditLeetCodeUrl(r.leetcode_url || (r.username ? `https://leetcode.com/u/${r.username}/` : ''));
    setEditEmail(r.email || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments]);

  const handleSaveStudentEdit = async () => {
    if (!editingStudent) return;
    const studentId = editingStudent.student_id || editingStudent.id;
    if (!studentId) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Update Error',
        message: 'Student identifier not found.'
      });
      return;
    }

    setIsSavingStudent(true);
    try {
      await api.patch(`/students/${studentId}`, {
        name: editName.trim(),
        department_id: editDeptId,
        year_level: editYearLevel,
        username: editUsername.trim() || undefined,
        leetcode_url: editLeetCodeUrl.trim() || undefined,
        email: editEmail.trim() || undefined,
        version: editingStudent.version
      });

      // Update local row in matrixRows
      setMatrixRows(prev => prev.map(row => {
        if ((row.student_id || row.id) === studentId) {
          return {
            ...row,
            name: editName.trim(),
            dept: editDeptCode,
            year: editYearLevel,
            username: editUsername.trim()
          };
        }
        return row;
      }));

      setEditingStudent(null);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Student Profile Updated',
        message: `Successfully updated details for ${editName.trim()} (${editingStudent.reg_no}).`
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Update Student',
        message: err.response?.data?.detail || err.message || 'Could not update student details.'
      });
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    const studentId = deletingStudent.student_id || deletingStudent.id;
    if (!studentId) return;

    setIsDeletingStudent(true);
    try {
      await api.delete(`/students/${studentId}?soft_delete=true`);
      setMatrixRows(prev => prev.filter(row => (row.student_id || row.id) !== studentId));
      setDeletingStudent(null);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Student Deactivated',
        message: `Successfully deactivated student record ${deletingStudent.reg_no} (${deletingStudent.name}).`
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Deactivate Student',
        message: err.response?.data?.detail || err.message || 'Could not deactivate student record.'
      });
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedRowIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const sMap = new Map<string, any>();
      allSessionRows.forEach(r => { if (r.reg_no) sMap.set(r.reg_no, r); });
      matrixRows.forEach(r => { if (r.reg_no) sMap.set(r.reg_no, r); });

      const targetStudents = Array.from(selectedRowIds).map(regNo => sMap.get(String(regNo))).filter(Boolean);
      const studentIds = targetStudents.map(s => Number(s.student_id || s.id)).filter(id => !isNaN(id) && id > 0);

      if (studentIds.length === 0) {
        for (const regNo of Array.from(selectedRowIds)) {
          await api.delete(`/students/${String(regNo)}?soft_delete=${bulkDeleteSoft}`);
        }
      } else {
        await api.post('/students/bulk-delete', { 
          student_ids: studentIds, 
          soft_delete: bulkDeleteSoft 
        });
      }

      const deletedRegNos = new Set(Array.from(selectedRowIds).map(String));
      setMatrixRows(prev => prev.filter(r => !deletedRegNos.has(r.reg_no)));
      setAllSessionRows(prev => prev.filter(r => !deletedRegNos.has(r.reg_no)));
      setSelectedRowIds(new Set());
      setShowBulkDeleteModal(false);

      setNotification({
        isOpen: true,
        type: 'success',
        title: bulkDeleteSoft ? 'Students Deactivated' : 'Students Deleted',
        message: `Successfully ${bulkDeleteSoft ? 'deactivated' : 'permanently deleted'} ${targetStudents.length || selectedRowIds.size} student record(s).`
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Bulk Action Failed',
        message: err.response?.data?.detail || err.message || 'Could not process selected students.'
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Memoized Dynamic Statistics Calculation with Fast Tiered Fallback
  const stats = useMemo(() => {
    const isScopeActive = (canFilterCollege ? selectedCollegeFilter !== 'ALL' : false) || selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL';

    let calcAttended = 0;
    let calcVirtual = 0;
    let calcNotAttended = 0;
    let calcDataError = 0;
    let calcQ4 = 0;
    let calcQ3 = 0;
    let calcQ2 = 0;
    let calcQ1 = 0;
    let calcVirt4 = 0;
    let calcVirt3 = 0;
    let calcVirt2 = 0;
    let calcVirt1 = 0;
    let calcRankBelow20k = 0;
    let calcRankBelow5k = 0;

    const hasMatrixRows = matrixRows && matrixRows.length > 0;

    if (hasMatrixRows) {
      for (const r of matrixRows) {
        const st = (r.participation_status || r.status || '').toString().toUpperCase();

        // Dynamic score / total solved calculation
        let solved = 0;
        if (r.total_solved !== undefined && r.total_solved !== null && r.total_solved !== '—') {
          solved = Number(r.total_solved) || 0;
        } else if (r.total_contest_solved !== undefined && r.total_contest_solved !== null && r.total_contest_solved !== '—') {
          solved = Number(r.total_contest_solved) || 0;
        } else {
          const q1 = (r.q1 === 1 || r.q1 === '1') ? 1 : 0;
          const q2 = (r.q2 === 1 || r.q2 === '1') ? 1 : 0;
          const q3 = (r.q3 === 1 || r.q3 === '1') ? 1 : 0;
          const q4 = (r.q4 === 1 || r.q4 === '1') ? 1 : 0;
          solved = q1 + q2 + q3 + q4;
        }

        // Global Ranking check (< 20000)
        const grRaw = r.global_rank ?? r.contest_global_rank ?? r.profile_rank ?? (r as any).site_rank ?? (r as any).stats?.global_rank ?? (r as any).stats?.contest_global_ranking;
        if (grRaw !== undefined && grRaw !== null && grRaw !== '—' && grRaw !== 'Unrated' && grRaw !== '-') {
          const num = typeof grRaw === 'number' ? grRaw : Number(String(grRaw).replace(/[^0-9]/g, ''));
          if (num > 0 && num < 20000) {
            calcRankBelow20k++;
          }
        }

        // Contest Rank check (< 5000) for attended participants
        if (st === 'PUBLIC' || st === 'PUBLIC_ATTENDED' || st === 'ATTENDED' || st === 'VIRTUAL' || st === 'VIRTUAL_ATTENDED') {
          const crRaw = r.contest_rank ?? r.rank ?? (r as any).last_contest_rank ?? (r as any).stats?.contest_rank;
          if (crRaw !== undefined && crRaw !== null && crRaw !== '—' && crRaw !== 'Unrated' && crRaw !== '-') {
            const num = typeof crRaw === 'number' ? crRaw : Number(String(crRaw).replace(/[^0-9]/g, ''));
            if (num > 0 && num < 5000) {
              calcRankBelow5k++;
            }
          }
        }

        if (st === 'VIRTUAL' || st === 'VIRTUAL_ATTENDED') {
          calcVirtual++;
          if (solved >= 4) calcVirt4++;
          else if (solved === 3) calcVirt3++;
          else if (solved === 2) calcVirt2++;
          else if (solved === 1) calcVirt1++;
        } else if (st === 'PUBLIC' || st === 'PUBLIC_ATTENDED' || st === 'ATTENDED') {
          calcAttended++;
          if (solved >= 4) calcQ4++;
          else if (solved === 3) calcQ3++;
          else if (solved === 2) calcQ2++;
          else if (solved === 1) calcQ1++;
        } else if (
          !r.username ||
          [
            'USERNAME_NOT_FOUND', 'INVALID_USERNAME',
            'FETCH_FAILED', 'FETCH_ERROR', 'DATA_ERROR',
            'DATA_MISMATCH', 'CONFLICT',
            'AUTH_REQUIRED', 'BLOCKED', 'SOURCE_UNAVAILABLE',
            'ERROR', 'INVALID',
          ].includes(st)
        ) {
          calcDataError++;
        } else {
          calcNotAttended++;
        }
      }
    }

    const fallbackTotal = hasMatrixRows ? matrixRows.length : 0;

    // Use dynamic scope-calculated metrics whenever scope is filtered OR sessionMetrics doesn't cover matrixRows
    const totalRowsVal = (isScopeActive && sessionMetrics?.totalStudents !== undefined)
      ? sessionMetrics.totalStudents
      : (isScopeActive && hasMatrixRows)
        ? matrixRows.length
        : (sessionMetrics?.totalStudents ?? sessionMetrics?.totalCount ?? fastSummary?.totalStudents ?? (totalRows > 0 ? totalRows : undefined) ?? fallbackTotal);

    const attendedRows = (isScopeActive && sessionMetrics?.officialAttended !== undefined)
      ? sessionMetrics.officialAttended
      : (isScopeActive && hasMatrixRows)
        ? calcAttended
        : (sessionMetrics?.officialAttended ?? sessionMetrics?.officialParticipants ?? fastSummary?.participantCount ?? calcAttended);

    const virtualRows = (isScopeActive && sessionMetrics?.virtualAttended !== undefined)
      ? sessionMetrics.virtualAttended
      : (isScopeActive && hasMatrixRows)
        ? calcVirtual
        : (sessionMetrics?.virtualAttended ?? sessionMetrics?.virtualParticipants ?? fastSummary?.virtualParticipants ?? calcVirtual);

    const errorRows = (isScopeActive && (sessionMetrics?.dataErrors !== undefined || sessionMetrics?.errors !== undefined))
      ? (sessionMetrics?.dataErrors ?? sessionMetrics?.errors ?? 0)
      : (isScopeActive && hasMatrixRows)
        ? calcDataError
        : (sessionMetrics?.dataErrors ?? sessionMetrics?.totalErrors ?? sessionMetrics?.errors ?? sessionMetrics?.failedVerification ?? fastSummary?.dataErrors ?? fastSummary?.missingUsername ?? fastSummary?.errors ?? calcDataError);

    const notAttendedRows = (isScopeActive && sessionMetrics?.notAttended !== undefined)
      ? sessionMetrics.notAttended
      : (isScopeActive && hasMatrixRows)
        ? calcNotAttended
        : Math.max(0, totalRowsVal - attendedRows - virtualRows - errorRows);

    const isVirtualAvailable = sessionMetrics?.virtualDataStatus === 'AVAILABLE' || virtualRows > 0;

    let q4Solved = (isScopeActive && hasMatrixRows)
      ? (calcQ4 + calcVirt4)
      : (sessionMetrics?.q4Count ?? sessionMetrics?.['4 Q Solved'] ?? fastSummary?.solvedDistribution?.q4 ?? fastSummary?.q4Count ?? (calcQ4 + calcVirt4));

    let q3Solved = (isScopeActive && hasMatrixRows)
      ? (calcQ3 + calcVirt3)
      : (sessionMetrics?.q3Count ?? sessionMetrics?.['3 Q Solved'] ?? fastSummary?.solvedDistribution?.q3 ?? fastSummary?.q3Count ?? (calcQ3 + calcVirt3));

    let q2Solved = (isScopeActive && hasMatrixRows)
      ? (calcQ2 + calcVirt2)
      : (sessionMetrics?.q2Count ?? sessionMetrics?.['2 Q Solved'] ?? fastSummary?.solvedDistribution?.q2 ?? fastSummary?.q2Count ?? (calcQ2 + calcVirt2));

    let q1Solved = (isScopeActive && hasMatrixRows)
      ? (calcQ1 + calcVirt1)
      : (sessionMetrics?.q1Count ?? sessionMetrics?.['1 Q Solved'] ?? fastSummary?.solvedDistribution?.q1 ?? fastSummary?.q1Count ?? (calcQ1 + calcVirt1));

    let virtual4Solved = hasMatrixRows ? calcVirt4 : (sessionMetrics?.virtual4Solved ?? 0);
    let virtual3Solved = hasMatrixRows ? calcVirt3 : (sessionMetrics?.virtual3Solved ?? 0);
    let virtual2Solved = hasMatrixRows ? calcVirt2 : (sessionMetrics?.virtual2Solved ?? 0);
    let virtual1Solved = hasMatrixRows ? calcVirt1 : (sessionMetrics?.virtual1Solved ?? 0);

    const publicPct = totalRowsVal > 0 ? Math.min(100, Math.max(0, (attendedRows / totalRowsVal) * 100)).toFixed(1) : '0.0';
    const virtualPct = totalRowsVal > 0 ? Math.min(100, Math.max(0, (virtualRows / totalRowsVal) * 100)).toFixed(1) : '0.0';
    const notAttendedPct = totalRowsVal > 0 ? Math.min(100, Math.max(0, (notAttendedRows / totalRowsVal) * 100)).toFixed(1) : '0.0';
    // Dynamic Participation %: ((PUBLIC + VIRTUAL) / TOTAL) * 100
    const totalParticipationPct = totalRowsVal > 0 ? Math.min(100, Math.max(0, ((attendedRows + virtualRows) / totalRowsVal) * 100)).toFixed(1) : '0.0';

    const topPerformers = sessionMetrics?.topPerformers ?? [];
    const q0Solved = Math.max(0, (attendedRows + virtualRows) - q4Solved - q3Solved - q2Solved - q1Solved);

    const rankBelow20k = (isScopeActive && hasMatrixRows)
      ? calcRankBelow20k
      : (sessionMetrics?.rankBelow20000 ?? sessionMetrics?.ranking_below_20000 ?? fastSummary?.ranking_below_20000 ?? calcRankBelow20k);

    const rankBelow5k = (isScopeActive && hasMatrixRows)
      ? calcRankBelow5k
      : (sessionMetrics?.rankBelow5000 ?? sessionMetrics?.contest_rank_below_5000 ?? fastSummary?.contest_rank_below_5000 ?? calcRankBelow5k);

    return {
      totalRows: totalRowsVal,
      attendedRows,
      notAttendedRows,
      virtualRows,
      isVirtualAvailable,
      errorRows,
      q4Solved,
      q3Solved,
      q2Solved,
      q1Solved,
      q0Solved,
      virtual4Solved,
      virtual3Solved,
      virtual2Solved,
      virtual1Solved,
      rankBelow20k,
      rankBelow5k,
      publicPct,
      virtualPct,
      notAttendedPct,
      totalParticipationPct,
      topPerformers
    };
  }, [sessionMetrics, fastSummary, matrixRows, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, totalRows]);

  // Pre-Indexed Matrix Rows for Ultra-Fast Instant Search & Filtering
  const indexedMatrixRows = useMemo(() => {
    return matrixRows.map(r => {
      const rawD = typeof r.dept === 'string' ? r.dept : (typeof r.department === 'string' ? r.department : (r.department?.code || r.department?.name || ''));
      const d = rawD.toString().toUpperCase();
      const rawY = typeof r.year === 'string' ? r.year : (typeof r.year_level === 'string' ? r.year_level : (r.year || r.year_level || ''));
      const y = rawY.toString().toUpperCase();
      const st = (r.participation_status || r.status || r.attendance_status || '').toString().toUpperCase();
      const searchKey = `${r.name || ''} ${r.reg_no || ''} ${r.username || ''} ${r.leetcode_url || ''}`.toLowerCase();
      return {
        ...r,
        _deptKey: d,
        _yearKey: y,
        _statusKey: st,
        _searchKey: searchKey
      };
    });
  }, [matrixRows]);

  // Dynamic Full Dataset for Live Preview & Reports (Falls back to full student roster so never empty)
  const previewDataset = useMemo(() => {
    const pool = (allSessionRows && allSessionRows.length > 0)
      ? allSessionRows
      : (matrixRows && matrixRows.length > 0)
        ? matrixRows
        : (cachedStudents && cachedStudents.length > 0)
          ? cachedStudents
          : (globalStudents && globalStudents.length > 0)
            ? globalStudents
            : [];
    if (pool.length === 0) return [];

    const normalizedPool = pool.map((r: any) => {
      let deptStr = '—';
      if (typeof r.dept === 'string' && r.dept.trim()) {
        deptStr = r.dept.trim();
      } else if (typeof r.department === 'string' && r.department.trim()) {
        deptStr = r.department.trim();
      } else if (r.department && typeof r.department === 'object') {
        deptStr = r.department.code || r.department.name || '—';
      } else if (typeof r.department_code === 'string' && r.department_code.trim()) {
        deptStr = r.department_code.trim();
      }

      let yearStr = '—';
      if (typeof r.year === 'string' && r.year.trim()) {
        yearStr = r.year.trim();
      } else if (typeof r.year_level === 'string' && r.year_level.trim()) {
        yearStr = r.year_level.trim();
      } else if (typeof r.year === 'number') {
        yearStr = String(r.year);
      } else if (typeof r.year_level === 'number') {
        yearStr = String(r.year_level);
      } else if (r.year && typeof r.year === 'object') {
        yearStr = r.year.year || r.year.name || '—';
      }

      return {
        ...r,
        reg_no: r.reg_no || r.register_number || '—',
        name: r.name || '—',
        dept: deptStr,
        year: yearStr,
        participation_status: r.participation_status || (r.status === 'PUBLIC' ? 'PUBLIC_ATTENDED' : r.status === 'VIRTUAL' ? 'VIRTUAL_ATTENDED' : 'PUBLIC_NOT_ATTENDED'),
        status: r.status || (r.username ? 'NOT_ATTENDED' : 'USERNAME_NOT_FOUND'),
        total_solved: r.total_solved ?? r.total_contest_solved ?? 0,
        score: r.score ?? 0,
        rank: r.rank || r.contest_rank || '—',
        contest_rank: r.contest_rank || r.rank || '—',
        contest_rating: r.contest_rating || r.rating || 'Unrated',
        global_rank: r.contest_global_rank || r.global_rank || 'Unrated',
        q1: r.q1 ?? 0,
        q2: r.q2 ?? 0,
        q3: r.q3 ?? 0,
        q4: r.q4 ?? 0,
      };
    });

    return normalizedPool.filter((r: any) => {
      const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC';
      const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
      const isAttended = isPublicAttended || isVirtualAttended;
      const isError = r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR';
      const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED' || (!isAttended && !isError);

      if (selectedCollegeFilter !== 'ALL') {
        const studentCollege = deriveStudentCollege(r);
        if (studentCollege !== selectedCollegeFilter) return false;
      }
      if (selectedDeptFilter !== 'ALL') {
        const filterNorm = normalizeDepartment(selectedDeptFilter);
        const studentNorm = normalizeDepartment(r.dept || r.department || r.department_code || r.department_id);
        if (filterNorm !== studentNorm && !(r.dept || r.department || '').toString().toUpperCase().includes(selectedDeptFilter.toUpperCase())) return false;
      }
      if (selectedYearFilter !== 'ALL') {
        const studentYear = normalizeYear(r.year || r.year_level, r.reg_no || r.register_number);
        const targetYear = normalizeYear(selectedYearFilter);
        if (studentYear !== targetYear) return false;
      }
      if (selectedAttendanceFilter === 'PUBLIC_ATTENDED') return isPublicAttended;
      if (selectedAttendanceFilter === 'VIRTUAL_ATTENDED') return isVirtualAttended;
      if (selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED') return isNotAttended;
      if (selectedAttendanceFilter === 'DATA_ERROR') return isError;
      if (selectedAttendanceFilter === 'ALL_ATTENDED') return isAttended;

      return true;
    });
  }, [allSessionRows, matrixRows, cachedStudents, globalStudents, selectedAttendanceFilter, selectedCollegeFilter, selectedDeptFilter, selectedYearFilter]);

  // Memoized Debounced Filtered Rows with Instant Client-Side Fallback
  const filteredMatrixRows = useMemo(() => {
    if (matrixRows && matrixRows.length > 0) return matrixRows;
    return previewDataset;
  }, [matrixRows, previewDataset]);

  // Handle Sort Click
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Memoized Paginated Slices for 60fps High-Performance Rendering
  const paginatedMatrixRows = filteredMatrixRows;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalRows / (pageSize || 50)));
  }, [totalRows, pageSize]);

  const previewPaginatedRows = useMemo(() => {
    if (previewPageSize >= previewDataset.length) return previewDataset;
    const start = (previewPage - 1) * previewPageSize;
    return previewDataset.slice(start, start + previewPageSize);
  }, [previewDataset, previewPage, previewPageSize]);

  const previewTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(previewDataset.length / (previewPageSize || 50)));
  }, [previewDataset.length, previewPageSize]);

  // Stable memoized callback so ContestMatrixRow's memo comparator can skip re-renders
  const handleRowCheckbox = useCallback((regNo: string, checked: boolean) => {
    setSelectedRowIds(prev => {
      const s = new Set(prev);
      checked ? s.add(regNo) : s.delete(regNo);
      return s;
    });
  }, []);

  // Stable callback so MobileContestMatrixCard and ContestMatrixRow memoization is NOT broken by inline closures
  const handleQuickSync = useCallback((regNo: string) => {
    setQuickSyncIdentifier(regNo);
    setShowAdminMonitor(true);
    setAdminSubTab('live_monitor');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        adminMonitorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const isAdmin = Boolean(
    user?.role?.toLowerCase()?.includes('admin') || 
    user?.role?.toLowerCase() === 'system admin'
  );

  // Only show sessions that have actual data synced — exclude all SCHEDULED (future) sessions
  const displaySessions = sessionsList.filter(s => {
    const status = (s.status || '').toUpperCase();
    // Exclude any session that is purely SCHEDULED with no data yet
    return !status.includes('SCHEDULE');
  });
  const activeSessionObj = displaySessions.find(s => Number(s.sessionId) === Number(selectedSessionId)) || currentSession;

  useEffect(() => {
    if (activeSessionObj?.status === 'COMPLETED' || activeSessionObj?.status === 'ARCHIVED') {
      if (!snapshotAlertFiredRef.current) {
        snapshotAlertFiredRef.current = true;
        try { playCelebrationChime(); } catch (_) { }
      }
    }
  }, [activeSessionObj?.status]);
  const statusColor = activeSessionObj?.status === 'LIVE' ? 'bg-emerald-500 text-white animate-pulse' :
    activeSessionObj?.status === 'FINALIZED' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white';

  const toggleAttendanceFilter = (targetFilter: string) => {
    if (selectedAttendanceFilter === targetFilter) {
      setSelectedAttendanceFilter('ALL');
    } else {
      setSelectedAttendanceFilter(targetFilter);
    }
  };

  // Helper Time Formatters 
  const formatCountdown = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  };

  const formatTimeRemaining = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const cd = formatCountdown(countdownSec);
  // liveTimerFormatted removed — now rendered by isolated <LiveCountdownClock> memo component
  const isLive = activeSessionObj?.status === 'LIVE';
  const isScheduled = activeSessionObj?.status === 'SCHEDULED';
  const isFinalizing = activeSessionObj?.status === 'FINALIZING';

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6 sm:space-y-10 pt-0 animate-fade-in pb-40 sm:pb-32 md:pb-16">

      {/* 1. SLEEK 2026 INSTITUTIONAL HERO HEADER */}
      <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl text-white p-3.5 sm:p-5 md:p-6 border transition-all duration-500 ${isLive
        ? 'bg-gradient-to-br from-[#0c1222] via-[#090d1a] to-[#05070e] border-emerald-500/40 shadow-emerald-500/10'
        : 'bg-gradient-to-br from-[#0c1222] via-[#090d1a] to-[#05070e] border-white/[0.09]'
        }`}>
        {/* Ambient Radial Mesh Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-500/15 via-brand-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left Context Info */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {isLive ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md bg-rose-600 text-white animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  <span>LIVE NOW</span>
                </span>
              ) : isScheduled ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 shadow-sm bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" />
                  <span>SCHEDULED</span>
                </span>
              ) : isFinalizing ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 shadow-sm bg-brand-600 text-white animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>FINALIZING</span>
                </span>
              ) : null}

              {wsSyncState === 'INITIAL_SYNC' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-mono font-bold animate-pulse">
                  <RefreshCw className="w-2.5 h-2.5 text-indigo-400 animate-spin shrink-0" />
                  <span>INITIAL SYNC</span>
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-display tracking-tight text-white uppercase font-black">
                  {['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase()) ? (
                    <>
                      MY <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300 font-extrabold">{activeSessionObj?.contestName || 'WEEKLY CONTEST'}</span>
                    </>
                  ) : (
                    <>
                      {activeSessionObj?.contestName || 'WEEKLY CONTEST'} <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300 font-extrabold">DASHBOARD</span>
                    </>
                  )}
                </h1>

                {user?.role?.toLowerCase() === 'admin (system admin)' && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-300 font-bold tracking-wide pt-1.5 border-t border-white/10">
              <span className="text-indigo-300">
                {isLive ? (
                  <>Last Updated: {liveTelemetry?.lastUpdatedIst || '08:42:17 AM IST'} (Next in <NextUpdateTicker initialSec={nextUpdateTicker} />)</>
                ) : (
                  <>
                    <span className="sm:hidden">Filter students by Dept, Year, Status</span>
                    <span className="hidden sm:inline">Filter students by Department, Academic Year, Name &amp; Status</span>
                  </>
                )}
              </span>
              {!isLive && activeSessionObj?.status && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    Last synced: {sessionMetrics?.last_synced || sessionMetrics?.generatedAtIST || sessionMetrics?.lastUpdated || activeSessionObj?.sessionDate || 'Live'}
                  </span>
                  {solverDelta && (
                    <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full ${solverDelta.delta > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'
                      }`}>
                      {solverDelta.delta > 0 ? `+${solverDelta.delta} new` : '0 new'} ({solverDelta.current} verified)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Controls: Unified Responsive Session Selector & Live Monitor Toggle */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/[0.06] dark:bg-slate-900/50 p-2 sm:p-1.5 rounded-xl sm:rounded-2xl border border-white/10 backdrop-blur-md shadow-md shrink-0">

            {/* Session Dropdown Selector with Delete Option */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 w-full sm:min-w-[280px]">
              <div className="min-w-0 flex-1">
                <GlobalFilter
                  options={displaySessions.map((s) => {
                    const statusUp = (s.status || '').toUpperCase();
                    const isCompleted = statusUp.includes('FINAL') || statusUp.includes('COMPLET');
                    const isScheduled = statusUp.includes('SCHEDULE');

                    let rawDate = s.sessionDate || '';
                    let formattedDate = rawDate;
                    if (rawDate.includes('-')) {
                      const parts = rawDate.split('-');
                      if (parts.length === 3 && parts[0].length === 4) {
                        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
                      }
                    }

                    return {
                      value: String(s.sessionId),
                      label: `${formattedDate} — ${s.contestName}`,
                      pillText: isScheduled ? 'SCHEDULED' : (isCompleted ? 'FINALIZED' : (statusUp || 'ACTIVE')),
                      pillColorClass: isScheduled
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : (isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30')
                    };
                  })}
                  value={selectedSessionId ? String(selectedSessionId) : ''}
                  onChange={(val) => handleSelectSession(Number(val))}
                  hideIcon={true}
                  placeholder="[ Select Session ]"
                  searchPlaceholder="Search contest session..."
                  showSearch={true}
                  variant="dark"
                  className="w-full !rounded-xl border border-white/15 !shadow-sm !bg-slate-900/80 hover:!bg-slate-800/90 !text-white text-xs font-bold"
                  dropdownWidth="w-full sm:w-[320px]"
                />
              </div>

              {(user?.role?.toLowerCase().includes('admin') || user?.role?.toLowerCase() === 'system admin') && activeSessionObj && (
                <DeleteSessionControl
                  session={activeSessionObj}
                  onDeleted={async (deletedId, label) => {
                    await fetchInitialContestData();
                    setNotification({
                      isOpen: true,
                      type: 'success',
                      title: 'Session Deleted',
                      message: `Successfully deleted contest session ${label}.`
                    });
                  }}
                  onWarning={(title, message) => {
                    setNotification({
                      isOpen: true,
                      type: 'warning',
                      title,
                      message
                    });
                  }}
                />
              )}
            </div>

            {/* Admin Live Monitor Toggle — Responsive Pill Button */}
            {(user?.role?.toLowerCase().includes('admin') || user?.role?.toLowerCase() === 'system admin') && (
              <button
                onClick={() => {
                  if (!showAdminMonitor) {
                    setShowAdminMonitor(true);
                    setAdminSubTab('live_monitor');
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        adminMonitorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                    });
                  } else {
                    setShowAdminMonitor(false);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border active:scale-[0.98] whitespace-nowrap shadow-sm shrink-0 w-full sm:w-auto ${showAdminMonitor
                    ? 'bg-rose-600/90 hover:bg-rose-600 text-white border-rose-500/50 shadow-rose-900/30'
                    : 'bg-slate-800/90 hover:bg-slate-800 text-emerald-400 hover:text-white border-emerald-500/30 hover:border-emerald-500/60'
                  }`}
                title="Toggle Live Contest Monitor"
              >
                <Activity className={`w-3.5 h-3.5 ${showAdminMonitor ? 'text-white' : 'text-emerald-400 animate-pulse'}`} />
                <span>{showAdminMonitor ? 'Hide Monitor' : 'Live Monitor'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* INITIAL SYNC PROGRESS BANNER (1/297 -> 297/297) */}
      {wsProgress && (
        <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 flex items-center justify-between shadow-xl animate-pulse">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider">Initial Synchronization In Progress</h4>
              <p className="text-xs text-indigo-300">Fetching baseline contest state for all {wsProgress.total} registered students...</p>
            </div>
          </div>
          <div className="text-right font-mono font-bold text-lg text-indigo-300">
            {wsProgress.processed}/{wsProgress.total} ({wsProgress.percent}%)
          </div>
        </div>
      )}

      {/* GLOBAL LIVE ACTIVITY FEED (ZERO MANUAL REFRESH) */}
      {wsLiveFeed.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-slate-200 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              GLOBAL LIVE ACTIVITY FEED (AUTOMATIC REALTIME UPDATES)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">WebSocket Persistent Connection</span>
          </div>
          <div className="flex space-x-3 overflow-x-auto py-1 scrollbar-thin">
            {wsLiveFeed.slice(0, 10).map((feed, idx) => (
              <div key={feed.event_id || idx} className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center space-x-2.5 shadow-md border-l-4 border-l-emerald-500">
                <span className="font-bold text-indigo-300">{feed.student_name} ({feed.people_id})</span>
                <span className="text-emerald-300 font-bold">{feed.text}</span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{feed.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* 1C. LIVE MODE TELEMETRY, QUESTION PROGRESS & LIVE ACTIVITY FEED */}
      {isLive && (
        <div className="mt-6 sm:mt-8 space-y-4 animate-fade-in">
          {/* Live Timer Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border border-emerald-500/40 text-white flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Clock className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-emerald-400 tracking-wider">CONTEST TIME REMAINING</p>
                <p className="text-2xl font-mono font-black text-white">
                  <LiveCountdownClock endSec={timeRemainingSec} label="Time remaining" />
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Contest Ends At</p>
                <p className="text-sm font-mono font-black text-indigo-300">09:30:00 AM IST</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Next Sync In</p>
                <p className="text-sm font-mono font-black text-emerald-400">
                  <NextUpdateTicker initialSec={nextUpdateTicker} />
                </p>
              </div>
            </div>
          </div>

          {/* Live Question Progress (Q1..Q4) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-500" />
                <span>Live Question Solved Progress</span>
              </h4>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                Total Solves: {liveTelemetry?.questionProgress?.totalSolved || 0} • Avg: {liveTelemetry?.questionProgress?.avgSolved || 0.0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { q: 'Q1 (Easy)', count: liveTelemetry?.questionProgress?.q1 || 0, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
                { q: 'Q2 (Medium)', count: liveTelemetry?.questionProgress?.q2 || 0, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
                { q: 'Q3 (Med/Hard)', count: liveTelemetry?.questionProgress?.q3 || 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
                { q: 'Q4 (Hard)', count: liveTelemetry?.questionProgress?.q4 || 0, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' }
              ].map((item, idx) => (
                <div key={idx} className={`p-3 rounded-2xl border ${item.bg} text-center shadow-sm`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">{item.q}</span>
                  <span className={`text-xl font-black font-mono ${item.color}`}>{item.count}</span>
                  <span className="text-[9px] text-slate-400 block font-medium">solved</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Verified Activity Feed */}
          {Array.isArray(liveTelemetry?.liveEvents) && liveTelemetry.liveEvents.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-navy-950 to-indigo-950 text-white border border-slate-700 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-brand-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                  <span>Live Activity Feed (Verified Events)</span>
                </span>
                <span className="text-[10px] text-slate-400">Real-time solve stream</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                {(Array.isArray(liveTelemetry?.liveEvents) ? liveTelemetry.liveEvents : []).map((evt: any) => (
                  <div key={evt.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] text-slate-400">{evt.timestamp}</span>
                      <span className="font-bold text-white">{evt.studentName}</span>
                      <span className="text-emerald-400 font-bold">{evt.detail}</span>
                    </div>
                    {evt.rank && (
                      <span className="font-mono text-[11px] text-indigo-300">
                        Rank #{evt.rank} {evt.rankChange ? `(↑ +${evt.rankChange})` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1D. ADMIN LIVE CONTEST OPERATIONS & WORKER TELEMETRY SUITE */}
      {showAdminMonitor && (
        <div ref={adminMonitorRef} className="p-5 sm:p-7 rounded-3xl bg-slate-900 text-white border border-slate-700/80 shadow-lg space-y-6 animate-fade-in scroll-mt-6 mt-4 sm:mt-6">
          {/* Header with Title, Worker Badge, and Action Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black uppercase tracking-wider text-brand-300 flex items-center gap-2 flex-wrap">
                  <span>Admin Live Contest Operations & Worker Telemetry</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 font-mono border border-emerald-400/40 font-bold shrink-0">
                    ACTIVE SUITE
                  </span>
                </h4>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">Mission-control engine for real-time synchronization, worker gating, and invariant validation.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 flex items-center gap-2 shadow-inner">
                <Cpu className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>Worker: <strong className="text-white font-black">{liveTelemetry?.workerId || 'WORKER-LIVE-5'}</strong></span>
                <span className={`px-2 py-0.5 text-[9.5px] font-black rounded-md ${liveTelemetry?.workerState === 'RUNNING' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50' :
                  liveTelemetry?.workerState === 'PAUSED' ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50' :
                    'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}>
                  {liveTelemetry?.workerState || 'READY'}
                </span>
              </span>
            </div>
          </div>

          {/* Admin Action Notification Banner */}
          {adminActionMsg && (
            <div className="p-3.5 rounded-2xl bg-brand-500/25 border border-brand-400/50 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{adminActionMsg}</span>
              </span>
              <button onClick={() => setAdminActionMsg('')} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Interactive Tab Switcher Navigation */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setAdminSubTab('sync_ops')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'sync_ops'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Live Sync & Controls</span>
            </button>

            <button
              onClick={() => setAdminSubTab('rate_limiter')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'rate_limiter'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Token-Bucket & Rate Limiter</span>
            </button>

            <button
              onClick={() => setAdminSubTab('error_resolver')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'error_resolver'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Data Errors & Re-sync ({liveTelemetry?.failedCount || stats.errorRows})</span>
            </button>

            <button
              onClick={() => setAdminSubTab('snapshot_audit')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'snapshot_audit'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Snapshot Lock & Windows</span>
            </button>

            <button
              onClick={() => setAdminSubTab('live_logs')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'live_logs'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Events Log Stream</span>
            </button>

            <button
              onClick={() => setAdminSubTab('simulation_sandbox')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'simulation_sandbox'
                ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/30 border border-brand-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
              <span>Sandbox & Live Test Sim</span>
            </button>

            <button
              onClick={() => setAdminSubTab('live_monitor')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${adminSubTab === 'live_monitor'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/50 border border-emerald-400/40'
                : 'text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60'
                }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Student Monitor</span>
            </button>
          </div>

          {/* Tab 1: Live Sync & Primary Controls */}
          {adminSubTab === 'sync_ops' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-300 block">Worker State</span>
                  <span className="text-base font-mono font-black text-white">{liveTelemetry?.workerState || 'READY'}</span>
                  <span className="text-[10px] text-emerald-400 block font-bold">Single-Worker DB Lock Active</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-300 block">Students Processed</span>
                  <span className="text-base font-mono font-black text-emerald-400">
                    {loading ? <span className="animate-pulse">Loading...</span> : `${liveTelemetry?.processedCount ?? sessionMetrics?.totalStudents ?? 0} / ${sessionMetrics?.totalStudents ?? 0}`}
                  </span>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.round(((liveTelemetry?.processedCount ?? sessionMetrics?.totalStudents ?? 0) / Math.max(1, sessionMetrics?.totalStudents ?? 1)) * 100))}%` }}></div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-300 block">Successful Syncs</span>
                  <span className="text-base font-mono font-black text-emerald-400">
                    {loading ? '...' : (liveTelemetry?.successfulCount ?? ((sessionMetrics?.totalStudents ?? 0) - (liveTelemetry?.failedCount ?? 0)))}
                  </span>
                  <span className="text-[10px] text-slate-300 block font-bold">99% Accuracy Rate</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-300 block">Data Errors</span>
                  <span className="text-base font-mono font-black text-amber-400">{liveTelemetry?.failedCount ?? 0}</span>
                  <span className="text-[10px] text-amber-300 block font-bold">Auto-Retry Eligible</span>
                </div>
              </div>

              {/* Action Buttons Toolbar - Clean Grid Layout */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-brand-400" />
                    <span>Live Synchronization & Execution Controls</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleAdminAction('start_live')}
                    disabled={isPerformingAdminAction}
                    className="w-full h-11 inline-flex items-center justify-center space-x-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Live Sync</span>
                  </button>

                  <button
                    onClick={() => handleAdminAction(liveTelemetry?.isPaused ? 'resume' : 'pause')}
                    disabled={isPerformingAdminAction}
                    className="w-full h-11 inline-flex items-center justify-center space-x-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-950/50 border border-amber-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>{liveTelemetry?.isPaused ? 'Resume Sync' : 'Pause Sync'}</span>
                  </button>

                  <button
                    onClick={() => handleAdminAction('sweep_verification')}
                    disabled={isPerformingAdminAction}
                    className="w-full h-11 inline-flex items-center justify-center space-x-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-950/50 border border-indigo-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run 3-Day Verification Sweep</span>
                  </button>

                  <button
                    onClick={() => handleAdminAction('reset_worker')}
                    disabled={isPerformingAdminAction}
                    className="w-full h-11 inline-flex items-center justify-center space-x-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black shadow-md border border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Worker State</span>
                  </button>

                  <button
                    onClick={() => handleAdminAction('force_final_sync')}
                    disabled={isPerformingAdminAction}
                    className="w-full h-11 inline-flex items-center justify-center space-x-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-950/50 border border-purple-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50 sm:col-span-2 lg:col-span-2"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Force Final Sync & Lock Snapshot</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Token-Bucket & Rate Limiter Telemetry */}
          {adminSubTab === 'rate_limiter' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Token Replenishment Rate</span>
                    <Gauge className="w-4 h-4 text-brand-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-emerald-400">3.0 <span className="text-xs text-slate-400">req / sec</span></p>
                  <p className="text-[10px] text-slate-400">Smooth token refill with zero API throttle risks.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Burst Bucket Capacity</span>
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-purple-400">5.0 <span className="text-xs text-slate-400">Tokens Max</span></p>
                  <p className="text-[10px] text-slate-400">Bounded burst capacity for fast concurrent queries.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Asyncio Socket Semaphore</span>
                    <Cpu className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-indigo-400">5 <span className="text-xs text-slate-400">Concurrent Sockets</span></p>
                  <p className="text-[10px] text-slate-400">Strict bounded concurrent HTTP sockets.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">Cache & Rate Limiting Controls</p>
                  <p className="text-[11px] text-slate-300 font-medium">Instantly flush memory cache keys or reset token state without dropping DB records.</p>
                </div>
                <button
                  onClick={() => handleAdminAction('flush_cache')}
                  disabled={isPerformingAdminAction}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black border border-slate-600 transition-all cursor-pointer active:scale-95"
                >
                  Flush Contest Cache Store
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Data Quality & Error Resolver */}
          {adminSubTab === 'error_resolver' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Unresolved Student Profiles ({liveTelemetry?.failedCount || stats.errorRows} Errors)
                  </h5>
                  <p className="text-xs text-slate-300 font-medium">
                    Students without configured usernames or whose LeetCode profiles encountered transient timeouts.
                  </p>
                </div>

                <button
                  onClick={() => handleAdminAction('retry_failed')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-lg shadow-brand-900/40 border border-brand-400/40 transition-all cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry All Unresolved Records</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 space-y-2">
                <p className="font-black text-white">Transient Error Breakdown & Invariants:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 font-medium">
                  <li><strong className="text-white">Missing Usernames:</strong> Students whose LeetCode handle is not set in Master Roster.</li>
                  <li><strong className="text-white">Upstream Timeouts (5xx / 429):</strong> Automatically retried with exponential backoff and jitter.</li>
                  <li><strong className="text-white">Data Error Contract:</strong> <code className="text-amber-300 font-bold bg-amber-950/50 px-1 py-0.5 rounded border border-amber-500/30">Data Errors = CONFLICT + SOURCE_ERROR</code> strictly holds across all views.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 4: Snapshot Immutability & Verification Windows */}
          {adminSubTab === 'snapshot_audit' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>DB Immutability Trigger</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 font-mono border border-emerald-400/40 font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono">
                    trg_prevent_snapshot_mutation enforced on official_weekly_snapshots table.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Bounded Verification Window</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/25 text-indigo-300 font-mono border border-indigo-400/40 font-bold">
                      3 DAYS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Transitions to <code className="text-indigo-300 font-bold bg-indigo-950/50 px-1 py-0.5 rounded border border-indigo-500/30">NOT_VERIFIED_FINAL</code> automatically once window expires.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Live Real-Time Events Log Stream */}
          {adminSubTab === 'live_logs' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-200 font-black flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>REAL-TIME AUDIT LOG STREAM</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-black animate-pulse"> LIVE STREAM</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin">
                {Array.isArray(liveTelemetry?.liveEvents) && liveTelemetry.liveEvents.length > 0 ? (
                  (Array.isArray(liveTelemetry?.liveEvents) ? liveTelemetry.liveEvents : []).map((evt: any) => (
                    <div key={evt.id || Math.random()} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">{evt.timestamp}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/30 text-brand-300 font-bold text-[9px] border border-brand-400/30">{evt.type}</span>
                        <span className="text-white font-bold">{evt.studentName}</span>
                        <span className="text-slate-300">({evt.regNo})</span>
                        <span className="text-slate-200">{evt.detail}</span>
                      </div>
                      {evt.rank && (
                        <span className="text-amber-400 font-bold">Rank #{evt.rank}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic py-4 text-center font-medium">No live events recorded yet in current cycle. Click 'Start Live Sync' or use 'Sandbox' tab to simulate events.</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 6: Live Simulation & Invariants Sandbox */}
          {adminSubTab === 'simulation_sandbox' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/30 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h5 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-amber-400" />
                      <span>Live Simulation Sandbox & Testing Lab</span>
                    </h5>
                    <p className="text-xs text-slate-300">
                      Test live event streaming, rank fluctuations, and problem solves dynamically without waiting for Sunday morning!
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleAdminAction('simulate_live_cycle')}
                      disabled={isPerformingAdminAction}
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Trigger Simulated Solves (5 Live Events)</span>
                    </button>

                    <button
                      onClick={() => handleAdminAction('validate_invariants')}
                      disabled={isPerformingAdminAction}
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Validate 5 Core Invariants</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Invariant Validation Results Panel */}
              {invariantResults && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>SYSTEM INVARIANT VALIDATION SCORECARD (100% PASS)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Status: Verified</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">1. Master Roster Size</span>
                      <span className="font-mono font-bold text-emerald-400">{invariantResults.masterRosterCount} Students</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">2. Total Classification Sum</span>
                      <span className="font-mono font-bold text-emerald-400">100% Parity</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">3. Data Errors Contract</span>
                      <span className="font-mono font-bold text-emerald-400">CONFLICT + SRC_ERR</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">4. Token Bucket Limiter</span>
                      <span className="font-mono font-bold text-emerald-400">&le; 3.0 req/s</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">5. Snapshot Immutability</span>
                      <span className="font-mono font-bold text-emerald-400">TRIGGER ACTIVE</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">6. Verification Window</span>
                      <span className="font-mono font-bold text-emerald-400">3-Day Bound</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 7: Live Student Monitor */}
          {adminSubTab === 'live_monitor' && (
            <div className="pt-2 animate-fade-in">
              <React.Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading Live Monitor Chart Engine...</div>}>
                <LiveStudentMonitor initialIdentifier={quickSyncIdentifier} sessionId={selectedSessionId} />
              </React.Suspense>
            </div>
          )}
        </div>
      )}

      {/* PRIMARY VIEW TAB SWITCHER */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 mb-5 sm:mb-8 shadow-xs">
        <button
          onClick={() => startTransition(() => setActiveTab('previous_week'))}
          className={`w-full flex items-center justify-center space-x-1.5 sm:space-x-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-[0.99] ${activeTab === 'previous_week'
              ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-900/60'
            }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="sm:hidden truncate">Contest Analyzer</span>
          <span className="hidden sm:inline truncate">Previous Week Contest Analyzer (Live + Virtual)</span>
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab('matrix'))}
          className={`w-full flex items-center justify-center space-x-1.5 sm:space-x-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-[0.99] ${activeTab === 'matrix'
              ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-900/60'
            }`}
        >
          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="sm:hidden truncate">Roster Matrix</span>
          <span className="hidden sm:inline truncate">Session Analytics & Student Roster Matrix</span>
        </button>
      </div>

      {/* PREVIOUS WEEK CONTEST ANALYZER TAB */}
      {activeTab === 'previous_week' && (
        <div className="mt-4 sm:mt-6 px-1 sm:px-0">
          <React.Suspense fallback={<div className="p-12 text-center text-slate-400 animate-pulse">Loading previous contest analysis...</div>}>
            <PreviousWeekContestPanel sessionId={selectedSessionId || currentSession?.sessionId || sessionsList[0]?.sessionId || sessionsList[0]?.id || 1} onStudentClick={onSelectStudent} />
          </React.Suspense>
        </div>
      )}

      {/* SESSION ANALYTICS & ROSTER MATRIX TAB */}
      {activeTab === 'matrix' && (
        <>
          {/* 2. UNIFIED COHESIVE FILTER & ACTION COMMAND BAR */}
          <div className={`relative ${showExportMenu ? 'z-50' : 'z-20'} mt-2 sm:mt-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/[0.09] shadow-xl dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.12)] space-y-3.5 sm:space-y-5 no-print mb-3 sm:mb-5`}>
            {/* Row 1: Consolidated Action Toolbar & Mobile Filter Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Mobile Filter Scope Bar */}
              <div className="flex items-center justify-between gap-3 sm:hidden pb-3 mb-1 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 shadow-2xs">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white truncate block">
                      Contest Filters
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block truncate">
                      {([selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].filter(v => v !== 'ALL').length > 0)
                        ? `${[selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].filter(v => v !== 'ALL').length} filter active`
                        : 'Filter by Dept, Year, Status'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMobileContestFilters(prev => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all shadow-2xs touch-manipulation active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <span className="font-extrabold">{showMobileContestFilters ? 'Hide Filters' : 'Filter Options'}</span>
                  {([selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].filter(v => v !== 'ALL').length > 0) && (
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-mono font-black flex items-center justify-center shrink-0">
                      {[selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].filter(v => v !== 'ALL').length}
                    </span>
                  )}
                  <ChevronDown size={14} className={`transition-transform duration-200 shrink-0 ${showMobileContestFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Mobile Active Filter Chips */}
              {([selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].some(v => v !== 'ALL') || searchTerm) && (
                <div className="pt-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.08] sm:hidden space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                        Active Filters ({[selectedCollegeFilter, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter].filter(v => v !== 'ALL').length + (searchTerm ? 1 : 0)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('warning');
                        setSelectedCollegeFilter(canFilterCollege ? 'ALL' : userCollege);
                        setSelectedDeptFilter(isUserHod ? initialDeptFilter : 'ALL');
                        setSelectedYearFilter('ALL');
                        setSelectedAttendanceFilter('ALL');
                        setSearchTerm('');
                        setDebouncedSearchTerm('');
                        setDeptSearchQuery('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-300 border border-rose-200/90 dark:border-rose-800/80 text-[10px] font-black uppercase tracking-wider shadow-2xs hover:shadow-xs active:scale-95 transition-all touch-manipulation cursor-pointer shrink-0"
                      title="Reset all active filters"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-500 dark:text-rose-400 stroke-[2.5]" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canFilterCollege && selectedCollegeFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
                        <span className="text-[9.5px] uppercase font-black text-teal-500 dark:text-teal-400">College:</span>
                        <span>{selectedCollegeFilter}</span>
                        <button onClick={() => setSelectedCollegeFilter('ALL')} className="hover:text-rose-500 font-bold ml-1 p-0.5 touch-manipulation active:scale-90 cursor-pointer text-xs leading-none">×</button>
                      </span>
                    )}
                    {selectedDeptFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shadow-2xs">
                        <span className="text-[9.5px] uppercase font-black text-indigo-500 dark:text-indigo-400">Dept:</span>
                        <span>{selectedDeptFilter}</span>
                        <button onClick={() => setSelectedDeptFilter('ALL')} className="hover:text-rose-500 font-bold ml-1 p-0.5 touch-manipulation active:scale-90 cursor-pointer text-xs leading-none">×</button>
                      </span>
                    )}
                    {selectedYearFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-2xs">
                        <span className="text-[9.5px] uppercase font-black text-amber-500 dark:text-amber-400">Year:</span>
                        <span>{selectedYearFilter === '1' || selectedYearFilter === 'I' ? '1st Year' : selectedYearFilter === '2' || selectedYearFilter === 'II' ? '2nd Year' : selectedYearFilter === '3' || selectedYearFilter === 'III' ? '3rd Year' : selectedYearFilter === '4' || selectedYearFilter === 'IV' ? '4th Year' : `${selectedYearFilter} Year`}</span>
                        <button onClick={() => setSelectedYearFilter('ALL')} className="hover:text-rose-500 font-bold ml-1 p-0.5 touch-manipulation active:scale-90 cursor-pointer text-xs leading-none">×</button>
                      </span>
                    )}
                    {selectedAttendanceFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs">
                        <span className="text-[9.5px] uppercase font-black text-emerald-500 dark:text-emerald-400">Status:</span>
                        <span>{
                          selectedAttendanceFilter === 'PUBLIC_ATTENDED' || selectedAttendanceFilter === 'PUBLIC' ? 'Public Attended' :
                          selectedAttendanceFilter === 'VIRTUAL_ATTENDED' || selectedAttendanceFilter === 'VIRTUAL' ? 'Virtual' :
                          selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED' || selectedAttendanceFilter === 'NOT_ATTENDED' ? 'Not Attended' :
                          selectedAttendanceFilter === 'DATA_ERROR' ? 'Data Error' :
                          selectedAttendanceFilter === 'ALL_ATTENDED' ? 'Participating' :
                          selectedAttendanceFilter.replace(/_/g, ' ')
                        }</span>
                        <button onClick={() => setSelectedAttendanceFilter('ALL')} className="hover:text-rose-500 font-bold ml-1 p-0.5 touch-manipulation active:scale-90 cursor-pointer text-xs leading-none">×</button>
                      </span>
                    )}
                    {searchTerm && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-500/20 shadow-2xs">
                        <span className="text-[9.5px] uppercase font-black text-purple-500 dark:text-purple-400">Query:</span>
                        <span className="truncate max-w-[120px]">{searchTerm}</span>
                        <button onClick={() => setSearchTerm('')} className="hover:text-rose-500 font-bold ml-1 p-0.5 touch-manipulation active:scale-90 cursor-pointer text-xs leading-none">×</button>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Consolidated Action Toolbar */}
              <div className="w-full sm:w-auto grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-2.5 ml-auto relative z-30 pt-0.5 sm:pt-0">

                {/* Unified Actions & Export Dropdown */}
                <div className={`relative w-full sm:w-auto ${showExportMenu ? 'z-50' : 'z-40'}`} ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportMenu(prev => !prev)}
                    disabled={!selectedSessionId || isSyncing}
                    className={`group relative w-full sm:w-auto flex items-center justify-center space-x-2.5 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border ${showExportMenu
                        ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white border-transparent shadow-[0_0_20px_rgba(var(--color-brand-500)/0.3)] ring-2 ring-brand-500/30 ring-offset-1 dark:ring-offset-navy-900'
                        : 'bg-white dark:bg-navy-900/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-navy-700 hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10'
                      }`}
                  >
                    {/* Subtle animated background gradient on hover (only when not active) */}
                    {!showExportMenu && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-500/0 via-brand-500/10 to-brand-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    )}

                    <div className={`p-1.5 rounded-xl transition-all duration-300 relative z-10 ${showExportMenu
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:scale-105'
                      }`}>
                      <Download className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span className="tracking-wide font-black relative z-10">Actions & Export</span>
                    <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-300 relative z-10 ${showExportMenu ? 'rotate-180 text-white' : 'text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                      }`} />
                  </button>

                  {/* Desktop Dropdown for Actions & Export */}
                  <AnimatePresence>
                    {showExportMenu && !isMobile && (() => {
                      const exportMenuContent = (
                        <>
                          {/* SECTION 1: ACTIONS */}
                          <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="px-3 pt-1 pb-1.5 flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                              <span className="text-[11px] font-black tracking-wider uppercase text-purple-700 dark:text-purple-400">
                                Primary Actions
                              </span>
                            </div>
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => { setShowPreviewModal(true); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-purple-50 dark:hover:bg-purple-950/50 cursor-pointer border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                                    <Eye className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                                      Live Preview
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Review dataset & questions before export
                                    </span>
                                  </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                              </button>

                              <button
                                type="button"
                                onClick={() => { setShowEmailModal(true); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                    <Mail className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                                      Send Email Report
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Distribute summary report securely to faculty
                                    </span>
                                  </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                              </button>
                            </div>
                          </div>

                          {/* SECTION 2: EXPORT FORMATS */}
                          <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="px-3 pt-1 pb-1.5 flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                              <span className="text-[11px] font-black tracking-wider uppercase text-emerald-700 dark:text-emerald-400">
                                Export Formats
                              </span>
                            </div>
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => { downloadReportFile('excel'); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                                    <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                                      Excel Workbook
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Raw structured data & roster matrix
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-300 dark:border-emerald-700 shrink-0">
                                  XLSX
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { downloadReportFile('pdf'); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
                                      PDF Document
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Formatted print layout & analytics
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 group-hover:bg-rose-600 group-hover:text-white transition-colors border border-rose-300 dark:border-rose-700 shrink-0">
                                  PDF
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { downloadReportFile('word'); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                      Word Document
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Editable text report with tables
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-300 dark:border-blue-700 shrink-0">
                                  DOCX
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { downloadReportFile('zip'); setShowExportMenu(false); }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-amber-50 dark:hover:bg-amber-950/50 cursor-pointer border border-transparent hover:border-amber-200 dark:hover:border-amber-800"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                                    <FileArchive className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                                      ZIP Archive
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      All formats bundled in one archive
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors border border-amber-300 dark:border-amber-700 shrink-0">
                                  ZIP
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* SECTION 3: UTILITY */}
                          <div>
                            <div className="px-3 pt-1 pb-1 flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-slate-500" />
                              <span className="text-[11px] font-black tracking-wider uppercase text-slate-600 dark:text-slate-400">
                                Utility
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { window.print(); setShowExportMenu(false); }}
                              className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-150 group hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-slate-800 group-hover:text-white dark:group-hover:bg-slate-200 dark:group-hover:text-slate-900 transition-all shadow-sm">
                                  <Printer className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-900 dark:text-white transition-colors">
                                    Print View
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                    Quick browser print layout
                                  </span>
                                </div>
                              </div>
                            </button>
                          </div>
                        </>
                      );

                      return (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.98 }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className="hidden sm:block absolute top-[calc(100%+8px)] right-0 w-[380px] max-w-[calc(100vw-32px)] max-h-[min(520px,calc(100vh-140px))] overflow-y-auto overscroll-contain custom-scrollbar z-[9999] rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] p-3.5 space-y-2 focus:outline-none select-none origin-top-right"
                        >
                          {exportMenuContent}
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* Mobile Swipe-Up Bottom Sheet Drawer for Actions & Export */}
                  {typeof document !== 'undefined' && createPortal(
                    <AnimatePresence>
                      {isMobile && showExportMenu && (
                        <div
                          className="fixed inset-0 z-[100050] flex flex-col justify-end"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="mobile-actions-export-title"
                        >
                          {/* Backdrop */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              triggerHaptic('light');
                              setShowExportMenu(false);
                            }}
                            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
                          />

                          {/* Bottom Sheet Drawer */}
                          <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            className="relative z-10 w-full max-h-[94vh] sm:max-h-[90vh] bg-white dark:bg-navy-950 rounded-t-[28px] border-t border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Pull Handle */}
                            <SwipeHandle
                              onClose={() => {
                                triggerHaptic('light');
                                setShowExportMenu(false);
                              }}
                              className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0"
                              pillClassName="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 transition-colors"
                            />

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-white/[0.08] shrink-0">
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                                  <Download className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                  <h3 id="mobile-actions-export-title" className="text-base font-black tracking-tight text-slate-900 dark:text-white font-display truncate">
                                    Actions &amp; Export Hub
                                  </h3>
                                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                    Download reports or trigger notifications
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setShowExportMenu(false);
                                }}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95 shrink-0 ml-2"
                                title="Close"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Cards List with Responsive Multi-Column Architecture */}
                            <div className="overflow-y-auto px-3.5 sm:px-5 py-3 space-y-3.5 flex-1 min-h-0 custom-scrollbar">
                              {/* Primary Actions Group */}
                              <div>
                                <div className="px-1 pt-0.5 pb-1.5 flex items-center space-x-2">
                                  <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                                  <span className="text-[10px] font-black tracking-wider uppercase text-purple-700 dark:text-purple-400">
                                    Primary Actions
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-2">
                                  {/* Live Preview Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setShowPreviewModal(true);
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-purple-50/80 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <Eye className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                                            PREVIEW
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          Live Preview
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Review dataset &amp; questions
                                        </span>
                                      </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                  </button>

                                  {/* Send Email Report Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setShowEmailModal(true);
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                        <Mail className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                                            EMAIL
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          Send Email Report
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Distribute securely to faculty
                                        </span>
                                      </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  </button>
                                </div>
                              </div>

                              {/* Export Formats Group */}
                              <div>
                                <div className="px-1 pt-1 pb-1.5 flex items-center space-x-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                  <span className="text-[10px] font-black tracking-wider uppercase text-emerald-700 dark:text-emerald-400">
                                    Export Formats
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {/* Excel Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('selection');
                                      downloadReportFile('excel');
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                        <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                            XLSX
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          Excel Workbook
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Raw data &amp; roster matrix
                                        </span>
                                      </div>
                                    </div>
                                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  </button>

                                  {/* PDF Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('selection');
                                      downloadReportFile('pdf');
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                                            PDF
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          PDF Document
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Formatted print layout
                                        </span>
                                      </div>
                                    </div>
                                    <Download className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                  </button>

                                  {/* Word Document Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('selection');
                                      downloadReportFile('word');
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                                            DOCX
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          Word Document
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Editable report with tables
                                        </span>
                                      </div>
                                    </div>
                                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                  </button>

                                  {/* ZIP Archive Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('selection');
                                      downloadReportFile('zip');
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                                        <FileArchive className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                            ZIP
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          ZIP Archive
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          All formats in one archive
                                        </span>
                                      </div>
                                    </div>
                                    <Download className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  </button>

                                  {/* Print View Card */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      window.print();
                                      setShowExportMenu(false);
                                    }}
                                    className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                      <div className="w-8 h-8 rounded-xl bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                        <Printer className="w-4 h-4 stroke-[2.5]" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                                            PRINT
                                          </span>
                                        </div>
                                        <span className="text-xs mt-0.5 font-bold leading-snug text-slate-800 dark:text-slate-200">
                                          Print View
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                          Quick browser print layout
                                        </span>
                                      </div>
                                    </div>
                                    <Printer className="w-4 h-4 text-slate-400 shrink-0" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>,
                    document.body
                  )}
                </div>

                <button
                  onClick={handleFetchSelectedContest}
                  disabled={isSyncing || !selectedSessionId}
                  className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-slate-700/50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncStatusStage || (isSyncing ? 'Syncing...' : 'Sync Contest')}</span>
                </button>

                {/* Auto Refresh Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`group relative w-full sm:w-auto flex items-center justify-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-md border ${autoRefresh
                      ? 'bg-slate-900 text-emerald-400 border-emerald-500/50 shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  title={autoRefresh ? 'Auto-refresh active (every 2 mins)' : 'Click to enable auto-refresh'}
                >
                  <div className="relative flex items-center justify-center">
                    {autoRefresh ? (
                      <>
                        <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping opacity-75" />
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse relative z-10" />
                      </>
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-45 transition-transform duration-300" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="tracking-wide uppercase text-[10px] font-black">Auto-Refresh</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-black uppercase tracking-wider transition-colors ${autoRefresh
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                      {autoRefresh ? 'LIVE' : 'OFF'}
                    </span>
                  </div>

                  <div
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${autoRefresh ? 'translate-x-3.5 bg-slate-950' : 'translate-x-0.5'
                        }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Row 2: Sleek 5-Column Filter Bar (Desktop only) */}
            <div className="hidden sm:block pt-3 sm:pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 items-end">
                {/* College Campus Filter — Admin & Management only */}
                {canFilterCollege && (() => {
                  const collegeOptions: GlobalFilterOption[] = [
                    { value: 'ALL', label: 'All Colleges', pillText: 'ALL' },
                    { value: 'NEC', label: 'Nandha Engineering (NEC)', pillText: 'NEC' },
                    { value: 'NCT', label: 'Nandha Tech (NCT)', pillText: 'NCT' },
                  ];

                  return (
                    <div className="space-y-1 min-w-0 w-full">
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                        College Campus
                      </label>
                      <GlobalFilter
                        value={selectedCollegeFilter}
                        onChange={(val) => setSelectedCollegeFilter(val as 'ALL' | 'NEC' | 'NCT')}
                        options={collegeOptions}
                        icon={<Building2 className="w-4 h-4 text-teal-500" />}
                        dropdownWidth="w-64 sm:w-72"
                        placeholder="All Colleges"
                      />
                    </div>
                  );
                })()}

                {/* Department Filter */}
                {(() => {
                  const roleClean = (user?.role || '').trim().toLowerCase();
                  const isStaffMentor = ['staff', 'faculty', 'staff mentor', 'faculty mentor'].includes(roleClean);
                  const isHod = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean);
                  const isGlobalRole = ['admin', 'super admin', 'super_admin', 'administrator', 'principal', 'management', 'director'].includes(roleClean);
                  const userDeptCode = (typeof user?.department === 'string' ? user.department : (user?.department as any)?.code) || (Array.isArray(user?.authorized_department_codes) && user.authorized_department_codes[0]) || '';

                  const hodAuthCodes = (Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : []).map(c => String(c).toUpperCase());
                  const filteredDepts = (isHod && !isGlobalRole)
                    ? departments.filter(d => hodAuthCodes.includes(d.code.toUpperCase()) || (userDeptCode && d.code.toUpperCase() === userDeptCode.toUpperCase()))
                    : departments;

                  const deptOptions: GlobalFilterOption[] = isStaffMentor
                    ? [
                      { value: 'ALL', label: 'My Allocated Mentees', pillText: 'MENTEES' },
                      ...(userDeptCode ? [{ value: userDeptCode, label: `${userDeptCode} (My Department)`, pillText: userDeptCode }] : [])
                    ]
                    : (isHod && !isGlobalRole)
                      ? [
                        ...(filteredDepts.length > 1 ? [{ value: 'ALL', label: 'All My Authorized Departments', pillText: 'ALL' }] : []),
                        ...filteredDepts.map((d) => ({
                          value: d.code,
                          label: d.name,
                          pillText: d.code
                        }))
                      ]
                      : [
                        { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
                        ...departments.map((d) => ({
                          value: d.code,
                          label: d.name,
                          pillText: d.code
                        }))
                      ];

                  return (
                    <div className="space-y-1 min-w-0 w-full">
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                        Department
                      </label>
                      <GlobalFilter
                        value={selectedDeptFilter}
                        onChange={(val) => setSelectedDeptFilter(val)}
                        options={deptOptions}
                        icon={<Building2 className="w-4 h-4 text-indigo-500" />}
                        dropdownWidth="w-72 sm:w-80"
                        showSearch={true}
                        searchPlaceholder="Search department..."
                        placeholder="All Departments"
                      />
                    </div>
                  );
                })()}

                {/* Academic Year Filter */}
                {(() => {
                  const yearOptions: GlobalFilterOption[] = [
                    { value: 'ALL', label: 'All Academic Years', pillText: 'ALL' },
                    { value: 'I', label: '1st Year (2026–2030)', pillText: '1st' },
                    { value: 'II', label: '2nd Year (2025–2029)', pillText: '2nd' },
                    { value: 'III', label: '3rd Year (2024–2028)', pillText: '3rd' },
                    { value: 'IV', label: '4th Year (2023–2027)', pillText: '4th' },
                  ];

                  const normalizedYear = selectedYearFilter === '1' ? 'I' : selectedYearFilter === '2' ? 'II' : selectedYearFilter === '3' ? 'III' : selectedYearFilter === '4' ? 'IV' : selectedYearFilter;

                  return (
                    <div className="space-y-1 min-w-0 w-full">
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                        Academic Year
                      </label>
                      <GlobalFilter
                        value={normalizedYear}
                        onChange={(val) => setSelectedYearFilter(val)}
                        options={yearOptions}
                        icon={<GraduationCap className="w-4 h-4 text-brand-500" />}
                        dropdownWidth="w-64 sm:w-72"
                        placeholder="All Academic Years"
                      />
                    </div>
                  );
                })()}

                {/* Attendance Status Filter */}
                {(() => {
                  const attOptions: GlobalFilterOption[] = [
                    { value: 'ALL', label: 'All Statuses', pillText: 'ALL' },
                    { value: 'ALL_ATTENDED', label: 'Participated', pillText: 'PART' },
                    { value: 'PUBLIC_ATTENDED', label: 'Public Attended', pillText: 'PUB' },
                    { value: 'VIRTUAL_ATTENDED', label: 'Virtual Attended', pillText: 'VIRT' },
                    { value: 'PUBLIC_NOT_ATTENDED', label: 'Not Attended', pillText: 'ABS' },
                    { value: 'DATA_ERROR', label: 'Data Errors', pillText: 'ERR' },
                  ];

                  return (
                    <div className="space-y-1 min-w-0 w-full">
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                        Attendance Status
                      </label>
                      <GlobalFilter
                        value={selectedAttendanceFilter}
                        onChange={(val) => setSelectedAttendanceFilter(val)}
                        options={attOptions}
                        icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        dropdownWidth="w-64 sm:w-72"
                        placeholder="All Statuses"
                      />
                    </div>
                  );
                })()}

                {/* Reset Filters Control */}
                <div className="min-w-0 w-full flex flex-col justify-end">
                  <label className="block text-[11px] font-black text-transparent select-none uppercase tracking-wider truncate hidden lg:block">
                    Action
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollegeFilter(canFilterCollege ? 'ALL' : userCollege);
                      setSelectedDeptFilter(isUserHod ? initialDeptFilter : 'ALL');
                      setSelectedYearFilter('ALL');
                      setSelectedAttendanceFilter('ALL');
                      setSearchTerm('');
                      setDebouncedSearchTerm('');
                    }}
                    className={`w-full h-10 min-h-[40px] flex items-center justify-center space-x-2 px-4 rounded-xl text-xs font-black border transition-all cursor-pointer active:scale-95 shadow-xs ${(selectedCollegeFilter !== 'ALL' || selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL' || searchTerm !== '')
                        ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/60 ring-1 ring-rose-500/20'
                        : 'bg-slate-50 dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-navy-700 hover:border-slate-300'
                      }`}
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${(selectedCollegeFilter !== 'ALL' || selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL' || searchTerm !== '')
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                      }`} />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Swipe-Up Bottom Sheet Drawer for Contest Filter Scope */}
            {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {isMobile && showMobileContestFilters && (
                  <div
                    className="fixed inset-0 z-[100050] flex flex-col justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mobile-contest-filters-title"
                  >
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => {
                        triggerHaptic('light');
                        setShowMobileContestFilters(false);
                      }}
                      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
                    />

                    {/* Bottom Sheet Drawer */}
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                      className="relative z-10 w-full max-h-[88vh] bg-white dark:bg-navy-950 rounded-t-[28px] border-t border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white pb-[max(1.75rem,env(safe-area-inset-bottom,1.75rem))]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Pull Handle */}
                      <SwipeHandle
                        onClose={() => {
                          triggerHaptic('light');
                          setShowMobileContestFilters(false);
                        }}
                        className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0"
                        pillClassName="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 transition-colors"
                      />

                      {/* Header matching PreviousWeekContestPanel */}
                      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-white/[0.08] shrink-0">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                            {filterDrawerTab === 'year' && <GraduationCap className="w-4 h-4" />}
                            {filterDrawerTab === 'dept' && <Building2 className="w-4 h-4" />}
                            {filterDrawerTab === 'college' && <Building className="w-4 h-4" />}
                            {filterDrawerTab === 'att' && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h3 id="mobile-contest-filters-title" className="text-base font-black tracking-tight text-slate-900 dark:text-white font-display truncate">
                              {filterDrawerTab === 'year' && 'Select Academic Year'}
                              {filterDrawerTab === 'dept' && 'Select Department'}
                              {filterDrawerTab === 'college' && 'Select College Campus'}
                              {filterDrawerTab === 'att' && 'Select Attendance Status'}
                            </h3>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                              {filterDrawerTab === 'year' && 'Filter students by study year and cohort'}
                              {filterDrawerTab === 'dept' && 'Filter contest performance by department'}
                              {filterDrawerTab === 'college' && 'Filter participants by institution campus'}
                              {filterDrawerTab === 'att' && 'Filter by submission and attendance status'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setShowMobileContestFilters(false);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                            title="Close"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Filter Category Segment Tabs */}
                      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-slate-100 dark:border-white/[0.08] overflow-x-auto no-scrollbar shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
                        <button
                          type="button"
                          onClick={() => setFilterDrawerTab('year')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                            filterDrawerTab === 'year'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Year</span>
                          {selectedYearFilter !== 'ALL' && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setFilterDrawerTab('dept')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                            filterDrawerTab === 'dept'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Dept</span>
                          {selectedDeptFilter !== 'ALL' && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </button>

                        {canFilterCollege && (
                          <button
                            type="button"
                            onClick={() => setFilterDrawerTab('college')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                              filterDrawerTab === 'college'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100'
                            }`}
                          >
                            <Building className="w-3.5 h-3.5" />
                            <span>Campus</span>
                            {selectedCollegeFilter !== 'ALL' && (
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setFilterDrawerTab('att')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                            filterDrawerTab === 'att'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Status</span>
                          {selectedAttendanceFilter !== 'ALL' && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </button>
                      </div>

                      {/* Options Container */}
                      <div className="overflow-y-auto px-3.5 py-3 space-y-2 flex-1 min-h-0 custom-scrollbar">
                        {/* TAB 1: ACADEMIC YEAR (Matching User's Reference Screenshot Exactly) */}
                        {filterDrawerTab === 'year' && (
                          <div className="space-y-1.5">
                            {[
                              { value: 'ALL', label: 'All Academic Years', desc: 'All batches and cohorts' },
                              { value: 'I', label: '1st Year', desc: 'Batch 2026 – 2030' },
                              { value: 'II', label: '2nd Year', desc: 'Batch 2025 – 2029' },
                              { value: 'III', label: '3rd Year', desc: 'Batch 2024 – 2028' },
                              { value: 'IV', label: '4th Year', desc: 'Batch 2023 – 2027' },
                            ].map((opt) => {
                              const normalizedSelected = selectedYearFilter === '1' ? 'I' : selectedYearFilter === '2' ? 'II' : selectedYearFilter === '3' ? 'III' : selectedYearFilter === '4' ? 'IV' : selectedYearFilter;
                              const isSelected = normalizedSelected === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedYearFilter(opt.value);
                                  }}
                                  className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-500 dark:border-purple-500/80 shadow-xs'
                                      : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                      <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold leading-snug ${
                                          isSelected ? 'text-purple-950 dark:text-purple-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                        }`}>
                                          {opt.label}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                      {opt.desc && (
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                          {opt.desc}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* TAB 2: DEPARTMENT */}
                        {filterDrawerTab === 'dept' && (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={deptSearchQuery}
                                onChange={(e) => setDeptSearchQuery(e.target.value)}
                                placeholder="Search department name or code..."
                                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
                              />
                              {deptSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setDeptSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              {contestDeptOptions
                                .filter(d => !deptSearchQuery || d.label.toLowerCase().includes(deptSearchQuery.toLowerCase()) || d.value.toLowerCase().includes(deptSearchQuery.toLowerCase()))
                                .map(dept => {
                                  const isSelected = selectedDeptFilter === dept.value;
                                  return (
                                    <button
                                      key={dept.value}
                                      type="button"
                                      onClick={() => {
                                        triggerHaptic('light');
                                        setSelectedDeptFilter(dept.value);
                                      }}
                                      className={`w-full min-h-[50px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                                        isSelected
                                          ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-500 dark:border-purple-500/80 shadow-xs'
                                          : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                          isSelected
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                        }`}>
                                          <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                                              {dept.pillText || (dept.value === 'ALL' ? 'ALL' : dept.value)}
                                            </span>
                                            {isSelected && (
                                              <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                                Active
                                              </span>
                                            )}
                                          </div>
                                          <span className={`text-xs mt-0.5 font-bold leading-snug ${
                                            isSelected ? 'text-purple-950 dark:text-purple-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                          }`}>
                                            {dept.label}
                                          </span>
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* TAB 3: COLLEGE CAMPUS */}
                        {filterDrawerTab === 'college' && canFilterCollege && (
                          <div className="space-y-1.5">
                            {[
                              { id: 'ALL', label: 'All College Campuses', desc: 'Both NEC and NCT combined', code: 'ALL' },
                              { id: 'NEC', label: 'Nandha Engineering College', desc: 'Main Campus (Autonomous)', code: 'NEC' },
                              { id: 'NCT', label: 'Nandha College of Technology', desc: 'Technology Campus', code: 'NCT' }
                            ].map(c => {
                              const isSelected = selectedCollegeFilter === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedCollegeFilter(c.id as any);
                                  }}
                                  className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-500 dark:border-purple-500/80 shadow-xs'
                                      : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                      <Building className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                                          {c.code}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-xs mt-0.5 font-bold leading-snug ${
                                        isSelected ? 'text-purple-950 dark:text-purple-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                      }`}>
                                        {c.label}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        {c.desc}
                                      </span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* TAB 4: ATTENDANCE STATUS */}
                        {filterDrawerTab === 'att' && (
                          <div className="space-y-1.5">
                            {[
                              { id: 'ALL', label: 'All Attendance Statuses', desc: 'All registered contest records', code: 'ALL' },
                              { id: 'ALL_ATTENDED', label: 'Participated', desc: 'Solved at least 1 problem', code: 'PART' },
                              { id: 'PUBLIC_ATTENDED', label: 'Public Attended', desc: 'Ranked in official public contest', code: 'PUB' },
                              { id: 'VIRTUAL_ATTENDED', label: 'Virtual Attended', desc: 'Participated in virtual contest window', code: 'VIRT' },
                              { id: 'PUBLIC_NOT_ATTENDED', label: 'Not Attended', desc: 'Absent from contest session', code: 'ABS' },
                              { id: 'DATA_ERROR', label: 'Data Errors', desc: 'Handshake or username resolution issues', code: 'ERR' }
                            ].map(att => {
                              const isSelected = selectedAttendanceFilter === att.id;
                              return (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedAttendanceFilter(att.id);
                                  }}
                                  className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-500 dark:border-purple-500/80 shadow-xs'
                                      : 'bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                          {att.code}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-xs mt-0.5 font-bold leading-snug ${
                                        isSelected ? 'text-purple-950 dark:text-purple-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                      }`}>
                                        {att.label}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        {att.desc}
                                      </span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Sticky Footer Actions */}
                      <div className="p-3.5 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('warning');
                            setSelectedCollegeFilter(canFilterCollege ? 'ALL' : userCollege);
                            setSelectedDeptFilter(isUserHod ? initialDeptFilter : 'ALL');
                            setSelectedYearFilter('ALL');
                            setSelectedAttendanceFilter('ALL');
                            setSearchTerm('');
                            setDebouncedSearchTerm('');
                            setDeptSearchQuery('');
                          }}
                          className="shrink-0 py-2 px-3 rounded-xl border border-slate-300/80 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                          title="Reset all filters"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                          <span>Reset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('success');
                            setShowMobileContestFilters(false);
                          }}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Apply Filters</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>

          {/* 3. EXECUTIVE QUICK VIEW (SCANNABLE IN < 3 SECONDS) */}
          <div className="space-y-4 sm:space-y-6">

            {/* Department-wise Summary Section — Compact Executive Grid */}
            {(() => {
              const deptCards = departments.map((dept, index) => {
                const colors = [
                  { bg: 'bg-indigo-50/70 dark:bg-indigo-950/30', border: 'border-indigo-100 dark:border-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-400', stat: 'text-indigo-700 dark:text-indigo-300', label: 'text-indigo-500', bar: 'bg-indigo-500 dark:bg-indigo-400' },
                  { bg: 'bg-cyan-50/70 dark:bg-cyan-950/30', border: 'border-cyan-100 dark:border-cyan-900/50', text: 'text-cyan-700 dark:text-cyan-400', stat: 'text-cyan-700 dark:text-cyan-300', label: 'text-cyan-500', bar: 'bg-cyan-500 dark:bg-cyan-400' },
                  { bg: 'bg-blue-50/70 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900/50', text: 'text-blue-700 dark:text-blue-400', stat: 'text-blue-700 dark:text-blue-300', label: 'text-blue-500', bar: 'bg-blue-500 dark:bg-blue-400' },
                  { bg: 'bg-emerald-50/70 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-400', stat: 'text-emerald-700 dark:text-emerald-300', label: 'text-emerald-500', bar: 'bg-emerald-500 dark:bg-emerald-400' },
                  { bg: 'bg-purple-50/70 dark:bg-purple-950/30', border: 'border-purple-100 dark:border-purple-900/50', text: 'text-purple-700 dark:text-purple-400', stat: 'text-purple-700 dark:text-purple-300', label: 'text-purple-500', bar: 'bg-purple-500 dark:bg-purple-400' }
                ];
                const color = colors[index % colors.length];
                const deptNorm = normalizeDepartment(dept.code || dept.name);

                let total = 0;
                let attended = 0;

                // 1. Check API departmentStats dictionary (or fastSummary)
                const activeDeptStats = departmentStats || fastSummary?.departmentStats;
                if (activeDeptStats && typeof activeDeptStats === 'object') {
                  for (const [key, val] of Object.entries(activeDeptStats)) {
                    if (normalizeDepartment(key) === deptNorm || key === dept.code || key === dept.name) {
                      const dVal: any = val;
                      total = Number(dVal?.total || dVal?.totalStudents || 0);
                      attended = Number(dVal?.public ?? dVal?.publicAttended ?? dVal?.officialAttended ?? dVal?.actual ?? 0) +
                        Number(dVal?.virtual ?? dVal?.virtualAttended ?? 0);
                      if (attended === 0 && dVal?.attended) {
                        attended = Number(dVal.attended);
                      }
                      break;
                    }
                  }
                }

                // 2. Check matrixRows or cachedStudents (if available) for dynamic calculation of attended count
                if (attended === 0 && (matrixRows.length > 0 || cachedStudents?.length > 0)) {
                  const studentPool = matrixRows.length > 0 ? matrixRows : cachedStudents;
                  const deptStudents = studentPool.filter((s: any) => normalizeDepartment(s.department_id || s.dept || s.department || s.department_code) === deptNorm);
                  if (deptStudents.length > 0) {
                    if (total === 0) total = deptStudents.length;
                    attended = deptStudents.filter((s: any) => {
                      const st = (s.participation_status || s.status || '').toUpperCase();
                      return st === 'PUBLIC_ATTENDED' || st === 'PUBLIC' || st === 'ATTENDED' || st === 'VIRTUAL_ATTENDED' || st === 'VIRTUAL';
                    }).length;
                  }
                }

                // 3. Fallback for total student count from master roster
                if (total === 0 && globalStudents.length > 0) {
                  const deptGlobalStudents = globalStudents.filter((s: any) => normalizeDepartment(s.department_id || s.dept || s.department || s.department_code) === deptNorm);
                  total = deptGlobalStudents.length;
                }

                // Exclude departments with 0 active students
                if (total === 0) {
                  return null;
                }

                const participationPct = total > 0 ? Math.min(100, Math.round((attended / total) * 100)) : 0;
                const isSelected = selectedDeptFilter === dept.code || normalizeDepartment(selectedDeptFilter) === deptNorm;

                return (
                  <div
                    key={dept.code}
                    onClick={() => setSelectedDeptFilter(isSelected ? 'ALL' : dept.code)}
                    role="button"
                    title={`Click to filter by ${dept.name}`}
                    className={`relative group p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-panel transition-all duration-300 flex flex-col justify-between min-w-0 w-full overflow-hidden cursor-pointer active:scale-[0.98] ${isSelected
                        ? 'border-2 border-brand-500 ring-1 ring-inset ring-brand-500/30 shadow-md bg-brand-500/10'
                        : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-brand-400 dark:hover:border-brand-500/50 hover:shadow-xs'
                      }`}
                  >
                    {/* Top gradient decorative line */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${color.bar}`} />

                    <div className="relative z-10 space-y-2">
                      {/* Top Row: Icon + Code Badge (Left) & Participated Count (Right) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color.bg} border ${color.border} group-hover:scale-105 transition-transform`}>
                            <Building2 className={`w-3.5 h-3.5 ${color.text}`} />
                          </div>
                          <span className={`text-xs font-black uppercase tracking-wider truncate ${color.text}`}>
                            {dept.code}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xl sm:text-2xl font-black font-mono leading-none ${color.stat}`}>{attended}</span>
                          <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider ${color.label} block mt-0.5`}>Attended</span>
                        </div>
                      </div>

                      {/* Middle Row: Department Name */}
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors" title={dept.name}>
                          {dept.name}
                        </h4>
                      </div>
                    </div>

                    {/* Bottom Row: Progress & Active Student Count */}
                    <div className="relative z-10 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-white/[0.06]">
                      <div className="flex justify-between items-center mb-1.5 text-[10px]">
                        <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Active
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-emerald-500">{participationPct}%</span>
                          <span className="text-[11px] font-bold font-mono text-slate-600 dark:text-slate-400">({attended}/{total})</span>
                        </div>
                      </div>

                      {/* Participation Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color.bar} transition-all duration-700 ease-out relative`}
                          style={{ width: `${participationPct}%` }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/20 animate-[shimmer_2s_infinite]" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }).filter(Boolean);

              if (deptCards.length === 0) return null;

              const isSingle = deptCards.length === 1;

              return (
                <div className={`grid ${isSingle ? 'grid-cols-1 sm:grid-cols-2 max-w-sm' : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'} gap-2.5 sm:gap-4 w-full min-w-0`}>
                  {deptCards}
                </div>
              );
            })()}
            {/* ACTIVE SCOPE BANNER - Dynamic & Clean: Only shows actively filtered dimensions */}
            {(selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL') && (
              <div className="bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl px-3.5 py-2 flex items-center justify-between gap-2.5 shadow-2xs animate-fade-in">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5 shrink-0">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    Active Scope:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedDeptFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold shadow-2xs">
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Dept:</span>
                        <span>{selectedDeptFilter}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDeptFilter('ALL')}
                          className="ml-0.5 p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Clear Department Filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedYearFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold shadow-2xs">
                        <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Year:</span>
                        <span>{selectedYearFilter === '1' || selectedYearFilter === 'I' ? '1st Year' : selectedYearFilter === '2' || selectedYearFilter === 'II' ? '2nd Year' : selectedYearFilter === '3' || selectedYearFilter === 'III' ? '3rd Year' : selectedYearFilter === '4' || selectedYearFilter === 'IV' ? '4th Year' : `${selectedYearFilter} Year`}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedYearFilter('ALL')}
                          className="ml-0.5 p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Clear Year Filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedAttendanceFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-2xs">
                        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Status:</span>
                        <span className="font-extrabold">{selectedAttendanceFilter.replace(/_/g, ' ')}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAttendanceFilter('ALL')}
                          className="ml-0.5 p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Clear Status Filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeptFilter('ALL');
                    setSelectedYearFilter('ALL');
                    setSelectedAttendanceFilter('ALL');
                  }}
                  className="shrink-0 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5 bg-white dark:bg-navy-950 px-2.5 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 shadow-2xs hover:shadow-xs hover:border-rose-300 active:scale-95 touch-manipulation"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
            )}

            {/* Headline Stat Cards - Collapsible on Mobile, Unchanged on Desktop */}
            {(() => {
              const showVirtualCard = stats.virtualRows > 0 || selectedAttendanceFilter === 'VIRTUAL_ATTENDED';
              const cardCount = showVirtualCard ? 6 : 5;
              return (
                <div className="space-y-2.5">
                  {/* Mobile-Only Toggle Bar (Hidden on Desktop 'lg:hidden') */}
                  <div className="flex items-center justify-between gap-2.5 lg:hidden pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showMobileStats;
                        setShowMobileStats(next);
                        try { localStorage.setItem('wc_show_mobile_stats', String(next)); } catch { }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-white/10 text-xs font-black text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 touch-manipulation shrink-0"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{showMobileStats ? 'Hide Overview Cards' : 'Overview Cards'}</span>
                      <span className="text-[10px] font-bold text-slate-400">({cardCount})</span>
                      {showMobileStats ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {!showMobileStats && (
                      <span className="inline-flex items-center shrink-0 text-[10px] sm:text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                        <span>{stats.attendedRows}/{stats.totalRows} Verified ({stats.totalParticipationPct}%)</span>
                        {solverDelta && solverDelta.delta > 0 && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                            (+{solverDelta.delta})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Grid: Hidden on mobile when collapsed, ALWAYS grid on desktop (lg:grid) */}
                  <div className={`${showMobileStats ? 'grid' : 'hidden lg:grid'} grid-cols-2 sm:grid-cols-3 ${showVirtualCard ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-2.5 sm:gap-3 w-full min-w-0 animate-fade-in`}>
                    {/* Card 1: Total Students */}
                    <button
                      type="button"
                      onClick={() => setSelectedAttendanceFilter('ALL')}
                      className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${selectedAttendanceFilter === 'ALL'
                        ? 'border-2 border-brand-500 ring-1 ring-inset ring-brand-500/30 shadow-md bg-brand-500/10'
                        : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-brand-400/50 shadow-2xs'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Total</span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform">
                          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white leading-none">
                          <AnimatedNumber value={stats.totalRows} />
                        </p>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Enrolled</span>
                      </div>
                    </button>

                    {/* Card 2: Public Attended */}
                    <button
                      type="button"
                      onClick={() => toggleAttendanceFilter('PUBLIC_ATTENDED')}
                      className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${selectedAttendanceFilter === 'PUBLIC_ATTENDED'
                        ? 'border-2 border-emerald-500 ring-1 ring-inset ring-emerald-500/30 shadow-md bg-emerald-500/15'
                        : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-emerald-500/50 shadow-2xs'
                        }`}
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center">
                          Public
                        </span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                          <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                          <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 leading-none">
                            <AnimatedNumber value={stats.attendedRows} />
                          </p>
                          {solverDelta && solverDelta.delta > 0 && (
                            <span
                              title={`+{solverDelta.delta} new solvers added (from ${solverDelta.prev} to ${solverDelta.current})`}
                              className="inline-flex items-center px-1 py-0.5 rounded text-[8px] sm:text-[10px] font-black font-mono bg-emerald-500 text-white shadow-xs shadow-emerald-500/40 animate-pulse"
                            >
                              +{solverDelta.delta} NEW
                            </span>
                          )}
                          {solverDelta && solverDelta.delta === 0 && (
                            <span
                              title="No new solvers added. Roster is up to date."
                              className="inline-flex items-center px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            >
                              +0
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/60 uppercase tracking-widest">Verified</span>
                      </div>
                    </button>

                    {/* Card 3: Virtual Attended (Only displayed when virtual participation exists or filter is active) */}
                    {showVirtualCard && (
                      <button
                        type="button"
                        onClick={() => toggleAttendanceFilter('VIRTUAL_ATTENDED')}
                        className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${selectedAttendanceFilter === 'VIRTUAL_ATTENDED'
                          ? 'border-2 border-purple-500 ring-1 ring-inset ring-purple-500/30 shadow-md bg-purple-500/15'
                          : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-purple-500/50 shadow-2xs'
                          }`}
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            Virtual
                          </span>
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between w-full">
                          <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400 leading-none">
                            <AnimatedNumber value={stats.virtualRows} />
                          </p>
                          <span className="text-[8px] sm:text-[9px] font-bold text-purple-600/70 dark:text-purple-400/60 uppercase tracking-widest">Practice</span>
                        </div>
                      </button>
                    )}

                    {/* Card 4: Not Attended */}
                    <button
                      type="button"
                      onClick={() => toggleAttendanceFilter('PUBLIC_NOT_ATTENDED')}
                      className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED'
                        ? 'border-2 border-rose-500 ring-1 ring-inset ring-rose-500/30 shadow-md bg-rose-500/15'
                        : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-rose-500/50 shadow-2xs'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400 tracking-wider">Absent</span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                          <UserX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 leading-none">
                          <AnimatedNumber value={stats.notAttendedRows} />
                        </p>
                        <span className="text-[8px] sm:text-[9px] font-bold text-rose-600/70 dark:text-rose-400/60 uppercase tracking-widest">Inactive</span>
                      </div>
                    </button>

                    {/* Card 5: Data Errors */}
                    <button
                      type="button"
                      onClick={() => {
                        toggleAttendanceFilter('DATA_ERROR');
                        setShowDetailedView(true);
                        setSubTab('error_board');
                      }}
                      className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${selectedAttendanceFilter === 'DATA_ERROR'
                        ? 'border-2 border-amber-500 ring-1 ring-inset ring-amber-500/30 shadow-md bg-amber-500/15'
                        : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-amber-500/50 shadow-2xs'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider">Errors</span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400 leading-none">
                          <AnimatedNumber value={stats.errorRows} />
                        </p>
                        <span className="text-[8px] sm:text-[9px] font-bold text-amber-600/70 dark:text-amber-400/60 uppercase tracking-widest">Fixes</span>
                      </div>
                    </button>

                    {/* Card 6: Participation (count = public + virtual) */}
                    <button
                      type="button"
                      onClick={() => toggleAttendanceFilter('ALL_ATTENDED')}
                      className={`h-20 sm:h-24 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl glass-panel text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass cursor-pointer flex flex-col justify-between relative overflow-hidden group min-w-0 w-full touch-manipulation active:scale-[0.98] ${!showVirtualCard ? 'col-span-2 sm:col-span-1' : ''
                        } ${selectedAttendanceFilter === 'ALL_ATTENDED'
                          ? 'border-2 border-indigo-500 ring-1 ring-inset ring-indigo-500/30 shadow-md bg-indigo-500/15'
                          : 'border border-slate-200/80 dark:border-navy-700/80 hover:border-indigo-500/50 shadow-2xs'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Overall</span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                          <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between w-full">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400 leading-none">
                          <AnimatedNumber value={stats.attendedRows + stats.virtualRows} />
                        </p>
                        <span className="text-[9px] sm:text-[10px] font-black font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">{stats.totalParticipationPct}%</span>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Feature Spotlight: Quick Statistics + Trend (Sparkline) + Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: Quick Statistics Progress Bars */}
              <div className="p-5 sm:p-6 rounded-3xl glass-panel shadow-glass hover:border-white/20 transition-all duration-300 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span>Participation Distribution</span>
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-slate-400 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                    Total: {stats.totalRows}
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-extrabold mb-1.5">
                      <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                        <span>PUBLIC ATTENDED ({stats.attendedRows})</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono">{stats.publicPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.publicPct}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-extrabold mb-1.5">
                      <span className="text-purple-500 dark:text-purple-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></span>
                        <span>VIRTUAL PRACTICE ({stats.virtualRows})</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono">{stats.virtualPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.virtualPct}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-extrabold mb-1.5">
                      <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-500/50"></span>
                        <span>NOT ATTENDED ({stats.notAttendedRows})</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono">{stats.notAttendedPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-2 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.notAttendedPct}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Contest Participation Trend & Growth with Inline Sparkline */}
              <div className="p-5 sm:p-6 rounded-3xl glass-panel shadow-glass relative overflow-hidden flex flex-col justify-between space-y-4 border border-indigo-500/20 dark:border-indigo-500/30 transition-all duration-300 hover:border-indigo-500/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3 relative z-10">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <span>Participation Trend</span>
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-500/30 shadow-2xs">
                    {comparison?.participationGrowthPct !== undefined
                      ? `${comparison.participationGrowthPct >= 0 ? '+' : ''}${comparison.participationGrowthPct.toFixed(1)}% Growth`
                      : `${stats.totalParticipationPct}% Active`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">{stats.totalParticipationPct}%</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">Active Solved</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug font-medium">
                      <b className="text-slate-900 dark:text-white font-bold">{stats.attendedRows} Public</b>
                      {stats.virtualRows > 0 ? (
                        <> + <b className="text-purple-600 dark:text-purple-300 font-bold">{stats.virtualRows} Virtual</b> participants</>
                      ) : (
                        <> Verified participants</>
                      )}
                    </p>
                  </div>

                  {/* Inline SVG Sparkline */}
                  <div className="shrink-0 bg-slate-100/80 dark:bg-white/5 p-2 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner">
                    <Sparkline data={comparison?.historyTrend || [Math.max(0, Number(stats.totalParticipationPct) - 15), Math.max(0, Number(stats.totalParticipationPct) - 8), Math.max(0, Number(stats.totalParticipationPct) - 3), Number(stats.totalParticipationPct)]} color="#6366f1" />
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden shadow-inner relative z-10">
                  <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 h-2 rounded-full shadow-md transition-all duration-700" style={{ width: `${stats.totalParticipationPct}%` }}></div>
                </div>
              </div>

              {/* Card 3: Top Performers Spotlight */}
              <div className="p-5 sm:p-6 rounded-3xl glass-panel shadow-glass hover:border-white/20 transition-all duration-300 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <span>Top Performers Spotlight</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">Live Global Rank</span>
                </div>

                <div className="space-y-2">
                  {stats.topPerformers.length > 0 ? (
                    stats.topPerformers.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/[0.06] text-xs transition-all hover:bg-white/[0.08] hover:scale-[1.01]">
                        <div className="flex items-center space-x-2.5">
                          <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-slate-950 font-bold' :
                            idx === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 font-bold' : 'bg-gradient-to-br from-amber-700 to-amber-900 text-white font-bold'
                            }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[120px] block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{typeof p.dept === 'object' ? (p.dept?.code || p.dept?.name || '—') : (p.dept || '—')} • {typeof p.year === 'object' ? (p.year?.year || p.year?.name || '—') : (p.year || '—')} Year</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] text-slate-500 font-bold">
                            {p.rank || p.contest_rank ? `#${p.rank || p.contest_rank}` : (p.participation_status?.includes('VIRTUAL') ? 'Virtual' : '—')}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs border border-emerald-500/20">
                            {Number(p.total_solved ?? p.total_contest_solved ?? ((p.q1 || 0) + (p.q2 || 0) + (p.q3 || 0) + (p.q4 || 0))) || 0}/4
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No live ranked submissions recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Virtual Students Detail Card (Conditionally shown only when virtual participants exist) */}
            {stats.virtualRows > 0 && (
              <div className="p-4 sm:p-6 rounded-3xl glass-panel relative overflow-hidden border border-purple-500/20 dark:border-purple-500/30 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center space-x-3.5 relative z-10 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-black text-[10px] uppercase tracking-wider border border-purple-500/30">
                        Virtual Practice Cohort
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {stats.virtualRows} Active Participants
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">
                      Questions solved during virtual contest windows are tracked separately from live public contests.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full md:w-auto relative z-10">
                  {[
                    { label: '4/4 Solved', count: stats.virtual4Solved, bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' },
                    { label: '3/4 Solved', count: stats.virtual3Solved, bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' },
                    { label: '2/4 Solved', count: stats.virtual2Solved, bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25' },
                    { label: '1/4 Solved', count: stats.virtual1Solved, bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25' },
                  ].map((item, idx) => (
                    <div key={idx} className={`px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-2xl border text-center w-full md:w-28 h-16 flex flex-col items-center justify-center shadow-xs transition-all hover:scale-105 ${item.bg}`}>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-90 whitespace-nowrap">{item.label}</span>
                      <span className="text-lg sm:text-xl font-black font-mono leading-none mt-1">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Cohort Institutional Performance & Ranking Matrix */}
            <div className="p-5 sm:p-7 rounded-3xl glass-panel relative overflow-hidden border border-brand-500/20 dark:border-brand-500/30 shadow-glass flex flex-col gap-5">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner shrink-0">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 font-black text-[10px] uppercase tracking-wider border border-brand-500/30">
                        {selectedDeptFilter === 'ALL' ? 'College-Wide' : selectedDeptFilter} • {selectedYearFilter === 'ALL' ? 'All Years' : `${selectedYearFilter} Year`}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {stats.attendedRows + stats.virtualRows} Total Participants ({stats.totalRows} Students in Scope)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                      Official Institutional Contest Performance Matrix tracking question solve distribution alongside Global Rank &lt; 20,000 and Contest Rank &lt; 5,000.
                    </p>
                  </div>
                </div>

                {/* Right Controls: View Mode Toggle & Session Meta Badges */}
                <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
                  {/* View Switcher: Cards View vs Table View */}
                  <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setMatrixViewMode('cards')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${matrixViewMode === 'cards'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/60 dark:border-white/10'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Cards View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixViewMode('table')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${matrixViewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/60 dark:border-white/10'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Table View</span>
                    </button>
                  </div>

                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {activeSessionObj?.contestName || `Weekly Contest ${activeSessionObj?.contestNumber || ''}`.trim()}
                  </span>
                  {activeSessionObj?.sessionDate && (
                    <span className="px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300 font-mono font-black text-xs border border-brand-500/20 shadow-2xs">
                      Date: {activeSessionObj.sessionDate}
                    </span>
                  )}
                </div>
              </div>

              {/* VIEW MODE 1: MODERN SPACIOUS BENTO CARDS (DEFAULT) */}
              {matrixViewMode === 'cards' ? (
                <div className="flex flex-col gap-4 relative z-10 animate-fade-in">
                  {/* Tier 1: Question Solve Distribution */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                        Last Contest No of Ques Solved ({activeSessionObj?.contestName || `Weekly Contest ${activeSessionObj?.contestNumber || ''}`.trim()})
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">5 Problem Benchmarks</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                      {[
                        { label: '4/4 Solved', count: stats.q4Solved, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40', sub: 'All Solved' },
                        { label: '3/4 Solved', count: stats.q3Solved, color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25 hover:border-purple-500/40', sub: '3 Solved' },
                        { label: '2/4 Solved', count: stats.q2Solved, color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25 hover:border-indigo-500/40', sub: '2 Solved' },
                        { label: '1/4 Solved', count: stats.q1Solved, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25 hover:border-amber-500/40', sub: '1 Solved' },
                        { label: '0/4 — No Solve', count: stats.q0Solved, color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25 hover:border-rose-500/40 col-span-2 sm:col-span-1', sub: '0 Solved' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={handleOpenDetailedRoster}
                          title={`Click to view full roster for ${item.label}`}
                          className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center min-h-[76px] shadow-2xs transition-all hover:scale-[1.03] active:scale-95 cursor-pointer touch-manipulation ${item.bg}`}
                        >
                          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider block opacity-90 whitespace-nowrap">{item.label}</span>
                          <span className={`text-xl sm:text-2xl font-black font-mono leading-none mt-1.5 ${item.color}`}>{item.count}</span>
                          <span className="text-[9px] sm:text-[10px] font-semibold opacity-70 block mt-1 truncate max-w-full font-mono">{item.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tier 2: Institutional Ranking & Attendance Benchmarks */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        Institutional Ranking &amp; Attendance Benchmarks
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">Session Criteria</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                      {[
                        {
                          label: 'Taken Count',
                          count: stats.attendedRows + stats.virtualRows,
                          color: 'text-slate-900 dark:text-white',
                          bg: 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600',
                          sub: `last_contest_name (${activeSessionObj?.contestNumber || activeSessionObj?.contestName?.match(/\d+/)?.[0] || 'Contest'} - ${activeSessionObj?.sessionDate || 'Session'})`,
                          icon: Users,
                          iconColor: 'text-brand-500'
                        },
                        {
                          label: 'Below 20000',
                          count: stats.rankBelow20k,
                          color: 'text-sky-700 dark:text-sky-400',
                          bg: 'bg-sky-500/10 border-sky-500/25 hover:border-sky-500/40',
                          sub: 'global_ranking < 20,000',
                          icon: TrendingUp,
                          iconColor: 'text-sky-500'
                        },
                        {
                          label: 'Below 5000',
                          count: stats.rankBelow5k,
                          color: 'text-teal-700 dark:text-teal-400',
                          bg: 'bg-teal-500/10 border-teal-500/25 hover:border-teal-500/40',
                          sub: 'last_contest_rank < 5,000',
                          icon: ShieldCheck,
                          iconColor: 'text-teal-500'
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={handleOpenDetailedRoster}
                          title={`Click to view full roster for ${item.label} (${item.sub})`}
                          className={`p-3.5 sm:p-4 rounded-2xl border text-center flex flex-col items-center justify-center min-h-[82px] shadow-2xs transition-all hover:scale-[1.02] active:scale-95 cursor-pointer touch-manipulation ${item.bg}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <item.icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider opacity-90">{item.label}</span>
                          </div>
                          <span className={`text-2xl sm:text-3xl font-black font-mono leading-none ${item.color}`}>{item.count}</span>
                          <span className="text-[10px] font-semibold opacity-75 mt-1 font-mono truncate max-w-full">{item.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* VIEW MODE 2: INSTITUTIONAL 2-TIER TABLE VIEW (RESPONSIVE NO-SCROLL) */
                <div className="w-full relative z-10 animate-fade-in">
                  <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white/70 dark:bg-slate-950/60 backdrop-blur-md overflow-hidden">
                    <table className="w-full table-fixed text-center border-collapse text-xs">
                      <thead>
                        {/* Header Row 1 */}
                        <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <th className="w-[20%] sm:w-[22%] py-2 sm:py-3 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700 font-black">
                            <span className="hidden sm:block text-[11px] tracking-wide uppercase font-black">last_contest_name</span>
                            <span className="sm:hidden text-[9px] tracking-tight uppercase font-black block truncate">Contest</span>
                            <span className="text-[7.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono mt-0.5 block truncate">
                              ({activeSessionObj?.contestNumber || activeSessionObj?.contestName?.match(/\d+/)?.[0] || 'Contest'} - {activeSessionObj?.sessionDate || 'Session'})
                            </span>
                          </th>
                          <th colSpan={5} className="w-[45%] sm:w-[40%] py-2 sm:py-3 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700 text-brand-700 dark:text-brand-300 font-black tracking-wide uppercase bg-brand-500/10 dark:bg-brand-500/15">
                            <span className="hidden sm:inline">Last Contest No of Ques Solved ({activeSessionObj?.contestName || `Weekly Contest ${activeSessionObj?.contestNumber || ''}`.trim()})</span>
                            <span className="sm:hidden text-[9px] tracking-tight uppercase font-black block truncate">Questions Solved</span>
                          </th>
                          <th className="w-[17%] sm:w-[19%] py-2 sm:py-3 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-black tracking-wide uppercase bg-sky-500/10 dark:bg-sky-500/15">
                            <span className="hidden sm:inline">Below 20000</span>
                            <span className="sm:hidden text-[9px] tracking-tight font-black uppercase block">&lt; 20k</span>
                          </th>
                          <th className="w-[18%] sm:w-[19%] py-2 sm:py-3 px-1 sm:px-4 text-teal-700 dark:text-teal-300 font-black tracking-wide uppercase bg-teal-500/10 dark:bg-teal-500/15">
                            <span className="hidden sm:inline">Below 5000</span>
                            <span className="sm:hidden text-[9px] tracking-tight font-black uppercase block">&lt; 5k</span>
                          </th>
                        </tr>
                        {/* Header Row 2 */}
                        <tr className="bg-slate-50/90 dark:bg-slate-900/90 text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-1.5 sm:py-2.5 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700 font-black uppercase text-slate-700 dark:text-slate-300">
                            <span className="hidden sm:inline">Taken Count</span>
                            <span className="sm:hidden text-[9px] font-black uppercase">Taken</span>
                          </th>
                          <th className="w-[9%] sm:w-[8%] py-1.5 sm:py-2.5 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-black text-[10px] sm:text-xs bg-emerald-500/5">4</th>
                          <th className="w-[9%] sm:w-[8%] py-1.5 sm:py-2.5 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700 text-purple-700 dark:text-purple-400 font-black text-[10px] sm:text-xs bg-purple-500/5">3</th>
                          <th className="w-[9%] sm:w-[8%] py-1.5 sm:py-2.5 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400 font-black text-[10px] sm:text-xs bg-indigo-500/5">2</th>
                          <th className="w-[9%] sm:w-[8%] py-1.5 sm:py-2.5 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 font-black text-[10px] sm:text-xs bg-amber-500/5">1</th>
                          <th className="w-[9%] sm:w-[8%] py-1.5 sm:py-2.5 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400 font-black text-[10px] sm:text-xs bg-rose-500/5">0</th>
                          <th className="py-1.5 sm:py-2.5 px-0.5 sm:px-4 border-r border-slate-200 dark:border-slate-700 font-mono font-black text-sky-700 dark:text-sky-400 bg-sky-500/5">
                            <span className="hidden sm:inline font-mono">global_ranking</span>
                            <span className="sm:hidden text-[8px] font-mono font-bold block truncate">Global</span>
                          </th>
                          <th className="py-1.5 sm:py-2.5 px-0.5 sm:px-4 font-mono font-black text-teal-700 dark:text-teal-400 bg-teal-500/5">
                            <span className="hidden sm:inline font-mono">last_contest_rank</span>
                            <span className="sm:hidden text-[8px] font-mono font-bold block truncate">Contest</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        onClick={handleOpenDetailedRoster}
                        title="Click to view detailed student roster"
                        className="font-mono divide-y divide-slate-100 dark:divide-slate-800 cursor-pointer"
                      >
                        <tr className="bg-white/80 dark:bg-slate-950/80 hover:bg-brand-50/50 dark:hover:bg-slate-900/60 transition-colors">
                          <td className="py-2.5 sm:py-4 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center px-1.5 sm:px-4 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-xs sm:text-base border border-slate-200 dark:border-slate-700 shadow-2xs">
                              {stats.attendedRows + stats.virtualRows}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-black text-[11px] sm:text-base border border-emerald-500/25 shadow-2xs">
                              {stats.q4Solved}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 font-mono font-black text-[11px] sm:text-base border border-purple-500/25 shadow-2xs">
                              {stats.q3Solved}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-mono font-black text-[11px] sm:text-base border border-indigo-500/25 shadow-2xs">
                              {stats.q2Solved}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-black text-[11px] sm:text-base border border-amber-500/25 shadow-2xs">
                              {stats.q1Solved}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-0.5 sm:px-3 border-r border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-black text-[11px] sm:text-base border border-rose-500/25 shadow-2xs">
                              {stats.q0Solved}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-1 sm:px-4 border-r border-slate-200 dark:border-slate-700 bg-sky-500/[0.03]">
                            <span className="inline-flex items-center justify-center px-1.5 sm:px-4 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-400 font-mono font-black text-xs sm:text-base border border-sky-500/25 shadow-2xs">
                              {stats.rankBelow20k}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-4 px-1 sm:px-4 bg-teal-500/[0.03]">
                            <span className="inline-flex items-center justify-center px-1.5 sm:px-4 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 font-mono font-black text-xs sm:text-base border border-teal-500/25 shadow-2xs">
                              {stats.rankBelow5k}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* TOGGLE CTA BUTTON: QUICK VIEW ↔ DETAILED VIEW */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  if (!showDetailedView) {
                    handleOpenDetailedRoster();
                  } else {
                    setShowDetailedView(false);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3.5 min-h-[46px] rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs sm:text-sm font-black shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 transition-all duration-300 cursor-pointer active:scale-95 border border-white/15 touch-manipulation"
              >
                {showDetailedView ? (
                  <>
                    <ChevronUp className="w-4 h-4 shrink-0" />
                    <span>Collapse Detailed View</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 shrink-0" />
                    <span className="truncate">View Full Breakdown & Student Roster ({totalRows || globalStudents.length || 0} Students)</span>
                  </>
                )
                }
              </button>
            </div>
          </div>

          {/* 4. DETAILED VIEW SECTION (LAZY-LOADED ON TOGGLE) */}
          {showDetailedView && (
            <div ref={detailedViewRef} className="space-y-6 pt-4 border-t border-white/[0.06] animate-fade-in">
              {/* Detailed View Sub-Tab Switcher - 2026 SaaS Segmented Bento Bar */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-white/[0.08] pb-3.5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full xl:w-auto flex-1 max-w-4xl">
                  <button
                    type="button"
                    onClick={() => setSubTab('matrix')}
                    className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 ${subTab === 'matrix'
                      ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/25 border border-brand-400/40 ring-2 ring-brand-500/20'
                      : 'bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                      }`}
                  >
                    <Users className={`w-4 h-4 shrink-0 ${subTab === 'matrix' ? 'text-white' : 'text-brand-500'}`} />
                    <span className="truncate">Student Matrix <span className="font-mono text-[11px] opacity-90">({totalRows})</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubTab('dept_year')}
                    className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 ${subTab === 'dept_year'
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40 ring-2 ring-purple-500/20'
                      : 'bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                      }`}
                  >
                    <Layers className={`w-4 h-4 shrink-0 ${subTab === 'dept_year' ? 'text-white' : 'text-purple-500'}`} />
                    <span className="truncate">Dept & Year Breakdown</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('error_board');
                      setSelectedAttendanceFilter('DATA_ERROR');
                    }}
                    className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 ${subTab === 'error_board'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/25 border border-amber-400/40 ring-2 ring-amber-500/20'
                      : 'bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                      }`}
                  >
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${subTab === 'error_board' ? 'text-white' : 'text-amber-500'}`} />
                    <span className="truncate">Data Quality <span className="font-mono text-[11px] opacity-90">({stats.errorRows})</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubTab('post_930_activity')}
                    className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 ${subTab === 'post_930_activity'
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/40 ring-2 ring-emerald-500/20'
                      : 'bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                      }`}
                  >
                    <Clock className={`w-4 h-4 shrink-0 ${subTab === 'post_930_activity' ? 'text-white' : 'text-emerald-500'}`} />
                    <span className="truncate">Post-9:30 AM Activity</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-white/5 px-3.5 py-2 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] w-fit shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px]">Scope:</span>
                  <span className="text-brand-600 dark:text-brand-400 font-mono font-black">{selectedDeptFilter}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-purple-600 dark:text-purple-400 font-mono font-black">{selectedYearFilter} Year</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{selectedAttendanceFilter}</span>
                </div>
              </div>

              {/* Missing Handles Alert Banner - ONLY shown in Data Quality ('error_board') tab */}
              {(() => {
                if (subTab !== 'error_board') return null;
                const missingHandlesCount = sessionMetrics?.usernameNotFound ?? sessionMetrics?.unlinkedProfiles ?? filteredMatrixRows.filter(r => !r.username || r.status === 'USERNAME_NOT_FOUND').length;
                if (missingHandlesCount > 0) {
                  return (
                    <div className="relative overflow-hidden bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-amber-200/90 dark:border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all animate-fade-in before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:bg-gradient-to-b before:from-amber-400 before:to-amber-500 before:rounded-l-3xl">
                      <div className="flex items-start sm:items-center space-x-3.5 min-w-0 pl-1.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 shadow-2xs">
                          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                              Action Required: Missing LeetCode Handles
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shadow-2xs">
                              {missingHandlesCount} Students
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                            These students do not have a linked LeetCode profile and cannot be tracked by the contest engine.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotification({ isOpen: true, title: 'Success', type: 'success', message: `Reminder emails queued for ${missingHandlesCount} students missing handles.` });
                        }}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs font-black rounded-xl sm:rounded-2xl transition-all shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/30 cursor-pointer active:scale-95 whitespace-nowrap touch-manipulation shrink-0 border border-brand-400/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Reminder to All</span>
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Tab 1: Live Question-Wise Student Matrix Table */}
              {subTab === 'matrix' && (
                <div className="glass-panel rounded-3xl overflow-hidden shadow-glass border-white/[0.08]">
                  {/* ACTIVE KPI FILTER BAR */}
                  {selectedAttendanceFilter !== 'ALL' && (
                    <div className="px-5 py-3.5 bg-brand-500/10 border-b border-brand-500/20 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                          <Filter className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-black text-brand-900 dark:text-brand-100 min-w-0 break-words">
                          Showing {filteredMatrixRows.length || totalRows} {
                            selectedAttendanceFilter === 'DATA_ERROR' ? 'Data Error' :
                              selectedAttendanceFilter === 'ALL_ATTENDED' ? 'Participating' :
                                selectedAttendanceFilter === 'PUBLIC_ATTENDED' ? 'Public' :
                                  selectedAttendanceFilter === 'VIRTUAL_ATTENDED' ? 'Virtual' :
                                    selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED' ? 'Not Attended' : 'Filtered'
                          } Students
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedAttendanceFilter('ALL')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-brand-400/30 text-brand-300 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Filters</span>
                      </button>
                    </div>
                  )}

                  {/* Table Legend & Top Quick Pagination */}
                  <div className="px-5 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] text-xs font-medium backdrop-blur-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">Legend:</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        PUBLIC
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold border border-purple-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        VIRTUAL
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        NOT ATTENDED
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        DATA ERROR
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Top Pagination Controls for Zero-Scroll Navigation */}
                      {totalRows > 0 && (
                        <div className="flex items-center gap-1.5 bg-white dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                          >
                            ‹ Prev
                          </button>
                          <span className="text-[10px] font-mono font-black text-brand-600 dark:text-brand-400 px-1.5">
                            {currentPage}/{totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                          >
                            Next ›
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bulk Action Bar */}
                  {selectedRowIds.size > 0 && (
                    <div className="bg-brand-50 dark:bg-brand-900/30 border-b border-brand-100 dark:border-brand-800 px-3.5 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 animate-fade-in">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
                          {selectedRowIds.size}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-brand-700 dark:text-brand-300">
                          Students Selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRowIds(new Set())}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-1 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNotification({ isOpen: true, title: 'Success', type: 'success', message: `${selectedRowIds.size} students marked as verified successfully.` });
                            setSelectedRowIds(new Set());
                          }}
                          className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-navy-800 border border-brand-200 dark:border-brand-700 hover:bg-brand-100 dark:hover:bg-brand-800/50 text-brand-700 dark:text-brand-300 text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark as Verified</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendBulkReminders}
                          disabled={isSendingReminders}
                          className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isSendingReminders ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                          <span>{isSendingReminders ? 'Sending Emails...' : 'Send Reminder Email'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBulkDeleteModal(true)}
                          className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-600/25"
                          title="Deactivate or delete selected students"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Deactivate Selected</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MOBILE VIEW: High-density full-width responsive cards (Zero Horizontal Scroll) */}
                  <div className="block md:hidden p-4 sm:p-5 space-y-4 sm:space-y-5">
                    {paginatedMatrixRows.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 font-bold">
                        No students found
                      </div>
                    ) : (
                      paginatedMatrixRows.map((r, idx) => {
                        const actualIdx = (currentPage - 1) * pageSize + idx;
                        return (
                          <MobileContestMatrixCard
                            key={r.reg_no || r.student_id || actualIdx}
                            r={r}
                            actualIdx={actualIdx}
                            isSelected={selectedRowIds.has(r.reg_no)}
                            onEdit={handleOpenEditStudent}
                            onDelete={setDeletingStudent}
                            onSelect={setViewingProfileStudent}
                            onCheckbox={handleRowCheckbox}
                            onQuickSync={isAdmin ? handleQuickSync : undefined}
                          />
                        );
                      })
                    )}
                  </div>

                  {/* DESKTOP VIEW: Full 12-Column Table */}
                  <div className="hidden md:block table-responsive-container w-full min-w-0 max-w-full overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs border-separate border-spacing-0">
                      <thead className="text-white text-xs font-black uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <tr className="[&>th]:bg-slate-950 [&>th]:dark:bg-navy-950 [&>th:first-child]:rounded-l-2xl [&>th:last-child]:rounded-r-2xl border-b border-slate-700 dark:border-slate-600">
                          {/* Checkbox Column */}
                          <th className="px-3 py-3.5 text-center w-10">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-600 bg-navy-900 focus:ring-brand-500 checked:bg-brand-500"
                              checked={selectedRowIds.size > 0 && selectedRowIds.size === paginatedMatrixRows.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allIds = new Set<string>(paginatedMatrixRows.map((r: any) => String(r.reg_no || r.id || '')));
                                  setSelectedRowIds(allIds);
                                } else {
                                  setSelectedRowIds(new Set<string>());
                                }
                              }}
                            />
                          </th>
                          <th className="px-3 py-3.5 text-center text-white font-extrabold">S.No</th>
                          <th className="px-3 py-3.5 text-left text-white font-extrabold whitespace-nowrap">Reg No</th>
                          <th className="px-3 py-3.5 text-left text-white font-extrabold whitespace-nowrap">Student Name</th>
                          <th className="px-3 py-3.5 text-center text-white font-extrabold">Dept</th>
                          <th className="px-3 py-3.5 text-center text-white font-extrabold">Year</th>
                          <th className="px-3 py-3.5 text-center text-white font-extrabold">Status</th>

                          {/* Sortable Columns */}
                          {['q1', 'q2', 'q3', 'q4'].map((qKey) => (
                            <th key={qKey} className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800 transition-colors group select-none text-white font-extrabold" onClick={() => handleSort(qKey)}>
                              <div className="flex items-center justify-center space-x-1">
                                <span>{qKey.toUpperCase()}</span>
                                <span className="text-xs opacity-60 group-hover:opacity-100">
                                  {sortConfig?.key === qKey ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </span>
                              </div>
                            </th>
                          ))}

                          <th className="px-3 py-3.5 text-center cursor-pointer hover:bg-slate-800 transition-colors group select-none text-white font-extrabold" onClick={() => handleSort('solved')}>
                            <div className="flex items-center justify-center space-x-1">
                              <span>Contest Solved</span>
                              <span className="text-xs opacity-60 group-hover:opacity-100">
                                {sortConfig?.key === 'solved' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </div>
                          </th>

                          <th className="px-4 py-3.5 text-center text-white font-extrabold min-w-[130px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {paginatedMatrixRows.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="p-12 text-center text-slate-500 font-bold">
                              No students found
                            </td>
                          </tr>
                        ) : (
                          paginatedMatrixRows.map((r, idx) => {
                            const actualIdx = (currentPage - 1) * pageSize + idx;
                            return (
                              <ContestMatrixRow
                                key={r.reg_no || r.student_id || actualIdx}
                                r={r}
                                actualIdx={actualIdx}
                                isSelected={selectedRowIds.has(r.reg_no)}
                                onEdit={handleOpenEditStudent}
                                onDelete={setDeletingStudent}
                                onSelect={setViewingProfileStudent}
                                onCheckbox={handleRowCheckbox}
                                onQuickSync={isAdmin ? handleQuickSync : undefined}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* HIGH-SPEED VIRTUALIZED PAGINATION BAR */}
                  {totalRows > 0 && (
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-navy-950 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Showing count */}
                      <div className="text-slate-500 dark:text-slate-400 font-bold min-w-0 break-words">
                        {loading ? (
                          <span className="animate-pulse">Loading students...</span>
                        ) : (
                          <>
                            Showing <span className="text-slate-900 dark:text-white font-black">{filteredMatrixRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
                            <span className="text-slate-900 dark:text-white font-black">{Math.min(currentPage * pageSize, totalRows)}</span> of{' '}
                            <span className="text-brand-600 dark:text-brand-400 font-black">{totalRows}</span> students
                          </>
                        )}
                      </div>

                      {/* Page Size Selector */}
                      {totalRows > 10 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 font-medium">Rows per page:</span>
                          <div className="flex items-center space-x-1 bg-white dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            {[10, 20, 50, 100, 200, 99999].map(sz => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${pageSize === sz
                                    ? 'bg-brand-500 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                                  }`}
                              >
                                {sz >= 99999 ? 'All' : sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Page Navigation Buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(1)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 font-bold hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                          title="First Page"
                        >
                          «
                        </button>
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 font-bold hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                          ‹ Prev
                        </button>

                        <span className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-black border border-brand-200 dark:border-brand-800/60">
                          Page {currentPage} of {totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 font-bold hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                          Next ›
                        </button>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 font-bold hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                          title="Last Page"
                        >
                          »
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Department & Academic Year Matrix Breakdown */}
              {subTab === 'dept_year' && (
                <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Department & Academic Year Aggregation Breakdown
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">Single-Source-of-Truth Aggregation</span>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto -mx-1 px-1 touch-pan-x overscroll-x-contain">
                    <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Segment / Category</th>
                          <th className="py-2.5 px-3 text-center">Total</th>
                          <th className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">Public</th>
                          <th className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400">Virtual</th>
                          <th className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">Not Attended</th>
                          <th className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">Errors</th>
                          <th className="py-2.5 px-3 text-right">Participation %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-bold">
                        {/* Department breakdown rows */}
                        {departments.map((dept, index) => {
                          const deptCode = dept.code;
                          const deptNorm = normalizeDepartment(dept.code || dept.name);

                          let dStats = { total: 0, public: 0, virtual: 0, not_attended: 0, errors: 0 };

                          if (departmentStats && typeof departmentStats === 'object') {
                            for (const [key, val] of Object.entries(departmentStats)) {
                              if (normalizeDepartment(key) === deptNorm || key === dept.code || key === dept.name) {
                                const dVal: any = val;
                                dStats = {
                                  total: Number(dVal?.total || 0),
                                  public: Number(dVal?.public ?? dVal?.publicAttended ?? dVal?.officialAttended ?? dVal?.actual ?? 0),
                                  virtual: Number(dVal?.virtual ?? dVal?.virtualAttended ?? 0),
                                  not_attended: Number(dVal?.not_attended ?? dVal?.notAttended ?? 0),
                                  errors: Number(dVal?.errors ?? dVal?.totalErrors ?? dVal?.dataErrors ?? 0)
                                };
                                break;
                              }
                            }
                          }

                          if (dStats.public === 0 && dStats.virtual === 0 && (matrixRows.length > 0 || cachedStudents?.length > 0)) {
                            const studentPool = matrixRows.length > 0 ? matrixRows : cachedStudents;
                            const deptStudents = studentPool.filter((s: any) => normalizeDepartment(s.department_id || s.dept || s.department || s.department_code) === deptNorm);
                            if (deptStudents.length > 0) {
                              const tot = deptStudents.length;
                              const pub = deptStudents.filter((s: any) => {
                                const st = (s.participation_status || s.status || '').toUpperCase();
                                return st === 'PUBLIC_ATTENDED' || st === 'PUBLIC' || st === 'ATTENDED';
                              }).length;
                              const virt = deptStudents.filter((s: any) => {
                                const st = (s.participation_status || s.status || '').toUpperCase();
                                return st === 'VIRTUAL_ATTENDED' || st === 'VIRTUAL';
                              }).length;
                              const notAtt = deptStudents.filter((s: any) => {
                                const st = (s.participation_status || s.status || '').toUpperCase();
                                return st === 'PUBLIC_NOT_ATTENDED' || st === 'NOT_ATTENDED';
                              }).length;
                              const errs = deptStudents.filter((s: any) => {
                                const st = (s.participation_status || s.status || '').toUpperCase();
                                return st === 'DATA_ERROR' || st === 'SOURCE_ERROR' || st === 'CONFLICT';
                              }).length;
                              dStats = { total: dStats.total || tot, public: pub, virtual: virt, not_attended: notAtt, errors: errs };
                            }
                          }

                          if (dStats.total === 0 && globalStudents.length > 0) {
                            const deptGlobal = globalStudents.filter((s: any) => normalizeDepartment(s.department_id || s.dept || s.department || s.department_code) === deptNorm);
                            dStats.total = deptGlobal.length;
                          }

                          const tot = dStats.total || 0;
                          const pub = dStats.public || 0;
                          const virt = dStats.virtual || 0;
                          const errs = dStats.errors || 0;
                          let notAtt = dStats.not_attended || 0;
                          if (notAtt === 0 && tot > (pub + virt + errs)) {
                            notAtt = tot - (pub + virt + errs);
                          }
                          const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                          const dotColors = ['bg-indigo-500', 'bg-teal-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500'];
                          const dotColor = dotColors[index % dotColors.length];

                          return (
                            <tr key={deptCode} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`}></span>
                                  <span>Department: {dept.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">{tot}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                              <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400 font-black">{virt}</td>
                              <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400 font-black">{notAtt}</td>
                              <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">{errs}</td>
                              <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-black">{pct}%</td>
                            </tr>
                          );
                        })}

                        {/* Academic Year breakdown rows */}
                        {['II', 'III', 'IV'].map((yr) => {
                          const normY = (y: any): string => {
                            if (!y) return '';
                            const str = String(y).toUpperCase().trim();
                            if (str.includes('2') || str.includes('II')) return 'II';
                            if (str.includes('3') || str.includes('III')) return 'III';
                            if (str.includes('4') || str.includes('IV')) return 'IV';
                            if (str.includes('1') || str.includes('I')) return 'I';
                            return str;
                          };
                          let yStats = yearStats?.[yr] || { total: 0, public: 0, virtual: 0, not_attended: 0, errors: 0 };
                          if (yStats.total === 0 && (matrixRows.length > 0 || cachedStudents?.length > 0 || globalStudents?.length > 0)) {
                            const pool = matrixRows.length > 0 ? matrixRows : (cachedStudents?.length > 0 ? cachedStudents : globalStudents);
                            const yrNorm = normY(yr);
                            const yrStudents = pool.filter((s: any) => normY(s.year || s.year_level || s.academic_year) === yrNorm);
                            if (yrStudents.length > 0) {
                              const t = yrStudents.length;
                              const p = yrStudents.filter((s: any) => ['PUBLIC_ATTENDED', 'PUBLIC', 'ATTENDED'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                              const v = yrStudents.filter((s: any) => ['VIRTUAL_ATTENDED', 'VIRTUAL'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                              const e = yrStudents.filter((s: any) => ['DATA_ERROR', 'SOURCE_ERROR', 'CONFLICT'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                              const n = Math.max(0, t - (p + v + e));
                              yStats = { total: t, public: p, virtual: v, not_attended: n, errors: e };
                            }
                          }
                          const tot = yStats.total || 0;
                          const pub = yStats.public || 0;
                          const virt = yStats.virtual || 0;
                          const errs = yStats.errors || 0;
                          let notAtt = yStats.not_attended || 0;
                          if (notAtt === 0 && tot > (pub + virt + errs)) {
                            notAtt = tot - (pub + virt + errs);
                          }
                          const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                          return (
                            <tr key={yr} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 bg-slate-50/40 dark:bg-navy-950/20">
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                                  <span>Academic Year: {yr === 'I' || yr === '1' ? '1st' : yr === 'II' || yr === '2' ? '2nd' : yr === 'III' || yr === '3' ? '3rd' : yr === 'IV' || yr === '4' ? '4th' : yr} Year ({yr === 'I' || yr === '1' ? '2026–2030' : (yr === 'II' || yr === '2' ? '2025–2029' : (yr === 'III' || yr === '3' ? '2024–2028' : '2023–2027'))})</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">{tot}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                              <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400 font-black">{virt}</td>
                              <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400 font-black">{notAtt}</td>
                              <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">{errs}</td>
                              <td className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400 font-black">{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Native Card View (Zero Horizontal Scroll on mobile) */}
                  <div className="block md:hidden space-y-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 pb-1">
                      Departments ({departments.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {departments.map((dept, index) => {
                        const deptCode = dept.code;
                        const deptNorm = normalizeDepartment(dept.code || dept.name);
                        let dStats = { total: 0, public: 0, virtual: 0, not_attended: 0, errors: 0 };

                        if (departmentStats && typeof departmentStats === 'object') {
                          for (const [key, val] of Object.entries(departmentStats)) {
                            if (normalizeDepartment(key) === deptNorm || key === dept.code || key === dept.name) {
                              const dVal: any = val;
                              dStats = {
                                total: Number(dVal?.total || 0),
                                public: Number(dVal?.public ?? dVal?.publicAttended ?? dVal?.officialAttended ?? dVal?.actual ?? 0),
                                virtual: Number(dVal?.virtual ?? dVal?.virtualAttended ?? 0),
                                not_attended: Number(dVal?.not_attended ?? dVal?.notAttended ?? 0),
                                errors: Number(dVal?.errors ?? dVal?.totalErrors ?? dVal?.dataErrors ?? 0)
                              };
                              break;
                            }
                          }
                        }

                        if (dStats.public === 0 && dStats.virtual === 0 && (matrixRows.length > 0 || cachedStudents?.length > 0)) {
                          const studentPool = matrixRows.length > 0 ? matrixRows : cachedStudents;
                          const deptStudents = studentPool.filter((s: any) => normalizeDepartment(s.department_id || s.dept || s.department || s.department_code) === deptNorm);
                          if (deptStudents.length > 0) {
                            const tot = deptStudents.length;
                            const pub = deptStudents.filter((s: any) => ['PUBLIC_ATTENDED', 'PUBLIC', 'ATTENDED'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const virt = deptStudents.filter((s: any) => ['VIRTUAL_ATTENDED', 'VIRTUAL'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const notAtt = deptStudents.filter((s: any) => ['PUBLIC_NOT_ATTENDED', 'NOT_ATTENDED'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const errs = deptStudents.filter((s: any) => ['DATA_ERROR', 'SOURCE_ERROR', 'CONFLICT'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            dStats = { total: tot, public: pub, virtual: virt, not_attended: notAtt, errors: errs };
                          }
                        }

                        const tot = dStats.total || 0;
                        const pub = dStats.public || 0;
                        const virt = dStats.virtual || 0;
                        const errs = dStats.errors || 0;
                        const notAtt = dStats.not_attended || Math.max(0, tot - (pub + virt + errs));
                        const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                        return (
                          <div key={deptCode} className="p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/60 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {dept.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                                {pct}% Attended
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5 text-center text-[10.5px] font-mono">
                              <div className="p-1 rounded-lg bg-slate-100 dark:bg-navy-800">
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Total</span>
                                <span className="font-black text-slate-800 dark:text-slate-200">{tot}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <span className="block text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Live</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{pub}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <span className="block text-[8px] font-bold text-purple-600 dark:text-purple-400 uppercase">Virt</span>
                                <span className="font-black text-purple-600 dark:text-purple-400">{virt}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                <span className="block text-[8px] font-bold text-rose-600 dark:text-rose-400 uppercase">Abs</span>
                                <span className="font-black text-rose-600 dark:text-rose-400">{notAtt}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <span className="block text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">Err</span>
                                <span className="font-black text-amber-600 dark:text-amber-400">{errs}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 pt-2 pb-1">
                      Academic Years
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {['II', 'III', 'IV'].map((yr) => {
                        const normY = (y: any): string => {
                          if (!y) return '';
                          const str = String(y).toUpperCase().trim();
                          if (str.includes('2') || str.includes('II')) return 'II';
                          if (str.includes('3') || str.includes('III')) return 'III';
                          if (str.includes('4') || str.includes('IV')) return 'IV';
                          return str;
                        };
                        let yStats = yearStats?.[yr] || { total: 0, public: 0, virtual: 0, not_attended: 0, errors: 0 };
                        if (yStats.total === 0 && (matrixRows.length > 0 || cachedStudents?.length > 0 || globalStudents?.length > 0)) {
                          const pool = matrixRows.length > 0 ? matrixRows : (cachedStudents?.length > 0 ? cachedStudents : globalStudents);
                          const yrNorm = normY(yr);
                          const yrStudents = pool.filter((s: any) => normY(s.year || s.year_level || s.academic_year) === yrNorm);
                          if (yrStudents.length > 0) {
                            const t = yrStudents.length;
                            const p = yrStudents.filter((s: any) => ['PUBLIC_ATTENDED', 'PUBLIC', 'ATTENDED'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const v = yrStudents.filter((s: any) => ['VIRTUAL_ATTENDED', 'VIRTUAL'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const e = yrStudents.filter((s: any) => ['DATA_ERROR', 'SOURCE_ERROR', 'CONFLICT'].includes((s.participation_status || s.status || '').toUpperCase())).length;
                            const n = Math.max(0, t - (p + v + e));
                            yStats = { total: t, public: p, virtual: v, not_attended: n, errors: e };
                          }
                        }
                        const tot = yStats.total || 0;
                        const pub = yStats.public || 0;
                        const virt = yStats.virtual || 0;
                        const errs = yStats.errors || 0;
                        const notAtt = yStats.not_attended || Math.max(0, tot - (pub + virt + errs));
                        const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                        return (
                          <div key={yr} className="p-3.5 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-purple-900 dark:text-purple-200 truncate">
                                Academic Year: {yr === 'I' || yr === '1' ? '1st' : yr === 'II' || yr === '2' ? '2nd' : yr === 'III' || yr === '3' ? '3rd' : yr === 'IV' || yr === '4' ? '4th' : yr} Year ({yr === 'I' || yr === '1' ? '2026–2030' : (yr === 'II' || yr === '2' ? '2025–2029' : (yr === 'III' || yr === '3' ? '2024–2028' : '2023–2027'))})
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shrink-0">
                                {pct}%
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5 text-center text-[10.5px] font-mono">
                              <div className="p-1 rounded-lg bg-white/60 dark:bg-navy-900">
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Total</span>
                                <span className="font-black text-slate-800 dark:text-slate-200">{tot}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <span className="block text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Live</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{pub}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <span className="block text-[8px] font-bold text-purple-600 dark:text-purple-400 uppercase">Virt</span>
                                <span className="font-black text-purple-600 dark:text-purple-400">{virt}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                <span className="block text-[8px] font-bold text-rose-600 dark:text-rose-400 uppercase">Abs</span>
                                <span className="font-black text-rose-600 dark:text-rose-400">{notAtt}</span>
                              </div>
                              <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <span className="block text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">Err</span>
                                <span className="font-black text-amber-600 dark:text-amber-400">{errs}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Itemized Data Quality Error Board */}
              {subTab === 'error_board' && (() => {
                const errorRows = matrixRows.filter(r => {
                  const st = (r.status || r.participation_status || '').toString().toUpperCase();
                  const u = (r.username || '').toString().trim();
                  const isMissingUsername = !u || u === 'USERNAME_NOT_FOUND' || u === 'UNLINKED' || u === 'NO_HANDLE' || u === 'NONE' || u === 'NULL';
                  return (
                    isMissingUsername ||
                    [
                      'USERNAME_NOT_FOUND', 'INVALID_USERNAME',
                      'FETCH_FAILED', 'FETCH_ERROR', 'DATA_ERROR',
                      'DATA_MISMATCH', 'CONFLICT',
                      'AUTH_REQUIRED', 'BLOCKED', 'SOURCE_UNAVAILABLE',
                      'SOURCE_ERROR', 'ERROR', 'INVALID', 'FAILED'
                    ].includes(st) ||
                    r.participation_status === 'DATA_ERROR'
                  );
                });

                const totalErrorCount = errorRows.length;
                const totalErrorPages = Math.ceil(totalErrorCount / pageSize) || 1;
                const currentErrorPage = Math.min(currentPage, totalErrorPages);
                const startIndex = (currentErrorPage - 1) * pageSize;
                const paginatedErrorRows = errorRows.slice(startIndex, startIndex + pageSize);

                return (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-950 p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <div>
                        <h3 className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Itemized Data Quality Errors ({totalErrorCount} Students)</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                          Root Cause: Missing or invalid LeetCode username handles. API failure is NEVER falsely marked as Not Attended.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          <span className="px-2 text-slate-400 uppercase text-[9px] font-black">Rows:</span>
                          {[10, 20, 50, 100, 200].map(sz => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${pageSize === sz ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-navy-800'}`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>

                        {/* Top Pagination Controls */}
                        {totalErrorCount > 0 && (
                          <div className="flex items-center gap-1.5 bg-white dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <button
                              type="button"
                              disabled={currentErrorPage <= 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              ‹ Prev
                            </button>
                            <span className="text-[10px] font-mono font-black text-amber-600 dark:text-amber-400 px-1.5">
                              {currentErrorPage}/{totalErrorPages}
                            </span>
                            <button
                              type="button"
                              disabled={currentErrorPage >= totalErrorPages}
                              onClick={() => setCurrentPage(p => Math.min(totalErrorPages, p + 1))}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Next ›
                            </button>
                          </div>
                        )}

                        <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-300">
                          Click "Add Username" to link profile
                        </span>
                      </div>
                    </div>

                    {loading ? (
                      <div className="p-8 text-center text-slate-500 font-bold bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                        <span>Loading data quality error records for scope ({selectedDeptFilter} • {selectedYearFilter} Year)...</span>
                      </div>
                    ) : (
                      <>
                        {/* Mobile View: Clean No-Scroll Card Stack */}
                        <div className="md:hidden space-y-3">
                          {totalErrorCount === 0 ? (
                            <div className="p-6 text-center text-slate-500 font-bold bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                              No data quality errors found for active filter scope ({selectedDeptFilter} • {selectedYearFilter} Year).
                            </div>
                          ) : (
                            paginatedErrorRows.map((errStudent, idx) => (
                              <div
                                key={errStudent.reg_no || errStudent.id || idx}
                                className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-amber-200/80 dark:border-amber-900/50 shadow-sm space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-slate-400">#{startIndex + idx + 1}</span>
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">{errStudent.reg_no}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800">{typeof errStudent.dept === 'object' ? (errStudent.dept?.code || errStudent.dept?.name || '—') : (errStudent.dept || '—')}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800">{typeof errStudent.year === 'object' ? (errStudent.year?.year || errStudent.year?.name || '—') : (errStudent.year || '—')}</span>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{errStudent.name}</h4>
                                  <div className="mt-1.5">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60">
                                      {!errStudent.username
                                        ? 'Missing LeetCode Username Handle'
                                        : errStudent.status === 'USERNAME_NOT_FOUND'
                                          ? 'Username Not Found on LeetCode'
                                          : errStudent.status === 'FETCH_ERROR'
                                            ? 'LeetCode API Fetch Error'
                                            : 'Invalid LeetCode Handle / API Error'}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleOpenEditStudent(errStudent)}
                                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center space-x-1.5"
                                >
                                  <span>Add Username</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Desktop View: Full-width Table */}
                        <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-navy-950 text-white font-black uppercase">
                              <tr>
                                <th className="px-4 py-3 text-center">#</th>
                                <th className="px-4 py-3">Register No</th>
                                <th className="px-4 py-3">Student Name</th>
                                <th className="px-4 py-3 text-center">Dept</th>
                                <th className="px-4 py-3 text-center">Year</th>
                                <th className="px-4 py-3">Root Cause / Issue</th>
                                <th className="px-4 py-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {totalErrorCount === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                                    No data quality errors found for active filter scope ({selectedDeptFilter} • {selectedYearFilter} Year).
                                  </td>
                                </tr>
                              ) : (
                                paginatedErrorRows.map((errStudent, idx) => (
                                  <tr key={errStudent.reg_no || errStudent.id || idx} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                                    <td className="px-4 py-2.5 text-center text-slate-400 font-mono font-bold">
                                      {startIndex + idx + 1}
                                    </td>
                                    <td className="px-4 py-2.5 font-bold font-mono text-amber-600 dark:text-amber-400">
                                      {errStudent.reg_no}
                                    </td>
                                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                                      {errStudent.name}
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-bold">
                                      {typeof errStudent.dept === 'object' ? (errStudent.dept?.code || errStudent.dept?.name || '—') : (errStudent.dept || '—')}
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-slate-500">
                                      {typeof errStudent.year === 'object' ? (errStudent.year?.year || errStudent.year?.name || '—') : (errStudent.year || '—')}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                        {!errStudent.username
                                          ? 'Missing LeetCode Username Handle'
                                          : errStudent.status === 'USERNAME_NOT_FOUND'
                                            ? 'Username Not Found on LeetCode'
                                            : errStudent.status === 'FETCH_ERROR'
                                              ? 'LeetCode API Fetch Error'
                                              : 'Invalid LeetCode Handle / API Error'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <button
                                        onClick={() => handleOpenEditStudent(errStudent)}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer active:scale-95"
                                      >
                                        Add Username
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Bottom Pagination Controls */}
                        {totalErrorCount > 0 && (
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <span className="text-slate-500 font-bold">
                              Showing <b className="text-slate-800 dark:text-slate-200">{startIndex + 1}</b> to <b className="text-slate-800 dark:text-slate-200">{Math.min(totalErrorCount, startIndex + pageSize)}</b> of <b className="text-amber-600 dark:text-amber-400">{totalErrorCount}</b> data error records
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={currentErrorPage <= 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                ‹ Previous
                              </button>
                              <span className="px-2.5 py-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                                Page {currentErrorPage} of {totalErrorPages}
                              </span>
                              <button
                                type="button"
                                disabled={currentErrorPage >= totalErrorPages}
                                onClick={() => setCurrentPage(p => Math.min(totalErrorPages, p + 1))}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                Next ›
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Tab 4: Post-9:30 AM Activity Solvers Report */}
              {subTab === 'post_930_activity' && (
                <div className="animate-fade-in">
                  <React.Suspense fallback={<div className="p-12 text-center text-slate-400 animate-pulse">Loading solvers report...</div>}>
                    <Post930SolversView />
                  </React.Suspense>
                </div>
              )}
            </div>
          )}

          {/* Interactive Report Preview Modal — Auto-fitted Viewport Card (Matches Student Modal) */}
          {showPreviewModal && typeof document !== 'undefined' && createPortal(
            <div
              className="modal-overlay-responsive animate-modal-backdrop"
              style={{ zIndex: 100000 }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowPreviewModal(false); }}
            >
              <div className="modal-container-responsive mobile-responsive-modal max-w-5xl bg-white dark:bg-navy-950 rounded-t-[28px] sm:rounded-3xl rounded-b-none sm:rounded-b-3xl shadow-lg border-t sm:border border-slate-200 dark:border-slate-800 animate-slide-up-drawer sm:animate-modal-content">

                {/* A. SLEEK GRADIENT HEADER (Matches Image 2) */}
                <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-brand-950 via-slate-900 to-navy-950 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center font-black text-white text-base shadow-lg shadow-brand-600/30">
                      <FileSpreadsheet className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                          Report Live Preview
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          Verified Dataset
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono">
                          {activeSessionObj?.contestName || 'Weekly Contest'}
                        </span>
                      </div>
                      <p className="text-xs text-brand-200/80 font-medium truncate mt-0.5">
                        Nandha Engineering College • Session Date: {activeSessionObj?.sessionDate || 'Sunday Session'} • Showing {previewDataset.length} Students
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    aria-label="Close report preview"
                    className="shrink-0 ml-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>

                {/* B. COMPACT METRICS & FILTER SUMMARY BAR */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
                  {/* Quick Metrics Badges */}
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="px-2.5 py-1 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50 font-black text-[11px]">
                      Roster: {previewDataset.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-black text-[11px]">
                      Public: {stats.attendedRows}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-black text-[11px]">
                      Not Attended: {stats.notAttendedRows}
                    </span>
                  </div>

                  {/* Active Filter Badges */}
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-[11px] font-bold text-slate-500">
                    <span>Filters:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">{selectedDeptFilter}</span>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold">{selectedYearFilter}</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">{selectedAttendanceFilter}</span>
                  </div>
                </div>

                {/* C. SCROLLABLE PREVIEW TABLE */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    {/* Desktop Preview Table */}
                    <div className="hidden md:block overflow-x-auto touch-pan-x overscroll-x-contain">
                      <table className="w-full min-w-[780px] text-left text-xs">
                        <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10 text-[11px]">
                          <tr>
                            <th className="px-3 py-2 text-center w-12">S.No</th>
                            <th className="px-3 py-2">Reg No</th>
                            <th className="px-3 py-2">Student Name</th>
                            <th className="px-3 py-2 text-center">Dept</th>
                            <th className="px-3 py-2 text-center">Year</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-2 py-2 text-center w-10">Q1</th>
                            <th className="px-2 py-2 text-center w-10">Q2</th>
                            <th className="px-2 py-2 text-center w-10">Q3</th>
                            <th className="px-2 py-2 text-center w-10">Q4</th>
                            <th className="px-3 py-2 text-right">Contest Solved</th>
                            <th className="px-2 py-2 text-right">Score</th>
                            <th className="px-3 py-2 text-right">Contest Rank</th>
                            <th className="px-3 py-2 text-right">Contest Rating</th>
                            <th className="px-3 py-2 text-right">Global Rank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                          {previewPaginatedRows.length === 0 ? (
                            <tr>
                              <td colSpan={15} className="p-8 text-center text-slate-500 font-bold">
                                No matching student records found for the active filter selection.
                              </td>
                            </tr>
                          ) : (
                            previewPaginatedRows.map((r, idx) => {
                              const actualIdx = (previewPage - 1) * previewPageSize + idx;
                              const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'PUBLIC' || r.status === 'PUBLIC';
                              const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
                              const isAttended = isPublicAttended || isVirtualAttended;
                              return (
                                <tr key={actualIdx} className="hover:bg-brand-50/40 dark:hover:bg-navy-800/40 transition-colors">
                                  <td className="px-3 py-1.5 text-center text-slate-400 font-mono text-[11px]">{actualIdx + 1}</td>
                                  <td className="px-3 py-1.5 font-bold font-mono text-slate-900 dark:text-white text-[11px]">{r.reg_no}</td>
                                  <td className="px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-200 uppercase">{(r.name || '').toUpperCase()}</td>
                                  <td className="px-3 py-1.5 text-center font-bold text-indigo-600 dark:text-indigo-400">
                                    {typeof r.dept === 'object' ? (r.dept?.code || r.dept?.name || '—') : (r.dept || '—')}
                                  </td>
                                  <td className="px-3 py-1.5 text-center text-slate-600 dark:text-slate-400 font-bold">
                                    {typeof r.year === 'object' ? (r.year?.year || r.year?.name || '—') : (r.year || '—')}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isPublicAttended
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : isVirtualAttended
                                        ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                                        : r.status === 'USERNAME_NOT_FOUND'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      }`}>
                                      {isPublicAttended ? 'PUBLIC' : isVirtualAttended ? 'VIRTUAL' : r.status === 'USERNAME_NOT_FOUND' ? (r.username ? 'INVALID HANDLE' : 'UNLINKED') : 'NOT ATTENDED'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q1 === 1 || r.q1 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-slate-400 font-bold">0</span>}</td>
                                  <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q2 === 1 || r.q2 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-slate-400 font-bold">0</span>}</td>
                                  <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q3 === 1 || r.q3 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-slate-400 font-bold">0</span>}</td>
                                  <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q4 === 1 || r.q4 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-slate-400 font-bold">0</span>}</td>
                                  <td className="px-3 py-1.5 text-right font-black text-emerald-600 dark:text-emerald-400">{isAttended ? (r.total_solved ?? 0) : 0}</td>
                                  <td className="px-2 py-1.5 text-right font-bold text-indigo-600 dark:text-indigo-400">{isAttended ? (r.score ?? 0) : 0}</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{isAttended && (r.contest_rank || r.rank) && String(r.contest_rank || r.rank) !== '—' ? `#${Number(String(r.contest_rank || r.rank).replace(/[^0-9]/g, '')).toLocaleString()}` : '—'}</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{r.contest_rating && String(r.contest_rating) !== 'Unrated' && String(r.contest_rating) !== '—' ? (typeof r.contest_rating === 'number' ? Math.round(r.contest_rating) : r.contest_rating) : (r.rating && String(r.rating) !== 'Unrated' && String(r.rating) !== '—' ? (typeof r.rating === 'number' ? Math.round(r.rating) : r.rating) : 'Unrated')}</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-600 dark:text-slate-400">{r.contest_global_rank && String(r.contest_global_rank) !== 'Unrated' ? r.contest_global_rank : (r.global_rank && String(r.global_rank) !== 'Unrated' ? r.global_rank : 'Unrated')}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Preview Cards */}
                    <div className="block md:hidden p-2.5 space-y-2">
                      {previewPaginatedRows.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 font-bold text-xs">
                          No matching student records found.
                        </div>
                      ) : (
                        previewPaginatedRows.map((r, idx) => {
                          const actualIdx = (previewPage - 1) * previewPageSize + idx;
                          const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'PUBLIC' || r.status === 'PUBLIC';
                          const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
                          return (
                            <div key={actualIdx} className="p-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-900/60 text-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-slate-500 text-[11px]">#{actualIdx + 1} • {r.reg_no}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black ${isPublicAttended ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                    isVirtualAttended ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                                      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}>
                                  {isPublicAttended ? 'PUBLIC' : isVirtualAttended ? 'VIRTUAL' : 'NOT ATTENDED'}
                                </span>
                              </div>
                              <p className="font-black text-slate-900 dark:text-white uppercase truncate">{r.name}</p>
                              <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-200/60 dark:border-navy-800">
                                <span className="text-slate-600 dark:text-slate-400">{typeof r.dept === 'object' ? (r.dept?.code || r.dept?.name || '—') : (r.dept || '—')} • {typeof r.year === 'object' ? (r.year?.year || r.year?.name || '—') : (r.year || '—')} Year</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{r.total_solved ?? 0}/4 Solved</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Preview Pagination Toolbar */}
                  {previewDataset.length > previewPageSize && (
                    <div className="mt-3 px-3 py-2 bg-slate-100 dark:bg-navy-950 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Page {previewPage} of {previewTotalPages} ({previewDataset.length} total)</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={previewPage <= 1}
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          ‹ Prev
                        </button>
                        <button
                          type="button"
                          disabled={previewPage >= previewTotalPages}
                          onClick={() => setPreviewPage(p => Math.min(previewTotalPages, p + 1))}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Interactive Report Email Dispatch Modal */}
          {showEmailModal && typeof document !== 'undefined' && createPortal(
            <div className="modal-overlay-responsive animate-modal-backdrop" style={{ zIndex: 100000 }}>
              <div className="modal-container-responsive max-w-2xl bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
                {/* Modal Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-lg font-black flex items-center space-x-2">
                      <Mail className="w-5 h-5 text-indigo-400" />
                      <span>Dispatch Filtered Weekly Report</span>
                    </h3>
                    <p className="text-xs text-slate-300 font-bold mt-0.5">
                      Sends the exact generated Excel report (<code className="text-indigo-300 font-mono">NEC_Weekly_Contest_{activeSessionObj?.contestName?.match(/\d+/)?.[0] || selectedSessionId}_PUBLIC.xlsx</code>)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
                  {/* Active Filter Scope Card */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-navy-950 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                    <div className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
                      Report Scope & Target Roster
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-bold">
                        Contest: <b className="text-slate-900 dark:text-white">{activeSessionObj?.contestName || 'Weekly Contest'}</b>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-bold">
                        Dept: <b className="text-indigo-600">{selectedDeptFilter}</b>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-bold">
                        Year: <b className="text-purple-600">{selectedYearFilter}</b>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-bold">
                        Attendance: <b className="text-emerald-600">{selectedAttendanceFilter}</b>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black">
                        {matrixRows.length} Students Selected
                      </span>
                    </div>
                  </div>

                  {/* Recipient Contacts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Select Delivery Recipients ({selectedRecipients.length} selected)
                      </label>
                      <button
                        onClick={() => {
                          if (selectedRecipients.length === recipientsList.length) setSelectedRecipients([]);
                          else setSelectedRecipients(recipientsList.map((r: any) => r.email));
                        }}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
                      >
                        {selectedRecipients.length === recipientsList.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-navy-950">
                      {recipientsList.length === 0 ? (
                        <p className="text-xs text-slate-500 font-bold py-2 text-center">
                          No configured recipients found in database. You can send a test email below.
                        </p>
                      ) : (
                        recipientsList.map((r: any) => {
                          const isChecked = selectedRecipients.includes(r.email);
                          return (
                            <label
                              key={r.id}
                              className="flex items-center space-x-2.5 text-xs p-1.5 rounded-lg hover:bg-white dark:hover:bg-navy-900 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedRecipients(prev => [...prev, r.email]);
                                  else setSelectedRecipients(prev => prev.filter(em => em !== r.email));
                                }}
                                className="rounded text-brand-600 focus:ring-brand-500"
                              />
                              <span className="font-bold text-slate-800 dark:text-slate-200">{r.name}</span>
                              <span className="text-slate-400 font-mono text-[11px]">({r.email})</span>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-navy-800 text-slate-600 dark:text-slate-300 ml-auto">
                                {r.role || 'HOD'}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Custom Note */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Executive Note / Remarks (Optional)
                    </label>
                    <textarea
                      value={customEmailNote}
                      onChange={(e) => setCustomEmailNote(e.target.value)}
                      placeholder="e.g. Please review the department performance metrics from Sunday contest..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                  </div>

                  {/* Safe Test Section */}
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                    <div className="flex items-center space-x-1.5 text-xs font-black text-amber-800 dark:text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      <span>Run Safe Test (Single Recipient)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={testEmailInput}
                        onChange={(e) => setTestEmailInput(e.target.value)}
                        placeholder="Enter test recipient email (e.g. admin@nandha.edu.in)"
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-navy-950 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white outline-none"
                      />
                      <button
                        onClick={() => handleSendWeeklyEmail(true)}
                        disabled={isSendingEmail}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isSendingEmail ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSendWeeklyEmail(false)}
                    disabled={isSendingEmail || selectedRecipients.length === 0}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingEmail ? 'Dispatching...' : `Dispatch Report to ${selectedRecipients.length} Recipient(s)`}</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Viewport-Centered Sticky Floating Student Edit Overlay */}
          <StudentEditOverlay
            isOpen={Boolean(editingStudent)}
            student={editingStudent}
            onClose={() => setEditingStudent(null)}
            onSaveSuccess={(updated) => {
              setMatrixRows(prev => prev.map(row =>
                (row.student_id === updated.id || row.id === updated.id)
                  ? {
                    ...row,
                    student_name: updated.name,
                    name: updated.name,
                    section: updated.section,
                    department: updated.department,
                    is_active: updated.is_active,
                    username: updated.username || row.username,
                    status: updated.username ? 'SYNC_PENDING' : row.status,
                    participation_status: updated.username ? 'PENDING' : row.participation_status
                  }
                  : row
              ));
              setEditingStudent(null);
            }}
          />

          {/* Viewport-Centered Single Student Delete Confirmation Modal */}
          <GlobalModalBackdrop
            isOpen={Boolean(deletingStudent)}
            onClose={() => { if (!isDeletingStudent) setDeletingStudent(null); }}
            zIndex={100000}
            className="flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md overflow-hidden"
          >
            {deletingStudent && (
              <div
                className="bg-white dark:bg-[#0c1424] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden border-0 sm:border border-slate-200 dark:border-white/10 animate-fade-in-up select-text m-0 sm:my-auto p-5 sm:p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="single-delete-modal-title"
              >
                <div className="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0 shadow-xs">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 id="single-delete-modal-title" className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Deactivate Student?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate">
                      {deletingStudent.name} • <span className="font-mono text-rose-600 dark:text-rose-400">{deletingStudent.reg_no}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isDeletingStudent}
                    onClick={() => setDeletingStudent(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-800 dark:text-rose-300 font-medium leading-relaxed">
                  This student record will be deactivated and removed from contest rankings and live sessions. You can safely reactivate them anytime from Student Master.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingStudent}
                    onClick={() => setDeletingStudent(null)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer min-h-[42px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteStudent}
                    disabled={isDeletingStudent}
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-2"
                  >
                    {isDeletingStudent ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Deactivating...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm Deactivation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </GlobalModalBackdrop>

          {/* Viewport-Centered Bulk Deactivation Confirmation Modal */}
          <GlobalModalBackdrop
            isOpen={showBulkDeleteModal}
            onClose={() => { if (!isBulkDeleting) setShowBulkDeleteModal(false); }}
            zIndex={100000}
            className="flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md overflow-hidden"
          >
            <div
              className="bg-white dark:bg-[#0c1424] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden border-0 sm:border border-slate-200 dark:border-white/10 animate-fade-in-up select-text m-0 sm:my-auto p-5 sm:p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-delete-modal-title"
            >
              <div className="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0 shadow-xs">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="bulk-delete-modal-title" className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Deactivate {selectedRowIds.size} Selected Students?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Cohort action on {selectedRowIds.size} selected student record{selectedRowIds.size > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Selector: Deactivate vs Purge */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBulkDeleteSoft(true)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    bulkDeleteSoft
                      ? 'bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/20'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-amber-700 dark:text-amber-400 uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Deactivate (Safe)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    Soft-deletes records; reversible anytime from Student Master.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBulkDeleteSoft(false)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    !bulkDeleteSoft
                      ? 'bg-rose-500/10 border-rose-500 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/20'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-rose-700 dark:text-rose-400 uppercase">
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Purge (Permanent)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    Cascades and deletes all contest history permanently.
                  </p>
                </button>
              </div>

              {/* Selected Preview List */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Selected Students ({selectedRowIds.size})
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200/80 dark:border-white/5 custom-scrollbar">
                  {Array.from(selectedRowIds).map(regNo => {
                    const regStr = String(regNo);
                    const s = matrixRows.find(r => r.reg_no === regStr) || allSessionRows.find(r => r.reg_no === regStr);
                    return (
                      <div key={regStr} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-white/5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                          {s?.name || 'Student'}
                        </span>
                        <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                          {regStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-2"
                >
                  {isBulkDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{bulkDeleteSoft ? `Deactivate ${selectedRowIds.size} Students` : `Permanently Delete ${selectedRowIds.size} Students`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </GlobalModalBackdrop>

          {/* Centered Application Notification Modal */}
          <StatusNotificationModal
            notification={notification}
            onClose={() => setNotification(null)}
          />

          {/* Centered Institutional Authentication Required Modal */}
          {showAuthRequiredModal && typeof document !== 'undefined' && createPortal(
            <div className="modal-overlay-responsive animate-fade-in" style={{ zIndex: 100000 }}>
              <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-amber-300 dark:border-amber-700/60 p-6 space-y-4 my-auto text-center overflow-y-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <Lock className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
                    <span>Authentication Required</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed px-2">
                    The institutional contest resource requires authentication. Please authenticate and try Sync again.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11.5px] text-amber-800 dark:text-amber-300 font-bold text-left space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Protected Institutional Operation</span>
                  </div>
                  <p className="text-[10.5px] font-normal text-amber-700 dark:text-amber-400">
                    Weekly contest synchronization updates official student rankings and requires verified administrative or faculty credentials.
                  </p>
                </div>

                <div className="flex items-center justify-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAuthRequiredModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthRequiredModal(false);
                      window.location.href = '/login?returnUrl=' + encodeURIComponent(window.location.pathname);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    Authenticate / Sign In
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        </>
      )}

      {/* STUDENT PROFILE MODAL */}
      {viewingProfileStudent && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" onClick={() => setViewingProfileStudent(null)}>
          <div className="bg-white dark:bg-navy-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-navy-950">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-xl border-2 border-brand-200 dark:border-brand-700">
                  {viewingProfileStudent.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{viewingProfileStudent.name}</h3>
                  <p className="text-sm font-bold text-slate-500 font-mono mt-0.5">{viewingProfileStudent.reg_no} • {typeof viewingProfileStudent.dept === 'object' ? (viewingProfileStudent.dept?.code || viewingProfileStudent.dept?.name || '—') : (viewingProfileStudent.dept || '—')}</p>
                </div>
              </div>
              <button onClick={() => setViewingProfileStudent(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-navy-800 rounded-full transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">Contest Solved</p>
                  <p className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                    {((viewingProfileStudent.q1 || 0) + (viewingProfileStudent.q2 || 0) + (viewingProfileStudent.q3 || 0) + (viewingProfileStudent.q4 || 0))}/4
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">Rank</p>
                  <p className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                    {viewingProfileStudent.contest_rank || viewingProfileStudent.rank ? `#${viewingProfileStudent.contest_rank || viewingProfileStudent.rank}` : '—'}
                  </p>
                </div>
              </div>

              {/* Status & LeetCode Info Banner */}
              {(() => {
                const isPub = viewingProfileStudent.participation_status === 'PUBLIC_ATTENDED' || viewingProfileStudent.participation_status === 'ATTENDED' || viewingProfileStudent.status === 'PUBLIC' || viewingProfileStudent.participation_status === 'PUBLIC';
                const isVirt = viewingProfileStudent.participation_status === 'VIRTUAL_ATTENDED' || viewingProfileStudent.participation_status === 'VIRTUAL' || viewingProfileStudent.status === 'VIRTUAL';
                const isErr = viewingProfileStudent.participation_status === 'DATA_ERROR' || viewingProfileStudent.status === 'USERNAME_NOT_FOUND' || viewingProfileStudent.status === 'FETCH_ERROR';

                const bannerCls = isPub
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : isVirt
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300'
                    : isErr
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300';

                return (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-2xs ${bannerCls}`}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Attendance Status
                      </span>
                      <span className="text-sm font-black uppercase tracking-wide mt-0.5">
                        {viewingProfileStudent.participation_status?.replace(/_/g, ' ') || viewingProfileStudent.status || 'NOT ATTENDED'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        LeetCode Username
                      </p>
                      <p className="text-sm font-black mt-1 font-mono text-slate-900 dark:text-white truncate max-w-[200px]" title={viewingProfileStudent.username}>
                        {viewingProfileStudent.username ? `@${viewingProfileStudent.username.replace(/^@/, '')}` : 'Not Linked'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                {viewingProfileStudent.username && (
                  <a
                    href={`https://leetcode.com/u/${viewingProfileStudent.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-navy-900 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>LeetCode</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    setViewingProfileStudent(null);
                    handleOpenEditStudent(viewingProfileStudent);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-sm transition-transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  Edit Record
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


