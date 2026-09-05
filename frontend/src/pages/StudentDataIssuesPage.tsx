import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Layers,
  GraduationCap,
  Building2,
  Sliders,
  Sparkles,
  RotateCcw,
  Clock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  FileSpreadsheet,
  FileText,
  Bookmark,
  ChevronRight,
  Eye,
  Edit3,
  HelpCircle,
  Info,
  ArrowUpDown,
  Send,
  Link2,
  Trash2,
  ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';

interface StudentIssue {
  id: number;
  name: string;
  reg_no: string;
  department_code: string;
  department_name: string;
  department_short: string;
  year_level: string;
  username: string | null;
  leetcode_url: string | null;
  url_status: 'VERIFIED' | 'NEEDS_CHECK' | 'INVALID' | 'NO_USERNAME';
  issue_category: string;
  issue_label: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'HEALTHY';
  error_description: string;
  recommended_action: string;
  total_solved: number;
  contest_rating?: number | null;
  sync_status: string;
  last_sync: string;
  last_sync_raw?: string | null;
  is_active: boolean;
}

interface IssueSummaryCounts {
  total_students: number;
  not_started: number;
  sync_failed: number;
  never_synced: number;
  missing_username: number;
  invalid_username: number;
  invalid_url: number;
  stale_data: number;
  data_mismatch: number;
  healthy: number;
  critical_issues: number;
  warning_issues: number;
}

interface SavedView {
  id: string;
  name: string;
  dept: string;
  year: string;
  issue: string;
  search: string;
}

const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: 'all_critical',    name: 'All Critical Issues',         dept: 'all',      year: 'all', issue: 'CRITICAL',        search: '' },
  { id: 'sync_failures',  name: 'Sync Failures Only',          dept: 'all',      year: 'all', issue: 'SYNC_FAILED',     search: '' },
  { id: 'missing_user',   name: 'Missing Username Profiles',   dept: 'all',      year: 'all', issue: 'MISSING_USERNAME', search: '' },
  { id: 'never_synced',  name: 'Never Synced Roster',         dept: 'all',      year: 'all', issue: 'NEVER_SYNCED',    search: '' },
  { id: 'not_started_only', name: 'Not Started (0 Solved)',    dept: 'all',      year: 'all', issue: 'NOT_STARTED',     search: '' },
  { id: 'stale_records',  name: 'Stale Data (>7 Days)',        dept: 'all',      year: 'all', issue: 'STALE_DATA',      search: '' },
  { id: 'cs_iii_sync',    name: 'Cyber Security - III Year',   dept: 'CSE(CS)',  year: 'III', issue: 'SYNC_FAILED',     search: '' },
  { id: 'iot_all_issues', name: 'IoT - All Attention Items',   dept: 'CSE(IOT)', year: 'all', issue: 'ISSUES',          search: '' }
];

