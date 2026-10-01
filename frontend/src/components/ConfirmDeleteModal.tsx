import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
      document.body.style.overflow = 'hidden';
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
        document.body.style.overflow = '';
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !item || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/65 dark:bg-navy-950/80 backdrop-blur-md animate-modal-backdrop select-none"
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
        className="relative w-full max-w-[500px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl border-t-[3.5px] border-t-rose-500 animate-modal-content text-white p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-30 cursor-pointer z-10"
          title="Close dialog (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6 space-y-4 text-center overflow-y-auto">
          
          {/* Top Circular Warning Icon */}
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner shadow-rose-500/10">
            <Trash2 className="w-6 h-6" />
          </div>

          {/* Micro Status Label & Title */}
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 inline-block px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
              DESTRUCTIVE ACTION • ADMIN CONTROL
            </span>
            <h3 id="confirm-delete-title" className="text-base sm:text-xl font-black text-white tracking-tight">
              {item.type ? `Delete ${item.type}?` : (item.title?.includes('Snapshot') ? 'Delete Snapshot?' : 'Confirm Deletion?')}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              {item.subtitle || `You are about to permanently remove ${item.title || 'this item'} from the system.`}
            </p>
          </div>

          {/* Snapshot / Item Information Card */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">Item ID</span>
              <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 truncate max-w-[200px]">
                {item.id}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">Title / Target</span>
              <span className="font-bold text-slate-200 text-[11px] truncate max-w-[220px] text-right" title={item.title}>{item.title}</span>
            </div>

            {item.metrics && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">Metrics / Scope</span>
                <span className="font-bold text-emerald-400 text-[11px] truncate max-w-[200px] text-right">{item.metrics}</span>
              </div>
            )}

            {item.created_at && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">Timestamp</span>
                <span className="text-slate-400 font-medium text-[10px] truncate">{item.created_at}</span>
              </div>
            )}
          </div>

          {/* Warning Banner */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center space-x-2 text-left">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[10.5px] font-bold text-amber-300/90 leading-snug">
              This action is permanent and cannot be undone.
            </p>
          </div>

          {/* Error Message if API fails */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold text-left space-y-1">
              <p>Unable to complete deletion. {errorMessage}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-[10px] underline text-white hover:text-rose-200 font-black cursor-pointer"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Action Buttons with 44px+ mobile touch targets */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 active:scale-95 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};
