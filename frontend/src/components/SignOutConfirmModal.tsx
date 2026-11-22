import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X } from 'lucide-react';

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user?: {
    name?: string;
    username?: string;
    full_name?: string;
    role?: string;
    photoURL?: string;
    profile_photo?: string;
    department?: string;
    email?: string;
  } | null;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user
}) => {
  // Keyboard listeners: Escape to close, Enter to confirm
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onClose();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (typeof document === 'undefined') return null;

  const displayName = user?.full_name || user?.name || user?.username;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 select-none">
          {/* iOS Frosted backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 dark:bg-black/70 backdrop-blur-md cursor-pointer"
          />

          {/* iOS Cupertino Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[340px] rounded-[28px] bg-white/85 dark:bg-[#1c1c1e]/85 backdrop-blur-2xl backdrop-saturate-180 border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.6)] p-6 text-center z-10 space-y-4"
          >
            {/* Top Close Button (iOS Minimal) */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Apple Icon Container */}
            <div className="w-14 h-14 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/[0.05] dark:ring-rose-400/[0.08] shadow-inner">
              <LogOut className="w-6 h-6 ml-0.5" strokeWidth={2.2} />
            </div>

            {/* Title & iOS Subtext */}
            <div className="space-y-1.5">
              <h3 className="text-[19px] font-bold text-slate-900 dark:text-white tracking-tight">
                Sign Out?
              </h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 font-normal leading-normal">
                Are you sure you want to sign out of your account?
              </p>
              {displayName && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.08] text-[12px] font-medium text-slate-700 dark:text-slate-200 shadow-2xs">
                    Signed in as <strong className="font-semibold text-slate-900 dark:text-white">{displayName}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* iOS Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-[18px] bg-slate-200/80 hover:bg-slate-200 active:bg-slate-300/80 dark:bg-white/[0.12] dark:hover:bg-white/[0.18] dark:active:bg-white/[0.22] text-slate-800 dark:text-white text-[14px] font-semibold transition-all duration-150 cursor-pointer active:scale-[0.97]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
                className="flex-1 py-3 px-4 rounded-[18px] bg-[#ff3b30] hover:bg-[#e0342a] active:bg-[#c92820] text-white text-[14px] font-semibold shadow-md shadow-rose-500/25 transition-all duration-150 cursor-pointer active:scale-[0.97]"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
