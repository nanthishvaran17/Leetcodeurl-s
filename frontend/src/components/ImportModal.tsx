import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2, RefreshCw, Zap, ShieldCheck, Terminal, ArrowRight, Check, ChevronRight, Info, Building2 } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { useGlobalData } from '../context/GlobalDataContext';
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

const CANONICAL_OPTIONS = [
  { key: 'reg_no', label: 'REG NO / ROLL NO (Required)', required: true },
  { key: 'name', label: 'NAME (Required)', required: true },
  { key: 'department', label: 'DEPARTMENT (Required)', required: true },
  { key: 'year_level', label: 'YEAR LEVEL (Required)', required: true },
  { key: 'email', label: 'EMAIL (Required)', required: true },
  { key: 'leetcode_url', label: 'PRIMARY LEETCODE LINK (Required)', required: true },
  { key: 'sec_leetcode_url', label: 'SECONDARY LEETCODE LINK (Optional)', required: false },
  { key: 'section', label: 'SECTION (Optional)', required: false },
  { key: 'batch', label: 'ACADEMIC BATCH (Optional)', required: false },
  { key: 'exclude', label: '❌ Exclude Column', required: false },
];

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { notify } = useNotification();
  const { refreshAllData } = useGlobalData();
  const [step, setStep] = useState<number>(1); // 1: Upload, 2: Mapping, 3: Preview, 4: Progress/Summary
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Analysis Data
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
  const [confirmedNewDepts, setConfirmedNewDepts] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<'all' | 'create' | 'update' | 'unchanged' | 'errors'>('all');

  // Job & Commit State
  const [commitSummary, setCommitSummary] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const pollIntervalRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setFile(null);
      setLoading(false);
      setAnalysisData(null);
      setCustomMapping({});
      setConfirmedNewDepts([]);
      setCommitSummary(null);
      setJobId(null);
      setImportStatus(null);
      setIsCompleted(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [isOpen]);

  // Real-time WebSocket updates
  useLiveLeaderboard((data) => {
    if (!data) return;
    if (data.type === 'IMPORT_PROGRESS' || data.type === 'IMPORT_COMPLETED' || data.type === 'IMPORT_FAILED') {
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

  if (!isOpen) return null;

  // Step 1 -> Step 2: File Select & Analyze
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setLoading(true);

      const formData = new FormData();
      formData.append('file', selected);

      try {
        const res = await api.post('/students/analyze-import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.success) {
          setAnalysisData(res.data);
          setCustomMapping(res.data.detected_mapping || {});
          setConfirmedNewDepts(res.data.summary?.new_departments || []);
          setStep(2);
        } else {
          notify.error('Analysis Failed', res.data?.error || 'Unable to parse Excel headers.', { category: 'EXCEL IMPORT' });
        }
      } catch (err: any) {
        notify.error('Analysis Error', err.response?.data?.detail || 'Failed to analyze uploaded file.', { category: 'EXCEL IMPORT' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Step 2 -> Step 3: Re-Analyze with custom mapping
  const handleMappingConfirm = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('custom_mapping', JSON.stringify(customMapping));

    try {
      const res = await api.post('/students/analyze-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        setAnalysisData(res.data);
        setConfirmedNewDepts(res.data.summary?.new_departments || []);
        setStep(3);
      } else {
        notify.error('Analysis Error', res.data?.error || 'Validation failed for selected mapping.', { category: 'EXCEL IMPORT' });
      }
    } catch (err: any) {
      notify.error('Mapping Error', err.response?.data?.detail || 'Could not verify custom mappings.', { category: 'EXCEL IMPORT' });
    } finally {
      setLoading(false);
    }
  };

  // Step 3 -> Step 4: Execute Commit
  const handleExecuteCommit = async () => {
    if (!file) return;
    setLoading(true);
    setStep(4);
    notify.info('Import Executing', `Processing roster & updating institutional database...`, { category: 'EXCEL IMPORT' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('custom_mapping', JSON.stringify(customMapping));
    formData.append('confirmed_new_departments', JSON.stringify(confirmedNewDepts));

    try {
      const res = await api.post('/students/commit-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        setCommitSummary(res.data.summary);
        setIsCompleted(true);
        refreshAllData();
        notify.success('Import Successful', `Created ${res.data.summary.new_students}, updated ${res.data.summary.existing_updated} student records.`, { category: 'EXCEL IMPORT' });
        onSuccess();
      } else {
        notify.error('Import Failed', res.data?.error || 'Database commit encountered an error.', { category: 'EXCEL IMPORT' });
      }
    } catch (err: any) {
      notify.error('Commit Error', err.response?.data?.detail || 'Failed to complete student import commit.', { category: 'EXCEL IMPORT' });
    } finally {
      setLoading(false);
    }
  };

  // Download Sample Excel
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

  const isImporting = loading && step === 4;

  return (
    <div className="modal-overlay-responsive animate-modal-backdrop">
      <div className="modal-container-responsive max-w-4xl glass-card rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl animate-modal-content overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header with Wizard Step Indicator */}
        <div className="border-b p-6 border-slate-200 dark:border-slate-800 shrink-0 bg-gradient-to-r from-slate-50 via-slate-50 to-slate-100 dark:from-navy-900 dark:via-navy-950 dark:to-slate-900">
          <div className="flex items-center justify-between">
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
                  <span>
                    {step === 1 && 'Upload Student Roster'}
                    {step === 2 && 'Smart Column Header Mapping'}
                    {step === 3 && 'Roster Import Preview & Audit'}
                    {step === 4 && (isCompleted ? 'Import Execution Complete' : 'Executing Database Import')}
                  </span>
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Intelligent auto-detection engine for any institutional Excel format
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

          {/* Step Progress Pills */}
          <div className="flex items-center justify-between mt-5 max-w-xl mx-auto px-4">
            <div className={`flex items-center space-x-2 text-xs font-bold ${step >= 1 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>1</span>
              <span>Upload</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div className={`flex items-center space-x-2 text-xs font-bold ${step >= 2 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>2</span>
              <span>Mapping</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div className={`flex items-center space-x-2 text-xs font-bold ${step >= 3 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>3</span>
              <span>Preview</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div className={`flex items-center space-x-2 text-xs font-bold ${step >= 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>4</span>
              <span>Commit</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

          {/* STEP 1: FILE UPLOAD */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="border-2 border-dashed border-brand-500/30 dark:border-brand-500/20 rounded-3xl p-10 text-center hover:border-brand-500 bg-brand-500/5 transition-all">
                <UploadCloud className="w-14 h-14 text-brand-600 dark:text-brand-400 mx-auto mb-3 animate-bounce" />
                <p className="font-extrabold text-base text-slate-900 dark:text-white">Click to upload or drag & drop Excel file</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                  Any column names accepted (e.g. <code>Roll No</code>, <code>Register Number</code>, <code>Branch</code>, <code>Batch</code>, <code>Mail ID</code>, <code>LeetCode URL</code>). Year can be <code>1</code>, <code>II</code>, <code>Third Year</code>, <code>4th</code>.
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="mt-6 block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-brand-600 file:text-white hover:file:bg-brand-700 mx-auto max-w-xs transition-all shadow-md cursor-pointer"
                />
                {loading && (
                  <div className="mt-4 flex items-center justify-center space-x-2 text-brand-600 dark:text-brand-400 text-xs font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing column headers & structure...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-xs">
                <div>
                  <p className="font-black text-indigo-950 dark:text-indigo-200">Need standard canonical template?</p>
                  <p className="text-indigo-600/80 dark:text-indigo-400 text-[11px]">Download sample Excel spreadsheet with canonical column layout</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer text-xs shrink-0"
                >
                  <span>Download Sample</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 2 && analysisData && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Detected {analysisData.raw_headers.length} Columns in <code>{file?.name}</code></p>
                  <p className="text-slate-500 text-[11px]">Review auto-detected canonical field mappings below and verify required columns.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-black text-[11px] uppercase">
                  Header Intelligence Active
                </span>
              </div>

              {/* Mappings Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Uploaded Header</th>
                      <th className="p-3">Confidence</th>
                      <th className="p-3">Mapped Canonical Target Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analysisData.raw_headers.map((h: string, idx: number) => {
                      const detectedKey = customMapping[h] || '';
                      const conf = analysisData.confidence_map?.[h] || 'LOW';

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-navy-900/50">
                          <td className="p-3 font-extrabold text-slate-900 dark:text-white font-mono">{h}</td>
                          <td className="p-3">
                            {conf === 'HIGH' ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                                HIGH CONFIDENCE
                              </span>
                            ) : conf === 'MEDIUM' ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase">
                                MEDIUM CONFIDENCE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase">
                                MANUAL CHECK
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <select
                              value={detectedKey}
                              onChange={(e) => setCustomMapping(prev => ({ ...prev, [h]: e.target.value }))}
                              className="w-full max-w-md p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-navy-950 font-medium text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                              <option value="">-- Unmapped / Exclude --</option>
                              {CANONICAL_OPTIONS.map(opt => (
                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back to Upload
                </button>
                <button
                  type="button"
                  onClick={handleMappingConfirm}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 cursor-pointer transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Proceed to Import Preview</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & AUDIT */}
          {step === 3 && analysisData && (
            <div className="space-y-5">

              {/* 5 Summary Breakdown Cards */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">New (CREATE)</span>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{analysisData.summary?.create_count || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/50">
                  <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">UPDATE (Diffs)</span>
                  <p className="text-xl font-black text-brand-700 dark:text-brand-300">{analysisData.summary?.update_count || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">UNCHANGED</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{analysisData.summary?.unchanged_count || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Warnings</span>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300">{analysisData.summary?.warning_count || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Errors</span>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-300">{analysisData.summary?.error_count || 0}</p>
                </div>
              </div>

              {/* New Department Alert Banner */}
              {analysisData.summary?.new_departments && analysisData.summary.new_departments.length > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200">
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <p className="font-extrabold text-sm">New Department(s) Discovered: {analysisData.summary.new_departments.join(', ')}</p>
                      <p className="text-indigo-600/80 dark:text-indigo-300 text-[11px]">
                        Upon confirmation, new departments will be registered in database master and instantly propagated to all filters, pages, & dashboards.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-[10px] uppercase border border-emerald-500/30">
                    AUTO-PROPAGATION READY
                  </span>
                </div>
              )}

              {/* Tabbed Row Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
                  <button
                    onClick={() => setPreviewTab('all')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer ${previewTab === 'all' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-900'}`}
                  >
                    All Preview Rows
                  </button>
                  <button
                    onClick={() => setPreviewTab('create')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer ${previewTab === 'create' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-900'}`}
                  >
                    Create ({analysisData.summary?.create_count || 0})
                  </button>
                  <button
                    onClick={() => setPreviewTab('update')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer ${previewTab === 'update' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-900'}`}
                  >
                    Updates ({analysisData.summary?.update_count || 0})
                  </button>
                  <button
                    onClick={() => setPreviewTab('unchanged')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer ${previewTab === 'unchanged' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-900'}`}
                  >
                    Unchanged ({analysisData.summary?.unchanged_count || 0})
                  </button>
                  <button
                    onClick={() => setPreviewTab('errors')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer ${previewTab === 'errors' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-900'}`}
                  >
                    Errors ({analysisData.summary?.error_count || 0})
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-56">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Reg No</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Dept</th>
                        <th className="p-2.5">Year</th>
                        <th className="p-2.5">Action / Field Diffs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* CREATE ROWS */}
                      {(previewTab === 'all' || previewTab === 'create') && analysisData.preview_data?.create?.map((r: any, idx: number) => (
                        <tr key={`c-${idx}`} className="hover:bg-slate-50 dark:hover:bg-navy-900/50">
                          <td className="p-2.5 text-slate-400 font-mono">{r.row_num}</td>
                          <td className="p-2.5 font-bold font-mono text-brand-600 dark:text-brand-400">{r.reg_no}</td>
                          <td className="p-2.5 font-medium">{r.name}</td>
                          <td className="p-2.5">{r.dept}</td>
                          <td className="p-2.5">{r.year}</td>
                          <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">✓ CREATE NEW</td>
                        </tr>
                      ))}

                      {/* UPDATE ROWS */}
                      {(previewTab === 'all' || previewTab === 'update') && analysisData.preview_data?.update?.map((r: any, idx: number) => (
                        <tr key={`u-${idx}`} className="hover:bg-slate-50 dark:hover:bg-navy-900/50 bg-brand-500/5">
                          <td className="p-2.5 text-slate-400 font-mono">{r.row_num}</td>
                          <td className="p-2.5 font-bold font-mono text-brand-600 dark:text-brand-400">{r.reg_no}</td>
                          <td className="p-2.5 font-medium">{r.name}</td>
                          <td className="p-2.5">{r.dept}</td>
                          <td className="p-2.5">{r.year}</td>
                          <td className="p-2.5">
                            <span className="font-bold text-brand-600 dark:text-brand-400 mr-2">↻ UPDATE:</span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">{r.diffs?.join(' | ')}</span>
                          </td>
                        </tr>
                      ))}

                      {/* UNCHANGED ROWS */}
                      {(previewTab === 'all' || previewTab === 'unchanged') && analysisData.preview_data?.unchanged?.map((r: any, idx: number) => (
                        <tr key={`uc-${idx}`} className="hover:bg-slate-50 dark:hover:bg-navy-900/50 opacity-60">
                          <td className="p-2.5 text-slate-400 font-mono">{r.row_num}</td>
                          <td className="p-2.5 font-bold font-mono">{r.reg_no}</td>
                          <td className="p-2.5 font-medium">{r.name}</td>
                          <td className="p-2.5">{r.dept}</td>
                          <td className="p-2.5">{r.year}</td>
                          <td className="p-2.5 font-bold text-slate-500 font-mono">= UNCHANGED</td>
                        </tr>
                      ))}

                      {/* ERROR ROWS */}
                      {(previewTab === 'all' || previewTab === 'errors') && analysisData.preview_data?.errors?.map((r: any, idx: number) => (
                        <tr key={`e-${idx}`} className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-mono">
                          <td className="p-2.5">{r.row_num}</td>
                          <td className="p-2.5 font-bold">{r.reg_no}</td>
                          <td className="p-2.5 font-medium">{r.name}</td>
                          <td className="p-2.5" colSpan={3}>❌ {r.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back to Header Mapping
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCommit}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>Confirm & Execute Import</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COMMIT EXECUTION & FINAL SUMMARY */}
          {step === 4 && (
            <div className="space-y-6">
              {isImporting && (
                <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-900 via-brand-950 to-indigo-950 text-white border border-brand-500/30 shadow-xl space-y-4 text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mx-auto" />
                  <h4 className="text-xl font-black">Executing Batch Student Import...</h4>
                  <p className="text-xs text-slate-300 font-medium max-w-md mx-auto">
                    Updating database records, registering departments, and triggering background LeetCode profile synchronization.
                  </p>
                </div>
              )}

              {isCompleted && (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border-2 border-emerald-500/30 animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white">Smart Excel Import Completed!</h4>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Institutional database updated. Department counts & student management views synchronized.
                    </p>
                  </div>

                  {/* Final Summary Grid */}
                  {commitSummary && (
                    <div className="grid grid-cols-4 gap-3 max-w-xl mx-auto">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Created</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{commitSummary.new_students}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60">
                        <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">Updated</p>
                        <p className="text-2xl font-black text-brand-700 dark:text-brand-300 mt-0.5">{commitSummary.existing_updated}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Unchanged</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{commitSummary.unchanged}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">New Depts</p>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{commitSummary.new_departments}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        onSuccess();
                        onClose();
                      }}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 cursor-pointer transition-all"
                    >
                      Done & View Updated Student Roster
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
