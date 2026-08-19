import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, RefreshCw, ExternalLink, ShieldAlert, UserCheck } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

interface FailedStudentItem {
  student_id: number;
  reg_no: string;
  name: string;
  department: string;
  year_level: string;
  username: string;
  leetcode_url: string;
  sync_status: string;
  error_code: string;
  error_message: string;
  retry_count: number;
  last_attempt_at: string | null;
  last_attempt_at_formatted: string | null;
  last_successful_sync: string | null;
  last_successful_sync_formatted: string | null;
}

interface FailedSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent?: (studentId: number) => void;
}

export const FailedSyncModal: React.FC<FailedSyncModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useNotification();
  const [failedStudents, setFailedStudents] = useState<FailedStudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchFailedStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sync/failed-students');
      if (Array.isArray(res.data)) {
        setFailedStudents(res.data);
      }
    } catch (err) {
      console.error("Failed to load sync failed students", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFailedStudents();
    }
  }, [isOpen]);

  const handleRetryStudent = async (studentId: number) => {
    setRetryingId(studentId);
    notify.info('Retrying Sync', `Re-evaluating student #${studentId}...`, { category: 'SYNC RETRY' });
    try {
      await api.post(`/sync/student/${studentId}`);
      notify.success('Sync Retry Succeeded', 'Student profile statistics updated.', { category: 'SYNC RETRY' });
      await fetchFailedStudents();
    } catch (err) {
      console.error("Retry failed", err);
      notify.error('Retry Failed', "Failed to sync student. Please check username / link.", { category: 'SYNC RETRY' });
    } finally {
      setRetryingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-responsive animate-modal-backdrop">
      <div className="modal-container-responsive max-w-5xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-modal-content">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-navy-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Sync Failure Audit ({failedStudents.length} Students)</h2>
              <p className="text-xs font-bold text-gray-500">Transparent error diagnostics — attendance remains evidence-backed</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchFailedStudents}
              disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
              title="Refresh list"
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
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading && failedStudents.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs font-bold flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              <span>Checking database for failed sync records...</span>
            </div>
          ) : failedStudents.length === 0 ? (
            <div className="py-12 text-center text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center space-y-2">
              <UserCheck className="w-8 h-8" />
              <span>Zero failed synchronization records in current database!</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {failedStudents.map((st) => (
                <div key={st.student_id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="font-black text-gray-900 dark:text-white">{st.name}</span>
                      <span className="font-mono text-gray-500 font-bold">({st.reg_no})</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-100 text-gray-700 dark:bg-navy-800 dark:text-gray-300">
                        {st.department} • {st.year_level} Year
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        {st.error_code}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-gray-500 text-[11px] font-bold">
                      <span>LeetCode Username: <strong className="text-gray-800 dark:text-gray-200">@{st.username}</strong></span>
                      {st.leetcode_url && (
                        <a
                          href={st.leetcode_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-0.5"
                        >
                          <span>Profile URL</span>
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>
                      )}
                    </div>

                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                      Diagnostic Note: {st.error_message}
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 text-right">
                    <div className="text-right text-[11px]">
                      <p className="text-gray-400 font-bold">Last Attempt: {st.last_attempt_at_formatted || 'Recently'}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold">Last Valid Fetch: {st.last_successful_sync_formatted || 'Never'}</p>
                    </div>

                    <button
                      onClick={() => handleRetryStudent(st.student_id)}
                      disabled={retryingId === st.student_id}
                      className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retryingId === st.student_id ? 'animate-spin' : ''}`} />
                      <span>{retryingId === st.student_id ? 'Retrying...' : 'Retry Fetch'}</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-navy-950/50 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-bold">
            Note: Network timeouts and rate limits do not count as zero solves or missing attendance.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-navy-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-bold text-xs transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
