import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useScrollLock } from '../hooks/useScrollLock';
import { SwipeHandle } from './SwipeHandle';

interface SyncJobHistoryItem {
  id: number;
  job_id: string;
  job_type: string;
  status: string;
  triggered_by: string;
  started_at: string | null;
  started_at_formatted: string | null;
  completed_at: string | null;
  completed_at_formatted: string | null;
  duration_seconds: number | null;
  total_records: number;
  success_count: number;
  partial_count: number;
  error_count: number;
}

interface SyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<SyncJobHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useScrollLock(isOpen);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sync/history');
      if (Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error("Failed to load sync history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay-responsive animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-container-responsive max-w-4xl bg-white dark:bg-navy-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-modal-content overflow-hidden flex flex-col">
        
        {/* Mobile Swipe Handle */}
        <SwipeHandle onClose={onClose} className="pt-2 pb-0 block sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/50 shrink-0 safe-area-pt">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">Data Sync Execution History</h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">Historical execution logs from the 24/7 background sync engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors active-spring touch-manipulation cursor-pointer"
              title="Refresh logs"
              aria-label="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors active-spring touch-manipulation cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
          {loading && history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              <span>Fetching sync history logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold">
              No historical sync jobs recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((job) => (
                <div
                  key={job.job_id || job.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">{job.job_id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : job.status === 'RUNNING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                         {job.status}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase truncate">By: {job.triggered_by}</span>
                    </div>
                    <p className="text-slate-500 font-bold text-[11px]">
                      Started: {job.started_at_formatted || job.started_at || 'Unknown'}
                      {job.duration_seconds && ` • Duration: ${job.duration_seconds}s`}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center shrink-0">
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200/60 dark:border-navy-800">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                      <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono">{job.total_records}</p>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300">
                      <p className="text-[9px] font-bold uppercase">OK</p>
                      <p className="text-xs sm:text-sm font-black font-mono">{job.success_count}</p>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-300">
                      <p className="text-[9px] font-bold uppercase">Pending</p>
                      <p className="text-xs sm:text-sm font-black font-mono">{job.partial_count}</p>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-300">
                      <p className="text-[9px] font-bold uppercase">Err</p>
                      <p className="text-xs sm:text-sm font-black font-mono">{job.error_count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/50 flex justify-end shrink-0 safe-area-pb">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors active-spring touch-manipulation cursor-pointer text-center"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
