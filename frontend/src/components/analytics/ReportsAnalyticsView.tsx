import React, { useState } from 'react';
import api from '../../services/api';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, User, Grid, Archive } from 'lucide-react';
import { downloadManager } from '../../services/download/downloadManager';

interface ReportsAnalyticsProps {
  studentId?: number;
  deptId?: number | null;
  yearLevel?: string | null;
  studentName?: string;
  regNo?: string;
  deptName?: string;
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsProps> = ({ 
  studentId,
  studentName,
  regNo,
  deptName
}) => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('student_detail');
  const [format, setFormat] = useState('pdf');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!studentId) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-400" />
        <h3 className="text-lg font-bold text-slate-700">No Student Selected</h3>
        <p className="mt-1 text-sm">Please select a student from the dashboard to generate their personalized reports.</p>
      </div>
    );
  }

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let baseUrl = `/student-reports/generate`;
      let payload = {
        student_id: studentId,
        report_type: reportType,
        format: format
      };
      let res = await api.post(baseUrl, payload);

      // Background generation polling
      let pollCount = 0;
      while (res.data.status === 'GENERATING' && pollCount < 40) {
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
        
        let ext = format;
        if (format === 'both') ext = 'zip';
        
        const safeName = studentName ? studentName.replace(/[^a-zA-Z0-9]/g, '_') : 'Student';
        const safeReg = regNo || 'Report';
        let prefix = 'Student_Report';
        if (reportType === 'official_summary') prefix = 'Student_Summary';
        if (reportType === 'weekly_contest_matrix') prefix = 'Student_Contest_Matrix';
        
        const filename = `Nandha_${prefix}_${safeName}_${safeReg}.${ext}`;

        const dlRes = await downloadManager.download({
          endpoint: dlUrl,
          filename,
        });

        if (dlRes.success) {
          setSuccess(`Report downloaded successfully!`);
        } else {
          setError(dlRes.error || 'Failed to download report file.');
          setSuccess(null);
        }
      } else {
        setError('Report generation taking longer than expected. Please try again.');
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reportTypes = [
    { id: 'student_detail', title: 'STUDENT', subtitle: 'Detailed Student Analytics', icon: <User className="w-5 h-5" /> },
    { id: 'official_summary', title: 'SUMMARY', subtitle: 'Student Performance Summary', icon: <FileText className="w-5 h-5" /> },
    { id: 'weekly_contest_matrix', title: 'MATRIX', subtitle: 'Student Contest Matrix', icon: <Grid className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in mt-4 max-w-3xl mx-auto">
      
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden">
        <div className="bg-slate-50 dark:bg-navy-800/50 p-4 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm tracking-wide uppercase">Target Student</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">ISOLATED MODE</span>
          </div>
        </div>
        <div className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center font-bold text-xl shrink-0">
            {studentName ? studentName.charAt(0) : 'S'}
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">{studentName || 'Unknown Student'}</h4>
            <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
              <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded font-bold font-mono">{regNo || studentId}</span>
              <span>{deptName || 'Department'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm">
        
        <div className="space-y-8">
          
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">Step 1: Select Report Type</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => setReportType(rt.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    reportType === rt.id 
                      ? 'bg-brand-50 border-brand-500 shadow-sm ring-1 ring-brand-500/50 dark:bg-brand-900/20 dark:border-brand-500' 
                      : 'bg-white border-slate-200 hover:border-brand-300 dark:bg-navy-900 dark:border-navy-700 dark:hover:border-navy-500'
                  }`}
                >
                  <div className={`mb-3 p-2 w-fit rounded-lg ${reportType === rt.id ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'}`}>
                    {rt.icon}
                  </div>
                  <h5 className={`font-black text-sm mb-1 ${reportType === rt.id ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>{rt.title}</h5>
                  <p className="text-xs text-slate-500 font-medium leading-tight">{rt.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">Step 2: Output Format</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border ${format === 'pdf' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 font-bold shadow-sm ring-1 ring-rose-500/50' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-400'} transition-all`}
              >
                <FileText className={`w-6 h-6 mb-2 ${format === 'pdf' ? 'text-rose-600 dark:text-rose-400' : ''}`} />
                <span className="text-sm">PDF Document</span>
              </button>
              
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border ${format === 'xlsx' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold shadow-sm ring-1 ring-emerald-500/50' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-400'} transition-all`}
              >
                <FileSpreadsheet className={`w-6 h-6 mb-2 ${format === 'xlsx' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                <span className="text-sm">Excel Spreadsheet</span>
              </button>

              <button
                onClick={() => setFormat('both')}
                className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border ${format === 'both' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-bold shadow-sm ring-1 ring-indigo-500/50' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-400'} transition-all`}
              >
                <Archive className={`w-6 h-6 mb-2 ${format === 'both' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="text-sm">PDF + Excel (.zip)</span>
              </button>
            </div>
          </div>

          {(error || success) && (
            <div className="pt-2">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl flex items-start text-sm font-medium">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-start text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
                  <p>{success}</p>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full flex items-center justify-center p-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-extrabold shadow-lg shadow-brand-500/25 transition-all disabled:opacity-70 disabled:shadow-none active:scale-[0.98]"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Generating Secure Report...</>
              ) : (
                <><Download className="w-5 h-5 mr-3" /> Generate & Download</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
