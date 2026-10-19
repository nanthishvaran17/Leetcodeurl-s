import React, { useState } from 'react';
import api from '../../services/api';
import { 
  FileText, Download, Loader2, CheckCircle2, AlertCircle, User, Grid,
  ShieldCheck, Award, Lock, Check, Fingerprint, X
} from 'lucide-react';
import { downloadManager } from '../../services/download/downloadManager';
import { formatDepartmentCode, deriveDepartmentFromRegNo } from '../../utils/filterUtils';

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
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-900/60 rounded-2xl border border-slate-200 dark:border-navy-700">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No Student Selected</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Please select a student from the dashboard to generate their personalized reports.</p>
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
    <div className="space-y-6 animate-fade-in mt-2 max-w-4xl mx-auto">
      
      {/* Target Student Header Card — 2026 Glassmorphic Identity Panel */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-[#0d1527] to-[#070b14] rounded-3xl border border-white/10 p-5 sm:p-6 text-white shadow-2xl shadow-indigo-950/40 backdrop-blur-xl">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
            <span className="text-[11px] font-mono font-black uppercase tracking-widest text-indigo-300">
              Institutional Report Engine
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVE STUDENT
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-4 sm:gap-5">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-brand-600 to-purple-600 text-white flex items-center justify-center font-display font-black text-2xl sm:text-3xl shrink-0 border border-white/20 shadow-xl shadow-indigo-500/25">
            {studentName ? studentName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-black text-white text-lg sm:text-2xl tracking-tight truncate leading-tight">
              {studentName || 'Unknown Student'}
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-lg font-mono text-xs font-black bg-white/10 text-indigo-200 border border-white/15 backdrop-blur-md">
                {regNo || studentId}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                {formatDepartmentCode(deptName) || deriveDepartmentFromRegNo(regNo) || deptName || 'CSE(CS)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Configuration Panel */}
      <div className="bg-white/80 dark:bg-slate-900/70 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-xl space-y-8">
        
        {/* Step 1: Report Type Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-brand-500/25">
                1
              </div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Select Report Type
              </label>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
              3 FORMATS AVAILABLE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {reportTypes.map((rt) => {
              const isSelected = reportType === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setReportType(rt.id)}
                  className={`group relative p-5 rounded-2xl text-left transition-all duration-200 cursor-pointer overflow-hidden border touch-manipulation active:scale-[0.98] ${
                    isSelected 
                      ? 'bg-gradient-to-br from-indigo-500/10 via-brand-500/5 to-transparent dark:from-indigo-500/20 dark:via-brand-500/10 dark:to-transparent border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-500/15 -translate-y-0.5' 
                      : 'bg-slate-50/70 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-0.5'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`mb-3.5 p-3 w-fit rounded-xl transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-br from-indigo-500 to-brand-600 text-white shadow-md shadow-indigo-500/25' 
                      : 'bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 group-hover:scale-105'
                  }`}>
                    {rt.icon}
                  </div>

                  <h5 className={`font-black text-sm tracking-wide mb-1 ${
                    isSelected ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-white'
                  }`}>
                    {rt.title}
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {rt.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Output Format (PDF Institutional Vector Export) - Simple & Clean */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-brand-500/25">
              2
            </div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Output Format
            </label>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border-2 border-indigo-500/60 dark:border-indigo-400/50 flex items-center justify-between gap-4 transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h5 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                  Institutional Vector PDF
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  High-res accredited report with verification stamp and official crest watermark
                </p>
              </div>
            </div>

            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Feedback Alerts — Crisp High-Contrast Theme-Adaptive Banner */}
        {(error || success) && (
          <div className="pt-1 animate-fade-in">
            {error && (
              <div className="p-4 sm:p-4.5 bg-rose-50/95 dark:bg-rose-950/40 border-2 border-rose-500/30 dark:border-rose-500/40 rounded-2xl sm:rounded-3xl flex items-center justify-between gap-3.5 shadow-lg shadow-rose-500/10 dark:shadow-rose-950/40 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30 border border-white/20">
                    <AlertCircle className="w-5 h-5 text-white stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-[15px] font-black text-slate-900 dark:text-white tracking-tight">
                      Generation Alert
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-medium mt-0.5 leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {success && (
              <div className="p-4 sm:p-4.5 bg-emerald-50/95 dark:bg-emerald-950/40 border-2 border-emerald-500/40 dark:border-emerald-500/40 rounded-2xl sm:rounded-3xl flex items-center justify-between gap-3.5 shadow-lg shadow-emerald-500/10 dark:shadow-emerald-950/40 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30 border border-white/20">
                    <CheckCircle2 className="w-5 h-5 text-white stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-[15px] font-black text-slate-900 dark:text-white tracking-tight">
                      PDF Report Downloaded Successfully!
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold mt-0.5 leading-relaxed">
                      Accredited Vector PDF compiled with embedded verification stamp &amp; watermark.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black text-xs tracking-wider uppercase shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    DONE
                  </span>
                  <button
                    type="button"
                    onClick={() => setSuccess(null)}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition-colors cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Generate & Download CTA — Ultra-premium 2026 Luminous Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full min-h-[62px] py-4 px-6 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:via-indigo-500 hover:to-purple-500 active:scale-[0.99] text-white rounded-2xl sm:rounded-3xl font-black text-sm sm:text-base tracking-wider uppercase shadow-2xl shadow-indigo-600/40 hover:shadow-indigo-600/60 border border-white/20 transition-all duration-300 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed group relative overflow-hidden touch-manipulation"
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            
            <div className="relative z-10 flex items-center justify-center gap-3.5 w-full">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 shrink-0 animate-spin text-white" />
                  <span className="font-sans font-black tracking-wide">COMPILING HIGH-RES VECTOR PDF ARCHIVE...</span>
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-xl bg-white/20 backdrop-blur-md shadow-inner border border-white/20">
                    <Download className="w-5 h-5 shrink-0 text-white group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="flex flex-col items-start sm:items-center text-left sm:text-center">
                    <span className="font-sans font-black tracking-wider leading-none">GENERATE &amp; DOWNLOAD REPORT</span>
                    <span className="text-[10px] text-indigo-200 font-mono font-bold tracking-widest uppercase mt-1">Official Accredited Document • Lossless Vector</span>
                  </div>
                </>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
