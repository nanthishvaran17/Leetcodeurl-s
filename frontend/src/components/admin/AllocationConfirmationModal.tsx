import React, { useEffect, useState } from 'react';
import { UserCheck, X, Check, AlertCircle, ArrowRight, RefreshCcw, Shield, Users, CheckCircle2 } from 'lucide-react';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';

export interface AllocationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  targetStaff: {
    id: number | string;
    username: string;
    email?: string;
    role?: string;
    department?: string;
    institutional_id?: string;
    assigned_count?: number;
  } | null;
  selectedCount: number;
  isSubmitting?: boolean;
}

export const AllocationConfirmationModal: React.FC<AllocationConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetStaff,
  selectedCount,
  isSubmitting: externalSubmitting = false
}) => {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitting = externalSubmitting || internalSubmitting;

  useEffect(() => {
    if (isOpen) {
      setSuccessState(false);
      setErrorMessage(null);
      setInternalSubmitting(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !targetStaff) return null;

  const handleExecuteConfirm = async () => {
    if (submitting) return;
    setInternalSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      setSuccessState(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'The students could not be assigned. No changes were committed.');
    } finally {
      setInternalSubmitting(false);
    }
  };

  const studentPlural = selectedCount === 1 ? 'student' : 'students';
  const roleDisplay = targetStaff.role || 'Staff / Faculty Mentor';

  return (
    <GlobalModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      className="flex items-center justify-center p-4"
    >
      <div 
        className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-navy-700 transition-all text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocation-modal-title"
        aria-describedby="allocation-modal-desc"
      >
        
        {/* 1. HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between bg-slate-50 dark:bg-navy-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="allocation-modal-title" className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white leading-none">
                ASSIGN STUDENTS
              </h2>
              <p id="allocation-modal-desc" className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Confirm student allocation
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close allocation modal"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. BODY CONTENT */}
        <div className="p-6 space-y-4">

          {/* SUCCESS STATE */}
          {successState ? (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Assignment Completed
              </h3>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {selectedCount} {studentPlural} assigned successfully to <strong className="text-indigo-600 dark:text-indigo-400">{targetStaff.username}</strong>.
              </p>
            </div>
          ) : (
            <>
              {/* TARGET STAFF CARD */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Target Mentor
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {targetStaff.username}
                    </h4>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                      {roleDisplay} {targetStaff.department ? `• ${targetStaff.department}` : ''}
                    </p>
                  </div>
                </div>

                {targetStaff.institutional_id && (
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                    {targetStaff.institutional_id}
                  </span>
                )}
              </div>

              {/* ASSIGNMENT SUMMARY STAT */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    Selected Students
                  </span>
                  <div className="flex items-baseline space-x-2 mt-0.5">
                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      {selectedCount}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">
                      {studentPlural}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-navy-900 border border-indigo-200 dark:border-navy-700 text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* CONFIRMATION DETAILS CHECKLIST */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-black">
                   
                  </span>
                  <span>{selectedCount} {studentPlural} selected for allocation</span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-black">
                   
                  </span>
                  <span>Assignment will be saved securely in database</span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-black">
                   
                  </span>
                  <span>Staff scope will update immediately</span>
                </div>
              </div>

              {/* INFORMATION CALLOUT TEXT */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-800 dark:text-amber-300 leading-snug">
                "This staff member will only be able to access students assigned to their mentoring portfolio."
              </div>

              {/* ERROR STATE INLINE PANEL */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-1 animate-fade-in text-left">
                  <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Assignment Failed</span>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300">
                    {errorMessage}
                  </p>
                </div>
              )}
            </>
          )}

        </div>

        {/* 3. FOOTER ACTIONS */}
        {!successState && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/60 flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleExecuteConfirm}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-brand-600 to-indigo-700 hover:from-indigo-500 hover:to-brand-500 text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : errorMessage ? (
                <>
                  <RefreshCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </>
              ) : (
                <>
                  <span>Confirm &amp; Assign</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </GlobalModalBackdrop>
  );
};