// ─── Custom Dropdown Select ──────────────────────────────────────────────────
const CustomSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; icon?: React.ReactNode; badge?: string; badgeColor?: string }[];
  placeholder: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, options, placeholder, icon }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-3 min-w-[200px] w-full px-4 py-2.5 rounded-xl border transition-all cursor-pointer font-bold text-sm ${
          open 
            ? 'border-brand-500 bg-white dark:bg-navy-950 ring-4 ring-brand-500/10 shadow-sm' 
            : (value && value !== 'all')
              ? 'border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' 
              : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={(value && value !== 'all') ? 'text-brand-500' : 'text-slate-400'}>{icon || selected?.icon}</span>
          <div className="flex items-center gap-2">
            {selected?.badge && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${selected.badgeColor || 'bg-slate-100 text-slate-500'}`}>
                {selected.badge}
              </span>
            )}
            <span>{selected ? selected.label : placeholder}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${open ? 'rotate-180 text-brand-500' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-[110%] left-0 w-full min-w-[280px] p-1.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-xl animate-fade-in-up">
          <button
            onClick={() => { onChange('all'); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              !value || value === 'all'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="opacity-70">{icon}</span>
              <span>{placeholder}</span>
            </div>
            {(!value || value === 'all') && <Check size={16} strokeWidth={3} />}
          </button>
          
          <div className="h-px bg-slate-100 dark:bg-navy-800 my-1.5 mx-2" />

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer mb-1 last:mb-0 ${
                    isSelected 
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isSelected ? 'text-white opacity-90' : 'text-slate-400'}>{opt.icon}</span>
                    {opt.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        isSelected ? 'bg-white/20 text-white' : opt.badgeColor || 'bg-slate-100 text-slate-500'
                      }`}>
                        {opt.badge}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const StudentDataIssuesPage: React.FC = () => {
  const { notify, confirmAction } = useNotification();

  // Primary Data State
  const [summary, setSummary] = useState<IssueSummaryCounts | null>(null);
  const [deptBreakdown, setDeptBreakdown] = useState<any[]>([]);
  const [yearBreakdown, setYearBreakdown] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentIssue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selection & Bulk State
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isBulking, setIsBulking] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);

  // Saved Views State
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem('nec_saved_issue_views');
      return stored ? JSON.parse(stored) : DEFAULT_SAVED_VIEWS;
    } catch {
      return DEFAULT_SAVED_VIEWS;
    }
  });
  const [showSaveViewModal, setShowSaveViewModal] = useState<boolean>(false);
  const [newViewName, setNewViewName] = useState<string>('');

  // Profile Repair Modal State
  const [repairStudent, setRepairStudent] = useState<StudentIssue | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState<string>('');
  const [verifyingUser, setVerifyingUser] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [savingRepair, setSavingRepair] = useState<boolean>(false);

  // Live URL Verification Single Row Indicator
  const [verifyingRowId, setVerifyingRowId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    fetchSummaryData();
    fetchStudentsData();
  }, [selectedDept, selectedYear, selectedIssue, searchQuery]);

  const fetchSummaryData = async () => {
    try {
      const res = await api.get('/data-issues/summary');
      if (res.data) {
        setSummary(res.data.counts);
        setDeptBreakdown(res.data.dept_breakdown || []);
        setYearBreakdown(res.data.year_breakdown || []);
      }
    } catch (err) {
      console.error("Failed to fetch data issues summary:", err);
    }
  };

  const fetchStudentsData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/data-issues/students', {
        params: {
          department: selectedDept,
          year_level: selectedYear,
          issue_type: selectedIssue,
          search: searchQuery || undefined,
          limit: 500
        }
      });
      if (res.data && res.data.students) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error("Failed to fetch students issues list:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    notify.info('Refreshing Issues Ledger', 'Calculating real-time database issue telemetry...', { category: 'DATA ISSUES' });
    await fetchSummaryData();
    await fetchStudentsData();
    setRefreshing(false);
    notify.success('Ledger Refreshed', 'Real-time student data issues updated.', { category: 'DATA ISSUES' });
  };

  // Copy canonical URL to clipboard
  const handleCopyUrl = (student: StudentIssue) => {
    if (!student.leetcode_url) return;
    navigator.clipboard.writeText(student.leetcode_url);
    setCopiedId(student.id);
    setTimeout(() => setCopiedId(null), 2000);
    notify.info('URL Copied', `Copied ${student.leetcode_url} to clipboard.`, { category: 'CLIPBOARD' });
  };

  // Live single-row URL verify
  const handleVerifySingleUrl = async (student: StudentIssue) => {
    if (!student.username) {
      notify.warning('Missing Username', 'Student has no LeetCode username configured. Please repair first.', { category: 'URL VALIDATOR' });
      return;
    }

    setVerifyingRowId(student.id);
    try {
      const res = await api.post('/data-issues/verify-url', { username: student.username });
      if (res.data.valid) {
        notify.success('Profile Verified', `LeetCode user @${student.username} is ACTIVE (${res.data.total_solved} solved).`, { category: 'URL VALIDATOR' });
      } else {
        notify.error('Verification Failed', res.data.message || `User @${student.username} not found on LeetCode.`, { category: 'URL VALIDATOR' });
      }
      await fetchStudentsData();
      await fetchSummaryData();
    } catch (err: any) {
      notify.error('Verification Error', err.response?.data?.detail || 'Failed to verify URL with LeetCode.', { category: 'URL VALIDATOR' });
    } finally {
      setVerifyingRowId(null);
    }
  };

  // Single-row Retry Sync
  const handleRetrySyncSingle = async (student: StudentIssue) => {
    notify.info('Syncing Student', `Initiating live stats refresh for ${student.name}...`, { category: 'SYNC ENGINE' });
    try {
      const res = await api.post('/data-issues/bulk-sync', { student_ids: [student.id] });
      if (res.data && res.data.synced > 0) {
        notify.success('Sync Successful', `Fresh stats fetched for ${student.name}.`, { category: 'SYNC ENGINE' });
      } else {
        notify.warning('Sync Incomplete', 'Could not retrieve fresh stats. Profile may be invalid.', { category: 'SYNC ENGINE' });
      }
      await fetchStudentsData();
      await fetchSummaryData();
    } catch (err: any) {
      notify.error('Sync Error', 'Failed to synchronize student data.', { category: 'SYNC ENGINE' });
    }
  };

  // Open Repair Profile Modal
  const handleOpenRepairModal = (student: StudentIssue) => {
    setRepairStudent(student);
    setNewUsernameInput(student.username || '');
    setVerifyResult(null);
  };

  // Live Test in Modal
  const handleTestUsernameInModal = async () => {
    const cleanUser = newUsernameInput.trim();
    if (!cleanUser) {
      notify.warning('Input Required', 'Please enter a LeetCode username.', { category: 'REPAIR ENGINE' });
      return;
    }

    setVerifyingUser(true);
    setVerifyResult(null);
    try {
      const res = await api.post('/data-issues/verify-url', { username: cleanUser });
      setVerifyResult(res.data);
      if (res.data.valid) {
        notify.success('Profile Exists', `Found @${res.data.username} with ${res.data.total_solved} solved problems.`, { category: 'REPAIR ENGINE' });
      } else {
        notify.error('Not Found', res.data.message || 'Username does not exist on LeetCode.', { category: 'REPAIR ENGINE' });
      }
    } catch (err: any) {
      notify.error('Check Failed', 'Could not connect to LeetCode.', { category: 'REPAIR ENGINE' });
    } finally {
      setVerifyingUser(false);
    }
  };

  // Save Repaired Profile
  const handleSaveRepairedProfile = async () => {
    if (!repairStudent || !verifyResult || !verifyResult.valid) {
      notify.warning('Verify First', 'Please verify the username successfully before saving.', { category: 'REPAIR ENGINE' });
      return;
    }

    setSavingRepair(true);
    try {
      await api.put(`/data-issues/repair-profile/${repairStudent.id}`, {
        new_username: verifyResult.username,
        admin_name: "Admin Officer"
      });
      notify.success('Profile Repaired', `Updated ${repairStudent.name} (${repairStudent.reg_no}) with @${verifyResult.username}.`, { category: 'REPAIR ENGINE' });
      setRepairStudent(null);
      await fetchStudentsData();
      await fetchSummaryData();
    } catch (err: any) {
      notify.error('Repair Failed', err.response?.data?.detail || 'Failed to save student profile.', { category: 'REPAIR ENGINE' });
    } finally {
      setSavingRepair(false);
    }
  };

  // Bulk URL Verify
  const handleBulkVerifySelected = async () => {
    if (selectedStudentIds.length === 0) {
      notify.warning('Select Students', 'Please check at least one student for bulk verification.', { category: 'BULK OPERATIONS' });
      return;
    }

    const confirmed = await confirmAction({
      title: `Verify ${selectedStudentIds.length} LeetCode URLs?`,
      message: `Execute controlled sequential verification against LeetCode GraphQL API for ${selectedStudentIds.length} students?`,
      confirmLabel: 'Run Verification',
      category: 'BULK VALIDATOR',
      variant: 'info',
    });
    if (!confirmed) return;

    setIsBulking(true);
    setBulkProgress(`Checking ${selectedStudentIds.length} profiles...`);
    try {
      let verifiedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < selectedStudentIds.length; i++) {
        const id = selectedStudentIds[i];
        const student = students.find(s => s.id === id);
        if (student && student.username) {
          try {
            const res = await api.post('/data-issues/verify-url', { username: student.username });
            if (res.data.valid) verifiedCount++;
            else failedCount++;
          } catch {
            failedCount++;
          }
        } else {
          failedCount++;
        }
        setBulkProgress(`Checked ${i + 1}/${selectedStudentIds.length} (${verifiedCount} Verified, ${failedCount} Issues)`);
      }

      notify.success('Bulk Check Complete', `Completed verification: ${verifiedCount} valid, ${failedCount} issues.`, { category: 'BULK VALIDATOR' });
      await fetchStudentsData();
      await fetchSummaryData();
    } catch (err) {
      notify.error('Bulk Verify Failed', 'An error occurred during bulk verification.', { category: 'BULK VALIDATOR' });
    } finally {
      setIsBulking(false);
      setBulkProgress(null);
      setSelectedStudentIds([]);
    }
  };

  // Bulk Sync Selected
  const handleBulkSyncSelected = async () => {
    if (selectedStudentIds.length === 0) {
      notify.warning('Select Students', 'Please select at least one student to sync.', { category: 'BULK OPERATIONS' });
      return;
    }

    setIsBulking(true);
    notify.info('Bulk Syncing', `Refreshing LeetCode performance for ${selectedStudentIds.length} selected students...`, { category: 'BULK SYNC' });
    try {
      const res = await api.post('/data-issues/bulk-sync', { student_ids: selectedStudentIds });
      notify.success('Bulk Sync Done', `Successfully synced ${res.data.synced} out of ${res.data.total} students.`, { category: 'BULK SYNC' });
      await fetchStudentsData();
      await fetchSummaryData();
    } catch (err) {
      notify.error('Bulk Sync Failed', 'Failed to synchronize batch records.', { category: 'BULK SYNC' });
    } finally {
      setIsBulking(false);
      setSelectedStudentIds([]);
    }
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    notify.info('Preparing Excel Export', `Building Excel file for ${students.length} filtered records...`, { category: 'EXPORT CENTER' });
    try {
      const params = new URLSearchParams({
        department: selectedDept,
        year_level: selectedYear,
        issue_type: selectedIssue,
        ...(searchQuery ? { search: searchQuery } : {})
      });

      const filename = `Student_Data_Issues_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const res = await downloadManager.download({
        endpoint: `/data-issues/export-excel?${params.toString()}`,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      if (res.success) {
        notify.success('Excel Downloaded', `Exported records to Excel.`, { category: 'EXPORT CENTER' });
      } else {
        notify.error('Export Error', res.error || 'Failed to download Excel report.', { category: 'EXPORT CENTER' });
      }
    } catch (err) {
      notify.error('Export Error', 'Failed to stream Excel report.', { category: 'EXPORT CENTER' });
    } finally {
      setIsExporting(false);
    }
  };

  // Download CSV
  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        department: selectedDept,
        year_level: selectedYear,
        issue_type: selectedIssue,
        ...(searchQuery ? { search: searchQuery } : {})
      });

      const filename = `Student_Data_Issues_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await downloadManager.download({
        endpoint: `/data-issues/export-csv?${params.toString()}`,
        filename,
        mimeType: 'text/csv',
      });

      if (res.success) {
        notify.success('CSV Downloaded', `Exported records to CSV.`, { category: 'EXPORT CENTER' });
      } else {
        notify.error('Export Error', res.error || 'Failed to download CSV report.', { category: 'EXPORT CENTER' });
      }
    } catch (err) {
      notify.error('Export Error', 'Failed to stream CSV report.', { category: 'EXPORT CENTER' });
    } finally {
      setIsExporting(false);
    }
  };

  // Apply a Saved View
  const handleApplySavedView = (view: SavedView) => {
    setSelectedDept(view.dept);
    setSelectedYear(view.year);
    setSelectedIssue(view.issue);
    setSearchQuery(view.search);
    notify.info('Applied View', `Applied preset: "${view.name}".`, { category: 'SAVED VIEWS' });
  };

  // Save current active filters as a preset
  const handleSaveCurrentFilter = () => {
    if (!newViewName.trim()) {
      notify.warning('View Name Required', 'Please enter a name for this custom view.', { category: 'SAVED VIEWS' });
      return;
    }
    const newView: SavedView = {
      id: `custom_${Date.now()}`,
      name: newViewName.trim(),
      dept: selectedDept,
      year: selectedYear,
      issue: selectedIssue,
      search: searchQuery
    };
    const updated = [newView, ...savedViews];
    setSavedViews(updated);
    localStorage.setItem('nec_saved_issue_views', JSON.stringify(updated));
    setShowSaveViewModal(false);
    setNewViewName('');
    notify.success('View Saved', `Custom view "${newView.name}" saved for future administrative use.`, { category: 'SAVED VIEWS' });
  };

  // Delete saved view
  const handleDeleteSavedView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    localStorage.setItem('nec_saved_issue_views', JSON.stringify(updated));
    notify.info('View Removed', 'Saved view preset removed.', { category: 'SAVED VIEWS' });
  };

  // Select all checkbox handler
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  const handleToggleSelectRow = (id: number) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(x => x !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in text-slate-900 dark:text-slate-100 font-sans">

      {/* ── 1. TOP HERO BANNER (MATCHING INSTITUTIONAL GRADIENT) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-xl border border-brand-500/30">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>DATA INTEGRITY & RECOVERY</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CANONICAL URL VALIDATOR ACTIVE</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Student Data Issues & <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-teal-300 to-indigo-300">Recovery Center</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide">
              Identify exact problems, verify canonical LeetCode URLs, filter by Department & Academic Year, repair usernames live, and download administrative reports.
            </p>
          </div>

          {/* Right Hero Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold border border-slate-700 shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Ledger'}</span>
            </button>

            <button
              onClick={handleDownloadExcel}
              disabled={isExporting || students.length === 0}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : `Download Excel (${students.length})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. MULTI-DIMENSIONAL SMART FILTERING WORKSPACE — FIRST ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Filter className="w-4 h-4 text-indigo-600 dark:text-brand-400" />
              <span>Multi-Dimensional Issue Filtration Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Isolate students by Department + Academic Year + Specific LeetCode Problem Severity.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedDept('all');
                setSelectedYear('all');
                setSelectedIssue('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-800 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Department Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-brand-400" />
              <span>Department Filter</span>
            </label>
            <CustomSelect
              value={selectedDept}
              onChange={setSelectedDept}
              placeholder="All Departments"
              icon={<Building2 size={16} />}
              options={[
                { label: 'CSE (Cyber Security)', value: 'CSE(CS)', badge: 'CYBER', badgeColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
                { label: 'CSE (Internet of Things - IoT)', value: 'CSE(IoT)', badge: 'IOT', badgeColor: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
              ]}
            />
          </div>

          {/* Academic Year Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center space-x-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-brand-400" />
              <span>Academic Year</span>
            </label>
            <CustomSelect
              value={selectedYear}
              onChange={setSelectedYear}
              placeholder="All Academic Years"
              icon={<GraduationCap size={16} />}
              options={[
                { label: 'I Year (1st Year)', value: 'I', badge: 'I', badgeColor: 'bg-slate-100 text-slate-600' },
                { label: 'II Year (2nd Year)', value: 'II', badge: 'II', badgeColor: 'bg-slate-200 text-slate-700' },
                { label: 'III Year (3rd Year)', value: 'III', badge: 'III', badgeColor: 'bg-slate-300 text-slate-800' },
                { label: 'IV Year (Final Year)', value: 'IV', badge: 'IV', badgeColor: 'bg-slate-400 text-slate-900' },
              ]}
            />
          </div>

          {/* Issue Category Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>Issue Category</span>
            </label>
            <CustomSelect
              value={selectedIssue}
              onChange={setSelectedIssue}
              placeholder={`All Categories (${summary?.total_students ?? 0})`}
              icon={<Sliders size={16} />}
              options={[
                { label: `Critical Issues (${summary?.critical_issues ?? 0})`, value: 'CRITICAL', badge: 'ERR', badgeColor: 'bg-rose-100 text-rose-600' },
                { label: `Sync Failed (${summary?.sync_failed ?? 0})`, value: 'SYNC_FAILED', badge: 'FAIL', badgeColor: 'bg-red-100 text-red-600' },
                { label: `Not Started — 0 Solved (${summary?.not_started ?? 0})`, value: 'NOT_STARTED', badge: 'NEW', badgeColor: 'bg-orange-100 text-orange-600' },
                { label: `Never Synced (${summary?.never_synced ?? 0})`, value: 'NEVER_SYNCED', badge: 'NONE', badgeColor: 'bg-amber-100 text-amber-600' },
                { label: `Missing Username (${summary?.missing_username ?? 0})`, value: 'MISSING_USERNAME', badge: 'MISS', badgeColor: 'bg-yellow-100 text-yellow-600' },
                { label: `Profile Not Found (${summary?.invalid_username ?? 0})`, value: 'INVALID_USERNAME', badge: '404', badgeColor: 'bg-pink-100 text-pink-600' },
                { label: `Invalid URL (${summary?.invalid_url ?? 0})`, value: 'INVALID_URL', badge: 'URL', badgeColor: 'bg-fuchsia-100 text-fuchsia-600' },
                { label: `Stale Data >7 Days (${summary?.stale_data ?? 0})`, value: 'STALE_DATA', badge: 'OLD', badgeColor: 'bg-purple-100 text-purple-600' },
                { label: `Data Mismatch (${summary?.data_mismatch ?? 0})`, value: 'DATA_MISMATCH', badge: 'DIFF', badgeColor: 'bg-indigo-100 text-indigo-600' },
                { label: `Healthy Records (${summary?.healthy ?? 0})`, value: 'HEALTHY', badge: 'OK', badgeColor: 'bg-emerald-100 text-emerald-600' },
              ]}
            />
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center space-x-1">
              <Search className="w-3.5 h-3.5 text-indigo-600 dark:text-brand-400" />
              <span>Search Query</span>
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Name, Reg No (732224CC044)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-gray-400 font-bold focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. ADMINISTRATIVE QUICK VIEWS & SAVED PRESETS BAR ── */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Bookmark className="w-4 h-4 text-amber-500" />
            <span>Administrative Quick Views &amp; Saved Presets</span>
          </span>
          <button
            onClick={() => setShowSaveViewModal(true)}
            className="px-3.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
          >
            <span>+ Save Current View</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => handleApplySavedView(view)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center space-x-1.5 ${
                selectedDept === view.dept && selectedYear === view.year && selectedIssue === view.issue && searchQuery === view.search
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm font-black'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{view.name}</span>
              {view.id.startsWith('custom_') && (
                <span
                  onClick={(e) => handleDeleteSavedView(view.id, e)}
                  className="text-slate-400 hover:text-rose-500 ml-1"
                  title="Delete preset"
                >
                 
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. DEPARTMENT & ACADEMIC YEAR BREAKDOWN MATRICES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-amber-400" />
              <span>Department Issue Breakdown</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">Click row to filter</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-navy-950 text-white uppercase font-black text-[10px]">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-2 text-center">Total</th>
                  <th className="py-2.5 px-2 text-center text-rose-400">Sync Fail</th>
                  <th className="py-2.5 px-2 text-center text-purple-400">No User</th>
                  <th className="py-2.5 px-2 text-center text-sky-400">Not Started</th>
                  <th className="py-2.5 px-2 text-center text-emerald-400">Healthy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-bold text-slate-800 dark:text-slate-200">
                {deptBreakdown.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedDept(row.department)}
                    className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">{row.department}</td>
                    <td className="py-2.5 px-2 text-center font-mono">{row.total}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-rose-600 dark:text-rose-400">{row.sync_failed}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-purple-600 dark:text-purple-400">{row.missing_username}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-sky-600 dark:text-sky-400">{row.not_started}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400">{row.healthy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Academic Year Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-amber-400" />
              <span>Academic Year Issue Breakdown</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">Click row to filter</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-navy-950 text-white uppercase font-black text-[10px]">
                  <th className="py-2.5 px-3">Year Level</th>
                  <th className="py-2.5 px-2 text-center">Total</th>
                  <th className="py-2.5 px-2 text-center text-rose-400">Sync Fail</th>
                  <th className="py-2.5 px-2 text-center text-purple-400">No User</th>
                  <th className="py-2.5 px-2 text-center text-sky-400">Not Started</th>
                  <th className="py-2.5 px-2 text-center text-emerald-400">Healthy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-bold text-slate-800 dark:text-slate-200">
                {yearBreakdown.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      const yCode = row.year.replace('Year', '').trim();
                      setSelectedYear(yCode);
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">{row.year}</td>
                    <td className="py-2.5 px-2 text-center font-mono">{row.total}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-rose-600 dark:text-rose-400">{row.sync_failed}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-purple-600 dark:text-purple-400">{row.missing_username}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-sky-600 dark:text-sky-400">{row.not_started}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400">{row.healthy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 5. BULK ACTIONS TOOLBAR & SELECTION BANNER ── */}
      {selectedStudentIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-navy-950 text-white border border-indigo-500/40 shadow-xl flex items-center justify-between flex-wrap gap-4 text-xs font-bold"
        >
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/30 text-indigo-300 font-mono font-black text-sm">
              {selectedStudentIds.length} Selected
            </span>
            <span className="text-slate-300">
              {bulkProgress || "Choose an administrative bulk action for selected students:"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBulkVerifySelected}
              disabled={isBulking}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify Selected URLs</span>
            </button>

            <button
              onClick={handleBulkSyncSelected}
              disabled={isBulking}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Sync Selected</span>
            </button>

            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </motion.div>
      )}

      {/* ── 6. STUDENT ISSUE TABLE (ENTERPRISE GRADE) ── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 shadow-sm overflow-hidden space-y-0">
        
        {/* Table Header & Download Controls */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Matched Students Requiring Attention ({students.length})</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting || students.length === 0}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              disabled={isExporting || students.length === 0}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-500 font-bold space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p>Analyzing and classifying student data issues from database...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 font-medium space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-base font-bold text-slate-900 dark:text-white">No issues found matching the active filters.</p>
              <p>All records within this selection meet verification and synchronization standards.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-navy-950 text-white uppercase tracking-wider font-black text-[10px]">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === students.length && students.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">Student & Register No</th>
                  <th className="py-3.5 px-3">Dept & Year</th>
                  <th className="py-3.5 px-3">LeetCode Username & URL</th>
                  <th className="py-3.5 px-3">Issue Category</th>
                  <th className="py-3.5 px-4">Exact Problem / Reason</th>
                  <th className="py-3.5 px-3">Last Sync</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium text-slate-800 dark:text-slate-200">
                {students.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const isVerifyingThis = verifyingRowId === student.id;

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(student.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>

                      {/* Student Name + Register Number */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">{student.name}</div>
                        <div className="font-mono text-xs text-indigo-600 dark:text-amber-400 font-bold mt-0.5">{student.reg_no}</div>
                      </td>

                      {/* Department & Year */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 dark:text-slate-200 block">{student.department_short}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{student.year_level}</span>
                      </td>

                      {/* LeetCode Username & URL Verification Status */}
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="flex items-center space-x-1.5">
                          {student.username ? (
                            <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">@{student.username}</span>
                          ) : (
                            <span className="text-[10.5px] text-rose-600 dark:text-rose-400 italic font-bold">No username</span>
                          )}
                        </div>

                        {/* Canonical URL status chip */}
                        {student.leetcode_url ? (
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${
                              student.url_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                                : student.url_status === 'INVALID'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/30'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/30'
                            }`}>
                              {student.url_status === 'VERIFIED' ? 'Verified URL' : student.url_status === 'INVALID' ? 'Invalid URL' : 'Needs Check'}
                            </span>

                            <button
                              onClick={() => handleCopyUrl(student)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedId === student.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9.5px] text-slate-400 font-mono block">— No URL —</span>
                        )}
                      </td>

                      {/* Issue Category Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider block text-center ${
                          student.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/40 shadow-sm'
                            : student.severity === 'WARNING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                            : student.severity === 'INFO'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-500/40 shadow-sm'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
                        }`}>
                          {student.issue_label}
                        </span>
                      </td>

                      {/* Exact Problem / Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-800 dark:text-slate-300 font-bold leading-snug">{student.error_description}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-1 font-semibold">
                          Action: {student.recommended_action}
                        </p>
                      </td>

                      {/* Last Sync */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {student.last_sync}
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          
                          {/* Open Profile */}
                          {student.leetcode_url && (
                            <a
                              href={student.leetcode_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
                              title="Open verified LeetCode profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Verify URL */}
                          {student.username && (
                            <button
                              onClick={() => handleVerifySingleUrl(student)}
                              disabled={isVerifyingThis}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
                              title="Verify URL live with LeetCode"
                            >
                              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifyingThis ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          {/* Repair Username / Profile */}
                          <button
                            onClick={() => handleOpenRepairModal(student)}
                            className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 cursor-pointer shadow-sm"
                            title="Repair / update student username"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Retry Sync */}
                          <button
                            onClick={() => handleRetrySyncSingle(student)}
                            className="p-1.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 cursor-pointer shadow-sm"
                            title="Retry sync for this student"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 8. REPAIR USERNAME MODAL ── */}
      <AnimatePresence>
        {repairStudent && (
          <div className="fixed inset-0 w-screen h-screen z-[1000000] flex items-center justify-center p-4 bg-black/90">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="max-w-lg w-full p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-lg space-y-4 text-slate-100 my-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Repair LeetCode Profile</h3>
                    <p className="text-xs text-slate-400">Live Verification & Audit Trail Update</p>
                  </div>
                </div>
                <button
                  onClick={() => setRepairStudent(null)}
                  className="text-slate-400 hover:text-white font-black text-xs p-1"
                >
                 
                </button>
              </div>

              {/* Student Metadata */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Student:</span>
                  <span className="text-white">{repairStudent.name}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Register No:</span>
                  <span className="font-mono text-amber-400">{repairStudent.reg_no}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-slate-200">{repairStudent.department_name}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Current Username:</span>
                  <span className="font-mono text-slate-300">{repairStudent.username || 'None'}</span>
                </div>
              </div>

              {/* Username Input & Test */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  New LeetCode Username or Profile URL:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. johndoe or https://leetcode.com/u/johndoe/"
                    value={newUsernameInput}
                    onChange={(e) => { setNewUsernameInput(e.target.value); setVerifyResult(null); }}
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleTestUsernameInModal}
                    disabled={verifyingUser || !newUsernameInput.trim()}
                    className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0 flex items-center space-x-1.5"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${verifyingUser ? 'animate-spin' : ''}`} />
                    <span>{verifyingUser ? 'Checking...' : 'Verify Profile'}</span>
                  </button>
                </div>
              </div>

              {/* Live Test Feedback Card */}
              {verifyResult && (
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  verifyResult.valid
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center space-x-1.5 font-black text-sm">
                    {verifyResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                    <span>{verifyResult.valid ? 'Profile Verified on LeetCode' : 'Verification Failed'}</span>
                  </div>
                  {verifyResult.valid ? (
                    <div className="text-[11.5px] space-y-1 pt-1">
                      <p>Username: <strong className="font-mono text-white">@{verifyResult.username}</strong></p>
                      <p>URL: <span className="font-mono text-emerald-200 underline">{verifyResult.canonical_url}</span></p>
                      <p>Solved Count: <strong className="text-white">{verifyResult.total_solved} problems</strong></p>
                      {verifyResult.contest_rating && <p>Rating: <strong className="text-white">{verifyResult.contest_rating.toFixed(1)}</strong></p>}
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-200">{verifyResult.message}</p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setRepairStudent(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRepairedProfile}
                  disabled={savingRepair || !verifyResult || !verifyResult.valid}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingRepair ? 'Updating Record...' : 'Confirm & Update Student Record'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 9. SAVE CUSTOM VIEW MODAL ── */}
      <AnimatePresence>
        {showSaveViewModal && (
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/85 animate-modal-backdrop">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-lg space-y-4 text-slate-100"
            >
              <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Save Custom Administrative View</h3>
                  <p className="text-xs text-slate-400">Store current filter matrix for fast 1-click recall</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-400">Active Preset Configuration:</div>
                  <div className="font-bold text-white">Dept: {selectedDept} • Year: {selectedYear} • Issue: {selectedIssue}</div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Preset View Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. III Year Cyber Security Sync Failures"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setShowSaveViewModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCurrentFilter}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-brand-600/25 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Preset</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
export default StudentDataIssuesPage;
