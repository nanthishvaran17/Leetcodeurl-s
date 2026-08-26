import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Mail, CheckCircle2, FileText, Sparkles, Send, ShieldCheck, Camera, History, LayoutTemplate, PlayCircle, Layers, Inbox, Trash2, Award, Clock, Building2, GraduationCap, ChevronDown, Check, Target } from 'lucide-react';
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
  const [rptDeptOpen,  setRptDeptOpen]  = useState<boolean>(false);
  const [rptYearOpen,  setRptYearOpen]  = useState<boolean>(false);
  const [rptScopeOpen, setRptScopeOpen] = useState<boolean>(false);
  const [rptTypeOpen,  setRptTypeOpen]  = useState<boolean>(false);

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
      setToastMessage("✓ HOD Executive Snapshot captured successfully!");
      setTimeout(() => setToastMessage(null), 4000);
      setHodSnapshots(prev => [newSnapshot, ...prev.filter(s => s.snapshot_id !== newSnapshot.snapshot_id)]);
      setSelectedSnapshotPreview(newSnapshot);
      fetchHodSnapshots();
    } catch (err: any) {
      setToastMessage(`⚠ ${err.response?.data?.detail || "Failed to generate HOD snapshot."}`);
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
      setToastMessage("✓ HOD Snapshot deleted successfully");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || err.message || "Failed to delete snapshot.");
    } finally {
      setIsDeletingSnapshot(false);
    }
  };
  const downloadReportFile = async (endpoint: string, filename: string) => {
    setToastMessage("⏳ Generating report dataset from database...");
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
      setToastMessage(`✓ ${filename} downloaded successfully.`);
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
        } catch (_e) {}
      } else if (err.response?.data?.detail) {
        errMsg = err.response.data.detail;
      }

      setToastMessage(`⚠ ${errMsg}`);
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

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
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
      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-navy-900 p-1.5 rounded-2xl max-w-fit border border-gray-200 dark:border-gray-800 flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Reports & Analytics Suite</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'email' || activeTab === 'manual_email' || activeTab === 'auto_email'
              ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
      <div className={`glass-card p-6 md:p-8 rounded-3xl border border-blue-500/30 dark:border-blue-500/20 shadow-xl space-y-6 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-transparent relative ${rptTypeOpen || rptDeptOpen || rptYearOpen || rptScopeOpen ? 'z-50' : 'z-10'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Universal Reports & Analytics</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                Central Report Engine: Generate standardized datasets viewable via <b>Preview</b>, <b>Excel (.xlsx)</b>, <b>PDF (.pdf)</b>, <b>Word (.docx)</b>, and <b>CSV (.csv)</b>.
              </p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            Institutional Report Engine
          </div>
        </div>
        
        {/* Unified Report Builder Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5 bg-white/70 dark:bg-navy-900/70 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-inner">
          
          {/* 1. Report Type — Premium Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider">
              Report Type
            </label>
            <div className={`relative ${rptTypeOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setRptTypeOpen(p => !p); setRptDeptOpen(false); setRptYearOpen(false); setRptScopeOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${
                  rptTypeOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-gray-300 dark:border-gray-700 hover:border-brand-300'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">
                  {({
                    'STUDENT_PERFORMANCE': 'Student Performance Detail',
                    'COLLEGE_EXECUTIVE':   'College Executive Overview',
                    'DEPARTMENT_PERFORMANCE': 'Department Performance',
                    'BATCH_PERFORMANCE':   'Batch Performance',
                    'CONTEST_PERFORMANCE': 'Contest Performance',
                    'STUDENT_MASTER':      'Student Master (All Roster)',
                    'LEADERBOARD':         'Leaderboard',
                    'CUSTOM':              'Custom Report',
                  } as Record<string,string>)[selectedReportType] || selectedReportType}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${rptTypeOpen ? 'rotate-180' : ''}`} />
              </button>
              {rptTypeOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {[
                    { value: 'STUDENT_PERFORMANCE',   label: 'Student Performance Detail',   dot: 'bg-brand-500' },
                    { value: 'COLLEGE_EXECUTIVE',      label: 'College Executive Overview',   dot: 'bg-indigo-500' },
                    { value: 'DEPARTMENT_PERFORMANCE', label: 'Department Performance',       dot: 'bg-purple-500' },
                    { value: 'BATCH_PERFORMANCE',      label: 'Batch Performance',            dot: 'bg-sky-500' },
                    { value: 'CONTEST_PERFORMANCE',    label: 'Contest Performance',          dot: 'bg-amber-500' },
                    { value: 'STUDENT_MASTER',         label: 'Student Master (All Roster)',  dot: 'bg-teal-500' },
                    { value: 'LEADERBOARD',            label: 'Leaderboard',                  dot: 'bg-rose-500' },
                    { value: 'CUSTOM',                 label: 'Custom Report',                dot: 'bg-gray-500' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedReportType(opt.value); setRptTypeOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                        selectedReportType === opt.value ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                      <span className={`text-xs truncate flex-1 ${selectedReportType === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{opt.label}</span>
                      {selectedReportType === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Department — Premium Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider">Department</label>
            <div className={`relative ${rptDeptOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setRptDeptOpen(p => !p); setRptTypeOpen(false); setRptYearOpen(false); setRptScopeOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${
                  rptDeptOpen ? 'border-indigo-400 ring-2 ring-indigo-400/20' : 'border-gray-300 dark:border-gray-700 hover:border-indigo-300'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                {(() => {
                  const DEPT_SLUGS: Record<string,{code:string;color:string}> = {
                    'ALL':     { code:'ALL',      color:'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
                    'CSE':     { code:'CSE',      color:'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300' },
                    'CSE(CS)': { code:'CSE(CS)',  color:'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300' },
                    'CSE(IOT)':{ code:'CSE(IOT)', color:'text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-300' },
                    'IT':      { code:'IT',       color:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' },
                    'AIDS':    { code:'AIDS',     color:'text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-300' },
                    'ECE':     { code:'ECE',      color:'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-300' },
                    'EEE':     { code:'EEE',      color:'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300' },
                    'MECH':    { code:'MECH',     color:'text-teal-600 bg-teal-50 dark:bg-teal-950 dark:text-teal-300' },
                    'CIVIL':   { code:'CIVIL',    color:'text-lime-600 bg-lime-50 dark:bg-lime-950 dark:text-lime-300' },
                    'BME':     { code:'BME',      color:'text-pink-600 bg-pink-50 dark:bg-pink-950 dark:text-pink-300' },
                    'AGRI':    { code:'AGRI',     color:'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300' },
                  };
                  const s = DEPT_SLUGS[selectedDept] || DEPT_SLUGS['ALL'];
                  const LABELS: Record<string,string> = { 'ALL':'All Departments','CSE':'Computer Science and Engineering','CSE(CS)':'CSE (Cyber Security)','CSE(IOT)':'CSE (Internet of Things)','IT':'Information Technology','AIDS':'AI & Data Science','ECE':'Electronics & Communication','EEE':'Electrical & Electronics','MECH':'Mechanical Engineering','CIVIL':'Civil Engineering','BME':'Biomedical Engineering','AGRI':'Agricultural Engineering' };
                  return (<>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${s.color}`}>{s.code}</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">{LABELS[selectedDept] || selectedDept}</span>
                  </>);
                })()}
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${rptDeptOpen ? 'rotate-180' : ''}`} />
              </button>
              {rptDeptOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {[
                    { value:'ALL',      code:'ALL',      label:'All Departments',                color:'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
                    { value:'CSE',      code:'CSE',      label:'Computer Science and Engineering',color:'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300' },
                    { value:'CSE(CS)',  code:'CSE(CS)',  label:'CSE (Cyber Security)',            color:'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300' },
                    { value:'CSE(IOT)', code:'CSE(IOT)', label:'CSE (Internet of Things)',        color:'text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-300' },
                    { value:'IT',       code:'IT',       label:'Information Technology',          color:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' },
                    { value:'AIDS',     code:'AIDS',     label:'AI & Data Science',               color:'text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-300' },
                    { value:'ECE',      code:'ECE',      label:'Electronics & Communication',     color:'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-300' },
                    { value:'EEE',      code:'EEE',      label:'Electrical & Electronics',        color:'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300' },
                    { value:'MECH',     code:'MECH',     label:'Mechanical Engineering',          color:'text-teal-600 bg-teal-50 dark:bg-teal-950 dark:text-teal-300' },
                    { value:'CIVIL',    code:'CIVIL',    label:'Civil Engineering',               color:'text-lime-600 bg-lime-50 dark:bg-lime-950 dark:text-lime-300' },
                    { value:'BME',      code:'BME',      label:'Biomedical Engineering',          color:'text-pink-600 bg-pink-50 dark:bg-pink-950 dark:text-pink-300' },
                    { value:'AGRI',     code:'AGRI',     label:'Agricultural Engineering',        color:'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedDept(opt.value); setRptDeptOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                        selectedDept === opt.value ? 'bg-indigo-50 dark:bg-indigo-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${opt.color}`}>{opt.code}</span>
                      <span className={`text-xs truncate flex-1 ${selectedDept === opt.value ? 'font-black text-indigo-700 dark:text-indigo-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{opt.label}</span>
                      {selectedDept === opt.value && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Year / Batch — Premium Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider">Year / Batch</label>
            <div className={`relative ${rptYearOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setRptYearOpen(p => !p); setRptTypeOpen(false); setRptDeptOpen(false); setRptScopeOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${
                  rptYearOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-gray-300 dark:border-gray-700 hover:border-brand-300'
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
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">
                  {selectedYear === 'ALL' ? 'All Academic Years' : selectedYear === 'II' ? 'Year (2025–2029)' : selectedYear === 'III' ? 'Year (2024–2028)' : 'Year (2023–2027)'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${rptYearOpen ? 'rotate-180' : ''}`} />
              </button>
              {rptYearOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {[
                    { value:'ALL', code:'ALL', label:'All Academic Years', color:'text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300' },
                    { value:'II',  code:'II',  label:'Year (2025–2029)',    color:'text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300' },
                    { value:'III', code:'III', label:'Year (2024–2028)',   color:'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-300' },
                    { value:'IV',  code:'IV',  label:'Year (2023–2027)',    color:'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedYear(opt.value); setRptYearOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                        selectedYear === opt.value ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${opt.color}`}>{opt.code}</span>
                      <span className={`text-xs truncate flex-1 ${selectedYear === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{opt.label}</span>
                      {selectedYear === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Output Scope — Premium Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider">Output Scope</label>
            <div className={`relative ${rptScopeOpen ? 'z-30' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => { setRptScopeOpen(p => !p); setRptTypeOpen(false); setRptDeptOpen(false); setRptYearOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${
                  rptScopeOpen ? 'border-purple-400 ring-2 ring-purple-400/20' : 'border-gray-300 dark:border-gray-700 hover:border-purple-300'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">
                  {{'COLLEGE':'College-wide','DEPARTMENT':'Department-wide','YEAR':'Year-wise','DEPT_YEAR':'Department + Year','CUSTOM':'Custom Filters'}[selectedOutputScope] || selectedOutputScope}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${rptScopeOpen ? 'rotate-180' : ''}`} />
              </button>
              {rptScopeOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {[
                    { value:'COLLEGE',   label:'College-wide',       dot:'bg-indigo-500' },
                    { value:'DEPARTMENT',label:'Department-wide',     dot:'bg-purple-500' },
                    { value:'YEAR',      label:'Year-wise',           dot:'bg-sky-500' },
                    { value:'DEPT_YEAR', label:'Department + Year',   dot:'bg-emerald-500' },
                    { value:'CUSTOM',    label:'Custom Filters',      dot:'bg-amber-500' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedOutputScope(opt.value); setRptScopeOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                        selectedOutputScope === opt.value ? 'bg-purple-50 dark:bg-purple-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                      <span className={`text-xs truncate flex-1 ${selectedOutputScope === opt.value ? 'font-black text-purple-700 dark:text-purple-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{opt.label}</span>
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
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 font-bold">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Workflow: <b>1. Select Parameters</b> → <b>2. Generate Preview</b> → <b>3. Review & Export</b></span>
          </div>

          <button
            onClick={() => handleGenerateUniversalReport()}
            disabled={isGeneratingUniversal}
            className="flex items-center space-x-2.5 px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/25 transition-all transform hover:scale-105 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isGeneratingUniversal ? 'animate-spin' : ''}`} />
            <span>{isGeneratingUniversal ? 'Building Dataset...' : 'Generate Preview'}</span>
          </button>
        </div>
      </div>

      {/* HOD Executive Snapshot Section */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-purple-500/30 dark:border-purple-500/20 shadow-xl space-y-6 bg-gradient-to-r from-purple-500/5 via-fuchsia-500/5 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Executive HOD Snapshots
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                Capture point-in-time verified performance data for HOD reporting. Never fakes zeroes.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleGenerateHodSnapshot}
            disabled={isGeneratingSnapshot}
            className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105 cursor-pointer"
          >
            <Camera className={`w-4 h-4 ${isGeneratingSnapshot ? 'animate-pulse' : ''}`} />
            <span>{isGeneratingSnapshot ? 'Generating Snapshot...' : 'Capture New Snapshot'}</span>
          </button>
        </div>

        {/* Snapshot History Table */}
        <div className="bg-white/50 dark:bg-navy-950/50 rounded-2xl border border-purple-200/50 dark:border-purple-900/30 overflow-hidden">
          {hodSnapshots.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
              No HOD snapshots captured yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
              {hodSnapshots.map(snap => (
                <div key={snap.snapshot_id} className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
                  <div className="space-y-1 min-w-[200px]">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center space-x-2">
                      <span>{snap.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        {snap.snapshot_id}
                      </span>
                    </h4>
                    <div className="flex items-center space-x-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1"><History className="w-3.5 h-3.5"/> <span>{new Date(snap.created_at).toLocaleString()}</span></span>
                      <span>Verified: <span className="text-emerald-600 dark:text-emerald-400">{snap.metrics?.synced_students}</span> / {snap.metrics?.total_students}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex space-x-3 text-xs font-black mr-4">
                      <div className="text-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-700 dark:text-indigo-400">
                        <div className="text-lg">{snap.metrics?.total_solved_college || 0}</div>
                        <div className="text-[9px] uppercase">College Solved</div>
                      </div>
                      <div className="text-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-700 dark:text-emerald-400">
                        <div className="text-lg">{snap.metrics?.total_official_participations || 0}</div>
                        <div className="text-[9px] uppercase">Official Parts</div>
                      </div>
                      <button 
                        onClick={() => promptDeleteHodSnapshot(snap)}
                        title="Delete Snapshot"
                        className="p-1.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <span>{isSendingEmail ? 'Dispatching...' : 'Send Report to Management Now'}</span>
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
              className="group glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800/80 shadow-md hover:shadow-lg hover:border-brand-500/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between space-y-6 relative overflow-hidden"
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
      {/* Preview Modal */}
      {selectedSnapshotPreview && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-4xl bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800 animate-modal-content">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-navy-900/50 shrink-0">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {selectedSnapshotPreview.title}
                </h2>
                <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
                  <span>ID: {selectedSnapshotPreview.snapshot_id}</span>
                  <span>•</span>
                  <span>{new Date(selectedSnapshotPreview.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSnapshotPreview(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
              {/* Top Level Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                  <div className="text-[10px] uppercase font-black text-purple-500 mb-1">Total Students</div>
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-400">{selectedSnapshotPreview.metrics?.total_students || 0}</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-[10px] uppercase font-black text-emerald-500 mb-1">Verified Solvers</div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{selectedSnapshotPreview.metrics?.synced_students || 0}</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                  <div className="text-[10px] uppercase font-black text-rose-500 mb-1">Unverified</div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
                    {(selectedSnapshotPreview.metrics?.total_students || 0) - (selectedSnapshotPreview.metrics?.synced_students || 0)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                  <div className="text-[10px] uppercase font-black text-indigo-500 mb-1">Total Solved</div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{selectedSnapshotPreview.metrics?.total_solved_college || 0}</div>
                </div>
              </div>

              {/* Department Breakdown & Student List */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">Department & Roster Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedSnapshotPreview.metrics?.department_summary || {}).map(([dept, data]: [string, any]) => (
                    <div key={dept} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-900/50 border border-gray-200 dark:border-gray-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs text-brand-600 dark:text-brand-400">{dept}</span>
                        <span className="text-[10px] font-bold text-gray-500">{data.synced_students} / {data.total_students} Verified</span>
                      </div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">{data.total_solved} Problems Solved</div>
                      
                      {/* Embedded Student Preview Table */}
                      {data.students && data.students.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 mt-2">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-navy-950 text-white font-bold sticky top-0">
                              <tr>
                                <th className="px-2 py-1">Reg No</th>
                                <th className="px-2 py-1">Name</th>
                                <th className="px-2 py-1 text-right">Solved</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {data.students.slice(0, 10).map((st: any, idx: number) => (
                                <tr key={idx} className="hover:bg-white dark:hover:bg-navy-800">
                                  <td className="px-2 py-1 font-mono text-gray-600 dark:text-gray-400">{st.reg_no}</td>
                                  <td className="px-2 py-1 font-semibold">{st.name}</td>
                                  <td className="px-2 py-1 text-right font-black text-brand-600">{st.total_solved !== null ? st.total_solved : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Note about downloads */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-xs font-medium text-amber-800 dark:text-amber-400 flex items-center justify-between">
                <div>
                  <span className="font-bold block mb-0.5">💡 Frozen Point-in-Time Snapshot</span>
                  Contains frozen student statistics. Download as PDF, Excel, or Word for institutional presentation.
                </div>
              </div>
            </div>

            {/* Modal Footer (Downloads) - Redesigned as Glass Cards */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-navy-900/50">
              <div className="flex items-center space-x-2 mb-4">
                <Download className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Export Frozen Snapshot</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PDF Card */}
                <div className="group bg-white dark:bg-navy-950 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/30 shadow-sm hover:shadow-xl hover:border-rose-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-rose-500/10 text-rose-600 border-rose-500/20 uppercase">
                        Printable PDF
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-rose-600 transition-colors">Executive PDF</h4>
                      <p className="text-[10px] text-gray-500 mt-1 leading-tight">High-resolution printable PDF report with top 20 performers styled strictly in Times New Roman.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => downloadReportFile(`/reports/hod-snapshots/${selectedSnapshotPreview.snapshot_id}/pdf`, `HOD_Snapshot_${selectedSnapshotPreview.snapshot_id}.pdf`)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-extrabold text-xs shadow-md group-hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>

                {/* Excel Card */}
                <div className="group bg-white dark:bg-navy-950 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/30 shadow-sm hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 uppercase">
                        Spreadsheet
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Master Excel</h4>
                      <p className="text-[10px] text-gray-500 mt-1 leading-tight">Multi-sheet workbook containing the College Leaderboard and separate Department sheets.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => downloadReportFile(`/reports/hod-snapshots/${selectedSnapshotPreview.snapshot_id}/excel`, `HOD_Snapshot_${selectedSnapshotPreview.snapshot_id}.xlsx`)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs shadow-md group-hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                </div>

                {/* Word Card */}
                <div className="group bg-white dark:bg-navy-950 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/30 shadow-sm hover:shadow-xl hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-blue-500/10 text-blue-600 border-blue-500/20 uppercase">
                        Editable Docx
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">Word Summary</h4>
                      <p className="text-[10px] text-gray-500 mt-1 leading-tight">Editable Microsoft Word document with an executive summary table and top performers.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => downloadReportFile(`/reports/hod-snapshots/${selectedSnapshotPreview.snapshot_id}/word`, `HOD_Snapshot_${selectedSnapshotPreview.snapshot_id}.docx`)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-extrabold text-xs shadow-md group-hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Word</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="fixed bottom-6 right-6 z-[10000] animate-slideUp">
          <div className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white text-xs font-bold shadow-lg flex items-center space-x-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-bold pl-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
};
