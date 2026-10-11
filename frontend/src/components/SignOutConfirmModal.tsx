import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Lock, ArrowRight } from 'lucide-react';

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

  const displayName = user?.full_name || user?.name || user?.username || 'Authorized User';
  const username = user?.username || user?.name || 'admin';
  const photo = user?.photoURL || (user as any)?.profile_photo;
  const role = (user?.role || 'ADMIN').toUpperCase();
  const department = (user as any)?.department || 'Nandha Engineering College';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 select-none">
          {/* Backdrop with soft blur and dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
          />

          {/* Premium White Card Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[420px] rounded-[28px] bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.06)] p-6 sm:p-8 text-center z-10 overflow-hidden"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all cursor-pointer border border-slate-200/60"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Clean Security Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-600 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Institutional Security Checkpoint</span>
            </div>

            {/* Crisp Red Icon Container (Clean white/rose container, no messy background smudges) */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center mb-4 shadow-xs">
              <LogOut className="w-6 h-6 text-rose-600" />
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1.5 mb-5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Ready to Sign Out?
              </h3>
              <p className="text-xs text-slate-500 font-medium px-2 leading-relaxed">
                You're about to sign out of your institutional account on Nandha Intelligence.
              </p>
            </div>

            {/* Profile Information Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left mb-6 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={displayName}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-xs"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-base flex items-center justify-center uppercase shadow-xs">
                      {displayName[0]}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 truncate">
                      {displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                      {role}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-slate-500 truncate">
                      @{username}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {department}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Row */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Session Encrypted</span>
                </span>
                <span className="text-emerald-600 font-bold">Active</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
                className="w-full h-11 sm:h-12 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm shadow-[0_4px_14px_rgba(225,29,72,0.35)] hover:shadow-[0_6px_20px_rgba(225,29,72,0.45)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Sign Out Now</span>
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white/90 border border-white/20 ml-1">
                  ↵ Enter
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 sm:h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Stay Logged In</span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500">
                  Esc
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
