import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Loader2,
  X,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { useNotification, ToastNotification } from '../context/NotificationContext';

const ToastItem: React.FC<{ toast: ToastNotification; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(toast.duration || 4500);

  useEffect(() => {
    if (!toast.duration || toast.duration === 0) return;

    let intervalId: any = null;
    const duration = toast.duration;

    if (!isPaused) {
      const step = 50;
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
          bg: 'bg-white dark:bg-navy-900 border-emerald-500/30 dark:border-emerald-500/30',
          badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: CheckCircle2,
          iconColor: 'text-emerald-500',
          progressBg: 'bg-emerald-500',
          defaultCategory: 'SUCCESS',
        };
      case 'error':
        return {
          bg: 'bg-white dark:bg-navy-900 border-rose-500/30 dark:border-rose-500/30',
          badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          icon: XCircle,
          iconColor: 'text-rose-500',
          progressBg: 'bg-rose-500',
          defaultCategory: 'SYSTEM ERROR',
        };
      case 'warning':
        return {
          bg: 'bg-white dark:bg-navy-900 border-amber-500/30 dark:border-amber-500/30',
          badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: AlertTriangle,
          iconColor: 'text-amber-500',
          progressBg: 'bg-amber-500',
          defaultCategory: 'ATTENTION REQUIRED',
        };
      case 'ai':
        return {
          bg: 'bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 border-brand-500/40 text-white',
          badgeBg: 'bg-brand-500/20 text-brand-300 border-brand-400/30',
          icon: Sparkles,
          iconColor: 'text-amber-400 animate-pulse',
          progressBg: 'bg-gradient-to-r from-brand-400 to-amber-400',
          defaultCategory: 'NEC UNIFIED AI',
        };
      case 'loading':
        return {
          bg: 'bg-white dark:bg-navy-900 border-brand-500/30 dark:border-brand-500/30',
          badgeBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
          icon: Loader2,
          iconColor: 'text-brand-500 animate-spin',
          progressBg: 'bg-brand-500',
          defaultCategory: 'PROCESSING',
        };
      case 'info':
      default:
        return {
          bg: 'bg-white dark:bg-navy-900 border-indigo-500/30 dark:border-indigo-500/30',
          badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: Info,
          iconColor: 'text-indigo-500',
          progressBg: 'bg-indigo-500',
          defaultCategory: 'INFORMATION',
        };
    }
  };

  const style = getStyleProps();
  const IconComponent = style.icon;

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-2xl p-4 shadow-2xl border backdrop-blur-xl transition-all duration-300 transform hover:-translate-y-0.5 ${style.bg}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${style.badgeBg}`}>
          <IconComponent className={`w-4 h-4 ${style.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0 pr-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-400">
              {toast.category || style.defaultCategory}
            </span>
            <span className="text-[10px] text-gray-400 font-bold shrink-0">{toast.timestamp}</span>
          </div>

          <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-snug tracking-tight">
            {toast.title}
          </h4>

          {toast.description && (
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
              {toast.description}
            </p>
          )}

          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                onDismiss(toast.id);
              }}
              className="mt-1.5 inline-flex items-center text-xs font-black text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors shrink-0 cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-dismiss Progress Bar */}
      {toast.duration && toast.duration > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-navy-950 overflow-hidden">
          <div
            className={`h-full transition-all ease-linear ${style.progressBg}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
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
      {/* Toast Notification Stack Container */}
      <div
        className="fixed top-16 sm:top-20 right-3 sm:right-6 z-[100000] flex flex-col space-y-3 w-[calc(100vw-24px)] sm:w-96 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={notify.dismiss} />
        ))}
      </div>

      {/* Confirmation Dialog Centered Modal Overlay */}
      {confirmDialogState.isOpen && confirmOptions && (
        <div
          className="modal-overlay-responsive animate-modal-backdrop z-[99900]"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissConfirm(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="modal-container-responsive max-w-[520px] bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-5 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Icon */}
            <div className="flex items-center justify-between">
              <div
                className={`p-3 rounded-2xl border ${
                  confirmOptions.variant === 'danger'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : confirmOptions.variant === 'warning'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20'
                }`}
              >
                {confirmOptions.variant === 'danger' ? (
                  <ShieldAlert className="w-7 h-7" />
                ) : confirmOptions.variant === 'warning' ? (
                  <AlertTriangle className="w-7 h-7" />
                ) : (
                  <HelpCircle className="w-7 h-7" />
                )}
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {confirmOptions.category || 'CONFIRMATION REQUIRED'}
              </span>
            </div>

            {/* Content Body */}
            <div className="space-y-2">
              <h3 id="confirm-dialog-title" className="text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-tight">
                {confirmOptions.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                {confirmOptions.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100 dark:border-navy-800">
              <button
                type="button"
                onClick={() => dismissConfirm(false)}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
              >
                {confirmOptions.cancelLabel || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => dismissConfirm(true)}
                autoFocus
                className={`px-6 py-2.5 rounded-2xl text-xs font-black text-white shadow-lg transition-all transform hover:scale-105 cursor-pointer ${
                  confirmOptions.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                    : confirmOptions.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30'
                }`}
              >
                {confirmOptions.confirmLabel || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
