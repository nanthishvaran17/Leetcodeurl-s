import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Mail, CheckCircle2, FileText, Sparkles, Send, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export const ReportsPage: React.FC = () => {
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    try {
      const res = await api.get('/reports/email-logs');
      setEmailLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadReportFile = async (endpoint: string, filename: string) => {
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      const fallbackUrl = `/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      window.open(fallbackUrl, '_blank');
    }
  };

  const handleDownloadOfficialSummary = () => {
    downloadReportFile('/reports/export-official-college-summary', 'Nandha_College_Official_Weekly_Report.xlsx');
  };

  const handleDownloadStudentDetail = () => {
    downloadReportFile('/reports/export-official-college-summary', 'Nandha_Student_Performance_Detail.xlsx');
  };

  const handleDownloadMatrix2028 = () => {
    downloadReportFile('/reports/export-weekly-contest-matrix?batch=2028', 'Batch_2028_Contest_Matrix.xlsx');
  };

  const handleDownloadMatrix2029 = () => {
    downloadReportFile('/reports/export-weekly-contest-matrix?batch=2029', 'Batch_2029_Contest_Matrix.xlsx');
  };

  const handleDownloadMasterTracker = () => {
    downloadReportFile('/reports/export-master-tracker', 'Full_8_Sheet_Master_Tracker.xlsx');
  };

  const handleDownloadPDF = () => {
    downloadReportFile('/reports/export-pdf', 'Executive_PDF_Summary.pdf');
  };

  const handleDownloadWord = () => {
    downloadReportFile('/reports/export-word', 'Executive_Word_Summary.docx');
  };

  const [recipientInput, setRecipientInput] = useState<string>("nanthishvaran17@gmail.com, msanthoshkumar@nandhaengg.org");

  const handleSendWeeklyEmail = async () => {
    setIsSendingEmail(true);
    try {
      const res = await api.post('/reports/send-weekly-email', {
        recipient_emails: recipientInput
      });
      alert(res.data.message);
      fetchEmailLogs();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to dispatch email report.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadCSV = () => {
    downloadReportFile('/reports/export-csv', 'LeetCode_Student_Performance_Report.csv');
  };

  const reportCards = [
    {
      id: 'student-detail',
      title: 'Student Performance Detail Excel',
      badge: '📊 LOGO + PER-DEPT/YEAR SHEETS',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      description: 'Multi-sheet workbook: Cover sheet with college logo, separate sheets for CSE(CS)-IIYr, CSE(CS)-IIIYr, CSE(CS)-IVYr, CSE(IoT)-IIYr, CSE(IoT)-IIIYr, CSE(IoT)-IVYr. Contains S.No, Name, Reg No, Dept, Year, LeetCode Profile Link, Username, Easy, Medium, Hard, Total Solved, Contest Rating & Global Rank + Category Summary (Above 500, 250-500, etc.).',
      filename: 'Nandha_Student_Performance_Detail.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      btnGradient: 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/30',
      onClick: handleDownloadStudentDetail
    },
    {
      id: 'csv-export',
      title: 'Student Performance CSV Export',
      badge: '📑 RAW SPREADSHEET (CSV)',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      description: 'Direct CSV file format containing all student performance metrics: S.No, Register No, Name, Department, Year, LeetCode URL, Username, Easy, Medium, Hard, Total Solved, Rating, Global Rank. Openable in any spreadsheet software.',
      filename: 'LeetCode_Student_Performance_Report.csv',
      icon: FileText,
      iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      btnGradient: 'from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-600/30',
      onClick: handleDownloadCSV
    },
    {
      id: 'official-summary',
      title: 'Official College Weekly Excel',
      badge: 'OFFICIAL TEMPLATE',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Formatted with official Nandha Engineering College header branding, batch breakdown (2023-2027, 2024-2028, 2025-2029), problem metrics & contest stats on separate sheets for CSE(CS) and CSE(IOT).',
      filename: 'Nandha_College_Official_Weekly_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      btnGradient: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30',
      onClick: handleDownloadOfficialSummary
    },
    {
      id: 'matrix-2028',
      title: 'Batch 2028 Contest Matrix Excel',
      badge: 'III YEAR BATCH',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      description: 'Weekly Contest & Problem Solving Count matrix report for Batch 2028 (III Year) with official college header, August Sunday date blocks, and separate CSE(CS) & CSE(IOT) sheets.',
      filename: 'Batch_2028_Contest_Matrix.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      btnGradient: 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-600/30',
      onClick: handleDownloadMatrix2028
    },
    {
      id: 'matrix-2029',
      title: 'Batch 2029 Contest Matrix Excel',
      badge: 'II YEAR BATCH',
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      description: 'Weekly Contest & Problem Solving Count matrix report for Batch 2029 (II Year) with official college header, August Sunday date blocks, and separate CSE(CS) & CSE(IOT) sheets.',
      filename: 'Batch_2029_Contest_Matrix.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
      btnGradient: 'from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-brand-600/30',
      onClick: handleDownloadMatrix2029
    },
    {
      id: 'master-tracker',
      title: 'Full 8-Sheet Master Tracker Excel',
      badge: 'ALL-IN-ONE WORKBOOK',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Complete master tracking workbook containing Student Master, Current Statistics, Session Logs, College Leaderboard, Department Leaderboards, and Audit Error Logs.',
      filename: 'Full_8_Sheet_Master_Tracker.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      btnGradient: 'from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-600/30',
      onClick: handleDownloadMasterTracker
    },
    {
      id: 'pdf-summary',
      title: 'Executive PDF Summary Report',
      badge: 'PRINTABLE PDF (TIMES NEW ROMAN)',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      description: 'High-resolution printable PDF report with official college header branding, executive summary table, department statistics, and top performers styled strictly in Times New Roman.',
      filename: 'Executive_PDF_Summary.pdf',
      icon: FileText,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      btnGradient: 'from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-600/30',
      onClick: handleDownloadPDF
    },
    {
      id: 'word-summary',
      title: 'Executive Word Summary (.DOCX)',
      badge: 'WORD DOCX (TIMES NEW ROMAN)',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Editable Microsoft Word document report with official Nandha Engineering College header, executive summary table, and student performance roster styled in Times New Roman.',
      filename: 'Executive_Word_Summary.docx',
      icon: FileText,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      btnGradient: 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-600/30',
      onClick: handleDownloadWord
    }
  ];

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>NANDHA ENGINEERING COLLEGE EXPORT SUITE</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Reports & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Export Center</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Download individual formatted Excel workbooks, executive PDF summaries, and dispatch automated Sunday email reports to management
            </p>
          </div>

          <button
            onClick={handleSendWeeklyEmail}
            disabled={isSendingEmail}
            className="flex items-center space-x-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/30 transition-all transform hover:scale-105"
          >
            <Mail className={`w-4 h-4 ${isSendingEmail ? 'animate-bounce' : ''}`} />
            <span>{isSendingEmail ? 'Dispatching Emails...' : '📧 Dispatch Weekly Email Report Now'}</span>
          </button>
        </div>
      </div>

      {/* Email Report Dispatch Configuration Card */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-xl space-y-4 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Email Report Dispatch Configuration
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                Automated & manual weekly email dispatch target recipients for Nandha Engineering College Management
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSendWeeklyEmail}
            disabled={isSendingEmail}
            className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105"
          >
            <Send className={`w-4 h-4 ${isSendingEmail ? 'animate-bounce' : ''}`} />
            <span>{isSendingEmail ? 'Dispatching...' : '📧 Send Report to Management Now'}</span>
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Recipient Email Addresses (Comma Separated)
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="e.g. nanthishvaran17@gmail.com, msanthoshkumar@nandhaengg.org"
              className="flex-1 px-4 py-3 bg-white dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner"
            />
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 inline" />
            <span>Configured Recipients: <b>nanthishvaran17@gmail.com</b> and <b>msanthoshkumar@nandhaengg.org</b></span>
          </p>
        </div>
      </div>

      {/* Grid of Standardized Equal-Height Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {reportCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              className="group glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800/80 shadow-md hover:shadow-2xl hover:border-brand-500/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between space-y-6 relative overflow-hidden"
            >
              
              {/* Top Card Info */}
              <div className="space-y-4">
                
                {/* Header Icon + Badge */}
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${card.badgeColor} uppercase tracking-wider`}>
                    {card.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    {card.description}
                  </p>
                </div>

              </div>

              {/* Bottom Action Button */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
                <button
                  onClick={card.onClick}
                  className={`w-full py-3 px-4 rounded-2xl bg-gradient-to-r ${card.btnGradient} text-white font-extrabold text-xs shadow-md transition-all duration-200 flex items-center justify-center space-x-2 group-hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]`}
                >
                  <Download className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5" />
                  <span className="truncate">Download {card.filename}</span>
                </button>
                <div className="text-center text-[10px] text-gray-400 font-mono">
                  File: <span className="font-semibold">{card.filename}</span>
                </div>
              </div>

              {/* Decorative Corner Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/10 to-transparent pointer-events-none rounded-bl-3xl" />
            </div>
          );
        })}
      </div>

      {/* Automated Email History Table */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Automated Sunday Email Dispatch History
              </h3>
              <p className="text-xs text-gray-500">Log of automatically dispatched weekly performance emails</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
            <span>APScheduler Active (Sundays 09:30 AM IST)</span>
          </div>
        </div>

        {emailLogs.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl space-y-2">
            <Send className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-500 font-bold">No email dispatches recorded yet.</p>
            <p className="text-[11px] text-gray-400">Click "Dispatch Weekly Email Report Now" above to trigger a test dispatch.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
            {emailLogs.map((log) => (
              <div key={log.id} className="py-3.5 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50/50 dark:hover:bg-navy-900/30 px-3 rounded-xl transition-colors">
                <div className="space-y-0.5">
                  <p className="font-bold text-gray-900 dark:text-white">{log.subject}</p>
                  <p className="text-gray-500 text-[11px]">Recipient: <span className="font-semibold text-gray-700 dark:text-gray-300">{log.recipient}</span></p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] text-gray-400 font-mono">{log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                    log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
