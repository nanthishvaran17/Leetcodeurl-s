import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, AlertTriangle } from 'lucide-react';

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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 select-none perspective-[1000px]">
          {/* Enhanced Backdrop with deep blur and overlay */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 cursor-pointer"
          />

          {/* Premium Glassmorphic Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20, rotateX: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20, rotateX: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[420px] rounded-[2rem] bg-white/95 dark:bg-navy-950/95 backdrop-blur-2xl border border-slate-200/80 dark:border-navy-800/80 shadow-2xl p-8 overflow-hidden text-center z-10"
          >
            {/* Subtle Ambient Background Light (Clean & Non-distracting) */}
            <div className="absolute -top-24 -left-24 w-56 h-56 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-[70px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-[70px] pointer-events-none" />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-navy-900 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800 transition-all cursor-pointer shadow-sm z-20 hover:scale-105 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Sign Out Icon Container - Clean & Crisp */}
            <div className="relative mx-auto w-16 h-16 sm:w-18 sm:h-18 mb-6 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-center shadow-xs">
                <LogOut className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
            </div>

            {/* Header & Subtitle */}
            <div className="space-y-2 mb-8 relative z-10">
              <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                Ready to leave?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-4">
                You're about to sign out of your institutional account.
              </p>
            </div>

            {/* Premium User Profile Card */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-navy-900/60 backdrop-blur-md border border-white dark:border-navy-700/50 shadow-sm text-left relative z-10 mb-8 transform transition-transform duration-300 hover:scale-[1.02]">
              <div className="relative">
                {photo ? (
                  <img
                    src={photo}
                    alt={displayName}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-navy-800 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-lg flex items-center justify-center uppercase shadow-md ring-2 ring-white dark:ring-navy-800">
                    {displayName[0]}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-navy-900 shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">
                    @{username || 'user'}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 relative z-10">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
                className="group relative w-full h-12 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-sm shadow-[0_8px_20px_-6px_rgba(225,29,72,0.5)] transition-all duration-300 cursor-pointer overflow-hidden flex items-center justify-center space-x-2"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                
                <span className="relative z-10">Sign Out Now</span>
                <LogOut className="w-4 h-4 relative z-10 transform group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-xl bg-slate-100/80 dark:bg-navy-900/80 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 font-extrabold text-sm transition-all duration-200 cursor-pointer backdrop-blur-sm"
              >
                Stay Logged In
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
