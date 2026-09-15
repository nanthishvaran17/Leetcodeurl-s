import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, X, RefreshCw, Download, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { DownloadState } from '../services/download/downloadTypes';

interface ExportStatusProps {
  state: DownloadState | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export const ExportStatus: React.FC<ExportStatusProps> = ({ state, onRetry, onClose }) => {
  if (!state || state.status === 'IDLE') return null;

  const isFailed = state.status === 'FAILED';
  const isGenerating = ['GENERATING', 'PROCESSING', 'QUEUED'].includes(state.status);
  const isCompleted = state.status === 'COMPLETED';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] right-4 left-4 sm:left-auto z-[100060] p-4 sm:p-5 bg-slate-950/90 dark:bg-navy-950/90 backdrop-blur-xl rounded-3xl shadow-[0_12px_40px_rgba(15,23,42,0.6)] text-white max-w-[calc(100vw-2rem)] sm:max-w-md w-full border border-brand-500/40 font-sans overflow-hidden"
      >
        {/* Glowing Top Ambient Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 animate-pulse" />

        {/* Floating Radial Background Glows */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-brand-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3.5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-2xl shrink-0 ${
                isFailed 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : isCompleted 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                  : 'bg-brand-500/20 text-brand-400 border border-brand-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
              }`}>
                {isFailed ? (
                  <AlertTriangle size={20} className="animate-bounce" />
                ) : isCompleted ? (
                  <CheckCircle2 size={20} className="animate-pulse text-emerald-400" />
                ) : (
                  <FileSpreadsheet size={20} className="animate-pulse text-brand-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-indigo-200">
                    INSTANT REPORT ENGINE
                  </span>
                </div>
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate mt-0.5">
                  {isFailed ? 'Report Generation Alert' : isGenerating ? 'Preparing Data Report...' : 'Report Download Complete'}
                </h3>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Generating Animated State */}
          {isGenerating && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping absolute" />
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                  </div>
                  <span className="font-semibold text-slate-200">Compiling high-contrast metrics...</span>
                </div>
                <span className="text-[11px] font-mono text-brand-300 font-bold">processing</span>
              </div>

              {/* Glowing Shimmer Progress Bar */}
              <div className="relative w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 shadow-[0_0_12px_rgba(59,130,246,0.8)] relative"
                  initial={{ width: '15%' }}
                  animate={{ width: ['20%', '85%', '95%'] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                </motion.div>
              </div>
            </div>
          )}

          {/* Failed State */}
          {isFailed && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-300 leading-relaxed">
                We couldn't compile the requested report right now. Please verify backend connection and try again.
              </p>

              <div className="flex items-center gap-2 pt-1">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Retry Download</span>
                  </button>
                )}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <Sparkles size={14} className="text-emerald-400 animate-spin" />
                <span>Your file has been generated and saved cleanly.</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
