import React, { useState } from 'react';
import api from '../../services/api';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, User, Building2, Grid } from 'lucide-react';

import { downloadManager } from '../../services/download/downloadManager';
import { GlobalFilter, GlobalFilterOption } from '../GlobalFilter';

interface ReportsAnalyticsProps {
  studentId?: number;
  deptId?: number | null;
  yearLevel?: string | null;
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsProps> = ({ 
  studentId,
  deptId,
  yearLevel 
}) => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState(studentId ? 'student_detail' : 'official_summary');
  const [format, setFormat] = useState('pdf');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let baseUrl = `/reports/download-info?report_type=${reportType}&format=${format}&session_id=latest`;
      if (studentId && reportType === 'student_detail') baseUrl += `&student_id=${studentId}`;
      if (deptId) baseUrl += `&dept_id=${deptId}`;
      if (yearLevel && yearLevel !== 'ALL') baseUrl += `&year_level=${yearLevel}`;
      
      let res = await api.get(baseUrl);

      // If report is being prepared in background, poll until ready (up to 30 attempts)
      let pollCount = 0;
      while (res.data.status === 'GENERATING' && pollCount < 30) {
        pollCount++;
        setSuccess(`Generating ${format.toUpperCase()} report in background... (${pollCount * 1.5}s)`);
        await new Promise((r) => setTimeout(r, 1500));
        res = await api.get(baseUrl);
      }
      
      if (res.data.status === 'READY' && res.data.download_url) {
        setSuccess('Report ready! Downloading...');
        let dlUrl = res.data.download_url;
        if (dlUrl.startsWith('/api/')) {
          dlUrl = dlUrl.substring(4);
        }
        const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
        const filename = `${reportType}_report.${ext}`;

        const dlRes = await downloadManager.download({
          endpoint: dlUrl,
          filename,
        });

        if (dlRes.success) {
          setSuccess(`Report (${ext.toUpperCase()}) downloaded successfully!`);
        } else {
          setError(dlRes.error || 'Failed to download report file.');
          setSuccess(null);
        }
      } else {
        setError('Report generation taking longer than expected. Please click Generate & Download again.');
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reportOptions: GlobalFilterOption[] = [
    { value: 'official_summary', label: 'Performance Summary (General)', pillText: 'SUMMARY', icon: <FileText className="w-3.5 h-3.5" /> },
    ...(studentId ? [{ value: 'student_detail', label: 'Detailed Student Analytics', pillText: 'STUDENT', icon: <User className="w-3.5 h-3.5" /> }] : []),
    ...(!studentId ? [{ value: 'department_performance', label: 'Department Comparison', pillText: 'DEPT', icon: <Building2 className="w-3.5 h-3.5" /> }] : []),
    { value: 'weekly_contest_matrix', label: 'Contest Matrix', pillText: 'MATRIX', icon: <Grid className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="space-y-6 animate-fade-in mt-4">
      <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl mr-4">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Generate Report</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Export analytics data for offline viewing</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <GlobalFilter
              label="Report Type"
              options={reportOptions}
              value={reportType}
              onChange={setReportType}
              dropdownWidth="w-full"
              showSearch={false}
              icon={<FileText className="w-4 h-4" />}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center justify-center p-3 rounded-xl border ${format === 'pdf' ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-300'} transition-all`}
              >
                <FileText className="w-5 h-5 mr-2" />
                PDF Document
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex items-center justify-center p-3 rounded-xl border ${format === 'xlsx' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-300'} transition-all`}
              >
                <FileSpreadsheet className="w-5 h-5 mr-2" />
                Excel Spreadsheet
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start text-sm">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-start text-sm">
              <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full flex items-center justify-center p-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-extrabold shadow-md shadow-brand-500/20 transition-all disabled:opacity-70 active:scale-95"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-5 h-5 mr-2" /> Generate & Download</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
