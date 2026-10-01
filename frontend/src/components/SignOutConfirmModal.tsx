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
  } | null;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const displayName = user?.full_name || user?.name || user?.username || 'User';
  const username = user?.username || user?.name || '';
  const photo = user?.photoURL || (user as any)?.profile_photo;
  const role = user?.role || 'Session';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 select-none">
          {/* Backdrop with modern deep blur - removes washed-out flat gray look */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/65 dark:bg-navy-950/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[390px] rounded-3xl bg-white dark:bg-navy-950 border border-slate-200/90 dark:border-navy-700/80 shadow-2xl shadow-rose-500/10 dark:shadow-navy-950/80 p-6 sm:p-7 overflow-hidden text-center z-10 space-y-5"
          >
            {/* Ambient subtle glow background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-28 bg-rose-500/10 dark:bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Sign Out Glowing Icon */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-rose-500/20 dark:bg-rose-500/25 animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
                <LogOut className="w-7 h-7 stroke-[2.2]" />
              </div>
            </div>

            {/* Header & Subtitle */}
            <div className="space-y-1.5 relative z-10">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Sign Out Confirmation
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to sign out of your institutional account?
              </p>
            </div>

            {/* User Profile Card Preview */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/90 dark:bg-navy-900/80 border border-slate-200/80 dark:border-navy-800/80 text-left relative z-10">
              {photo ? (
                <img
                  src={photo}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border-2 border-brand-500 object-cover bg-white dark:bg-navy-950 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center uppercase shrink-0 shadow-xs">
                  {displayName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                    @{username || 'user'}
                  </span>
                  <span className="inline-flex px-1.5 py-0.2 text-[9px] font-black rounded uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white hover:bg-slate-100 dark:bg-navy-900 dark:hover:bg-navy-800 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white font-extrabold text-xs sm:text-[13px] transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm active:scale-95 flex items-center justify-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs sm:text-[13px] shadow-lg shadow-rose-600/30 hover:shadow-rose-600/45 transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center space-x-1.5"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Yes, Sign Out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
