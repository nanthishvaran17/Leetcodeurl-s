import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../services/api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-navy-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Data Sync Execution History</h2>
              <p className="text-xs font-bold text-gray-500">Historical execution logs from the 24/7 background sync engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading && history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs font-bold flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              <span>Fetching sync history logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs font-bold">
              No historical sync jobs recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((job) => (
                <div
                  key={job.job_id || job.id}
                  className="p-4 rounded-2xl bg-white dark:bg-navy-950 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-gray-900 dark:text-white font-mono">{job.job_id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : job.status === 'RUNNING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        ● {job.status}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Triggered by: {job.triggered_by}</span>
                    </div>
                    <p className="text-gray-500 font-bold text-[11px]">
                      Started: {job.started_at_formatted || job.started_at || 'Unknown'}
                      {job.duration_seconds && ` • Duration: ${job.duration_seconds}s`}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 text-center">
                    <div className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-navy-900 border">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Total</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{job.total_records}</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300">
                      <p className="text-[9px] font-bold uppercase">Success</p>
                      <p className="text-sm font-black">{job.success_count}</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-700 dark:text-amber-300">
                      <p className="text-[9px] font-bold uppercase">Pending</p>
                      <p className="text-sm font-black">{job.partial_count}</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300">
                      <p className="text-[9px] font-bold uppercase">Failed</p>
                      <p className="text-sm font-black">{job.error_count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-navy-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-navy-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-bold text-xs transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
