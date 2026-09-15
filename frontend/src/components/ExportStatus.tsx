import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, X, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
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
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] right-4 left-4 sm:left-auto z-[100060] bg-slate-900/85 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-950/50 text-white max-w-[calc(100vw-2rem)] sm:max-w-[420px] w-full border border-white/[0.08] font-sans overflow-hidden"
      >
        {/* Subtle premium gradient background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-brand-500/5 pointer-events-none" />
        
        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

        <div className="relative z-10 p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-2xl flex items-center justify-center shrink-0 ${
                isFailed 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : isCompleted 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
              }`}>
                {isFailed ? (
                  <AlertTriangle size={18} strokeWidth={2.5} />
                ) : isCompleted ? (
                  <CheckCircle2 size={18} strokeWidth={2.5} className="text-emerald-400" />
                ) : (
                  <FileSpreadsheet size={18} strokeWidth={2.5} className="text-brand-400" />
                )}
              </div>

              <div className="min-w-0 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                  Instant Report Engine
                </span>
                <h3 className="font-bold text-sm sm:text-[15px] text-white tracking-tight truncate">
                  {isFailed ? 'Generation Interrupted' : isGenerating ? 'Preparing Data Report' : 'Download Complete'}
                </h3>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors shrink-0 -mt-1 -mr-1"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="pl-14">
            {/* Generating State */}
            {isGenerating && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader2 size={14} className="animate-spin text-brand-400" />
                    <span className="font-medium tracking-wide">Compiling high-contrast metrics...</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">Processing</span>
                </div>

                {/* Sleek Progress Bar */}
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-brand-400 relative"
                    initial={{ width: '0%' }}
                    animate={{ width: ['20%', '60%', '90%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Failed State */}
            {isFailed && (
              <div className="space-y-4">
                <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                  We couldn't compile the requested report right now. Please verify your connection and try again.
                </p>

                <div className="flex items-center gap-3">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-[13px] font-bold shadow-sm transition-all flex items-center gap-2"
                    >
                      <RefreshCw size={14} strokeWidth={2.5} />
                      <span>Retry Request</span>
                    </button>
                  )}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] font-bold transition-all"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Completed State */}
            {isCompleted && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/10 rounded-xl p-3">
                <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[13px] text-emerald-100/90 font-medium leading-snug">
                  Your report has been successfully generated and is ready for review.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

