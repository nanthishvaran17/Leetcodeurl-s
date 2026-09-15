import React, { useState } from 'react';
import api from '../../services/api';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, User, Grid } from 'lucide-react';
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
  const [reportType, setReportType] = useState('student');
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
      let baseUrl = `/student-reports/generate-direct`;
      let payload = {
        student_id: studentId,
        report_type: reportType,
        format: 'pdf'
      };

      const safeName = studentName ? studentName.replace(/[^a-zA-Z0-9]/g, '_') : 'Student';
      const safeReg = regNo || 'Report';
      let prefix = 'Student_Report';
      if (reportType === 'summary') prefix = 'Student_Summary';
      if (reportType === 'matrix') prefix = 'Student_Contest_Matrix';
      
      const filename = `Nandha_${prefix}_${safeName}_${safeReg}.pdf`;

      const dlRes = await downloadManager.download({
        endpoint: baseUrl,
        method: 'POST',
        data: payload,
        filename,
      });

      if (dlRes.success) {
        setSuccess(`PDF Report downloaded successfully!`);
      } else {
        setError(dlRes.error || 'Failed to download PDF report file.');
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reportTypes = [
    { id: 'student', title: 'STUDENT', subtitle: 'Detailed Student Analytics', icon: <User className="w-5 h-5" /> },
    { id: 'summary', title: 'SUMMARY', subtitle: 'Student Performance Summary', icon: <FileText className="w-5 h-5" /> },
    { id: 'matrix', title: 'MATRIX', subtitle: 'Student Contest Matrix', icon: <Grid className="w-5 h-5" /> },
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
            <div className="flex items-center gap-2.5 text-sm text-slate-500 font-medium mt-1">
              <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded font-bold font-mono">{regNo || studentId}</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold">•</span>
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
            <div className="w-full">
              <div className="flex items-center justify-start p-4 rounded-xl border border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-extrabold shadow-sm gap-3">
                <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <div className="text-sm">PDF Document</div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Institutional Vector PDF Export</div>
                </div>
              </div>
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
              className="w-full flex items-center justify-center p-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-extrabold shadow-lg shadow-brand-500/25 transition-all disabled:opacity-70 disabled:shadow-none active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Generating PDF Report...</>
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
