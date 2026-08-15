import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface DeleteItemInfo {
  id: string;
  title: string;
  type?: string;
  subtitle?: string;
  metrics?: string;
  created_at?: string;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  item: DeleteItemInfo | null;
  isDeleting: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  item,
  isDeleting,
  errorMessage,
  onConfirm,
  onCancel,
  onRetry
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button for safe keyboard accessibility
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isDeleting) {
          onCancel();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#07111E]/70 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div
        className="relative w-full max-w-[490px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-t-[3.5px] border-t-rose-500 overflow-hidden transform transition-all animate-scaleUp text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
          title="Close dialog (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-7 sm:p-8 space-y-6 text-center">
          
          {/* Top Circular Warning Icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner shadow-rose-500/10">
            <Trash2 className="w-7 h-7" />
          </div>

          {/* Micro Status Label & Title */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 inline-block px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
              DESTRUCTIVE ACTION • ADMIN CONTROL
            </span>
            <h3 id="confirm-delete-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Delete HOD Snapshot?
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              You are about to permanently remove this HOD snapshot from the Admin Control Center registry.
            </p>
          </div>

          {/* Snapshot Information Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Snapshot ID</span>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {item.id}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Title / Type</span>
              <span className="font-bold text-slate-200">{item.title}</span>
            </div>

            {item.metrics && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Verified Metrics</span>
                <span className="font-bold text-emerald-400">{item.metrics}</span>
              </div>
            )}

            {item.created_at && (
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Captured At</span>
                <span className="text-slate-400 font-medium">{item.created_at}</span>
              </div>
            )}
          </div>

          {/* Warning Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center space-x-2.5 text-left">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] font-bold text-amber-300/90 leading-snug">
              This action is permanent and cannot be undone.
            </p>
          </div>

          {/* Error Message if API fails */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold text-left space-y-1">
              <p>Unable to delete HOD snapshot. {errorMessage}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-[11px] underline text-white hover:text-rose-200 font-black cursor-pointer"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 transform hover:scale-[1.02]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting Snapshot...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Snapshot</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
