import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X, RefreshCw, Loader2, ArrowDownToLine, ServerOff, FileSpreadsheet, ShieldAlert } from 'lucide-react';
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

  // Auto-dismiss completed state after 5 seconds
  useEffect(() => {
    if (isCompleted && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onClose]);

  if (!state || state.status === 'IDLE') return null;

  const isConnectionIssue = Boolean(
    state.error && (
      state.error.toLowerCase().includes('econnrefused') ||
      state.error.toLowerCase().includes('connection refused') ||
      state.error.toLowerCase().includes('offline') ||
      state.error.toLowerCase().includes('unreachable') ||
      state.error.toLowerCase().includes('network error')
    )
  );

  const isAuthIssue = state.status === 'UNAUTHORIZED' || state.status === 'FORBIDDEN';

  const title = isFailed
    ? (isConnectionIssue ? 'Server Connection Offline' : isAuthIssue ? 'Access Denied' : 'Generation Interrupted')
    : isCompleted
    ? 'Report Ready'
    : isDownloading
    ? 'Downloading Report...'
    : isPreparing
    ? 'Preparing High-Res Data'
    : 'Generating Report...';

  const friendlyMessage = isConnectionIssue
    ? 'Unable to connect to the backend server (127.0.0.1:8000). Please ensure the backend service is running or verify your network.'
    : state.error || "We couldn't compile the requested report right now. Please verify your connection and try again.";

  const technicalDetail = state.technicalDetail || (
    state.error && state.error.toLowerCase().includes('econnrefused')
      ? state.error
      : undefined
  );

  const getStyleTheme = () => {
    if (isFailed) {
      return {
        ambientGlow: 'from-rose-500/25 via-pink-500/10',
        borderColor: 'border-rose-500/40 dark:border-rose-500/30',
        ringGlow: 'shadow-[0_12px_40px_-8px_rgba(244,63,94,0.35)]',
        badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
        categoryTag: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-800/60',
        progressBar: 'bg-gradient-to-r from-rose-500 to-red-400',
        icon: isConnectionIssue ? ServerOff : isAuthIssue ? ShieldAlert : AlertTriangle,
        iconColor: 'text-rose-600 dark:text-rose-400',
      };
    }
    if (isCompleted) {
      return {
        ambientGlow: 'from-emerald-500/25 via-teal-500/10',
        borderColor: 'border-emerald-500/40 dark:border-emerald-500/30',
        ringGlow: 'shadow-[0_12px_40px_-8px_rgba(16,185,129,0.35)]',
        badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        categoryTag: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/60',
        progressBar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400',
        icon: CheckCircle2,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (isDownloading) {
      return {
        ambientGlow: 'from-brand-500/25 via-indigo-500/10',
        borderColor: 'border-brand-500/40 dark:border-brand-500/30',
        ringGlow: 'shadow-[0_12px_40px_-8px_rgba(99,102,241,0.3)]',
        badgeBg: 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/25',
        categoryTag: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 border-brand-200/80 dark:border-brand-800/60',
        progressBar: 'bg-gradient-to-r from-brand-500 via-indigo-500 to-blue-400',
        icon: ArrowDownToLine,
        iconColor: 'text-brand-600 dark:text-brand-400',
      };
    }
    return {
      ambientGlow: 'from-indigo-500/25 via-sky-500/10',
      borderColor: 'border-indigo-500/40 dark:border-indigo-500/30',
      ringGlow: 'shadow-[0_12px_40px_-8px_rgba(99,102,241,0.3)]',
      badgeBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
      categoryTag: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-800/60',
      progressBar: 'bg-gradient-to-r from-indigo-500 via-sky-400 to-brand-400',
      icon: Loader2,
      iconColor: 'text-indigo-600 dark:text-indigo-400 animate-spin',
    };
  };

  const theme = getStyleTheme();
  const IconComponent = theme.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.94, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, scale: 0.92, filter: 'blur(2px)', transition: { duration: 0.18, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 480, damping: 30 }}
        className={`fixed top-[calc(env(safe-area-inset-top,0px)+3.85rem)] sm:top-[4.25rem] left-3 sm:left-auto right-3 sm:right-6 z-[100060] bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl text-slate-800 dark:text-white max-w-[calc(100vw-1.5rem)] sm:max-w-md w-full border ${theme.borderColor} ${theme.ringGlow} font-sans overflow-hidden select-none`}
        role="alert"
        aria-live="assertive"
      >
        {/* Soft Ambient Pastel Glow Arc */}
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-24 rounded-full bg-gradient-to-b ${theme.ambientGlow} to-transparent blur-2xl pointer-events-none opacity-70`} />

        <div className="relative z-10 p-3.5 sm:p-4.5 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2.5 rounded-2xl border shrink-0 mt-0.5 shadow-xs ${theme.badgeBg}`}>
                <IconComponent className={`w-4.5 h-4.5 ${theme.iconColor}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0 ${theme.categoryTag}`}>
                    INSTANT REPORT ENGINE
                  </span>
                  {state.status === 'QUEUED' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 uppercase">
                      Queued
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight mt-1 leading-snug">
                  {title}
                </h3>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer active:scale-90"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="pl-11 sm:pl-12 space-y-2.5">
            {/* Generating / Preparing / Downloading State */}
            {isGenerating && !isCompleted && !isFailed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {isDownloading
                      ? (state.progress ? `Saving file... ${state.progress}%` : (state.filename ? `Saving ${state.filename}...` : 'Downloading file...'))
                      : (state.status === 'AUTHENTICATING' ? 'Authenticating institutional token...' : 'Compiling verified student records...')}
                  </span>
                  {state.progress ? (
                    <span className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono shrink-0 ml-2">
                      {state.progress}%
                    </span>
                  ) : null}
                </div>

                {/* Shimmer Animated Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-slate-200/50 dark:border-white/[0.06]">
                  <motion.div
                    className={`h-full rounded-full ${theme.progressBar} relative`}
                    initial={{ width: '0%' }}
                    animate={{ width: state.progress ? `${state.progress}%` : ['15%', '65%', '92%'] }}
                    transition={state.progress ? { duration: 0.3 } : { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  >
                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Failed State */}
            {isFailed && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {friendlyMessage}
                </p>

                {technicalDetail && (
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all select-text">
                    <span className="font-bold text-rose-600 dark:text-rose-400 mr-1.5">Error:</span>
                    {technicalDetail}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-black shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Completed State */}
            {isCompleted && (
              <div className="space-y-1.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
                  Institutional report exported successfully and saved to your downloads.
                </p>
                {state.filename && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono text-[11px] truncate max-w-full">
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{state.filename}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportStatus;
