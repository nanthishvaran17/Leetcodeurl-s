import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationState {
  isOpen: boolean;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  confirmText?: string;
  onConfirm?: () => void;
  onClose?: () => void;
  // If set, shows a two-button confirm dialog (e.g. for Delete)
  isConfirm?: boolean;
  cancelText?: string;
}

interface StatusNotificationModalProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export const StatusNotificationModal: React.FC<StatusNotificationModalProps> = ({
  notification,
  onClose
}) => {
  useScrollLock(Boolean(notification?.isOpen));

  useEffect(() => {
    if (notification?.isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (notification.onClose) notification.onClose();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [notification?.isOpen, onClose]);

  if (!notification || !notification.isOpen) return null;

  const {
    type,
    title,
    message,
    details,
    confirmText = 'OK',
    cancelText = 'Cancel',
    isConfirm = false,
    onConfirm
  } = notification;

  const config = {
    success: {
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
      tag: 'SUCCESS NOTIFICATION',
      tagCls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
      iconContainerCls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs',
      btnCls: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.98]',
      topAura: 'from-emerald-400/15 via-teal-400/10'
    },
    error: {
      icon: <XCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />,
      tag: 'SYSTEM ERROR NOTICE',
      tagCls: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400',
      iconContainerCls: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-xs',
      btnCls: 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-600/25 active:scale-[0.98]',
      topAura: 'from-rose-400/15 via-pink-400/10'
    },
    warning: {
      icon: <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      tag: 'VALIDATION WARNING',
      tagCls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
      iconContainerCls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs',
      btnCls: 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-lg shadow-amber-600/25 active:scale-[0.98]',
      topAura: 'from-amber-400/15 via-orange-400/10'
    },
    info: {
      icon: <Info className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />,
      tag: 'INFORMATION NOTICE',
      tagCls: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
      iconContainerCls: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-xs',
      btnCls: 'bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white shadow-lg shadow-indigo-600/25 active:scale-[0.98]',
      topAura: 'from-indigo-400/15 via-sky-400/10'
    }
  }[type];

  const handlePrimaryClick = () => {
    if (onConfirm) {
      onConfirm();
    }
    if (notification.onClose) {
      notification.onClose();
    }
    onClose();
  };

  const handleCancelClick = () => {
    if (notification.onClose) {
      notification.onClose();
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-modal-backdrop select-none"
      onClick={handleCancelClick}
    >
      {/* Modal Container Card / Mobile Bottom Sheet — Solid 100% Opaque Pure White in Light Mode */}
      <div
        className="relative w-full max-w-full sm:max-w-[460px] bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-slate-200 dark:border-slate-800 p-6 pb-8 sm:p-8 text-center space-y-5 text-slate-900 dark:text-white animate-modal-content transition-all shadow-2xl overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Ambient Pastel Glow Arc */}
        <div className={`absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-36 rounded-full bg-gradient-to-b ${config.topAura} to-transparent blur-3xl pointer-events-none`} />

        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2" />

        {/* Subtle Top Close Icon */}
        <button
          onClick={handleCancelClick}
          aria-label="Close notification"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${config.iconContainerCls}`}>
            {config.icon}
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.tagCls}`}>
            {config.tag}
          </span>
        </div>

        {/* Text Content */}
        <div className="relative z-10 space-y-2">
          <h3 id="notif-modal-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {message}
          </p>
          {details && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 text-left font-mono text-[11px] text-slate-600 dark:text-slate-400 break-words max-h-32 overflow-y-auto">
              {details}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="relative z-10 flex items-center justify-center gap-3 pt-2">
          {isConfirm && (
            <button
              type="button"
              onClick={handleCancelClick}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black transition-all cursor-pointer active:scale-[0.98]"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={handlePrimaryClick}
            className={`py-3 px-6 rounded-xl text-xs font-black transition-all cursor-pointer ${isConfirm ? 'flex-1' : 'w-full'} ${config.btnCls}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
