import React, { useState, useEffect, useMemo, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Download, Mail, CheckCircle2, FileText, Send, ShieldCheck, Camera, History, LayoutTemplate, PlayCircle, Layers, Inbox, Trash2, Award, Clock, Building2, GraduationCap, ChevronDown, Check, Target, Loader2, RefreshCw, Search, X } from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import api, { getApiUrl } from '../services/api';
import { ReportPreview } from '../components/ReportPreview';
import { EmailDeliveryTab } from '../components/EmailDeliveryTab';
import { CertificateManagementModal } from '../components/CertificateManagementModal';
import { SyncStatusModal } from '../components/SyncStatusModal';
import { ConfirmDeleteModal, DeleteItemInfo } from '../components/ConfirmDeleteModal';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { downloadFromUrl } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';
import { ExportStatus } from '../components/ExportStatus';
import { DownloadState } from '../services/download/downloadTypes';
import { useKeyboardContext } from '../context/KeyboardContext';
import { SwipeHandle } from '../components/SwipeHandle';

export const ReportsPage: React.FC = () => {
  const { notify } = useNotification();
  const { user, token } = useAuth();

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640 || window.matchMedia('(max-width: 639px)').matches;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640 || window.matchMedia('(max-width: 639px)').matches);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [activeTab, setActiveTab] = useState<'reports' | 'email' | 'manual_email' | 'auto_email'>('reports');
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [hodSnapshots, setHodSnapshots] = useState<any[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState<boolean>(false);
  const [selectedSnapshotPreview, setSelectedSnapshotPreview] = useState<any>(null);
  const [activeUniversalPreviewId, setActiveUniversalPreviewId] = useState<string | null>(null);
  const [activeUniversalPreviewData, setActiveUniversalPreviewData] = useState<any>(null);
  const [isGeneratingUniversal, setIsGeneratingUniversal] = useState<boolean>(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('STUDENT_PERFORMANCE');

  const userRole = (user?.role || '').trim().toLowerCase();
  const isHodUser = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(userRole);
  const hodDeptDefault = useMemo(() => {
    if (!isHodUser) return 'ALL';
    const codes = user?.authorized_department_codes || [];
    if (codes.length > 0) return codes[0];
    return (user as any)?.department_code || 'ALL';
  }, [user, isHodUser]);

  const [selectedDept, setSelectedDept] = useState<string>(() => hodDeptDefault);

  useEffect(() => {
    if (isHodUser && selectedReportType !== 'WEEKLY_PERFORMANCE' && hodDeptDefault !== 'ALL' && !selectedDept) {
      setSelectedDept(hodDeptDefault);
    }
  }, [isHodUser, hodDeptDefault, selectedDept, selectedReportType]);

  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedOutputScope, setSelectedOutputScope] = useState<string>('COLLEGE');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('latest');
  const [availableSundays, setAvailableSundays] = useState<any[]>([]);
  // Track which download is currently in progress (filename → boolean)
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, boolean>>({});
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);

  const [rptYearOpen, setRptYearOpen] = useState<boolean>(false);
  const [rptScopeOpen, setRptScopeOpen] = useState<boolean>(false);
  const [rptTypeOpen, setRptTypeOpen] = useState<boolean>(false);
  const [rptSessionOpen, setRptSessionOpen] = useState<boolean>(false);
  const [rptSearch, setRptSearch] = useState<string>('');

  useEffect(() => {
    if (selectedReportType === 'WEEKLY_PERFORMANCE') {
      setSelectedYear('ALL');
    }
  }, [selectedReportType]);

  // Floating Center Delete Modal & Toast States
  const [deleteModalItem, setDeleteModalItem] = useState<DeleteItemInfo | null>(null);
  const [isDeletingSnapshot, setIsDeletingSnapshot] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

  // Background pre-fetch warm-up on filter change for instant (< 1ms) dataset generation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (navigator.onLine) {
        const effDept = (isHodUser && selectedReportType !== 'WEEKLY_PERFORMANCE' && (selectedDept === 'ALL' || !selectedDept)) ? hodDeptDefault : selectedDept;
        api.post('/reports/generate', {
          report_type: selectedReportType,
          department: effDept,
          year: selectedYear,
          output_scope: selectedOutputScope,
          filters: { session_id: selectedSessionId }
        }).catch(() => {});
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedReportType, selectedDept, selectedYear, selectedOutputScope, selectedSessionId, isHodUser, hodDeptDefault]);

  useEffect(() => {
    if (deleteModalItem || showCertModal || activeUniversalPreviewId || showSyncModal) {
      pushContext('MODAL');
      const unregister = registerEscHandler(() => {
        if (deleteModalItem) setDeleteModalItem(null);
        if (showCertModal) setShowCertModal(false);
        if (activeUniversalPreviewId) setActiveUniversalPreviewId(null);
        if (showSyncModal) setShowSyncModal(false);
      });
      return () => {
        unregister();
        popContext('MODAL');
      };
    }
  }, [deleteModalItem, showCertModal, activeUniversalPreviewId, showSyncModal, pushContext, popContext, registerEscHandler]);

  useEffect(() => {
    fetchEmailLogs();
    fetchHodSnapshots();
    fetchAvailableSundays();

    const handlePull = () => {
      fetchEmailLogs();
      fetchHodSnapshots();
      fetchAvailableSundays();
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, []);

  const fetchAvailableSundays = async () => {
    try {
      const res = await api.get('/reports/available-sundays');
      setAvailableSundays(res.data.sundays || []);
      if (res.data.sundays && res.data.sundays.length > 0) {
        setSelectedSessionId(res.data.sundays[0].session_id);
      }
    } catch (err) {
      console.error("Failed to fetch available Sundays", err);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const res = await api.get('/reports/email-logs');
      setEmailLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch email logs", err);
    }
  };

  const handleTriggerSync = async () => {
    try {
      await api.post('/api/sync/trigger');
      setShowSyncModal(true);
      notify.success('Sync Started', 'Background live sync initialized.', { category: 'SYNC' });
    } catch (err: any) {
      notify.error('Sync Failed', err.response?.data?.detail || "Failed to trigger sync.", { category: 'SYNC' });
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

    // Format target endpoint
    const effEndpoint = endpoint.startsWith('http')
      ? endpoint
      : (endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);

    const effMime = filename.endsWith('.pdf')
      ? 'application/pdf'
      : (filename.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // High-Speed Direct Stream: Directly fetch pre-cached file in single request (<200ms)
    const result = await downloadManager.download({
      endpoint: effEndpoint,
      filename,
      mimeType: effMime,
      onStateChange: (state) => setDownloadState(state)
    });

    setDownloadingFiles(prev => ({ ...prev, [filename]: false }));

    if (result.success) {
      setReportError(null);
      notify.dismissCategory('REPORTS');
    } else {
      const userFacingMsg = result.error && !result.error.includes('500') && !result.error.includes('status code')
        ? result.error
        : 'Please try again.';

      setReportError(userFacingMsg);
    }
  };

  const getActiveFilterQueryParams = (extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    const effDept = (isHodUser && selectedReportType !== 'WEEKLY_PERFORMANCE' && (selectedDept === 'ALL' || !selectedDept)) ? hodDeptDefault : selectedDept;
    if (effDept && effDept !== 'ALL') params.append('department', effDept);
    if (selectedYear && selectedYear !== 'ALL') params.append('year', selectedYear);
    if (selectedOutputScope && selectedOutputScope !== 'ALL') params.append('output_scope', selectedOutputScope);
    if (selectedReportType) params.append('report_type', selectedReportType);
    if (selectedSessionId) params.append('session_id', selectedSessionId);
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

  const handleDownloadPDF = async () => {
    const q = getActiveFilterQueryParams();
    const today = new Date().toISOString().slice(0, 10);
    const filename = `Nandha_LeetCode_Intelligence_Report_${today}.pdf`;
    setReportError(null);
    notify.dismissCategory('REPORTS');
    setDownloadingFiles(prev => ({ ...prev, [filename]: true }));
    const result = await downloadManager.download({
      endpoint: `/reports/export-pdf${q}`,
      filename,
      mimeType: 'application/pdf',
      onStateChange: (state) => setDownloadState(state),
    });
    setDownloadingFiles(prev => ({ ...prev, [filename]: false }));
    if (!result.success) {
      const msg = result.error && !result.error.includes('500') ? result.error : 'Please try again.';
      setReportError(msg);
    }
  };

  const handleDownloadWord = async () => {
    const q = getActiveFilterQueryParams();
    const filename = 'Executive_Word_Summary.docx';
    setReportError(null);
    notify.dismissCategory('REPORTS');
    setDownloadingFiles(prev => ({ ...prev, [filename]: true }));
    const result = await downloadManager.download({
      endpoint: `/reports/export-word${q}`,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      onStateChange: (state) => setDownloadState(state),
    });
    setDownloadingFiles(prev => ({ ...prev, [filename]: false }));
    if (!result.success) {
      const msg = result.error && !result.error.includes('500') ? result.error : 'Please try again.';
      setReportError(msg);
    }
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
    // Instant offline check to prevent endless spinning
    if (!navigator.onLine) {
      notify.error('Network Offline', 'Please check your internet connection and try again.', { category: 'REPORTS' });
      return;
    }

    setIsGeneratingUniversal(true);
    setReportError(null);
    notify.dismissCategory('REPORTS');

    try {
      const reportType = overrideType || selectedReportType;
      const rawDept = overrideFilters?.department || selectedDept;
      const department = (isHodUser && reportType !== 'WEEKLY_PERFORMANCE' && (rawDept === 'ALL' || !rawDept)) ? hodDeptDefault : rawDept;
      const year = overrideFilters?.year || selectedYear;
      const output_scope = overrideFilters?.output_scope || selectedOutputScope;

      const res = await api.post('/reports/generate', {
        report_type: reportType,
        department: department,
        year: year,
        output_scope: output_scope,
        filters: { session_id: selectedSessionId, ...(overrideFilters || {}) }
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        }
      });

      if (!res.data || typeof res.data !== 'object') {
        throw new Error('Unable to retrieve report dataset. Please try again.');
      }

      setActiveUniversalPreviewData(res.data);
      setActiveUniversalPreviewId(res.data.reportId || res.data.report_id || `rpt_${Date.now()}`);
      notify.success('Report Ready', 'Universal report generated successfully.', { category: 'REPORTS' });
    } catch (err: any) {
      const statusCode = err.response?.status;
      const detailMsg = err.response?.data?.detail || err.message;
      let userFacingMsg = detailMsg && !detailMsg.includes('500') && !detailMsg.includes('traceback') ? detailMsg : 'Please try again.';
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
      icon: Award,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      btnGradient: 'from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 shadow-indigo-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-excel?report_type=FIVE_WEEK_PERFORMANCE_TREND${q}`, 'Five_Week_Performance_Trend_Report.xlsx');
      }
    },
    {
      id: 'contest-attendance',
      title: 'Contest Attendance & Participation',
      badge: 'WEEKLY CONTEST MATRIX',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Comprehensive grid mapping every student’s contest attendance across the academic year. Provides a complete weekly attendance matrix and performance breakdown.',
      filename: 'Contest_Attendance_and_Participation.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      btnGradient: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-weekly-contest-matrix${q}`, 'Contest_Attendance_and_Participation.xlsx');
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
      id: 'coordinator-weekly-performance',
      title: 'Coordinator Weekly Performance',
      badge: 'WEEKLY SUMMARY REPORT',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      description: 'Generates the Weekly Performance Report for the Academic Coordinator, detailing problem solving counts, contest attendance, and Leetcode ratings.',
      filename: 'LeetCode_Weekly_Report.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      btnGradient: 'from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-excel?report_type=WEEKLY_PERFORMANCE${q}`, 'LeetCode_Weekly_Report.xlsx');
      }
    },
    {
      id: 'principal-executive',
      title: 'Principal Executive Intelligence Report',
      badge: 'INSTITUTION-WIDE OVERVIEW',
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      description: 'High-level executive institutional overview: Total enrolled students, verified solvers, attendance %, 4/4 solver count, department comparative matrix, and top achievements.',
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
      id: 'tnea-cutoff-analysis',
      title: '12th TNEA Cutoff Intelligence',
      badge: 'ADMISSIONS & ACADEMICS',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      description: 'Analysis of 12th standard TNEA cutoff bands (200-190, 190-180... 70-80) mapped to department distribution and academic performance.',
      filename: '12th_TNEA_Cutoff_Intelligence.xlsx',
      icon: FileSpreadsheet,
      iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      btnGradient: 'from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-sky-600/30',
      onClick: () => {
        const q = getActiveFilterQueryParams();
        downloadReportFile(`/reports/export-excel?report_type=12TH_TNEA_CUTOFF_ANALYSIS${q}`, '12th_TNEA_Cutoff_Intelligence.xlsx');
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
    <div className="space-y-6 sm:space-y-8 pt-0 pb-10 animate-fade-in">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-8 shadow-lg border border-brand-500/30">

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 sm:space-y-3 max-w-2xl">

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight uppercase">
              {['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase()) ? (
                <>
                  MY <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">EXPORT SUITE</span>
                </>
              ) : (
                <>
                  Reports & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Export Center</span>
                </>
              )}
            </h1>

            <p className="text-xs md:text-sm text-slate-300 font-medium sm:font-bold tracking-wide">
              {['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase())
                ? "Download individual formatted Excel workbooks and reports for your assigned students."
                : "Download individual formatted Excel workbooks, executive PDF summaries, and dispatch automated Sunday email reports to management"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-3 w-full md:w-auto shrink-0 pt-2 sm:pt-0">
            <button
              onClick={handleTriggerSync}
              className="flex items-center justify-center space-x-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 cursor-pointer w-full sm:w-auto shrink-0 touch-manipulation"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="truncate">Live Sync</span>
            </button>
            <button
              onClick={() => setShowCertModal(true)}
              className="flex items-center justify-center space-x-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all transform active:scale-95 cursor-pointer w-full sm:w-auto shrink-0 touch-manipulation"
            >
              <Award className="w-4 h-4 shrink-0" />
              <span className="truncate">Merit Certificates</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-navy-950 p-1.5 sm:p-2.5 rounded-2xl w-full sm:max-w-fit border border-slate-200 dark:border-slate-800 flex-nowrap overflow-x-auto mt-2 mb-6 sm:mb-10 shadow-sm scrollbar-none">
        <button
          onClick={() => startTransition(() => setActiveTab('reports'))}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${activeTab === 'reports'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Exports &amp; Hub</span>
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab('email'))}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${activeTab === 'email' || activeTab === 'manual_email' || activeTab === 'auto_email'
              ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Email Operations</span>
        </button>
      </div>



      {activeTab === 'email' || activeTab === 'manual_email' || activeTab === 'auto_email' ? (
        <EmailDeliveryTab defaultSection="manual" />
      ) : (
        <>

          {/* Universal Institutional Reports Section — Clean Solid Architecture */}
          <div className={`p-4 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-white/10 shadow-2xl shadow-indigo-950/20 space-y-5 bg-white dark:bg-[#0b101e] relative mt-2 ${rptTypeOpen || rptYearOpen || rptScopeOpen || rptSessionOpen ? 'z-50' : 'z-10'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/25 border border-white/20">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                      Universal Reports & Intelligence
                    </h2>
                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-mono font-bold border border-emerald-400/30 whitespace-nowrap">
                      LIVE ENGINE
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Standardized export datasets for <span className="font-bold text-slate-700 dark:text-slate-200">Preview</span>, <span className="font-bold text-brand-600 dark:text-brand-400">Excel</span>, <span className="font-bold text-rose-600 dark:text-rose-400">PDF</span>, & <span className="font-bold text-indigo-600 dark:text-indigo-400">Word</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Unified Report Builder Form Controls — Mobile Friendly Responsive Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5 p-3.5 sm:p-5 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-inner items-start relative ${rptTypeOpen || rptYearOpen || rptSessionOpen ? 'z-[100]' : 'z-20'}`}>

              {/* 1. Report Type — Premium Dropdown with Custom Colored Badges */}
              <div className={`flex flex-col space-y-1.5 min-w-0 w-full relative transition-all ${rptTypeOpen ? 'z-[100]' : 'z-[10]'}`}>
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">
                  Report Type
                </span>
                <div className={`relative ${rptTypeOpen ? 'z-30' : 'z-10'}`}>
                  {(() => {
                    const rawCategories = [
                      {
                        title: 'A. CONTEST REPORTS',
                        titleColor: 'text-brand-600 dark:text-brand-400',
                        options: [
                          { value: 'FRIDAY_OFFICIAL_CONTEST', label: 'Friday Contest Result', dotColor: 'bg-indigo-500' },
                          { value: 'SATURDAY_BIWEEKLY_CONTEST', label: 'Saturday Biweekly Contest Result', dotColor: 'bg-purple-500' },
                          { value: 'SUNDAY_LIVE_CONTEST', label: 'Sunday Live Contest', dotColor: 'bg-sky-500' },
                          { value: 'WEEKLY_CONTEST_INTELLIGENCE', label: 'Weekly Contest Intelligence', dotColor: 'bg-blue-500' },
                          { value: 'CONTEST_ATTENDANCE_PARTICIPATION', label: 'Contest Attendance & Participation', dotColor: 'bg-emerald-500' },
                          { value: 'CONTEST_PERFORMANCE_RANKING', label: 'Contest Performance & Ranking', dotColor: 'bg-amber-500' },
                          { value: 'WEEK_ON_WEEK_INTELLIGENCE', label: 'Week-on-Week Intelligence', dotColor: 'bg-teal-500' },
                          { value: 'HISTORICAL_CONTEST_INTELLIGENCE', label: 'Historical Contest Intelligence', dotColor: 'bg-cyan-500' },
                        ]
                      },
                      {
                        title: 'B. PERFORMANCE REPORTS',
                        titleColor: 'text-purple-600 dark:text-purple-400',
                        options: [
                          { value: 'WEEKLY_STUDENT_PERFORMANCE', label: 'Weekly Student Performance', dotColor: 'bg-purple-500' },
                          { value: 'FIVE_WEEK_PERFORMANCE_TREND', label: 'Five-Week Performance Trend', dotColor: 'bg-indigo-500' },
                          { value: 'PROBLEM_DIFFICULTY_INTELLIGENCE', label: 'Problem Difficulty Intelligence', dotColor: 'bg-teal-500' },
                        ]
                      },
                      {
                        title: 'C. CONSOLIDATED REPORTS',
                        titleColor: 'text-amber-600 dark:text-amber-400',
                        options: [
                          { value: 'FACULTY_CONSOLIDATED', label: 'Faculty Consolidated Performance', dotColor: 'bg-amber-500' },
                          { value: 'FACULTY_COORDINATOR_CONSOLIDATED', label: 'Faculty Coordinator Consolidated', dotColor: 'bg-orange-500' },
                          { value: 'HOD_DEPARTMENT_INTELLIGENCE', label: 'HOD Department Intelligence', dotColor: 'bg-rose-500' },
                          { value: 'WEEKLY_PERFORMANCE', label: 'Coordinator Weekly Performance', dotColor: 'bg-cyan-500' },
                        ]
                      },
                      {
                        title: 'D. EXECUTIVE REPORTS',
                        titleColor: 'text-indigo-600 dark:text-indigo-400',
                        options: [
                          { value: 'PRINCIPAL_EXECUTIVE', label: 'Principal Executive Intelligence', dotColor: 'bg-blue-500' },
                          { value: 'MANAGEMENT_EXECUTIVE_SUMMARY', label: 'Management Executive Summary', dotColor: 'bg-slate-500' },
                          { value: '12TH_TNEA_CUTOFF_ANALYSIS', label: '12th TNEA Cutoff Intelligence', dotColor: 'bg-sky-500' },
                        ]
                      }
                    ];

                    const roleClean = (user?.role || '').trim().toLowerCase();
                    const isFaculty = ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
                    const isHod = ['hod', 'head of department', 'head'].includes(roleClean);
                    const isCoordinator = ['coordinator', 'academic coordinator'].includes(roleClean);

                    const reportCategories = rawCategories.map(cat => {
                      if (cat.title === 'A. CONTEST REPORTS' || cat.title === 'B. PERFORMANCE REPORTS') return cat;
                      if (cat.title === 'C. CONSOLIDATED REPORTS') {
                        let allowedOptions = cat.options;
                        if (isFaculty) {
                          allowedOptions = allowedOptions.filter(o => o.value === 'FACULTY_CONSOLIDATED');
                        } else if (isCoordinator) {
                          allowedOptions = allowedOptions.filter(o => o.value === 'FACULTY_CONSOLIDATED' || o.value === 'FACULTY_COORDINATOR_CONSOLIDATED' || o.value === 'WEEKLY_PERFORMANCE');
                        } else if (isHod) {
                          allowedOptions = allowedOptions.filter(o => o.value === 'FACULTY_CONSOLIDATED' || o.value === 'HOD_DEPARTMENT_INTELLIGENCE');
                        }
                        return { ...cat, options: allowedOptions };
                      }
                      if (cat.title === 'D. EXECUTIVE REPORTS') {
                        if (isFaculty || isCoordinator || isHod) return { ...cat, options: [] };
                        return cat;
                      }
                      return cat;
                    }).filter(cat => cat.options.length > 0);

                    const allOpts = reportCategories.flatMap(c => c.options);
                    const currentOpt = allOpts.find(o => 
                      o.value === selectedReportType ||
                      (selectedReportType === 'STUDENT_PERFORMANCE' && o.value === 'WEEKLY_STUDENT_PERFORMANCE') ||
                      (selectedReportType === 'COLLEGE_EXECUTIVE' && o.value === 'PRINCIPAL_EXECUTIVE') ||
                      (selectedReportType === 'DEPARTMENT_PERFORMANCE' && o.value === 'HOD_DEPARTMENT_INTELLIGENCE') ||
                      (selectedReportType === 'BATCH_PERFORMANCE' && o.value === 'FIVE_WEEK_PERFORMANCE_TREND')
                    ) || allOpts[0];

                    const categoryMeta: Record<string, { gradient: string; headerBg: string; iconBg: string; accentBar: string }> = {
                      'A. CONTEST REPORTS': {
                        gradient: 'from-brand-500 to-indigo-500',
                        headerBg: 'bg-gradient-to-r from-brand-500/10 to-indigo-500/5 border border-brand-500/20',
                        iconBg: 'bg-brand-500/15',
                        accentBar: 'bg-gradient-to-b from-brand-500 to-indigo-500',
                      },
                      'B. PERFORMANCE REPORTS': {
                        gradient: 'from-purple-500 to-pink-500',
                        headerBg: 'bg-gradient-to-r from-purple-500/10 to-pink-500/5 border border-purple-500/20',
                        iconBg: 'bg-purple-500/15',
                        accentBar: 'bg-gradient-to-b from-purple-500 to-pink-500',
                      },
                      'C. CONSOLIDATED REPORTS': {
                        gradient: 'from-amber-500 to-orange-500',
                        headerBg: 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20',
                        iconBg: 'bg-amber-500/15',
                        accentBar: 'bg-gradient-to-b from-amber-500 to-orange-500',
                      },
                      'D. EXECUTIVE REPORTS': {
                        gradient: 'from-indigo-500 to-sky-500',
                        headerBg: 'bg-gradient-to-r from-indigo-500/10 to-sky-500/5 border border-indigo-500/20',
                        iconBg: 'bg-indigo-500/15',
                        accentBar: 'bg-gradient-to-b from-indigo-500 to-sky-500',
                      },
                    };

                    const renderCategory = (cat: any) => {
                      const meta = categoryMeta[cat.title] || { gradient: 'from-brand-500 to-indigo-500', headerBg: 'bg-slate-100/80 border border-slate-200', iconBg: 'bg-brand-500/10', accentBar: 'bg-brand-500' };
                      return (
                        <div key={cat.title} className="space-y-1.5">
                          {/* Category Header */}
                          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl mb-2 ${meta.headerBg}`}>
                            <div className={`h-4 w-1 rounded-full ${meta.accentBar} shrink-0`} />
                            <span className={`text-[11px] font-black uppercase tracking-widest bg-gradient-to-r ${meta.gradient} bg-clip-text text-transparent`}>
                              {cat.title}
                            </span>
                          </div>
                          {/* Options */}
                          {cat.options.map((opt: any) => {
                            const isSelected = selectedReportType === opt.value ||
                              (selectedReportType === 'STUDENT_PERFORMANCE' && opt.value === 'WEEKLY_STUDENT_PERFORMANCE') ||
                              (selectedReportType === 'COLLEGE_EXECUTIVE' && opt.value === 'PRINCIPAL_EXECUTIVE') ||
                              (selectedReportType === 'DEPARTMENT_PERFORMANCE' && opt.value === 'HOD_DEPARTMENT_INTELLIGENCE');

                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setSelectedReportType(opt.value);
                                  setRptTypeOpen(false);
                                  setRptSearch('');
                                }}
                                className={`w-full flex items-center gap-2.5 pl-3 pr-3 py-2.5 rounded-xl text-left transition-all duration-150 group cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-brand-500/12 to-transparent border border-brand-400/40 dark:border-brand-500/40 shadow-sm'
                                    : 'border border-transparent hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:border-slate-200/60 dark:hover:border-white/8'
                                }`}
                              >
                                {/* Left accent strip */}
                                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200 ${
                                  isSelected
                                    ? `h-[70%] bg-brand-500`
                                    : `h-0 ${opt.dotColor} opacity-0 group-hover:h-[50%] group-hover:opacity-60`
                                }`} />
                                <span className={`text-[12.5px] truncate flex-1 leading-snug transition-all duration-150 pl-1 ${
                                  isSelected
                                    ? 'font-extrabold text-brand-700 dark:text-brand-300'
                                    : 'font-semibold text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white'
                                }`}>
                                  {opt.label}
                                </span>
                                {isSelected && (
                                  <div className="shrink-0 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shadow-sm shadow-brand-500/30">
                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Trigger Button */}
                        <button
                          type="button"
                          onClick={() => { setRptTypeOpen(p => !p); setRptYearOpen(false); setRptScopeOpen(false); setRptSessionOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 h-12 min-h-[48px] rounded-2xl bg-white dark:bg-navy-950 border-2 text-left transition-all duration-200 focus:outline-none cursor-pointer ${
                            rptTypeOpen
                              ? 'border-brand-500 ring-4 ring-brand-500/15 shadow-lg shadow-brand-500/10'
                              : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <div className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                            rptTypeOpen ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          }`}>
                            <LayoutTemplate className="w-4 h-4" />
                          </div>

                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                            {currentOpt ? currentOpt.label : selectedReportType}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0 ${rptTypeOpen ? 'rotate-180 text-brand-500' : ''}`} />
                        </button>

                        {/* Dropdown Panel */}
                        {rptTypeOpen && (
                          isMobile ? (
                            createPortal(
                              <div className="fixed inset-0 z-[99999] flex flex-col justify-end">
                                <div 
                                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
                                  onClick={() => { setRptTypeOpen(false); setRptSearch(''); }} 
                                />
                                <div className="relative z-10 w-full max-h-[85vh] flex flex-col bg-white dark:bg-[#0c1222] rounded-t-[28px] border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden pb-8">
                                  {/* Interactive Top Swipe Bar */}
                                  <SwipeHandle 
                                    onClose={() => { setRptTypeOpen(false); setRptSearch(''); }} 
                                    className="pt-2 pb-1 shrink-0" 
                                    pillClassName="bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                                  />

                                  {/* Header */}
                                  <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-xl bg-brand-500/15 border border-brand-400/30 flex items-center justify-center text-brand-500 shrink-0">
                                        <LayoutTemplate className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-sm font-black text-slate-900 dark:text-white tracking-wide truncate">
                                        Select Report Type
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-full">
                                        {allOpts.length} Reports
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => { setRptTypeOpen(false); setRptSearch(''); }}
                                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Search Bar */}
                                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 shrink-0">
                                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <input
                                      type="text"
                                      value={rptSearch}
                                      onChange={(e) => setRptSearch(e.target.value)}
                                      placeholder="Filter reports by name..."
                                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none font-medium"
                                      autoFocus
                                    />
                                    {rptSearch && (
                                      <button
                                        type="button"
                                        onClick={() => setRptSearch('')}
                                        className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>

                                  {/* Options Content */}
                                  {(() => {
                                    const displayedCategories = rptSearch.trim()
                                      ? reportCategories.map(cat => ({
                                          ...cat,
                                          options: cat.options.filter((opt: any) => 
                                            opt.label.toLowerCase().includes(rptSearch.toLowerCase()) ||
                                            opt.value.toLowerCase().includes(rptSearch.toLowerCase())
                                          )
                                        })).filter(cat => cat.options.length > 0)
                                      : reportCategories;

                                    return (
                                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {displayedCategories.map(cat => (
                                          <div key={cat.title}>
                                            {renderCategory(cat)}
                                          </div>
                                        ))}
                                        {displayedCategories.length === 0 && (
                                          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                                            No reports found matching "{rptSearch}".
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>,
                              document.body
                            )
                          ) : (
                            <>
                              {/* Backdrop click to dismiss on desktop - clean transparent dismissal */}
                              <div 
                                className="fixed inset-0 z-[190] bg-transparent" 
                                onClick={() => { setRptTypeOpen(false); setRptSearch(''); }} 
                              />
                              <div className="absolute z-[200] top-full left-0 right-0 sm:right-auto mt-2 w-full sm:w-[500px] md:w-[740px] max-w-full sm:max-w-[calc(100vw-3rem)] rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-[#0c1222] border-2 border-slate-200 dark:border-slate-700 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_90px_-15px_rgba(0,0,0,0.95)] animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[min(480px,calc(100vh-140px))]">
                                {/* Dropdown header bar */}
                                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-gradient-to-r from-[#111827] via-[#1e293b] to-[#111827] border-b border-brand-500/40 shrink-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-brand-500/25 border border-brand-400/30 flex items-center justify-center shrink-0">
                                      <LayoutTemplate className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-300" />
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-white tracking-wide truncate">Select Report Type</span>
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-bold text-white bg-brand-500/30 border border-brand-400/40 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                                    {allOpts.length} Reports
                                  </span>
                                </div>

                                {/* Search Bar */}
                                <div className="px-3.5 sm:px-5 py-2 bg-slate-900/95 border-b border-slate-700/80 flex items-center gap-2 shrink-0">
                                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <input
                                    type="text"
                                    value={rptSearch}
                                    onChange={(e) => setRptSearch(e.target.value)}
                                    placeholder="Filter reports by name (e.g. contest, hod, faculty)..."
                                    className="w-full bg-transparent text-xs text-white placeholder-slate-400 outline-none font-medium"
                                    autoFocus
                                  />
                                  {rptSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setRptSearch('')}
                                      className="text-[10px] text-slate-300 hover:text-white px-1.5 py-0.5 rounded bg-white/10"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>

                                {/* Two-column body on desktop, single column on mobile - constrained height & visible scrolling */}
                                {(() => {
                                  const displayedCategories = rptSearch.trim()
                                    ? reportCategories.map(cat => ({
                                        ...cat,
                                        options: cat.options.filter((opt: any) => 
                                          opt.label.toLowerCase().includes(rptSearch.toLowerCase()) ||
                                          opt.value.toLowerCase().includes(rptSearch.toLowerCase())
                                        )
                                      })).filter(cat => cat.options.length > 0)
                                    : reportCategories;

                                  return (
                                    <div 
                                      className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-y-auto divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0c1222] pb-6 custom-scrollbar"
                                      style={{
                                        maxHeight: '340px',
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: '#6366f1 rgba(15, 23, 42, 0.4)'
                                      }}
                                    >
                                      {/* LEFT: Contest Reports */}
                                      <div className="p-3 sm:p-5 bg-slate-50 dark:bg-[#0f172a] border-r-0 md:border-r border-slate-200/80 dark:border-slate-800">
                                        {displayedCategories.find(c => c.title === 'A. CONTEST REPORTS') && 
                                          renderCategory(displayedCategories.find(c => c.title === 'A. CONTEST REPORTS'))}
                                      </div>
                                      {/* RIGHT: Performance, Consolidated, Executive */}
                                      <div className="p-3 sm:p-5 bg-white dark:bg-[#0c1222] flex flex-col gap-y-3.5 sm:gap-y-5">
                                        {displayedCategories.filter(c => c.title !== 'A. CONTEST REPORTS').map(cat => (
                                          <div key={cat.title}>
                                            {renderCategory(cat)}
                                          </div>
                                        ))}
                                        {displayedCategories.length === 0 && (
                                          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                                            No reports found matching "{rptSearch}".
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          )
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Department — Premium Dropdown */}
              <div className="flex flex-col min-w-0 w-full z-[10]">
                <PremiumDepartmentSelect
                  selectedDept={selectedDept}
                  onChange={setSelectedDept}
                  label="Department"
                  className="!w-full"
                  showAllDepartments={true}
                  useIdAsValue={false}
                />
              </div>

              {/* 3. Year / Batch — Premium Dropdown */}
              <div className={`flex flex-col space-y-1.5 min-w-0 w-full relative transition-all ${rptYearOpen ? 'z-[100]' : 'z-[10]'}`}>
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">Year / Batch</span>
                <div className={`relative ${rptYearOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptYearOpen(p => !p); setRptTypeOpen(false); setRptScopeOpen(false); setRptSessionOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 h-12 min-h-[48px] rounded-2xl bg-white dark:bg-navy-950 border-2 text-left transition-all duration-200 focus:outline-none cursor-pointer ${
                      rptYearOpen 
                        ? 'border-brand-500 ring-4 ring-brand-500/15 shadow-lg shadow-brand-500/10' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
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
                      {selectedYear === 'ALL' ? 'All Academic Years' : selectedYear === '2' ? 'II Year' : selectedYear === '3' ? 'III Year' : 'IV Year'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptYearOpen ? 'rotate-180 text-brand-500' : ''}`} />
                  </button>
                  {rptYearOpen && (
                    isMobile ? (
                      createPortal(
                        <div className="fixed inset-0 z-[99999] flex flex-col justify-end">
                          <div 
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
                            onClick={() => setRptYearOpen(false)} 
                          />
                          <div className="relative z-10 w-full max-h-[75vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-[28px] border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden pb-8">
                            {/* Interactive Top Swipe Bar */}
                            <SwipeHandle 
                              onClose={() => setRptYearOpen(false)} 
                              className="pt-2 pb-1 shrink-0" 
                              pillClassName="bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                            />
                            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-xl bg-brand-500/15 border border-brand-400/30 flex items-center justify-center text-brand-500">
                                  <GraduationCap className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-wide">
                                  Select Year / Batch
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-full">
                                  4 Batches
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRptYearOpen(false)}
                                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="p-3.5 space-y-2 overflow-y-auto">
                              {[
                                { value: 'ALL', code: 'ALL', label: 'All Academic Years', pillColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' },
                                { value: '2', code: 'II', label: 'II Year (Second Year)', pillColor: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700' },
                                { value: '3', code: 'III', label: 'III Year (Third Year)', pillColor: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/60 dark:text-violet-200 dark:border-violet-700' },
                                { value: '4', code: 'IV', label: 'IV Year (Final Year)', pillColor: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700' },
                              ].map(opt => {
                                const isSelected = selectedYear === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setSelectedYear(opt.value); setRptYearOpen(false); }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.98] ${
                                      isSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-500/80 text-indigo-950 dark:text-indigo-200 shadow-xs'
                                        : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:bg-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className={`w-12 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : opt.pillColor}`}>
                                        {opt.code}
                                      </span>
                                      <span className={`text-sm truncate ${isSelected ? 'font-black text-indigo-950 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                                        {opt.label}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>,
                        document.body
                      )
                    ) : (
                      <>
                        <div 
                          className="fixed inset-0 z-[190] bg-transparent" 
                          onClick={() => setRptYearOpen(false)} 
                        />
                        <div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl max-h-64 overflow-y-auto p-2 space-y-1">
                          {[
                            { value: 'ALL', code: 'ALL', label: 'All Academic Years', pillColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' },
                            { value: '2', code: 'II', label: 'II Year', pillColor: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700' },
                            { value: '3', code: 'III', label: 'III Year', pillColor: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/60 dark:text-violet-200 dark:border-violet-700' },
                            { value: '4', code: 'IV', label: 'IV Year', pillColor: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700' },
                          ].map(opt => {
                            const isSelected = selectedYear === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => { setSelectedYear(opt.value); setRptYearOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${isSelected ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/20' : 'hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                              >
                                <span className={`w-12 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-white/20 text-white border-white/30' : opt.pillColor}`}>{opt.code}</span>
                                <span className={`text-xs truncate flex-1 ${isSelected ? 'font-black text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{opt.label}</span>
                                {isSelected && <Check className="w-4 h-4 text-white shrink-0" strokeWidth={3} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )
                  )}
                </div>
              </div>

              {/* 4. Report Date / Snapshot — Premium Dropdown */}
              <div className={`flex flex-col space-y-1.5 min-w-0 w-full relative transition-all ${rptSessionOpen ? 'z-[100]' : 'z-[10]'}`}>
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider truncate">Report Date</span>
                <div className={`relative ${rptSessionOpen ? 'z-50' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setRptSessionOpen(p => !p); setRptYearOpen(false); setRptTypeOpen(false); setRptScopeOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 h-12 min-h-[48px] rounded-2xl bg-white dark:bg-navy-950 border-2 text-left transition-all duration-200 focus:outline-none cursor-pointer ${
                      rptSessionOpen 
                        ? 'border-brand-500 ring-4 ring-brand-500/15 shadow-lg shadow-brand-500/10' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    {(() => {
                      const sel = availableSundays.find(s => s.session_id === selectedSessionId) || availableSundays[0];
                      if (!sel) return <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">Latest Date</span>;
                      
                      const formatDate = (d: string) => {
                        if (d && d.includes('-')) {
                          const p = d.split('-');
                          if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
                        }
                        if (d && d.includes('/')) {
                          return d.replace(/\//g, '.');
                        }
                        return d;
                      };

                      return (
                        <>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border ${sel.is_latest ? 'text-brand-700 bg-brand-100 border-brand-300' : 'text-slate-700 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'}`}>
                            {sel.is_latest ? 'LATEST' : 'PAST'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                            {formatDate(sel.date)}
                          </span>
                        </>
                      );
                    })()}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${rptSessionOpen ? 'rotate-180 text-brand-500' : ''}`} />
                  </button>
                  {rptSessionOpen && (
                    isMobile ? (
                      createPortal(
                        <div className="fixed inset-0 z-[99999] flex flex-col justify-end">
                          <div 
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
                            onClick={() => setRptSessionOpen(false)} 
                          />
                          <div className="relative z-10 w-full max-h-[80vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-[28px] border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden pb-8">
                            {/* Interactive Top Swipe Bar */}
                            <SwipeHandle 
                              onClose={() => setRptSessionOpen(false)} 
                              className="pt-2 pb-1 shrink-0" 
                              pillClassName="bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                            />
                            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-xl bg-brand-500/15 border border-brand-400/30 flex items-center justify-center text-brand-500">
                                  <Clock className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-wide">
                                  Select Report Date / Session
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-full">
                                  {availableSundays.length} Sessions
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRptSessionOpen(false)}
                                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="p-3.5 space-y-2 overflow-y-auto">
                              {availableSundays.map(opt => {
                                const isSelected = selectedSessionId === opt.session_id;
                                const formatDate = (d: string) => {
                                  if (d && d.includes('-')) {
                                    const p = d.split('-');
                                    if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
                                  }
                                  if (d && d.includes('/')) {
                                    return d.replace(/\//g, '.');
                                  }
                                  return d;
                                };
                                const isBiweekly = opt.contest_type === 'biweekly' || (opt.label && opt.label.toLowerCase().includes('biweekly'));
                                return (
                                  <button
                                    key={opt.session_id}
                                    type="button"
                                    onClick={() => { setSelectedSessionId(opt.session_id); setRptSessionOpen(false); }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.98] ${
                                      isSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-500/80 text-indigo-950 dark:text-indigo-200 shadow-xs'
                                        : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:bg-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <span className={`w-16 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : (isBiweekly ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' : (opt.is_latest ? 'bg-brand-100 text-brand-700 border-brand-300 dark:bg-brand-950/60 dark:text-brand-300' : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200'))
                                      }`}>
                                        {isBiweekly ? 'BIWEEKLY' : (opt.is_latest ? 'LATEST' : 'PAST')}
                                      </span>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-sm truncate ${isSelected ? 'font-black text-indigo-950 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                                          {formatDate(opt.date)}
                                        </span>
                                        <span className={`text-xs truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-slate-500 dark:text-slate-400 font-normal'}`}>
                                          {opt.label.split(' - ')[1] || opt.contest_name || opt.label}
                                        </span>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 ml-2 shadow-xs">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                              {availableSundays.length === 0 && (
                                <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                                  Loading available dates...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>,
                        document.body
                      )
                    ) : (
                      <>
                        <div 
                          className="fixed inset-0 z-[190] bg-transparent" 
                          onClick={() => setRptSessionOpen(false)} 
                        />
                        <div className="absolute z-[300] top-full left-0 right-0 mt-2 bg-white dark:bg-navy-950 border border-slate-200/90 dark:border-slate-700 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] max-h-[380px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {availableSundays.map(opt => {
                          const isSelected = selectedSessionId === opt.session_id;
                          const formatDate = (d: string) => {
                            if (d && d.includes('-')) {
                              const p = d.split('-');
                              if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
                            }
                            if (d && d.includes('/')) {
                              return d.replace(/\//g, '.');
                            }
                            return d;
                          };
                          const isBiweekly = opt.contest_type === 'biweekly' || (opt.label && opt.label.toLowerCase().includes('biweekly'));
                          return (
                            <button key={opt.session_id} type="button"
                              onClick={() => { setSelectedSessionId(opt.session_id); setRptSessionOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${isSelected ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/20' : 'hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                            >
                              <span className={`w-16 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md text-center shrink-0 border ${isSelected ? 'bg-white/20 text-white border-white/30' : (isBiweekly ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' : (opt.is_latest ? 'bg-brand-100 text-brand-700 border-brand-300 dark:bg-brand-950/60 dark:text-brand-300' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'))}`}>
                                {isBiweekly ? 'BIWEEKLY' : (opt.is_latest ? 'LATEST' : 'PAST')}
                              </span>
                              <div className={`flex flex-col flex-1 min-w-0 ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                                <span className={`text-xs truncate ${isSelected ? 'font-black' : 'font-bold'}`}>{formatDate(opt.date)}</span>
                                <span className={`text-[11px] truncate ${isSelected ? 'text-white/90 font-bold' : 'text-slate-600 dark:text-slate-400 font-semibold'}`}>{opt.label.split(' - ')[1] || opt.contest_name || opt.label}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-white shrink-0" strokeWidth={3} />}
                            </button>
                          );
                        })}
                        {availableSundays.length === 0 && (
                          <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-brand-500" />
                            Loading available dates...
                          </div>
                        )}
                      </div>
                    </>
                  )
                )}
                </div>
              </div>

            </div>

            {/* Action Bar Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-200/80 dark:border-white/10 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 font-semibold truncate w-full sm:w-auto">
                <span className="text-[11px] sm:text-xs truncate">
                  Active Filter: <span className="font-black text-slate-900 dark:text-white">{selectedDept === 'ALL' ? 'All Departments' : selectedDept}</span> • <span className="font-black text-indigo-600 dark:text-indigo-400">{selectedYear === 'ALL' ? 'All Batches' : `${selectedYear === '2' ? 'II' : selectedYear === '3' ? 'III' : 'IV'} Year`}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateUniversalReport()}
                disabled={isGeneratingUniversal}
                className="w-full sm:w-auto min-h-[48px] flex items-center justify-center space-x-2.5 px-7 py-3 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:via-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm tracking-wide rounded-2xl shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 border border-brand-400/30 transition-all active:scale-95 cursor-pointer touch-manipulation group"
              >
                <CheckCircle2 className={`w-4 h-4 text-brand-200 group-hover:rotate-12 transition-transform shrink-0 ${isGeneratingUniversal ? 'animate-spin' : ''}`} />
                <span className="font-sans font-black">{isGeneratingUniversal ? 'Opening Preview...' : 'Generate Preview'}</span>
              </button>
            </div>
          </div>

          {/* Universal Report Previewer */}
          {activeUniversalPreviewId && (
            <ReportPreview
              reportId={activeUniversalPreviewId}
              initialData={activeUniversalPreviewData}
              onClose={() => {
                setActiveUniversalPreviewId(null);
                setActiveUniversalPreviewData(null);
              }}
            />
          )}

          {/* Certificate Management Modal */}
          {showCertModal && (
            <CertificateManagementModal
              isOpen={showCertModal}
              onClose={() => setShowCertModal(false)}
            />
          )}

          {/* Sync Status Modal */}
          <SyncStatusModal 
            isOpen={showSyncModal} 
            onClose={() => setShowSyncModal(false)} 
          />

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
            <div className="fixed top-[calc(env(safe-area-inset-top,0px)+3.85rem)] sm:top-[4.25rem] left-4 right-4 sm:left-auto sm:right-6 z-[10000] animate-slide-down-fade">
              <div className="px-5 py-3 rounded-2xl bg-slate-905 bg-slate-900/95 dark:bg-navy-950/95 backdrop-blur-xl border border-slate-700/80 text-white text-xs font-bold shadow-2xl flex items-center space-x-3 w-full sm:w-auto max-w-md mx-auto ring-1 ring-white/10">
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

