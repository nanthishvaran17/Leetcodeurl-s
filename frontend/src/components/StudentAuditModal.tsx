import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock, Database, UserCheck, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

export interface StudentAuditModalProps {
  isOpen: boolean;
  studentId: number | string | null;
  studentName?: string;
  regNo?: string;
  onClose: () => void;
  onDownloadForensic?: () => void;
}

export const StudentAuditModal: React.FC<StudentAuditModalProps> = ({
  isOpen,
  studentId,
  studentName,
  regNo,
  onClose,
  onDownloadForensic
}) => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<any>(null);

  const fetchAuditData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/students/${encodeURIComponent(studentId)}/audit-history`);
      if (res.data) {
        setAuditData(res.data);
      } else {
        setError('No audit response received from backend.');
      }
    } catch (err: any) {
      console.error('Failed to load student audit log:', err);
      const msg = err.response?.data?.detail || err.message || 'Unable to load student audit history.';
      setError(msg);
      notify.error('Audit Load Error', msg, { category: 'FORENSIC AUDIT' });
    } finally {
      setLoading(false);
    }
  }, [studentId, notify]);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchAuditData();
    }
  }, [isOpen, studentId, fetchAuditData]);

  // Lock body scroll & Handle ESC
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = orig || '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pipeline = auditData?.stats_pipeline || {};
  const logs = auditData?.logs || [];
  const stInfo = auditData?.student || {};

  return createPortal(
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                Student Forensic & Audit Ledger
              </h3>
              <p className="text-xs text-emerald-300 font-mono font-bold mt-0.5 truncate">
                {stInfo.name || studentName || 'Student'} • {stInfo.reg_no || regNo || 'ID: ' + studentId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-slate-50/50 dark:bg-navy-900/30">
          
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Fetching forensic audit records & data pipeline state...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold">Failed to Load Audit History</h4>
                <p className="text-xs mt-1">{error}</p>
                <button
                  type="button"
                  onClick={fetchAuditData}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm inline-flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Request</span>
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Pipeline Verification Status Card */}
              <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Telemetry Pipeline Verification State
                    </h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    pipeline.sync_status === 'success' || pipeline.sync_status === 'OK'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : pipeline.sync_status === 'failed'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {pipeline.sync_status || 'NOT_STARTED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Validation</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">
                      {pipeline.validation_status || 'Unverified'}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Problems Solved</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {pipeline.total_solved || 0} Solved
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Contest Rating</p>
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {pipeline.contest_rating || 'Unrated'}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Last Verified</p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                      {pipeline.last_verified_at ? new Date(pipeline.last_verified_at).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>

                {pipeline.error_message && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="truncate">Pipeline error note: {pipeline.error_message}</span>
                  </div>
                )}
              </div>

              {/* Audit Activity Trail */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Audit Event Ledger ({logs.length})</span>
                  </h4>
                </div>

                {logs.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <CheckCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      No administrative audit events recorded for this student yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {log.action}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              by <strong className="text-slate-700 dark:text-slate-300">{log.user_name}</strong>
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                            {log.details || 'Event logged successfully.'}
                          </p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-navy-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchAuditData}
            disabled={loading}
            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit</span>
          </button>

          <div className="flex items-center gap-2">
            {onDownloadForensic && (
              <button
                type="button"
                onClick={onDownloadForensic}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export Forensic PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
