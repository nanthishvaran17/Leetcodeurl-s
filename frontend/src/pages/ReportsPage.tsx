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

  const handleDownloadOfficialSummary = () => {
    window.open('/api/reports/export-official-college-summary', '_blank');
  };

  const handleDownloadMatrix2028 = () => {
    window.open('/api/reports/export-weekly-contest-matrix?batch=2028', '_blank');
  };

  const handleDownloadMatrix2029 = () => {
    window.open('/api/reports/export-weekly-contest-matrix?batch=2029', '_blank');
  };

  const handleDownloadMasterTracker = () => {
    window.open('/api/reports/export-master-tracker', '_blank');
  };

  const handleDownloadPDF = () => {
    window.open('/api/reports/export-pdf', '_blank');
  };

  const handleSendWeeklyEmail = async () => {
    setIsSendingEmail(true);
    try {
      const res = await api.post('/reports/send-weekly-email');
      alert(res.data.message);
      fetchEmailLogs();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to dispatch email report.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const reportCards = [
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
      badge: 'PRINTABLE PDF',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      description: 'High-resolution printable PDF report with official college header branding, executive summary table, department statistics, and top performers.',
      filename: 'Executive_PDF_Summary.pdf',
      icon: FileText,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      btnGradient: 'from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-600/30',
      onClick: handleDownloadPDF
    }
  ];

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      
      {/* Top Banner & Action */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-1.5 relative z-10 max-w-2xl">
          <div className="flex items-center space-x-2 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Nandha Engineering College Export Suite</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Reports & Export Center
          </h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Download individual formatted Excel workbooks, executive PDF summaries, and dispatch automated Sunday email reports to management.
          </p>
        </div>

        <button
          onClick={handleSendWeeklyEmail}
          disabled={isSendingEmail}
          className="relative z-10 flex items-center space-x-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Mail className={`w-4 h-4 ${isSendingEmail ? 'animate-bounce' : ''}`} />
          <span>{isSendingEmail ? 'Dispatching Emails...' : '📧 Dispatch Weekly Email Report Now'}</span>
        </button>

        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
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
