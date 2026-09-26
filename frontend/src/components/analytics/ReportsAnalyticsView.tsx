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
    <div className="space-y-8 animate-fade-in mt-4 max-w-4xl mx-auto">
      
      <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-navy-900 dark:to-navy-800/80 rounded-2xl border border-slate-200/80 dark:border-navy-700/60 shadow-md overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600"></div>
        <div className="bg-slate-50/50 dark:bg-navy-800/30 p-4 border-b border-slate-100/80 dark:border-navy-700/50 flex items-center justify-between backdrop-blur-sm">
          <div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-xs tracking-widest uppercase">Target Student</h3>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-500/20">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400">ISOLATED MODE</span>
          </div>
        </div>
        <div className="p-6 flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-2xl shrink-0 border border-brand-200/50 dark:border-brand-700/50 shadow-inner">
            {studentName ? studentName.charAt(0) : 'S'}
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">{studentName || 'Unknown Student'}</h4>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-slate-500 font-medium mt-1.5">
              <span className="text-slate-700 dark:text-slate-300 bg-white dark:bg-navy-800 px-2.5 py-1 rounded-md font-bold font-mono border border-slate-200 dark:border-navy-600 shadow-sm whitespace-nowrap">{regNo || studentId}</span>
              <span className="text-slate-300 dark:text-slate-600 font-bold hidden sm:inline">•</span>
              <span className="text-slate-600 dark:text-slate-400 w-full sm:w-auto">{deptName || 'Department'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 p-8 rounded-2xl border border-slate-200/80 dark:border-navy-700/60 shadow-lg shadow-slate-200/20 dark:shadow-none">
        
        <div className="space-y-10">
          
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 font-bold text-xs">1</div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Select Report Type</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => setReportType(rt.id)}
                  className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${
                    reportType === rt.id 
                      ? 'bg-gradient-to-b from-brand-50 to-white dark:from-brand-900/30 dark:to-navy-900 border-brand-400 dark:border-brand-500 shadow-md shadow-brand-500/10 scale-[1.02]' 
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-brand-300 dark:hover:border-navy-500 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {reportType === rt.id && (
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-brand-500 text-white rounded-full p-1 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`mb-4 p-2.5 w-fit rounded-xl transition-colors ${reportType === rt.id ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 shadow-inner' : 'bg-slate-50 text-slate-500 dark:bg-navy-800 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-navy-700'}`}>
                    {rt.icon}
                  </div>
                  <h5 className={`font-extrabold text-sm mb-1.5 tracking-wide ${reportType === rt.id ? 'text-brand-700 dark:text-brand-400' : 'text-slate-800 dark:text-slate-200'}`}>{rt.title}</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{rt.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 font-bold text-xs">2</div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Output Format</label>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-start p-4 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-gradient-to-r from-rose-50 to-white dark:from-rose-950/20 dark:to-navy-900 text-rose-700 dark:text-rose-400 shadow-sm gap-4 transition-all hover:shadow-md">
                <div className="bg-rose-100 dark:bg-rose-900/40 p-2.5 rounded-lg">
                  <FileText className="w-6 h-6 text-rose-600 dark:text-rose-500 shrink-0" />
                </div>
                <div>
                  <div className="text-sm font-extrabold tracking-wide">PDF Document</div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Institutional Vector PDF Export</div>
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

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full min-h-[54px] py-3.5 px-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 active:scale-[0.99] text-white rounded-xl font-black text-sm sm:text-[15px] tracking-wide shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-85 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <div className="relative flex items-center justify-center gap-3 sm:gap-3.5 w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 shrink-0 animate-spin text-white" />
                    <span className="whitespace-nowrap truncate font-black">GENERATING PDF REPORT...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform text-white" />
                    <span className="whitespace-nowrap truncate font-black">GENERATE & DOWNLOAD</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
