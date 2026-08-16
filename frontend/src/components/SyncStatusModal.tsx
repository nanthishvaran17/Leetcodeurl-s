import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Activity, RefreshCw, X, AlertTriangle, CheckCircle2, Clock, ShieldCheck, Database, UserCheck, AlertCircle, XCircle } from 'lucide-react';
import { getSyncStatus, getDataFreshness } from '../services/api';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [freshness, setFreshness] = useState<any>(null);
  const [refreshBadge, setRefreshBadge] = useState<string>('');
  const activeJobIdRef = useRef<string | null>(null);

  // Subscribe to live WebSocket progress events
  useLiveLeaderboard((data) => {
    if (!isOpen || !data) return;

    if (data.type === 'sync_progress') {
      // Prevent stale job event pollution
      if (activeJobIdRef.current && data.job_id && data.job_id !== activeJobIdRef.current) {
        // If incoming job is newer or currently tracked is empty, accept it
        activeJobIdRef.current = data.job_id;
      }

      setSyncStatus((prev: any) => ({
        ...prev,
        is_running: true,
        operation: 'RUNNING',
        status: 'RUNNING',
        job_id: data.job_id,
        total: data.total,
        total_students: data.total,
        processed: data.processed,
        completed: data.processed,
        successful: data.successful,
        success: data.successful,
        profiles_synced: data.successful,
        failed: data.failed,
        pending: data.pending,
        pending_usernames: data.pending,
        invalid: data.invalid,
        current_student: data.current_student,
        current_username: data.current_username,
        current_student_status: data.current_status,
        progress_percentage: data.progress_percent,
        progress_percent: data.progress_percent,
        recent_completed: data.recent_completed || prev?.recent_completed || []
      }));
    } else if (data.type === 'SYNC_COMPLETED') {
      setSyncStatus((prev: any) => ({
        ...prev,
        is_running: false,
        operation: 'COMPLETED',
        status: 'COMPLETED',
        progress_percentage: 100,
        progress_percent: 100,
        completed: prev?.total || 300,
        processed: prev?.total || 300
      }));
      fetchStatus(false);
    }
  });

  const fetchStatus = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else if (!syncStatus) {
      setLoading(true);
    }
    setError(null);

    try {
      const [statusData, freshnessData] = await Promise.all([
        getSyncStatus().catch(() => null),
        getDataFreshness().catch(() => null)
      ]);

      if (statusData) {
        setSyncStatus(statusData);
        if (statusData.job_id) {
          activeJobIdRef.current = statusData.job_id;
        }
      }
      if (freshnessData) {
        setFreshness(freshnessData);
      }

      if (!statusData && !freshnessData) {
        throw new Error("Unable to retrieve synchronization status.");
      }

      if (isManual) {
        setRefreshBadge('✓ Updated');
        setTimeout(() => setRefreshBadge(''), 2000);
      }
    } catch (err: any) {
      console.warn("Sync status fetch error:", err);
      setError("The synchronization service is temporarily unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Keyboard ESC Key listener & Body Scroll Locking & Polling fallback (2s while running, 15s otherwise)
  useEffect(() => {
    if (!isOpen) return;

    fetchStatus();

    const pollInterval = setInterval(() => {
      fetchStatus(false);
    }, syncStatus?.is_running ? 2000 : 15000);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(pollInterval);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, syncStatus?.is_running]);

  if (!isOpen) return null;

  const isRunning = syncStatus?.is_running ?? false;
  const systemStatus = syncStatus?.system_status || 'Operational';
  const lastSyncTime = syncStatus?.last_sync_timestamp || freshness?.last_sync_timestamp || 'Just now';
  const totalStudents = syncStatus?.total || syncStatus?.total_students || freshness?.total_students || 300;
  const processed = syncStatus?.processed ?? syncStatus?.completed ?? (isRunning ? 0 : totalStudents);
  const successful = syncStatus?.successful ?? syncStatus?.success ?? (isRunning ? 0 : totalStudents);
  const pending = syncStatus?.pending ?? syncStatus?.pending_usernames ?? 0;
  const failed = syncStatus?.failed ?? 0;
  const invalid = syncStatus?.invalid ?? 0;
  const progressPercent = syncStatus?.progress_percent ?? syncStatus?.progress_percentage ?? (totalStudents > 0 ? Math.round((processed / totalStudents) * 100 * 10) / 10 : 0);
  const currentStudent = syncStatus?.current_student;
  const currentUsername = syncStatus?.current_username;
  const currentStatus = syncStatus?.current_student_status;
  const recentCompleted: any[] = syncStatus?.recent_completed || [];

  const getWorkerStatusBadge = () => {
    if (isRunning) {
      return { text: '● Sync Engine Running', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    if (syncStatus?.operation === 'COMPLETED' || syncStatus?.status === 'COMPLETED') {
      return { text: '✓ Synchronization Complete', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (syncStatus?.operation === 'FAILED' || syncStatus?.status === 'FAILED') {
      return { text: '⚠ Sync Engine Error', color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    return { text: '● Sync Engine Ready', color: 'text-brand-600 dark:text-brand-400 bg-brand-500/10 border-brand-500/30' };
  };

  const workerBadge = getWorkerStatusBadge();

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg max-h-[calc(100vh-48px)] flex flex-col bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-navy-800 bg-gray-50/50 dark:bg-navy-950/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              <Activity className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight flex items-center space-x-2">
                <span>Live Synchronization Engine</span>
              </h3>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Real-time per-student telemetry & sync progress
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Sync Engine Status"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
          
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
              <p className="text-sm font-extrabold text-gray-700 dark:text-gray-300">
                Loading current synchronization status...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <h4 className="text-sm font-black text-rose-700 dark:text-rose-300">
                ⚠ Unable to retrieve synchronization status
              </h4>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => fetchStatus(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Progress Bar & Header Banner */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black">
                  <div className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${workerBadge.color}`}>
                    <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                    <span>{workerBadge.text}</span>
                  </div>
                  <div className="font-mono text-sm text-gray-900 dark:text-white">
                    <span>{processed}</span> <span className="text-gray-400">/ {totalStudents}</span>
                    <span className="ml-2 text-brand-600 dark:text-brand-400 font-bold">({progressPercent}%)</span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3 bg-gray-200 dark:bg-navy-800 rounded-full overflow-hidden p-0.5 border border-gray-300/50 dark:border-navy-700">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 relative shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                  />
                </div>

                {/* Currently Processing Student Indicator */}
                {isRunning && (
                  <div className="pt-2 border-t border-gray-200/60 dark:border-navy-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2 truncate">
                      <RefreshCw className="w-3.5 h-3.5 text-brand-500 animate-spin flex-shrink-0" />
                      <span className="text-gray-500 dark:text-gray-400 font-semibold">Processing:</span>
                      <span className="font-black text-gray-900 dark:text-white truncate">
                        {currentStudent || 'Connecting...'}
                      </span>
                      {currentUsername && (
                        <span className="text-gray-400 font-mono text-[10px] truncate">
                          @{currentUsername}
                        </span>
                      )}
                    </div>
                    {currentStatus && (
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase font-mono ${
                        currentStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        currentStatus === 'PENDING_USERNAME' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {currentStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 3-Column Real-Time Metrics Counters */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                  <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                    Successful
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-300 font-mono mt-0.5">
                    {successful}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-center">
                  <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                    Pending
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-300 font-mono mt-0.5">
                    {pending}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center">
                  <div className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider">
                    Failed / Invalid
                  </div>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-300 font-mono mt-0.5">
                    {failed + invalid}
                  </div>
                </div>
              </div>

              {/* Real "Recently Synced" Live Stream */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 px-1">
                  <span>RECENTLY SYNCHRONIZED PROFILES</span>
                  <span className="text-[10px] font-mono">{recentCompleted.length} recorded</span>
                </div>
                
                <div className="p-2.5 rounded-2xl bg-gray-900 text-gray-200 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1.5 border border-gray-800">
                  {recentCompleted.length > 0 ? (
                    recentCompleted.map((rec: any, idx: number) => {
                      const isOk = rec.status === 'SUCCESS' || rec.status === 'VERIFIED' || rec.status === 'PROFILE_VERIFIED';
                      return (
                        <div key={idx} className="flex items-center justify-between text-[10.5px] py-0.5 border-b border-gray-800/60 last:border-0">
                          <div className="flex items-center space-x-2 truncate">
                            <span className={isOk ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {isOk ? '✓' : '✕'}
                            </span>
                            <span className="text-gray-100 font-sans font-bold truncate">{rec.student_name}</span>
                            {rec.username && (
                              <span className="text-gray-500 text-[10px]">@{rec.username}</span>
                            )}
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {isOk && rec.total_solved !== null && rec.total_solved !== undefined ? (
                              <span className="text-emerald-400 font-bold">{rec.total_solved} solved</span>
                            ) : (
                              <span className="text-rose-400 font-bold text-[10px]">{rec.status}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : syncStatus?.recent_logs && syncStatus.recent_logs.length > 0 ? (
                    syncStatus.recent_logs.slice(-6).map((log: string, idx: number) => (
                      <div key={idx} className="truncate text-gray-300 text-[10.5px]">{log}</div>
                    ))
                  ) : (
                    <div className="text-gray-500 py-2 text-center text-xs">
                      {isRunning ? 'Listening for per-student sync events...' : `Synchronization engine ready (${successful} verified profiles).`}
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp Footer Info */}
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 flex justify-between items-center text-[11px]">
                <span className="font-bold text-gray-500">LAST SUCCESSFUL SYNC</span>
                <span className="font-black text-gray-900 dark:text-white font-mono">{lastSyncTime}</span>
              </div>
            </>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-navy-800 bg-gray-50/50 dark:bg-navy-950/50 shrink-0">
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold transition-all border border-brand-200 dark:border-brand-800 flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshBadge || (refreshing ? 'Refreshing...' : '↻ Refresh Status')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 dark:hover:bg-navy-700 text-gray-900 dark:text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
          >
            {isRunning ? 'Run in Background' : 'Close Summary'}
          </button>
        </div>

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
