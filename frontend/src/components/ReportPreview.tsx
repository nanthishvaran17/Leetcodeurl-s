import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle, Trophy, Layers, Award } from 'lucide-react';
import api from '../services/api';

interface ReportPreviewProps {
  reportId: string;
  onClose: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ reportId, onClose }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get(`/reports/${reportId}/preview`);
        setReport(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  const downloadFile = async (format: string) => {
    try {
      const url = `/reports/${reportId}/${format}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;
      
      const contentDisposition = res.headers['content-disposition'];
      let filename = `${report?.reportType || 'REPORT'}_${reportId}.${ext}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error(`Failed to download ${format} report:`, err);
      const statusCode = err.response?.status;
      if (statusCode === 401) {
        alert("Authentication required. Please sign in again.");
      } else if (statusCode === 403) {
        alert("You do not have permission to generate this institutional report.");
      } else if (statusCode === 404) {
        alert("Report resource not found.");
      } else if (statusCode === 422) {
        alert("Invalid report parameters.");
      } else if (statusCode === 500) {
        alert("Report generation failed on the server. Check server logs.");
      } else {
        alert(`Failed to download ${format.toUpperCase()} report. Please try again.`);
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-navy-900 p-8 rounded-3xl flex flex-col items-center space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <p className="font-bold text-gray-700 dark:text-gray-300">Fetching verified report dataset...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const dataQuality = report.dataQuality;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-navy-900 w-full max-w-5xl max-h-[88vh] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden my-auto animate-modal-content">
        
        {/* ── 1. SLEEK GRADIENT HEADER (Matches Image 2) ── */}
        <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/30">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-base sm:text-lg text-white flex items-center space-x-2 truncate">
                <span className="truncate">{report.title}</span>
                {report.dataStatus === 'READY' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold shrink-0">
                    🟢 READY
                  </span>
                )}
              </h2>
              <p className="text-xs text-blue-200/80 font-medium mt-0.5 truncate">
                Report ID: <span className="font-mono text-amber-300">{report.reportId}</span> • Generated: {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="shrink-0 ml-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* ── 2. FILTER / SUMMARY AREA ── */}
        {dataQuality && (
          <div className="px-5 py-3 bg-gray-100 dark:bg-navy-950 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs font-bold shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-black">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Roster Integrity:</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black">
                Verified: {dataQuality.valid_count} / {dataQuality.total_students}
              </span>
              {dataQuality.unverified_count > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black">
                  Unverified: {dataQuality.unverified_count}
                </span>
              )}
            </div>
            <span className="text-brand-600 dark:text-brand-400 font-mono font-bold text-[11px]">
              Nandha Engineering College (Autonomous)
            </span>
          </div>
        )}

        {/* ── 3. SCROLLABLE REPORT CONTENT ── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

          {report.message && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-2xl font-bold flex items-center space-x-2 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{report.message}</span>
            </div>
          )}

          {/* Metrics Overview Cards */}
          {report.metrics && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">Executive Summary Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(report.metrics).map(([key, value]) => (
                  <div key={key} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-center shadow-sm">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">
                      {value !== null && value !== undefined ? (typeof value === 'number' && value > 999 ? value.toLocaleString() : String(value)) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Distribution Grid */}
          {report.distribution && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>Problem Solving Category Distribution</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(report.distribution).map(([cat, count]: [string, any]) => (
                  <div key={cat} className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-center">
                    <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">{cat}</div>
                    <div className="text-lg font-black text-purple-700 dark:text-purple-400">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performers Table */}
          {report.topStudents && report.topStudents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center space-x-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Top Performers Leaderboard</span>
              </h3>
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-navy-950 text-white font-black uppercase">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 text-center">Dept</th>
                      <th className="px-4 py-3 text-center">Year</th>
                      <th className="px-4 py-3 text-right">Easy</th>
                      <th className="px-4 py-3 text-right">Medium</th>
                      <th className="px-4 py-3 text-right">Hard</th>
                      <th className="px-4 py-3 text-right">Total Solved</th>
                      <th className="px-4 py-3 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.topStudents.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-center font-black text-amber-500">#{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{s.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{s.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                        <td className="px-4 py-2.5 text-center">{s.year}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{s.easy ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{s.medium ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{s.hard ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">{s.total_solved ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">{s.rating ? Math.round(s.rating) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full Student Roster Table */}
          {report.allStudents && report.allStudents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                Full Student Performance Roster ({report.allStudents.length} Students)
              </h3>
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm max-h-[450px] overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-center">S.No</th>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3 text-center">Dept</th>
                      <th className="px-4 py-3 text-center">Year</th>
                      <th className="px-4 py-3 text-right">Easy</th>
                      <th className="px-4 py-3 text-right">Medium</th>
                      <th className="px-4 py-3 text-right">Hard</th>
                      <th className="px-4 py-3 text-right">Total Solved</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.allStudents.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{s.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{s.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.dept}</td>
                        <td className="px-4 py-2.5 text-center">{s.year}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{s.easy ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold">{s.medium ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400 font-semibold">{s.hard ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">{s.total_solved !== null ? s.total_solved : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${s.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Official Contest Participations Table */}
          {report.participations && report.participations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-emerald-500" />
                <span>Official Contest Participation Log ({report.participations.length} Entries)</span>
              </h3>
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-navy-950 text-white font-black uppercase">
                    <tr>
                      <th className="px-4 py-3 text-center">S.No</th>
                      <th className="px-4 py-3">Contest Name</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3 text-center">Dept</th>
                      <th className="px-4 py-3 text-center">Problems Solved</th>
                      <th className="px-4 py-3 text-right">Contest Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.participations.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-black text-brand-600 dark:text-brand-400">{p.contest_name}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono">{p.date}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{p.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{p.student_name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{p.dept}</td>
                        <td className="px-4 py-2.5 text-center font-black text-emerald-600 dark:text-emerald-400">
                          {p.problems_solved} / {p.total_problems || 4}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-700 dark:text-gray-300">{p.rank ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* ── 4. FOOTER / EXPORT ACTIONS ── */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 font-semibold flex items-center space-x-2">
            <span>Official Institutional Report Dataset</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => downloadFile('excel')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button onClick={() => downloadFile('pdf')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button onClick={() => downloadFile('word')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>Word</span>
            </button>
            <button onClick={() => downloadFile('csv')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <FileText className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button onClick={() => downloadFile('zip')} className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-105">
              <Download className="w-4 h-4" />
              <span>All (.zip)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
