import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Mail, CheckCircle2, FileText, Sparkles, Send, ShieldCheck, Camera, History, LayoutTemplate, PlayCircle, Layers, Inbox, Trash2, Award, Clock, Building2, GraduationCap, ChevronDown, Check, Target, Loader2, Trophy } from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import api, { getApiUrl } from '../services/api';
import { ReportPreview } from '../components/ReportPreview';
import { EmailDeliveryTab } from '../components/EmailDeliveryTab';
import { CertificateManagementModal } from '../components/CertificateManagementModal';
import { ConfirmDeleteModal, DeleteItemInfo } from '../components/ConfirmDeleteModal';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { downloadFromUrl } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';
import { ExportStatus } from '../components/ExportStatus';
import { DownloadState } from '../services/download/downloadTypes';
import { useKeyboardContext } from '../context/KeyboardContext';

export const ReportsPage: React.FC = () => {
  const { notify } = useNotification();
  const { user, token } = useAuth();
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
  // Track which download is currently in progress (filename → boolean)
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, boolean>>({});
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);

  const [rptYearOpen, setRptYearOpen] = useState<boolean>(false);
  const [rptScopeOpen, setRptScopeOpen] = useState<boolean>(false);
  const [rptTypeOpen, setRptTypeOpen] = useState<boolean>(false);

  // Floating Center Delete Modal & Toast States
  const [deleteModalItem, setDeleteModalItem] = useState<DeleteItemInfo | null>(null);
  const [isDeletingSnapshot, setIsDeletingSnapshot] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

  useEffect(() => {
    if (deleteModalItem || showCertModal || activeUniversalPreviewId) {
      pushContext('MODAL');
      const unregister = registerEscHandler(() => {
        if (deleteModalItem) setDeleteModalItem(null);
        if (showCertModal) setShowCertModal(false);
        if (activeUniversalPreviewId) setActiveUniversalPreviewId(null);
      });
      return () => {
        unregister();
        popContext('MODAL');
      };
    }
  }, [deleteModalItem, showCertModal, activeUniversalPreviewId, pushContext, popContext, registerEscHandler]);

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
  const [reportError, setReportError] = useState<string | null>(null);

  const downloadReportFile = async (endpoint: string, filename: string) => {
    // 1. Clear previous error state & previous report toasts before starting new request
    setReportError(null);
    notify.dismissCategory('REPORTS');
    setDownloadingFiles(prev => ({ ...prev, [filename]: true }));

    // Parse query params from endpoint to filters first
    const urlParts = endpoint.split('?');
    const filters: any = { department: selectedDept, year: selectedYear, output_scope: selectedOutputScope };
    if (urlParts.length > 1) {
      const params = new URLSearchParams(urlParts[1]);
      params.forEach((val, key) => { filters[key] = val; });
    }

    // Map report_type and format dynamically
    let report_type = filters.report_type || selectedReportType || 'STUDENT_PERFORMANCE';
    let format = 'excel';
    
    if (endpoint.includes('export-official-college-summary')) { report_type = 'COLLEGE_EXECUTIVE'; format = 'excel'; }
    else if (endpoint.includes('export-student-performance-detail')) { report_type = 'STUDENT_PERFORMANCE'; format = 'excel'; }
    else if (endpoint.includes('export-weekly-contest-matrix')) { report_type = 'BATCH_PERFORMANCE'; format = 'excel'; } 
    else if (endpoint.includes('export-master-tracker')) { report_type = 'STUDENT_MASTER'; format = 'excel'; }
    else if (endpoint.includes('export-pdf')) { format = 'pdf'; }
    else if (endpoint.includes('export-word')) { format = 'word'; }
    else if (endpoint.includes('export-csv')) { format = 'csv'; }

    const result = await downloadManager.downloadJob({
      report_type,
      format,
      filters,
      filename,
      onStateChange: (state) => setDownloadState(state)
    });

    setDownloadingFiles(prev => ({ ...prev, [filename]: false }));

    if (result.success) {
      setReportError(null);
      notify.dismissCategory('REPORTS');
      // notify.success is handled by downloadManager
    } else {
      const userFacingMsg = result.error && !result.error.includes('500') && !result.error.includes('status code')
        ? result.error
        : 'Please try again.';

      setReportError(userFacingMsg);
      // Status modal will show error, so we don't necessarily need a duplicate toast
    }
  };

  const getActiveFilterQueryParams = (extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (selectedDept && selectedDept !== 'ALL') params.append('department', selectedDept);
    if (selectedYear && selectedYear !== 'ALL') params.append('year', selectedYear);
    if (selectedOutputScope && selectedOutputScope !== 'ALL') params.append('output_scope', selectedOutputScope);
    if (selectedReportType) params.append('report_type', selectedReportType);
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v && v !== 'ALL') params.set(k, v);
      });
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const handleDownloadOfficialSummary = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-official-college-summary${q}`, 'Nandha_College_Official_Weekly_Report.xlsx');
  };

  const handleDownloadStudentDetail = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-student-performance-detail${q}`, 'Nandha_Student_Performance_Detail.xlsx');
  };

  const handleDownloadMatrix2028 = () => {
    const q = getActiveFilterQueryParams({ batch: '2028' });
    downloadReportFile(`/reports/export-weekly-contest-matrix${q}`, 'Batch_2028_Contest_Matrix.xlsx');
  };

  const handleDownloadMatrix2029 = () => {
    const q = getActiveFilterQueryParams({ batch: '2029' });
    downloadReportFile(`/reports/export-weekly-contest-matrix${q}`, 'Batch_2029_Contest_Matrix.xlsx');
  };

  const handleDownloadMasterTracker = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-master-tracker${q}`, 'Full_8_Sheet_Master_Tracker.xlsx');
  };

  const handleDownloadPDF = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-pdf${q}`, 'Executive_PDF_Summary.pdf');
  };

  const handleDownloadWord = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-word${q}`, 'Executive_Word_Summary.docx');
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
    setReportError(null);
    notify.dismissCategory('REPORTS');

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
      notify.success('Report Ready', 'Universal report generated successfully.', { category: 'REPORTS' });
    } catch (err: any) {
      const statusCode = err.response?.status;
      let userFacingMsg = 'Please try again.';
      if (statusCode === 401) {
        userFacingMsg = 'Please sign in again.';
      } else if (statusCode === 403) {
        userFacingMsg = 'You do not have permission to generate this institutional report.';
      } else if (statusCode === 404) {
        userFacingMsg = 'Report resource not found.';
      } else if (statusCode === 422) {
        userFacingMsg = 'Invalid report parameters.';
      }

      setReportError(userFacingMsg);
      notify.error('Unable to generate report', userFacingMsg, {
        category: 'REPORTS',
        duration: 5000,
        onClose: () => setReportError(null),
      });
    } finally {
      setIsGeneratingUniversal(false);
    }
  };

  const handleDownloadCSV = () => {
    const q = getActiveFilterQueryParams();
    downloadReportFile(`/reports/export-csv${q}`, 'LeetCode_Student_Performance_Report.csv');
  };

  const reportCards = [
    {
      id: 'master-10-sheet',
      title: 'Master 10-Sheet Institutional Excel',
      badge: 'OFFICIAL 10-SHEET WORKBOOK',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Complete 10-Sheet Master Workbook: 01 Principal Executive, 02 Complete Student Roster, 03 Contest Attendance, 04 Contest Performance, 05 Top Performers, 06 4-4 Perfect Solvers, 07 3-4 Solvers, 08 2-4 Solvers, 09 1-4 Solvers, and 10 Department Intelligence.',
      filename: 'Weekly_LeetCode_Master_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      btnGradient: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/download${q}`, 'Weekly_LeetCode_Master_Report.xlsx');
      }
    },
    {
      id: 'five-week-trend',
      title: 'Five-Week Performance Trend Report',
      badge: 'LONGITUDINAL 5-CONTEST WINDOW',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      description: 'Monitors student performance across the latest 5 valid contests. Automatically calculates rolling window metrics and identifies Improving (↑), Stable (→), Declining (↓), and Follow-Up student trajectories.',
      filename: 'Five_Week_Performance_Trend_Report.xlsx',
      icon: Trophy,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      btnGradient: 'from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 shadow-indigo-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-excel?report_type=FIVE_WEEK_PERFORMANCE_TREND${q}`, 'Five_Week_Performance_Trend_Report.xlsx');
      }
    },
    {
      id: 'hod-department',
      title: 'HOD Department Intelligence Report',
      badge: 'AUTHORIZED DEPARTMENT SCOPE',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      description: 'Department-level performance review: HOD → Faculty/Mentor → Assigned Students drill-down. Contains department KPIs, solver distribution, faculty group metrics, and student performance roster.',
      filename: 'HOD_Department_Intelligence_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      btnGradient: 'from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/hod${q}`, 'HOD_Department_Intelligence_Report.xlsx');
      }
    },
    {
      id: 'faculty-consolidated',
      title: 'Faculty Consolidated Performance',
      badge: 'ASSIGNED STUDENT ROSTER',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Consolidated review report for faculty and mentors: Includes assigned student attendance %, Q1–Q4 solve status, scores, mentor signals, and 5-week improvement trajectory.',
      filename: 'Faculty_Consolidated_Performance_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      btnGradient: 'from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 shadow-amber-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/staff${q}`, 'Faculty_Consolidated_Performance_Report.xlsx');
      }
    },
    {
      id: 'principal-executive',
      title: 'Principal Executive Intelligence Report',
      badge: 'INSTITUTION-WIDE OVERVIEW',
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      description: 'High-level executive institutional overview: Total enrolled students (1,569), verified solvers, attendance %, 4/4 solver count, department comparative matrix, and top achievements.',
      filename: 'Principal_Executive_Intelligence_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
      btnGradient: 'from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-brand-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/principal${q}`, 'Principal_Executive_Intelligence_Report.xlsx');
      }
    },
    {
      id: 'management-summary',
      title: 'Management Executive Summary',
      badge: 'SECRETARY & SENIOR MANAGEMENT',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      description: 'Concise executive summary for Secretary & Management: High-impact institutional participation rate, performance trajectory, department rank comparison, and key action highlights.',
      filename: 'Management_Executive_Summary_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      btnGradient: 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-excel?report_type=MANAGEMENT_EXECUTIVE_SUMMARY${q}`, 'Management_Executive_Summary_Report.xlsx');
      }
    },
    {
      id: 'pdf-summary',
      title: 'Executive PDF Summary Report',
      badge: 'PRINTABLE PDF (SEGMENTED TYPOGRAPHY)',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      description: 'High-resolution printable PDF report with official college header branding, executive summary table, department statistics, and top performers formatted for executive review.',
      filename: 'Executive_PDF_Summary.pdf',
      icon: FileText,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      btnGradient: 'from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-600/30',
      onClick: handleDownloadPDF
    },
    {
      id: 'word-summary',
      title: 'Executive Word Summary (.DOCX)',
      badge: 'WORD DOCX (EXECUTIVE TEMPLATE)',
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      description: 'Editable Microsoft Word document report with official Nandha Engineering College header, executive summary table, and student performance roster formatted for institutional distribution.',
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
          <span>Exports & Download Hub</span>
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
                    Central Report Engine: Generate standardized datasets viewable via <b>Preview</b>, <b>Excel (.xlsx)</b>, <b>PDF (.pdf)</b>, and <b>Word (.docx)</b>.
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                Institutional Report Engine
              </div>
            </div>

            {/* Unified Report Builder Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5 bg-white/70 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner items-start">

              {/* 1. Report Type — Premium Dropdown with Custom Colored Badges */}
              <div className="flex flex-col space-y-1.5 min-w-0 w-full relative z-[35]">
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">
                  Report Type
                </span>
                <div className={`relative ${rptTypeOpen ? 'z-30' : 'z-10'}`}>
                  {(() => {
                    const reportCategories = [
                      {
                        title: 'A. CONTEST REPORTS',
                        titleColor: 'text-brand-600 dark:text-brand-400',
                        options: [
                          { value: 'FRIDAY_OFFICIAL_CONTEST', label: 'Friday Official Contest Result', pill: 'OFFICIAL', pillColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700' },
                          { value: 'SUNDAY_LIVE_CONTEST', label: 'Sunday Live Contest Report', pill: 'LIVE', pillColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200 border-sky-300 dark:border-sky-700' },
                          { value: 'WEEKLY_CONTEST_INTELLIGENCE', label: 'Weekly Contest Intelligence', pill: 'INTELLIGENCE', pillColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700' },
                          { value: 'CONTEST_ATTENDANCE_PARTICIPATION', label: 'Contest Attendance & Participation', pill: 'ATTENDANCE', pillColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' },
                          { value: 'CONTEST_PERFORMANCE_RANKING', label: 'Contest Performance & Ranking', pill: 'RANKING', pillColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700' },
                        ]
                      },
                      {
                        title: 'B. PERFORMANCE REPORTS',
                        titleColor: 'text-purple-600 dark:text-purple-400',
                        options: [
                          { value: 'WEEKLY_STUDENT_PERFORMANCE', label: 'Weekly Student Performance', pill: 'STUDENT', pillColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300 dark:border-purple-700' },
                          { value: 'FIVE_WEEK_PERFORMANCE_TREND', label: 'Five-Week Performance Trend', pill: '5-WEEK', pillColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700' },
                          { value: 'PROBLEM_DIFFICULTY_INTELLIGENCE', label: 'Problem Difficulty Intelligence', pill: 'DIFFICULTY', pillColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200 border-teal-300 dark:border-teal-700' },
                        ]
                      },
                      {
                        title: 'C. CONSOLIDATED REPORTS',
                        titleColor: 'text-amber-600 dark:text-amber-400',
                        options: [
                          { value: 'FACULTY_CONSOLIDATED', label: 'Faculty Consolidated Performance', pill: 'FACULTY', pillColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700' },
                          { value: 'FACULTY_COORDINATOR_CONSOLIDATED', label: 'Faculty Coordinator Consolidated', pill: 'COORDINATOR', pillColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200 border-orange-300 dark:border-orange-700' },
                          { value: 'HOD_DEPARTMENT_INTELLIGENCE', label: 'HOD Department Intelligence', pill: 'HOD', pillColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-300 dark:border-rose-700' },
                        ]
                      },
                      {
                        title: 'D. EXECUTIVE REPORTS',
                        titleColor: 'text-indigo-600 dark:text-indigo-400',
                        options: [
                          { value: 'PRINCIPAL_EXECUTIVE', label: 'Principal Executive Intelligence', pill: 'PRINCIPAL', pillColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700' },
                          { value: 'MANAGEMENT_EXECUTIVE_SUMMARY', label: 'Management Executive Summary', pill: 'MANAGEMENT', pillColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
                        ]
                      }
                    ];

                    const allOpts = reportCategories.flatMap(c => c.options);
                    const currentOpt = allOpts.find(o => 
                      o.value === selectedReportType ||
                      (selectedReportType === 'STUDENT_PERFORMANCE' && o.value === 'WEEKLY_STUDENT_PERFORMANCE') ||
                      (selectedReportType === 'COLLEGE_EXECUTIVE' && o.value === 'PRINCIPAL_EXECUTIVE') ||
                      (selectedReportType === 'DEPARTMENT_PERFORMANCE' && o.value === 'HOD_DEPARTMENT_INTELLIGENCE') ||
                      (selectedReportType === 'BATCH_PERFORMANCE' && o.value === 'FIVE_WEEK_PERFORMANCE_TREND')
                    ) || allOpts[0];

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => { setRptTypeOpen(p => !p); setRptYearOpen(false); setRptScopeOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 h-11 min-h-[44px] rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none cursor-pointer ${rptTypeOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}
                        >
                          <LayoutTemplate className="w-4 h-4 text-brand-500 shrink-0" />
                          {currentOpt && (
                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${currentOpt.pillColor}`}>
                              {currentOpt.pill}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                            {currentOpt ? currentOpt.label : selectedReportType}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptTypeOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {rptTypeOpen && (
                          <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 min-w-[340px]">
                            {reportCategories.map(cat => (
                              <div key={cat.title} className="p-2 space-y-1">
                                <div className={`text-[10px] font-black uppercase px-2.5 py-1 tracking-wider ${cat.titleColor}`}>
                                  {cat.title}
                                </div>
                                {cat.options.map(opt => {
                                  const isSelected = selectedReportType === opt.value || 
                                    (selectedReportType === 'STUDENT_PERFORMANCE' && opt.value === 'WEEKLY_STUDENT_PERFORMANCE') ||
                                    (selectedReportType === 'COLLEGE_EXECUTIVE' && opt.value === 'PRINCIPAL_EXECUTIVE') ||
                                    (selectedReportType === 'DEPARTMENT_PERFORMANCE' && opt.value === 'HOD_DEPARTMENT_INTELLIGENCE');

                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => { setSelectedReportType(opt.value); setRptTypeOpen(false); }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${isSelected ? 'bg-brand-600 text-white font-black shadow-md shadow-brand-500/20' : 'hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                                    >
                                      <span className={`w-20 min-w-[5rem] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-white/20 text-white border-white/30' : opt.pillColor}`}>
                                        {opt.pill}
                                      </span>
                                      <span className={`text-xs truncate flex-1 ${isSelected ? 'font-black text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                                        {opt.label}
                                      </span>
                                      {isSelected && <Check className="w-4 h-4 text-white shrink-0" strokeWidth={3} />}
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Department — Premium Dropdown */}
              <div className="flex flex-col min-w-0 w-full z-[30]">
                <PremiumDepartmentSelect
                  selectedDept={selectedDept}
                  onChange={setSelectedDept}
                  label="Department"
                  className="!w-full"
                />
              </div>

              {/* 3. Year / Batch — Premium Dropdown */}
              <div className="flex flex-col space-y-1.5 min-w-0 w-full relative z-[25]">
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">Year / Batch</span>
                <div className={`relative ${rptYearOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptYearOpen(p => !p); setRptTypeOpen(false); setRptScopeOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 h-11 min-h-[44px] rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none cursor-pointer ${rptYearOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}
                  >
                    <GraduationCap className="w-4 h-4 text-brand-500 shrink-0" />
                    {selectedYear === 'ALL' ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border text-slate-700 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">ALL</span>
                    ) : selectedYear === '2' ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border text-sky-700 bg-sky-100 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700">II</span>
                    ) : selectedYear === '3' ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border text-violet-700 bg-violet-100 border-violet-300 dark:bg-violet-900/60 dark:text-violet-200 dark:border-violet-700">III</span>
                    ) : (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700">IV</span>
                    )}
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {selectedYear === 'ALL' ? 'All Academic Years' : selectedYear === '2' ? 'Year (2025–2029)' : selectedYear === '3' ? 'Year (2024–2028)' : 'Year (2023–2027)'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptYearOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rptYearOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto p-1.5 space-y-1">
                      {[
                        { value: 'ALL', code: 'ALL', label: 'All Academic Years', pillColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' },
                        { value: '2', code: 'II', label: 'Year II (2025–2029)', pillColor: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700' },
                        { value: '3', code: 'III', label: 'Year III (2024–2028)', pillColor: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/60 dark:text-violet-200 dark:border-violet-700' },
                        { value: '4', code: 'IV', label: 'Year IV (2023–2027)', pillColor: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700' },
                      ].map(opt => {
                        const isSelected = selectedYear === opt.value;
                        return (
                          <button key={opt.value} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setSelectedYear(opt.value); setRptYearOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${isSelected ? 'bg-brand-600 text-white font-black shadow-md shadow-brand-500/20' : 'hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                          >
                            <span className={`w-12 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-white/20 text-white border-white/30' : opt.pillColor}`}>{opt.code}</span>
                            <span className={`text-xs truncate flex-1 ${isSelected ? 'font-black text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Output Scope — Premium Dropdown */}
              <div className="flex flex-col space-y-1.5 min-w-0 w-full relative z-[20]">
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">Output Scope</span>
                <div className={`relative ${rptScopeOpen ? 'z-30' : 'z-10'}`}>
                  {(() => {
                    const scopeOptions = [
                      { value: 'COLLEGE', pill: 'COLLEGE', label: 'College-wide', pillColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300 dark:border-purple-700' },
                      { value: 'DEPARTMENT', pill: 'DEPT', label: 'Department-wide', pillColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700' },
                      { value: 'YEAR', pill: 'YEAR', label: 'Year-wise', pillColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200 border-sky-300 dark:border-sky-700' },
                      { value: 'DEPT_YEAR', pill: 'DEPT+YR', label: 'Department + Year', pillColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' },
                      { value: 'CUSTOM', pill: 'CUSTOM', label: 'Custom Filters', pillColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700' },
                    ];
                    const currentScope = scopeOptions.find(s => s.value === selectedOutputScope) || scopeOptions[0];

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => { setRptScopeOpen(p => !p); setRptTypeOpen(false); setRptYearOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 h-11 min-h-[44px] rounded-2xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none cursor-pointer ${rptScopeOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}
                        >
                          <Target className="w-4 h-4 text-purple-500 shrink-0" />
                          {currentScope && (
                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${currentScope.pillColor}`}>
                              {currentScope.pill}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                            {currentScope ? currentScope.label : selectedOutputScope}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptScopeOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {rptScopeOpen && (
                          <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto p-1.5 space-y-1">
                            {scopeOptions.map(opt => {
                              const isSelected = selectedOutputScope === opt.value;
                              return (
                                <button key={opt.value} type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { setSelectedOutputScope(opt.value); setRptScopeOpen(false); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${isSelected ? 'bg-brand-600 text-white font-black shadow-md shadow-brand-500/20' : 'hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                                >
                                  <span className={`w-16 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-white/20 text-white border-white/30' : opt.pillColor}`}>{opt.pill}</span>
                                  <span className={`text-xs truncate flex-1 ${isSelected ? 'font-black text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{opt.label}</span>
                                  {isSelected && <Check className="w-4 h-4 text-white shrink-0" strokeWidth={3} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* Action Button Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
              <div className="flex items-start sm:items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-bold min-w-0 flex-1">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                <span className="flex flex-wrap items-center gap-1.5 leading-snug">
                  <span>Workflow:</span>
                  <b>1. Select Parameters</b>
                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">→</span>
                  <b>2. Generate Preview</b>
                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">→</span>
                  <b>3. Review & Export</b>
                </span>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filename = `${selectedReportType}_${selectedDept}_${selectedYear}.xlsx`;
                    downloadReportFile(`/reports/export-excel?report_type=${selectedReportType}&department=${selectedDept}&year=${selectedYear}&output_scope=${selectedOutputScope}`, filename);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  title="Direct Download Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const filename = `${selectedReportType}_${selectedDept}_${selectedYear}.pdf`;
                    downloadReportFile(`/reports/export-pdf?report_type=${selectedReportType}&department=${selectedDept}&year=${selectedYear}&output_scope=${selectedOutputScope}`, filename);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  title="Direct Download PDF (.pdf)"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF (.pdf)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const filename = `${selectedReportType}_${selectedDept}_${selectedYear}.docx`;
                    downloadReportFile(`/reports/export-word?report_type=${selectedReportType}&department=${selectedDept}&year=${selectedYear}&output_scope=${selectedOutputScope}`, filename);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  title="Direct Download Word (.docx)"
                >
                  <FileText className="w-4 h-4" />
                  <span>Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateUniversalReport()}
                  disabled={isGeneratingUniversal}
                  className="flex items-center space-x-2.5 px-6 py-2.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl shadow-brand-500/25 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingUniversal ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingUniversal ? 'Building Dataset...' : 'Generate Preview'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pre-Formatted Institutional Exports & Download Hub */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Pre-Formatted Exports & Download Hub</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">1-Click download official institutional Excel workbooks, weekly contest matrices, PDF summaries, and Word documents.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reportCards.map((card) => {
                const Icon = card.icon;
                const isDownloading = downloadingFiles[card.filename];
                return (
                  <div key={card.id} className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-navy-800 hover:border-brand-500/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 bg-white dark:bg-navy-950">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`p-3 rounded-2xl ${card.iconBg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${card.badgeColor}`}>
                          {card.badge}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">{card.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed font-medium">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={card.onClick}
                      disabled={isDownloading}
                      className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r ${card.btnGradient} transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50`}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>{isDownloading ? 'Generating Report...' : `Download ${card.filename.split('.').pop()?.toUpperCase()}`}</span>
                    </button>
                  </div>
                );
              })}
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

          <ExportStatus 
            state={downloadState} 
            onClose={() => setDownloadState(null)} 
          />
        </>
      )}

    </div>
  );
};
