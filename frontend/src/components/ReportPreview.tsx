import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, RefreshCw, X, AlertTriangle } from 'lucide-react';
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

  const downloadFile = (format: string) => {
    const url = `/reports/${reportId}/${format}`;
    api.get(url, { responseType: 'blob' }).then(res => {
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${report?.reportType}_${reportId}.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-navy-900 p-8 rounded-3xl flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <p className="font-bold text-gray-700 dark:text-gray-300">Fetching verified report dataset...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-navy-950 overflow-hidden">
      {/* Toolbar */}
      <div className="h-16 bg-white dark:bg-navy-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-lg">{report.title}</h2>
          {report.dataStatus === 'INVALID' && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>DRAFT / INVALID</span>
            </span>
          )}
          {report.dataStatus === 'READY' && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
              🟢 READY
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <button onClick={() => downloadFile('excel')} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button onClick={() => downloadFile('pdf')} className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md">
            <FileText className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button onClick={() => downloadFile('word')} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md">
            <FileText className="w-4 h-4" />
            <span>Word</span>
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-10 min-h-full">
          <div className="text-center space-y-2 mb-10 border-b border-gray-100 dark:border-gray-800 pb-6">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wider">
              NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
            </h1>
            <h2 className="text-lg font-bold text-brand-600">{report.title}</h2>
            <div className="flex justify-center space-x-6 text-xs text-gray-500 mt-4">
              <p>Generated At: {new Date(report.generatedAt).toLocaleString()}</p>
              <p>Verified At: {new Date(report.verifiedAt).toLocaleString()}</p>
              <p>Report ID: {report.reportId.split('-')[0]}</p>
            </div>
          </div>

          {report.message && (
            <div className="mb-8 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{report.message}</span>
            </div>
          )}

          {/* Metrics */}
          {report.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {Object.entries(report.metrics).map(([key, value]) => (
                <div key={key} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{value !== null ? value : "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table Data */}
          {report.allStudents && (
            <div className="mt-8 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-navy-950 text-gray-500 text-xs uppercase font-black">
                  <tr>
                    <th className="px-4 py-3">S.No</th>
                    <th className="px-4 py-3">Reg No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Dept</th>
                    <th className="px-4 py-3 text-right">Total Solved</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.allStudents.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold">{s.reg_no}</td>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{s.dept}</td>
                      <td className="px-4 py-3 text-right font-black text-brand-600">{s.total_solved !== null ? s.total_solved : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black rounded-full ${s.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
