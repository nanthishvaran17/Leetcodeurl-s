import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Bot,
  Loader2,
  X,
  ShieldAlert,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { useNotification, ToastNotification } from '../context/NotificationContext';

const ToastItem: React.FC<{ toast: ToastNotification; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef(toast.duration || 4500);

  useEffect(() => {
    if (!toast.duration || toast.duration === 0) return;

    let intervalId: any = null;
    const duration = toast.duration;

    if (!isPaused) {
      const step = 40;
      intervalId = setInterval(() => {
        remainingTimeRef.current -= step;
        const percentage = Math.max(0, (remainingTimeRef.current / duration) * 100);
        setProgress(percentage);

        if (remainingTimeRef.current <= 0) {
          clearInterval(intervalId);
          onDismiss(toast.id);
        }
      }, step);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPaused, toast.duration, toast.id, onDismiss]);

  const getStyleProps = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-white/95 dark:bg-[#0B132B]/95 backdrop-blur-xl border-emerald-500/40 dark:border-emerald-500/30',
          badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          progressBg: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400',
          categoryColor: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/60',
          ambientGlow: 'from-emerald-500/20 via-teal-500/10',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(16,185,129,0.3)]',
          defaultCategory: 'SUCCESS',
        };
      case 'error':
        return {
          bg: 'bg-white/95 dark:bg-[#1A0B14]/95 backdrop-blur-xl border-rose-500/40 dark:border-rose-500/30',
          badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
          icon: XCircle,
          iconColor: 'text-rose-600 dark:text-rose-400',
          progressBg: 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-500',
          categoryColor: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-800/60',
          ambientGlow: 'from-rose-500/25 via-pink-500/10',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(244,63,94,0.3)]',
          defaultCategory: 'SYSTEM NOTICE',
        };
      case 'warning':
        return {
          bg: 'bg-white/95 dark:bg-[#191408]/95 backdrop-blur-xl border-amber-500/40 dark:border-amber-500/30',
          badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
          icon: AlertTriangle,
          iconColor: 'text-amber-600 dark:text-amber-400',
          progressBg: 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400',
          categoryColor: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800/60',
          ambientGlow: 'from-amber-500/25 via-yellow-500/10',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(245,158,11,0.3)]',
          defaultCategory: 'ATTENTION',
        };
      case 'ai':
        return {
          bg: 'bg-slate-900/95 dark:bg-[#080B16]/95 backdrop-blur-xl border-indigo-500/40 text-white',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
          icon: Bot,
          iconColor: 'text-indigo-400 animate-pulse',
          progressBg: 'bg-gradient-to-r from-indigo-500 via-purple-400 to-brand-400',
          categoryColor: 'text-indigo-300 bg-indigo-500/20 border-indigo-400/30',
          ambientGlow: 'from-indigo-500/25 via-purple-500/15',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(99,102,241,0.35)]',
          defaultCategory: 'INTELLIGENCE AI',
        };
      case 'loading':
        return {
          bg: 'bg-white/95 dark:bg-[#0A1024]/95 backdrop-blur-xl border-indigo-500/40 dark:border-indigo-500/30',
          badgeBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
          icon: Loader2,
          iconColor: 'text-indigo-600 dark:text-indigo-400 animate-spin',
          progressBg: 'bg-gradient-to-r from-indigo-500 to-sky-400',
          categoryColor: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-800/60',
          ambientGlow: 'from-indigo-500/20 via-sky-500/10',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(99,102,241,0.25)]',
          defaultCategory: 'PROCESSING',
        };
      case 'info':
      default:
        return {
          bg: 'bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-slate-200/90 dark:border-white/[0.12]',
          badgeBg: 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/25',
          icon: Info,
          iconColor: 'text-brand-600 dark:text-brand-400',
          progressBg: 'bg-gradient-to-r from-brand-500 via-indigo-500 to-blue-400',
          categoryColor: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 border-brand-200/80 dark:border-brand-800/60',
          ambientGlow: 'from-brand-500/20 via-indigo-500/10',
          ringGlow: 'shadow-[0_10px_35px_-8px_rgba(99,102,241,0.25)]',
          defaultCategory: 'NOTIFICATION',
        };
    }
  };

  const style = getStyleProps();
  const IconComponent = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.94, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -16, scale: 0.92, filter: 'blur(2px)', transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 480, damping: 30 }}
      className={`pointer-events-auto relative shrink-0 w-full overflow-hidden rounded-2xl p-3 sm:p-3.5 border transition-all duration-200 hover:-translate-y-0.5 select-none ${style.bg} ${style.ringGlow}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      {/* Ambient Top Glow Arc */}
      <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full bg-gradient-to-b ${style.ambientGlow} to-transparent blur-2xl pointer-events-none opacity-60`} />

      <div className="relative z-10 flex items-start gap-3 min-w-0">
        <div className={`p-2 rounded-xl border shrink-0 mt-0.5 shadow-xs ${style.badgeBg}`}>
          <IconComponent className={`w-4 h-4 ${style.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0 ${style.categoryColor}`}>
                {toast.category || style.defaultCategory}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold shrink-0">
                {toast.timestamp || 'Just now'}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer active:scale-90"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug mt-1">
            {toast.title}
          </h4>

          {toast.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-0.5 line-clamp-3">
              {toast.description}
            </p>
          )}

          {toast.actionLabel && toast.onAction && (
            <div className="mt-2 pt-1 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  onDismiss(toast.id);
                }}
                className="inline-flex items-center gap-1 text-xs font-black text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer"
              >
                <span>{toast.actionLabel}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto-dismiss Glowing Micro-Progress Bar */}
      {toast.duration && toast.duration > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
          <div
            className={`h-full transition-all ease-linear ${style.progressBg}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </motion.div>
  );
};

export const NotificationCenter: React.FC = () => {
  const { toasts, notify, confirmDialogState, dismissConfirm } = useNotification();

  // Keyboard accessibility for confirm dialog
  useEffect(() => {
    if (!confirmDialogState.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissConfirm(false);
      } else if (e.key === 'Enter') {
        dismissConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialogState.isOpen, dismissConfirm]);

  const confirmOptions = confirmDialogState.options;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Toast Notification Stack Container (Top-Right Header-Aligned Stack / Below Navbar on Mobile) */}
      <div
        id="nec-toast-container"
        className="fixed top-[calc(env(safe-area-inset-top,0px)+3.85rem)] sm:top-[4.25rem] left-3 sm:left-auto right-3 sm:right-6 z-[99999999] flex flex-col gap-2.5 w-auto sm:w-[350px] max-w-[calc(100vw-1.5rem)] sm:max-w-md mx-auto sm:mx-0 pointer-events-none print:hidden no-print"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="popLayout">
          {[...toasts].reverse().map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={notify.dismiss} />
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog Centered Modal Overlay */}
      {confirmDialogState.isOpen && confirmOptions && (
        <div
          className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md print:hidden no-print animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissConfirm(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="relative max-w-md w-full mx-auto bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/[0.12] rounded-3xl shadow-2xl shadow-slate-950/50 overflow-hidden p-6 sm:p-7 space-y-5 sm:space-y-6 animate-modal-content select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Icon & Category */}
            <div className="flex items-center justify-between pb-1">
              <div
                className={`p-3 rounded-2xl border ${
                  confirmOptions.variant === 'danger'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25 shadow-sm shadow-rose-500/10'
                    : confirmOptions.variant === 'warning'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 shadow-sm shadow-amber-500/10'
                    : 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/25 shadow-sm shadow-brand-500/10'
                }`}
              >
                {confirmOptions.variant === 'danger' ? (
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : confirmOptions.variant === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {confirmOptions.category && (
                <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]">
                  {confirmOptions.category}
                </span>
              )}
            </div>

            {/* Content Body */}
            <div className="space-y-2.5">
              <h3 id="confirm-dialog-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                {confirmOptions.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {confirmOptions.message}
              </p>
              {confirmOptions.detail && (
                <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed break-words max-h-28 overflow-y-auto">
                  {confirmOptions.detail}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 sm:pt-5 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => dismissConfirm(false)}
                className="px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {confirmOptions.cancelLabel || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => dismissConfirm(true)}
                autoFocus
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white shadow-lg transition-all active:scale-95 cursor-pointer ${
                  confirmOptions.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : confirmOptions.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/30'
                }`}
              >
                {confirmOptions.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default NotificationCenter;
