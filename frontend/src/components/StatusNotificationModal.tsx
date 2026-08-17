import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

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
  useEffect(() => {
    if (notification?.isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (notification.onClose) notification.onClose();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [notification?.isOpen, onClose, notification]);

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
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
      tag: 'SUCCESS NOTIFICATION',
      tagCls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      iconContainerCls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      btnCls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 ring-emerald-500/20',
      borderGlow: 'border-emerald-500/30 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)]'
    },
    error: {
      icon: <XCircle className="w-8 h-8 text-rose-400" />,
      tag: 'SYSTEM ERROR NOTICE',
      tagCls: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      iconContainerCls: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      btnCls: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 ring-rose-500/20',
      borderGlow: 'border-rose-500/30 shadow-[0_20px_60px_-15px_rgba(244,63,94,0.25)]'
    },
    warning: {
      icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
      tag: 'VALIDATION WARNING',
      tagCls: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      iconContainerCls: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      btnCls: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/30 ring-amber-500/20',
      borderGlow: 'border-amber-500/30 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.25)]'
    },
    info: {
      icon: <Info className="w-8 h-8 text-indigo-400" />,
      tag: 'INFORMATION NOTICE',
      tagCls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
      iconContainerCls: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      btnCls: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 ring-indigo-500/20',
      borderGlow: 'border-indigo-500/30 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.25)]'
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={handleCancelClick}
    >
      {/* Modal Container Card */}
      <div
        className={`relative w-full max-w-[500px] max-h-[calc(100vh-3rem)] bg-slate-900/95 dark:bg-navy-900/95 backdrop-blur-2xl rounded-3xl border ${config.borderGlow} p-6 sm:p-8 text-center space-y-5 text-white animate-scaleUp transition-all shadow-2xl my-auto overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Top Close Icon */}
        <button
          onClick={handleCancelClick}
          aria-label="Close notification"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${config.iconContainerCls} shadow-inner`}>
            {config.icon}
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.tagCls}`}>
            {config.tag}
          </span>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h3 id="notif-modal-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
            {message}
          </p>
          {details && (
            <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-left font-mono text-[11px] text-gray-400 break-words max-h-32 overflow-y-auto">
              {details}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {isConfirm && (
            <button
              type="button"
              onClick={handleCancelClick}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-700 hover:border-gray-600 bg-slate-800/80 hover:bg-slate-800 text-gray-300 text-xs font-black transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={handlePrimaryClick}
            className={`py-2.5 px-6 rounded-xl text-xs font-black transition-all cursor-pointer ${isConfirm ? 'flex-1' : 'w-full'} ${config.btnCls}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
