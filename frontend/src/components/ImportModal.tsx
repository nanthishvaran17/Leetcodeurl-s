import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2, RefreshCw, Zap, ShieldCheck, Terminal } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { useGlobalData } from '../context/GlobalDataContext';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportStatus {
  job_id: string;
  is_running: boolean;
  status: string;
  total_rows: number;
  processed_rows: number;
  successful: number;
  failed: number;
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  error_summary?: string;
  recent_logs: string[];
  new_departments: string[];
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { notify } = useNotification();
  const { refreshAllData } = useGlobalData();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const pollIntervalRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Clean up state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setLoading(false);
      setJobId(null);
      setImportStatus(null);
      setIsCompleted(false);
      setValidationData(null);
      setIsValidating(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [isOpen]);


  // Real-time WebSocket listening for INSTANT progress updates
  useLiveLeaderboard((data) => {
    if (!data) return;
    if (data.type === 'IMPORT_PROGRESS' || data.type === 'IMPORT_COMPLETED') {
      if (data.job_id === jobId || !jobId) {
        if (data.job_id && !jobId) setJobId(data.job_id);
        setImportStatus(prev => ({
          job_id: data.job_id || prev?.job_id || '',
          is_running: data.type === 'IMPORT_PROGRESS' && data.status !== 'COMPLETED',
          status: data.status || (data.type === 'IMPORT_COMPLETED' ? 'COMPLETED' : 'RUNNING'),
          total_rows: data.total || data.total_rows || prev?.total_rows || 1,
          processed_rows: data.processed || data.processed_rows || prev?.processed_rows || 0,
          successful: data.successful ?? prev?.successful ?? 0,
          failed: data.failed ?? prev?.failed ?? 0,
          progress_percentage: data.progress_percentage ?? (data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0),
          recent_logs: data.recent_logs || prev?.recent_logs || [],
          new_departments: data.new_departments || prev?.new_departments || []
        }));

        if (data.type === 'IMPORT_COMPLETED' || data.status === 'COMPLETED') {
          setIsCompleted(true);
          setLoading(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          refreshAllData();
          onSuccess();
        }
      }
    }
  });

  // Polling fallback to guarantee 100% UI accuracy if WebSocket drops
  useEffect(() => {
    if (!jobId || isCompleted) return;

    const pollStatus = async () => {
      try {
        const res = await api.get(`/students/import-status/${jobId}`);
        if (res.data && res.data.status !== 'NOT_FOUND') {
          setImportStatus(res.data);
          if (res.data.status === 'COMPLETED' || res.data.status === 'SUCCESS') {
            setIsCompleted(true);
            setLoading(false);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            refreshAllData();
            onSuccess();
          } else if (res.data.status === 'FAILED') {
            setLoading(false);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            notify.error('Import Failed', res.data.error_summary || 'Excel import encountered errors.', { category: 'EXCEL IMPORT' });
          }
        }
      } catch (err) {
        console.warn('Import status poll error:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollStatus, 400);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, isCompleted, onSuccess, refreshAllData, notify]);

  // Auto-scroll logs box
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [importStatus?.recent_logs]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setValidationData(null);
      setIsValidating(true);

      const formData = new FormData();
      formData.append('file', selected);
      try {
        const res = await api.post('/students/validate-import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setValidationData(res.data);
      } catch (err: any) {
        console.warn('Validation error:', err);
      } finally {
        setIsValidating(false);
      }
    }
  };


  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    notify.info('Import Started', `Uploading '${file.name}' to high-speed import engine...`, { category: 'EXCEL IMPORT' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const returnedJobId = res.data?.job_id;
      if (returnedJobId) {
        setJobId(returnedJobId);
        setImportStatus({
          job_id: returnedJobId,
          is_running: true,
          status: 'RUNNING',
          total_rows: res.data.total_rows || 100,
          processed_rows: 0,
          successful: 0,
          failed: 0,
          progress_percentage: 0,
          recent_logs: [`[IMPORT] Started background Excel import job '${returnedJobId}'`],
          new_departments: []
        });
        notify.success('Import Running', `Job ${returnedJobId} active. Tracking live progress...`, { category: 'EXCEL IMPORT' });
      } else {
        notify.success('Import Queued', 'Import job queued successfully.', { category: 'EXCEL IMPORT' });
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      notify.error('Import Error', err.response?.data?.detail || 'Failed to start Excel import.', { category: 'EXCEL IMPORT' });
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await downloadManager.download({
        endpoint: '/students/sample-excel',
        filename: 'Student_Import_Sample.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (res.success) {
        notify.success('Sample Template Saved', 'Student_Import_Sample.xlsx downloaded.', { category: 'EXCEL IMPORT' });
      } else {
        notify.error('Download Error', res.error || 'Unable to download sample Excel template.', { category: 'EXCEL IMPORT' });
      }
    } catch (err: any) {
      notify.error('Download Error', 'Unable to download sample Excel template.', { category: 'EXCEL IMPORT' });
    }
  };

  const isImporting = loading || (importStatus && importStatus.is_running);

  return (
    <div className="modal-overlay-responsive animate-modal-backdrop">
      <div className="modal-container-responsive max-w-3xl glass-card rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl animate-modal-content overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-6 border-slate-200 dark:border-slate-800 shrink-0 bg-gradient-to-r from-slate-50 via-slate-50 to-slate-100 dark:from-navy-900 dark:via-navy-950 dark:to-slate-900">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-emerald-600' : isImporting ? 'bg-brand-600 animate-pulse' : 'bg-indigo-600'} text-white shadow-lg`}>
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isImporting ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                <span>{isCompleted ? 'Excel Import Complete' : isImporting ? 'High-Speed Excel Import Active' : 'Import Students from Excel'}</span>
                {isImporting && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    LIVE PROCESSING
                  </span>
                )}
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {isCompleted ? 'All student roster records verified and updated in real-time.' : isImporting ? `Processing job ${jobId}... live updating database.` : 'Upload .xlsx or .xls file containing institutional student profiles'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className={`p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isImporting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

          {/* STATE 1: File Selection Dropzone */}
          {!file && !isImporting && !isCompleted && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-brand-500/30 dark:border-brand-500/20 rounded-3xl p-10 text-center hover:border-brand-500 bg-brand-500/5 transition-all">
                <UploadCloud className="w-14 h-14 text-brand-600 dark:text-brand-400 mx-auto mb-3 animate-bounce" />
                <p className="font-extrabold text-base text-slate-900 dark:text-white">Click to upload or drag & drop Excel file</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Columns: <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-brand-600 dark:text-brand-300">REG NO</code>, <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-brand-600 dark:text-brand-300">NAME</code>, <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-brand-600 dark:text-brand-300">DEPT</code>, <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-brand-600 dark:text-brand-300">YEAR</code>, <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-brand-600 dark:text-brand-300">PRIMARY LEETCODE LINK</code>, <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-emerald-600 dark:text-emerald-400">SECONDARY LEETCODE LINK (Optional)</code></p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="mt-6 block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-brand-600 file:text-white hover:file:bg-brand-700 mx-auto max-w-xs transition-all shadow-md"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-xs">
                <div>
                  <p className="font-black text-indigo-950 dark:text-indigo-200">Need standard import template?</p>
                  <p className="text-indigo-600/80 dark:text-indigo-400 text-[11px]">Download formatted Excel sample with exact required headers</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer text-xs shrink-0"
                >
                  <span></span>
                  <span>Download Sample</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: File Selected (Parsed & Pre-Validated) */}
          {file && !isImporting && !isCompleted && (
            <div className="space-y-5">
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="w-8 h-8 text-brand-600 dark:text-brand-400 shrink-0" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-md">{file.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {(file.size / 1024).toFixed(2)} KB • {isValidating ? 'Validating schema & rows...' : 'Pre-validated & schema verified'}
                      </p>
                    </div>
                  </div>
                  {isValidating && <Loader2 className="w-5 h-5 animate-spin text-brand-500" />}
                </div>

                {/* Validation Summary Breakdown Cards */}
                {validationData && !isValidating && (
                  <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-navy-800">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Rows</span>
                        <p className="text-base font-black text-slate-900 dark:text-white">{validationData.total_rows}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Valid Rows</span>
                        <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{validationData.valid_rows}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Duplicates</span>
                        <p className="text-base font-black text-amber-700 dark:text-amber-300">{validationData.duplicate_rows}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Invalid</span>
                        <p className="text-base font-black text-rose-700 dark:text-rose-300">{validationData.invalid_rows}</p>
                      </div>
                    </div>

                    {/* Invalid / Warning Alert */}
                    {validationData.invalid_rows > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                        <div className="flex items-center space-x-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{validationData.invalid_rows} Invalid Record(s) Skipped</span>
                        </div>
                        <p className="text-[11px] leading-snug">
                          {validationData.errors?.[0] || 'Records with missing Register No or Name will be skipped safely without corrupting existing roster data.'}
                        </p>
                      </div>
                    )}

                    {/* Parse Preview Table (First 5 Rows) */}
                    {validationData.preview && validationData.preview.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sample Parsed Roster Preview:</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-800">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-100 dark:bg-navy-950 text-slate-600 dark:text-slate-400 font-bold">
                              <tr>
                                <th className="p-2">Reg No</th>
                                <th className="p-2">Name</th>
                                <th className="p-2">Department</th>
                                <th className="p-2">Year</th>
                                <th className="p-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                              {validationData.preview.map((row: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-2 font-mono text-brand-600 dark:text-brand-400 font-bold">{row.reg_no}</td>
                                  <td className="p-2 font-medium text-slate-900 dark:text-white">{row.name}</td>
                                  <td className="p-2 text-slate-500">{row.dept || 'N/A'}</td>
                                  <td className="p-2 text-slate-500">{row.year || 'N/A'}</td>
                                  <td className="p-2 text-right font-bold">
                                    {row.is_duplicate ? (
                                      <span className="text-amber-600 dark:text-amber-400">UPDATE</span>
                                    ) : (
                                      <span className="text-emerald-600 dark:text-emerald-400">NEW</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => { setFile(null); setValidationData(null); }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Choose Different File
                </button>
                <button
                  onClick={handleCommit}
                  disabled={isValidating || (validationData && validationData.valid_rows === 0)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer transition-all"
                >
                  <Zap className="w-4 h-4" />
                  <span>Confirm & Import {validationData ? validationData.valid_rows : ''} Valid Students</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: LIVE IMPORTING IN PROGRESS */}
          {isImporting && (
            <div className="space-y-6">
              {/* Sleek Gradient Progress Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-900 via-brand-950 to-indigo-950 text-white border border-brand-500/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold tracking-wider uppercase text-emerald-400 flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Executing Bulk Import Engine</span>
                  </span>
                  <span className="text-2xl font-black font-mono text-cyan-300">
                    {importStatus?.progress_percentage ?? 0}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/20">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 shadow-lg shadow-emerald-500/50"
                    style={{ width: `${Math.max(5, importStatus?.progress_percentage ?? 0)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <span>Processed: <strong className="text-white">{importStatus?.processed_rows ?? 0}</strong> / {importStatus?.total_rows ?? 1} rows</span>
                  <span className="text-teal-300 font-mono">Job ID: {jobId}</span>
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Processed</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{importStatus?.processed_rows ?? 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-center">
                  <p className="text-xs font-bold text-brand-600 dark:text-brand-400">Successfully Imported</p>
                  <p className="text-xl font-black text-brand-700 dark:text-brand-300 mt-1">{importStatus?.successful ?? 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Skipped / Duplicates</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{importStatus?.failed ?? 0}</p>
                </div>
              </div>

              {/* Real-time Log Feed */}
              {importStatus?.recent_logs && importStatus.recent_logs.length > 0 && (
                <div className="rounded-2xl bg-navy-950 border border-navy-800 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400 font-bold border-b border-navy-800 pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-brand-400" />
                      <span>Live Terminal Activity Feed</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Real-time Stream</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300 pr-1">
                    {importStatus.recent_logs.map((log, i) => (
                      <div key={i} className="flex items-start space-x-2">
                        <span className="text-emerald-400 font-black">›</span>
                        <span className={log.includes('Skipped') ? 'text-amber-400' : 'text-slate-200'}>{log}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 4: COMPLETED SUMMARY STATE */}
          {isCompleted && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border-2 border-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white">Excel Import Complete!</h4>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  Roster database successfully updated and synchronized with campus system.
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-500">Total Rows</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{importStatus?.total_rows ?? importStatus?.processed_rows ?? 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Imported / Updated</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{importStatus?.successful ?? 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Duplicates Skipped</p>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">{importStatus?.failed ?? 0}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 cursor-pointer transition-all"
                >
                  Done & View Student Roster
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
