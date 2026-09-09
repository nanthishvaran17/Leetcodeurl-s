import React, { useState } from 'react';
import api from '../../services/api';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

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
  const [reportType, setReportType] = useState('performance_summary');
  const [format, setFormat] = useState('pdf');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let url = `/reports/download-info?report_type=${reportType}&format=${format}&session_id=latest`;
      if (deptId) url += `&dept_id=${deptId}`;
      if (yearLevel && yearLevel !== 'ALL') url += `&year_level=${yearLevel}`;
      
      const res = await api.get(url);
      
      if (res.data.status === 'READY' && res.data.download_url) {
        setSuccess('Report is ready! Downloading...');
        window.location.href = res.data.download_url;
      } else {
        setSuccess('Report generation started. This may take a few minutes for large datasets. Please check back later.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Report Type</label>
            <select 
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="performance_summary">Performance Summary (General)</option>
              {studentId && <option value="student_detail">Detailed Student Analytics</option>}
              {!studentId && <option value="department_comparison">Department Comparison</option>}
              <option value="contest_matrix">Contest Matrix</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center justify-center p-3 rounded-xl border ${format === 'pdf' ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-300'} transition-all`}
              >
                <FileText className="w-5 h-5 mr-2" />
                PDF Document
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex items-center justify-center p-3 rounded-xl border ${format === 'xlsx' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-300'} transition-all`}
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
              className="w-full flex items-center justify-center p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70"
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
