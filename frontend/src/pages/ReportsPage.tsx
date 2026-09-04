import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Mail, CheckCircle2, FileText, Sparkles, Send, ShieldCheck, Camera, History, LayoutTemplate, PlayCircle, Layers, Inbox, Trash2, Award, Clock, Building2, GraduationCap, ChevronDown, Check, Target } from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import api from '../services/api';
import { ReportPreview } from '../components/ReportPreview';
import { EmailDeliveryTab } from '../components/EmailDeliveryTab';
import { CertificateManagementModal } from '../components/CertificateManagementModal';
import { ConfirmDeleteModal, DeleteItemInfo } from '../components/ConfirmDeleteModal';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export const ReportsPage: React.FC = () => {
  const { notify } = useNotification();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'email' | 'manual_email' | 'auto_email'>('reports');
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [hodSnapshots, setHodSnapshots] = useState<any[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState<boolean>(false);
  const [selectedSnapshotPreview, setSelectedSnapshotPreview] = useState<any>(null);
  const [activeUniversalPreviewId, setActiveUniversalPreviewId] = useState<string | null>(null);
  const [isGeneratingUniversal, setIsGeneratingUniversal] = useState<boolean>(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('STUDENT_PERFORMANCE');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedOutputScope, setSelectedOutputScope] = useState<string>('COLLEGE');

  const [rptYearOpen, setRptYearOpen] = useState<boolean>(false);
  const [rptScopeOpen, setRptScopeOpen] = useState<boolean>(false);
  const [rptTypeOpen, setRptTypeOpen] = useState<boolean>(false);

  // Floating Center Delete Modal & Toast States
  const [deleteModalItem, setDeleteModalItem] = useState<DeleteItemInfo | null>(null);
  const [isDeletingSnapshot, setIsDeletingSnapshot] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailLogs();
    fetchHodSnapshots();
  }, []);

  const fetchEmailLogs = async () => {
    try {
      const res = await api.get('/reports/email-logs');
      setEmailLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch email logs", err);
    }
  };

  const fetchHodSnapshots = async () => {
    try {
      const res = await api.get('/reports/hod-snapshots');
      setHodSnapshots(res.data);
    } catch (err) {
      console.error("Failed to fetch HOD snapshots", err);
    }
  };

  const handleGenerateHodSnapshot = async () => {
    setIsGeneratingSnapshot(true);
    try {
      const res = await api.post('/reports/generate-hod-snapshot');
      const newSnapshot = {
        snapshot_id: res.data.snapshot_id || `snap_${Date.now()}`,
        title: res.data.title || "Executive HOD Snapshot",
        created_at: new Date().toISOString(),
        metrics: res.data.metrics || {}
      };
      setToastMessage("HOD Executive Snapshot captured successfully!");
      setTimeout(() => setToastMessage(null), 4000);
      setHodSnapshots(prev => [newSnapshot, ...prev.filter(s => s.snapshot_id !== newSnapshot.snapshot_id)]);
      setSelectedSnapshotPreview(newSnapshot);
      fetchHodSnapshots();
    } catch (err: any) {
      setToastMessage(`${err.response?.data?.detail || "Failed to generate HOD snapshot."}`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsGeneratingSnapshot(false);
    }
  };

  const promptDeleteHodSnapshot = (snap: any) => {
    setDeleteError(null);
    setDeleteModalItem({
      id: snap.snapshot_id,
      title: snap.title || "HOD Executive Snapshot",
      type: "HOD Snapshot",
      metrics: `${snap.metrics?.synced_students || 0} / ${snap.metrics?.total_students || 0} Verified • ${(snap.metrics?.total_solved_college || 0).toLocaleString()} Solved`,
      created_at: new Date(snap.created_at).toLocaleString()
    });
  };

  const executeDeleteHodSnapshot = async () => {
    if (!deleteModalItem) return;
    setIsDeletingSnapshot(true);
    setDeleteError(null);
    try {
      await api.delete(`/reports/hod-snapshots/${deleteModalItem.id}`);
      setHodSnapshots(prev => prev.filter(s => s.snapshot_id !== deleteModalItem.id));
      if (selectedSnapshotPreview?.snapshot_id === deleteModalItem.id) {
        setSelectedSnapshotPreview(null);
      }
      setDeleteModalItem(null);
      setToastMessage("HOD Snapshot deleted successfully");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || err.message || "Failed to delete snapshot.");
    } finally {
      setIsDeletingSnapshot(false);
    }
  };
  const downloadReportFile = async (endpoint: string, filename: string) => {
    setToastMessage("Generating report dataset from database...");
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
      setToastMessage(`${filename} downloaded successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Download error:', err);
      let statusCode = err.response?.status;
      let errMsg = 'Failed to generate report.';

      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.detail) errMsg = parsed.detail;
        } catch (_e) { }
      } else if (err.response?.data?.detail) {
        errMsg = err.response.data.detail;
      }

      setToastMessage(`${errMsg}`);
      setTimeout(() => setToastMessage(null), 5000);

      if (statusCode === 401) {
        notify.error('Authentication Required', 'Please sign in again.', { category: 'AUTH' });
      } else if (statusCode === 403) {
        notify.error('Access Denied', 'You do not have permission to generate this institutional report.', { category: 'SECURITY' });
      } else if (statusCode === 404) {
        notify.error('Not Found', 'Report resource not found.', { category: 'REPORTS' });
      } else if (statusCode === 422) {
        notify.error('Invalid Parameters', 'Invalid report parameters.', { category: 'REPORTS' });
      }
    }
  };

  const handleDownloadOfficialSummary = () => {
    downloadReportFile('/reports/export-official-college-summary', 'Nandha_College_Official_Weekly_Report.xlsx');
  };

  const handleDownloadStudentDetail = () => {
    downloadReportFile('/reports/export-student-performance-detail', 'Nandha_Student_Performance_Detail.xlsx');
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

  const [recipientInput, setRecipientInput] = useState<string>("nanthishvaran17@gmail.com");

  const handleSendWeeklyEmail = async () => {
    setIsSendingEmail(true);
    notify.info('Sending Email Report', 'Dispatching automated email report...', { category: 'EMAIL ENGINE' });
    try {
      const res = await api.post('/reports/send-weekly-email', {
        recipient_emails: recipientInput
      });
      notify.success('Email Dispatched', res.data.message || 'Weekly report dispatched successfully.', { category: 'EMAIL ENGINE' });
      fetchEmailLogs();
    } catch (err: any) {
      notify.error('Email Dispatch Failed', err.response?.data?.detail || "Failed to dispatch email report.", { category: 'EMAIL ENGINE' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleGenerateUniversalReport = async (overrideType?: string, overrideFilters?: any) => {
    setIsGeneratingUniversal(true);
    notify.info('Generating Universal Report', 'Processing custom filters...', { category: 'UNIVERSAL REPORT' });
    try {
      const reportType = overrideType || selectedReportType;
      const department = overrideFilters?.department || selectedDept;
      const year = overrideFilters?.year || selectedYear;
      const output_scope = overrideFilters?.output_scope || selectedOutputScope;

      const res = await api.post('/reports/generate', {
        report_type: reportType,
        department: department,
        year: year,
        output_scope: output_scope,
        filters: overrideFilters || {}
      });
      setActiveUniversalPreviewId(res.data.reportId || res.data.report_id);
      notify.success('Report Ready', 'Universal report generated successfully.', { category: 'UNIVERSAL REPORT' });
    } catch (err: any) {
      const statusCode = err.response?.status;
      const detailMsg = err.response?.data?.detail;
      if (statusCode === 401) {
        notify.error('Authentication Required', 'Please sign in again.', { category: 'AUTH' });
      } else if (statusCode === 403) {
        notify.error('Access Denied', 'You do not have permission to generate this institutional report.', { category: 'SECURITY' });
      } else if (statusCode === 404) {
        notify.error('Not Found', 'Report resource not found.', { category: 'REPORTS' });
      } else if (statusCode === 422) {
        notify.error('Invalid Parameters', 'Invalid report parameters.', { category: 'REPORTS' });
      } else if (statusCode === 500) {
        notify.error('Server Error', 'Report generation failed on the server.', { category: 'REPORTS' });
      } else {
        notify.error('Report Error', detailMsg || "Failed to generate report.", { category: 'REPORTS' });
      }
    } finally {
      setIsGeneratingUniversal(false);
    }
  };

  const handleDownloadCSV = () => {
    downloadReportFile('/reports/export-csv', 'LeetCode_Student_Performance_Report.csv');
  };

  const reportCards = [
    {
      id: 'student-detail',
      title: 'Student Performance Detail Excel',
      badge: 'LOGO + PER-DEPT/YEAR SHEETS',
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
      badge: 'RAW SPREADSHEET (CSV)',
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
      btnGradient: 'from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 shadow-indigo-600/30',
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
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      description: 'Editable Microsoft Word document report with official Nandha Engineering College header, executive summary table, and student performance roster styled in Times New Roman.',
      filename: 'Executive_Word_Summary.docx',
      icon: FileText,
      iconBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
      btnGradient: 'from-brand-600 to-cyan-600 hover:from-brand-700 hover:to-cyan-700 shadow-brand-600/30',
      onClick: handleDownloadWord
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pt-1 sm:pt-0 pb-10 animate-fade-in">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-lg border border-brand-500/30">

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? (
                <>
                  MY <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">EXPORT SUITE</span>
                </>
              ) : (
                <>
                  Reports & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Export Center</span>
                </>
              )}
            </h1>

            <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '')
                ? "Download individual formatted Excel workbooks and reports for your assigned students."
                : "Download individual formatted Excel workbooks, executive PDF summaries, and dispatch automated Sunday email reports to management"}
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button
              onClick={() => setShowCertModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all transform hover:scale-105 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Generate Merit Certificates</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center space-x-2 bg-slate-100 dark:bg-navy-950 p-1.5 rounded-2xl max-w-fit border border-slate-200 dark:border-slate-800 flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'reports'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Reports & Analytics Suite</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'email' || activeTab === 'manual_email' || activeTab === 'auto_email'
              ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Mail className="w-4 h-4 text-emerald-400" />
          <span>Email Operations Center</span>
        </button>
      </div>

      {activeTab === 'email' || activeTab === 'manual_email' || activeTab === 'auto_email' ? (
        <EmailDeliveryTab defaultSection="manual" />
      ) : (
        <>

          {/* Universal Institutional Reports Section */}
          <div className={`glass-card p-6 md:p-8 rounded-3xl border border-brand-500/30 dark:border-brand-500/20 shadow-xl space-y-6 bg-gradient-to-r from-brand-500/5 via-cyan-500/5 to-transparent relative ${rptTypeOpen || rptYearOpen || rptScopeOpen ? 'z-50' : 'z-10'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Universal Reports & Analytics</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    Central Report Engine: Generate standardized datasets viewable via <b>Preview</b>, <b>Excel (.xlsx)</b>, <b>PDF (.pdf)</b>, <b>Word (.docx)</b>, and <b>CSV (.csv)</b>.
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                Institutional Report Engine
              </div>
            </div>

            {/* Unified Report Builder Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5 bg-white/70 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">

              {/* 1. Report Type — Premium Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                  Report Type
                </label>
                <div className={`relative ${rptTypeOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptTypeOpen(p => !p); setRptYearOpen(false); setRptScopeOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${rptTypeOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-300 dark:border-slate-700 hover:border-brand-300'
                      }`}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {({
                        'STUDENT_PERFORMANCE': 'Student Performance Detail',
                        'COLLEGE_EXECUTIVE': 'College Executive Overview',
                        'DEPARTMENT_PERFORMANCE': 'Department Performance',
                        'BATCH_PERFORMANCE': 'Batch Performance',
                        'CONTEST_PERFORMANCE': 'Contest Performance',
                        'STUDENT_MASTER': 'Student Master (All Roster)',
                        'LEADERBOARD': 'Leaderboard',
                        'CUSTOM': 'Custom Report',
                      } as Record<string, string>)[selectedReportType] || selectedReportType}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptTypeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rptTypeOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {[
                        { value: 'STUDENT_PERFORMANCE', label: 'Student Performance Detail', dot: 'bg-brand-500' },
                        { value: 'COLLEGE_EXECUTIVE', label: 'College Executive Overview', dot: 'bg-indigo-500' },
                        { value: 'DEPARTMENT_PERFORMANCE', label: 'Department Performance', dot: 'bg-purple-500' },
                        { value: 'BATCH_PERFORMANCE', label: 'Batch Performance', dot: 'bg-sky-500' },
                        { value: 'CONTEST_PERFORMANCE', label: 'Contest Performance', dot: 'bg-amber-500' },
                        { value: 'STUDENT_MASTER', label: 'Student Master (All Roster)', dot: 'bg-teal-500' },
                        { value: 'LEADERBOARD', label: 'Leaderboard', dot: 'bg-rose-500' },
                        { value: 'CUSTOM', label: 'Custom Report', dot: 'bg-slate-500' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedReportType(opt.value); setRptTypeOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${selectedReportType === opt.value ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                          <span className={`text-xs truncate flex-1 ${selectedReportType === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {selectedReportType === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Department — Premium Dropdown */}
              <div className="space-y-1.5 z-20">
                <PremiumDepartmentSelect
                  selectedDept={selectedDept}
                  onChange={setSelectedDept}
                  label="Department"
                />
              </div>

              {/* 3. Year / Batch — Premium Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">Year / Batch</label>
                <div className={`relative ${rptYearOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptYearOpen(p => !p); setRptTypeOpen(false); setRptScopeOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${rptYearOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-300 dark:border-slate-700 hover:border-brand-300'
                      }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    {selectedYear === 'ALL' ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300">ALL</span>
                    ) : selectedYear === 'II' ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300">II</span>
                    ) : selectedYear === 'III' ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-300">III</span>
                    ) : (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300">IV</span>
                    )}
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {selectedYear === 'ALL' ? 'All Academic Years' : selectedYear === 'II' ? 'Year (2025–2029)' : selectedYear === 'III' ? 'Year (2024–2028)' : 'Year (2023–2027)'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptYearOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rptYearOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {[
                        { value: 'ALL', code: 'ALL', label: 'All Academic Years', color: 'text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300' },
                        { value: 'II', code: 'II', label: 'Year (2025–2029)', color: 'text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300' },
                        { value: 'III', code: 'III', label: 'Year (2024–2028)', color: 'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-300' },
                        { value: 'IV', code: 'IV', label: 'Year (2023–2027)', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedYear(opt.value); setRptYearOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${selectedYear === opt.value ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                            }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${opt.color}`}>{opt.code}</span>
                          <span className={`text-xs truncate flex-1 ${selectedYear === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {selectedYear === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Output Scope — Premium Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">Output Scope</label>
                <div className={`relative ${rptScopeOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptScopeOpen(p => !p); setRptTypeOpen(false); setRptYearOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${rptScopeOpen ? 'border-purple-400 ring-2 ring-purple-400/20' : 'border-slate-300 dark:border-slate-700 hover:border-purple-300'
                      }`}
                  >
                    <Target className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {{ 'COLLEGE': 'College-wide', 'DEPARTMENT': 'Department-wide', 'YEAR': 'Year-wise', 'DEPT_YEAR': 'Department + Year', 'CUSTOM': 'Custom Filters' }[selectedOutputScope] || selectedOutputScope}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptScopeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rptScopeOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {[
                        { value: 'COLLEGE', label: 'College-wide', dot: 'bg-indigo-500' },
                        { value: 'DEPARTMENT', label: 'Department-wide', dot: 'bg-purple-500' },
                        { value: 'YEAR', label: 'Year-wise', dot: 'bg-sky-500' },
                        { value: 'DEPT_YEAR', label: 'Department + Year', dot: 'bg-emerald-500' },
                        { value: 'CUSTOM', label: 'Custom Filters', dot: 'bg-amber-500' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedOutputScope(opt.value); setRptScopeOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${selectedOutputScope === opt.value ? 'bg-purple-50 dark:bg-purple-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                          <span className={`text-xs truncate flex-1 ${selectedOutputScope === opt.value ? 'font-black text-purple-700 dark:text-purple-300' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {selectedOutputScope === opt.value && <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Action Button Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
              <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-bold">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Workflow: <b>1. Select Parameters</b> → <b>2. Generate Preview</b> → <b>3. Review & Export</b></span>
              </div>

              <button
                onClick={() => handleGenerateUniversalReport()}
                disabled={isGeneratingUniversal}
                className="flex items-center space-x-2.5 px-8 py-3.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-brand-500/25 transition-all transform hover:scale-105 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingUniversal ? 'animate-spin' : ''}`} />
                <span>{isGeneratingUniversal ? 'Building Dataset...' : 'Generate Preview'}</span>
              </button>
            </div>
          </div>



          {/* Universal Report Previewer */}
          {activeUniversalPreviewId && (
            <ReportPreview
              reportId={activeUniversalPreviewId}
              onClose={() => setActiveUniversalPreviewId(null)}
            />
          )}

          {/* Certificate Management Modal */}
          {showCertModal && (
            <CertificateManagementModal
              isOpen={showCertModal}
              onClose={() => setShowCertModal(false)}
            />
          )}

          {/* Premium Floating Center Confirmation Modal */}
          {deleteModalItem && (
            <ConfirmDeleteModal
              isOpen={!!deleteModalItem}
              item={deleteModalItem}
              isDeleting={isDeletingSnapshot}
              errorMessage={deleteError}
              onConfirm={executeDeleteHodSnapshot}
              onCancel={() => {
                if (!isDeletingSnapshot) {
                  setDeleteModalItem(null);
                  setDeleteError(null);
                }
              }}
              onRetry={executeDeleteHodSnapshot}
            />
          )}

          {/* Floating Success / Status Toast */}
          {toastMessage && (
            <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:left-auto sm:right-6 z-[10000] animate-slideUp">
              <div className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white text-xs font-bold shadow-lg flex items-center space-x-3 w-full sm:w-auto max-w-md mx-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{toastMessage}</span>
                <button
                  onClick={() => setToastMessage(null)}
                  className="text-slate-400 hover:text-white text-xs font-bold pl-2 cursor-pointer"
                >
                 
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
