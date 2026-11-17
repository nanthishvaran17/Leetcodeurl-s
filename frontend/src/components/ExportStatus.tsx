import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X, RefreshCw, Loader2, ArrowDownToLine } from 'lucide-react';
import { DownloadState } from '../services/download/downloadTypes';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ExportStatusProps {
  state: DownloadState | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export const ExportStatus: React.FC<ExportStatusProps> = ({ state, onRetry, onClose }) => {
  useEscapeKey(onClose, Boolean(onClose && state && state.status !== 'IDLE'));

  const isFailed = Boolean(
    state && ['FAILED', 'CANCELLED', 'EXPIRED', 'UNAUTHORIZED', 'FORBIDDEN'].includes(state.status)
  );
  const isCompleted = state?.status === 'COMPLETED';
  const isDownloading = state?.status === 'DOWNLOADING';
  const isPreparing = Boolean(
    state && ['PREPARING', 'AUTHENTICATING', 'READY', 'STARTED'].includes(state.status)
  );
  const isGenerating = Boolean(
    state && (['GENERATING', 'PROCESSING', 'QUEUED'].includes(state.status) || isPreparing || isDownloading)
  );

  // Auto-dismiss completed state after 4.5 seconds so it doesn't block the screen
  useEffect(() => {
    if (isCompleted && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onClose]);

  if (!state || state.status === 'IDLE') return null;

  const title = isFailed
    ? (state.status === 'UNAUTHORIZED' || state.status === 'FORBIDDEN' ? 'Access Denied' : 'Generation Interrupted')
    : isCompleted
    ? 'Download Complete'
    : isDownloading
    ? 'Downloading Report...'
    : isPreparing
    ? 'Preparing Data Report'
    : 'Generating Report...';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] sm:bottom-auto sm:top-[4.25rem] right-3 left-3 sm:left-auto sm:right-6 z-[100060] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-slate-950/60 text-slate-800 dark:text-white max-w-[calc(100vw-1.5rem)] sm:max-w-[420px] w-full border border-slate-200/90 dark:border-white/[0.14] font-sans overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10"
      >
        {/* Subtle premium gradient background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-brand-500/5 dark:from-indigo-500/10 dark:to-brand-500/10 pointer-events-none" />
        
        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-300/60 dark:via-white/25 to-transparent opacity-60" />

        <div className="relative z-10 p-3.5 sm:p-5 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
                isFailed 
                  ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30' 
                  : isCompleted 
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30' 
                  : isDownloading
                  ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/20 dark:border-brand-500/30'
                  : 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30'
              }`}>
                {isFailed ? (
                  <AlertTriangle size={18} strokeWidth={2.5} />
                ) : isCompleted ? (
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                ) : isDownloading ? (
                  <ArrowDownToLine size={18} strokeWidth={2.5} className="animate-bounce" />
                ) : (
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                )}
              </div>

              <div className="min-w-0 flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                  Instant Report Engine
                </span>
                <h3 className="font-extrabold text-sm sm:text-[15px] text-slate-900 dark:text-white tracking-tight truncate">
                  {title}
                </h3>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 -mt-1 -mr-1 active-spring touch-manipulation cursor-pointer"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="pl-11 sm:pl-12">
            {/* Generating / Preparing / Downloading State */}
            {isGenerating && !isCompleted && !isFailed && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[12.5px] sm:text-[13px]">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
                    <Loader2 size={13} className="animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="font-medium tracking-wide truncate">
                      {isDownloading
                        ? (state.progress ? `Saving file... ${state.progress}%` : (state.filename ? `Saving ${state.filename}...` : 'Downloading file...'))
                        : (state.status === 'AUTHENTICATING' ? 'Authenticating request...' : 'Compiling high-contrast metrics...')}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 border border-brand-200/60 dark:border-transparent px-2 py-0.5 rounded-md shrink-0 ml-2">
                    {isDownloading ? 'Downloading' : state.status === 'QUEUED' ? 'Queued' : 'Processing'}
                  </span>
                </div>

                {/* Sleek Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-full h-1.5 overflow-hidden border border-slate-200/50 dark:border-transparent">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-brand-500 dark:from-blue-500 dark:to-brand-400 relative"
                    initial={{ width: '0%' }}
                    animate={{ width: state.progress ? `${state.progress}%` : ['20%', '60%', '90%'] }}
                    transition={state.progress ? { duration: 0.3 } : { repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Failed State */}
            {isFailed && (
              <div className="space-y-3">
                <p className="text-[12.5px] sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {state.error || "We couldn't compile the requested report right now. Please verify your connection and try again."}
                </p>

                <div className="flex items-center gap-2.5">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-[12px] sm:text-[13px] font-bold shadow-sm transition-all flex items-center gap-1.5 active-spring cursor-pointer"
                    >
                      <RefreshCw size={13} strokeWidth={2.5} />
                      <span>Retry</span>
                    </button>
                  )}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[12px] sm:text-[13px] font-bold transition-all active-spring cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Completed State */}
            {isCompleted && (
              <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 rounded-xl p-2.5 sm:p-3">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] sm:text-[13px] text-emerald-900 dark:text-emerald-200/90 font-medium leading-snug">
                    Your report has been successfully generated and is ready for review.
                  </p>
                  {state.filename && (
                    <p className="mt-1 text-[11px] font-mono text-emerald-700/90 dark:text-emerald-300/80 truncate">
                      {state.filename}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

