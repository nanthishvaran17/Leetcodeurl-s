import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Upload, 
  User, 
  AlertTriangle, 
  FileText, 
  Info, 
  Copy, 
  Check, 
  X, 
  Eye, 
  Sparkles,
  ShieldCheck,
  Download,
  Bell,
  Send,
  Code
} from 'lucide-react';
import { UrlImportModal } from '../components/UrlImportModal';

interface IntegrityCase {
  id: number;
  case_id: string;
  people_id: string;
  reg_no?: string;
  student_name: string;
  department_id?: number;
  department_name?: string;
  contest_id: string;
  account_ids: string[];
  participation_statuses: Record<string, any>;
  why_this_alert?: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED' | 'IDENTITY_REVIEW_REQUIRED';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  student_email_sent?: boolean;
  staff_email_sent?: boolean;
  staff_push_sent?: boolean;
  audit_history?: any[];
}

export const ContestIntegrityMonitor: React.FC = () => {
  const [allCases, setAllCases] = useState<IntegrityCase[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<IntegrityCase | null>(null);
  const [activeTab, setActiveTab] = useState<'CASES' | 'AUDIT_LOGS'>('CASES');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectPayload, setInspectPayload] = useState<any | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrity/cases');
      if (res.ok) {
        const data = await res.json();
        setAllCases(data);
      }
    } catch (err) {
      console.error('Failed to fetch integrity cases', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/integrity/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectPayload) {
          setInspectPayload(null);
        } else if (selectedCase) {
          setSelectedCase(null);
        } else if (isImportOpen) {
          setIsImportOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectPayload, selectedCase, isImportOpen]);

  const handleReview = async (caseId: string, action: 'CONFIRMED' | 'DISMISSED') => {
    // Optimistic UI state update
    setAllCases((prev) =>
      prev.map((c) =>
        c.case_id === caseId || String(c.id) === caseId ? { ...c, status: action } : c
      )
    );

    try {
      const res = await fetch(`/api/admin/integrity/cases/${caseId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: action,
          action,
          reviewed_by: 'Staff Mentor',
          notes: `Action marked as ${action} from Integrity Console`,
        }),
      });
      if (res.ok) {
        await fetchCases();
        await fetchAuditLogs();
      } else {
        console.error('API review failed with status', res.status);
        await fetchCases();
      }
    } catch (err) {
      console.error('Failed to update case', err);
      await fetchCases();
    }
  };

  const handleRunScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrity/scan', {
        method: 'POST',
      });
      if (res.ok) {
        fetchCases();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error('Error triggering scan', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportReport = () => {
    const reportData = JSON.stringify(allCases, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dual_ID_Integrity_Report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCases = allCases.filter((c) => {
    let statusMatch = true;
    if (filterStatus === 'PENDING') statusMatch = c.status === 'PENDING';
    else if (filterStatus === 'IDENTITY_REVIEW_REQUIRED') statusMatch = c.status === 'IDENTITY_REVIEW_REQUIRED';
    else if (filterStatus === 'CONFIRMED') statusMatch = c.status === 'CONFIRMED';
    else if (filterStatus === 'DISMISSED') statusMatch = c.status === 'DISMISSED';
    else if (filterStatus === 'RESOLVED') statusMatch = c.status === 'CONFIRMED' || c.status === 'DISMISSED';

    const searchMatch =
      !searchTerm.trim() ||
      c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.people_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.reg_no && c.reg_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contest_id.toLowerCase().includes(searchTerm.toLowerCase());

    return statusMatch && searchMatch;
  });

  const pendingCount = allCases.filter((c) => c.status === 'PENDING').length;
  const confirmedCount = allCases.filter((c) => c.status === 'CONFIRMED').length;
  const dismissedCount = allCases.filter((c) => c.status === 'DISMISSED').length;
  const identityReviewCount = allCases.filter((c) => c.status === 'IDENTITY_REVIEW_REQUIRED').length;

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown') return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Helper to parse and humanize audit log details cleanly
  const renderAuditDetails = (log: any) => {
    let detailsObj = log.details;
    if (typeof detailsObj === 'string') {
      try {
        detailsObj = JSON.parse(detailsObj);
      } catch {
        // Keep as string
      }
    }

    if (log.event_type === 'NOTIFICATION_OUTBOX_SENT') {
      const recipient = detailsObj?.recipient || 'STAFF';
      const eventId = detailsObj?.event_id || '';
      const isEmail = eventId.includes('EMAIL') || recipient.includes('@');
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              {isEmail ? 'Staff Email Alert Dispatched' : 'Staff App Push Notification Dispatched'}
            </span>
            <span className="text-slate-400 font-normal">→</span>
            <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px] font-semibold">
              {recipient}
            </span>
          </div>
          {detailsObj?.event_id && (
            <p className="text-[11px] text-slate-500 font-mono truncate">
              ID: {detailsObj.event_id}
            </p>
          )}
        </div>
      );
    }

    if (log.event_type === 'INTEGRITY_CASE_CREATED') {
      const accounts = detailsObj?.accounts ? detailsObj.accounts.join(', ') : '';
      const why = detailsObj?.why || '';
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-900">New Integrity Case Flagged</span>
            {accounts && (
              <span className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold">
                Accounts: @{accounts}
              </span>
            )}
          </div>
          {why && (
            <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-2">
              {why}
            </p>
          )}
        </div>
      );
    }

    if (typeof detailsObj === 'object' && detailsObj !== null) {
      if (detailsObj.why) {
        return <p className="text-xs text-slate-700 font-medium">{detailsObj.why}</p>;
      }
      if (detailsObj.notes) {
        return <p className="text-xs text-slate-700 font-medium">{detailsObj.notes}</p>;
      }
      return (
        <div className="text-xs text-slate-600 font-mono line-clamp-1">
          {JSON.stringify(detailsObj)}
        </div>
      );
    }

    return <p className="text-xs text-slate-700 font-medium">{String(log.details)}</p>;
  };

  return (
    <div className="w-full min-h-screen py-2 sm:py-4 space-y-6 font-sans antialiased text-slate-900">
      
      {/* FULL WIDTH MAIN CONTAINER */}
      <div className="w-full space-y-6">

        {/* 5. PAGE HERO SECTION (DARK NAVY GRADIENT MATCHING MENTORING DASHBOARD) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-7 shadow-xl border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 w-full">
          {/* Subtle Background Radial Glow */}
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] sm:text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>FORENSIC ACCOUNT INTEGRITY</span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 shrink-0" />
              Dual-ID Integrity Review System
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Review and resolve potential duplicate or multiple LeetCode accounts linked to the same student.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="relative z-10 flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={handleExportReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Download size={14} className="text-slate-400" />
              <span>Export Report</span>
            </button>

            <button
              onClick={handleRunScan}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-purple-200' : 'text-purple-200'} />
              <span>Run Scan</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold transition cursor-pointer"
            >
              <Upload size={14} />
              <span>Bulk Import</span>
            </button>
          </div>
        </div>

        {/* 6. KPI CARDS GRID (4 INTERACTIVE CARDS - 1 COL ON MOBILE, 2 ON TABLET, 4 COLUMNS ON DESKTOP) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full">
          {/* Card 1: Pending Review */}
          <div
            onClick={() => { setFilterStatus(filterStatus === 'PENDING' ? 'ALL' : 'PENDING'); setActiveTab('CASES'); }}
            className={`border rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] min-w-0 ${
              filterStatus === 'PENDING'
                ? 'bg-rose-100/90 border-rose-400 ring-2 ring-rose-400/30 shadow-md'
                : 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/60'
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 block truncate">
                Pending Review
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-950">
                {pendingCount}
              </div>
              <p className="text-[11px] font-semibold text-rose-700/90 truncate">
                Action required
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs shrink-0 ml-2">
              <Clock size={19} className="animate-pulse" />
            </div>
          </div>

          {/* Card 2: Under Investigation */}
          <div
            onClick={() => { setFilterStatus(filterStatus === 'IDENTITY_REVIEW_REQUIRED' ? 'ALL' : 'IDENTITY_REVIEW_REQUIRED'); setActiveTab('CASES'); }}
            className={`border rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] min-w-0 ${
              filterStatus === 'IDENTITY_REVIEW_REQUIRED'
                ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                : 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/60'
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block truncate">
                Under Investigation
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-950">
                {identityReviewCount}
              </div>
              <p className="text-[11px] font-semibold text-amber-700/90 truncate">
                Missing official ID link
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs shrink-0 ml-2">
              <User size={19} />
            </div>
          </div>

          {/* Card 3: Resolved */}
          <div
            onClick={() => { setFilterStatus(filterStatus === 'RESOLVED' ? 'ALL' : 'RESOLVED'); setActiveTab('CASES'); }}
            className={`border rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] min-w-0 ${
              filterStatus === 'RESOLVED' || filterStatus === 'CONFIRMED' || filterStatus === 'DISMISSED'
                ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
                : 'bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/60'
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block truncate">
                Resolved
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                {confirmedCount + dismissedCount}
              </div>
              <p className="text-[11px] font-semibold text-emerald-700/90 truncate">
                Confirmed or Dismissed cases
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs shrink-0 ml-2">
              <CheckCircle size={19} />
            </div>
          </div>

          {/* Card 4: Total Flagged */}
          <div
            onClick={() => { setFilterStatus('ALL'); setActiveTab('CASES'); }}
            className={`border rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] min-w-0 ${
              filterStatus === 'ALL'
                ? 'bg-blue-100/90 border-blue-400 ring-2 ring-blue-400/30 shadow-md'
                : 'bg-blue-50/70 border-blue-200/80 hover:bg-blue-100/60'
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 block truncate">
                Total Flagged
              </span>
              <div className="text-2xl sm:text-3xl font-black text-blue-950">
                {allCases.length}
              </div>
              <p className="text-[11px] font-semibold text-blue-700/90 truncate">
                Cross-contest multi-account audit
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs shrink-0 ml-2">
              <ShieldAlert size={19} />
            </div>
          </div>
        </div>

        {/* 7. UNIFIED FILTER TOOLBAR (100% FULL WIDTH RESPONSIVE FLEX/GRID) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 w-full lg:w-auto shrink-0">
            <button
              onClick={() => setActiveTab('CASES')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'CASES'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Integrity Cases ({filteredCases.length}{filteredCases.length !== allCases.length ? ` / ${allCases.length}` : ''})
            </button>
            <button
              onClick={() => setActiveTab('AUDIT_LOGS')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'AUDIT_LOGS'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          {activeTab === 'CASES' && (
            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap sm:flex-nowrap justify-end flex-1 min-w-0">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search size={15} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, reg no, username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full shrink-0 custom-scrollbar">
                {[
                  { label: 'All', value: 'ALL' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Identity Review', value: 'IDENTITY_REVIEW_REQUIRED' },
                  { label: 'Resolved', value: 'RESOLVED' },
                  { label: 'Confirmed', value: 'CONFIRMED' },
                  { label: 'Dismissed', value: 'DISMISSED' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setFilterStatus(filter.value)}
                    className={`h-10 px-3.5 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
                      filterStatus === filter.value
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}

                {(searchTerm || filterStatus !== 'ALL') && (
                  <button
                    onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-purple-600 hover:bg-purple-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <X size={13} /> Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 8. DUAL LAYOUT: MOBILE RESPONSIVE CARDS (NO HORIZONTAL SCROLL NEEDED) + DESKTOP TABLE */}
        {activeTab === 'CASES' ? (
          <div className="w-full space-y-4">
            
            {/* MOBILE RESPONSIVE CARDS VIEW (md:hidden - ALL INFO & ACTIONS ON SAME SCREEN WITHOUT HORIZONTAL SCROLL) */}
            <div className="block md:hidden space-y-3.5">
              {loading ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
                  <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mx-auto" />
                  <span className="font-bold text-xs text-slate-600 block">Evaluating contest integrity cases...</span>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-500/80 mx-auto" />
                  <span className="font-black text-base text-slate-900 block">No integrity cases found</span>
                  <span className="text-xs font-semibold text-slate-600 block">All student accounts are verified clean for current filters.</span>
                </div>
              ) : (
                filteredCases.map((c) => {
                  const cleanCaseShort = c.case_id.length > 22 ? `${c.case_id.substring(0, 19)}...` : c.case_id;
                  const reasonText = c.why_this_alert ? (
                    c.why_this_alert
                  ) : c.status === 'IDENTITY_REVIEW_REQUIRED' ? (
                    'Multiple accounts detected without official People ID mapping.'
                  ) : (
                    'Both linked accounts confirmed NOT_ATTENDED in contest window.'
                  );

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 hover:border-purple-300 transition-all cursor-pointer active:scale-[0.995]"
                    >
                      {/* Card Header: Case Ref & Status */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-slate-900 truncate">
                              {cleanCaseShort}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopy(c.case_id); }}
                              title="Copy Case ID"
                              className="text-slate-500 hover:text-purple-700 transition cursor-pointer p-0.5 rounded shrink-0"
                            >
                              {copiedId === c.case_id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 block">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>

                        {/* Status Pill Badge */}
                        <div className="shrink-0">
                          {c.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-black whitespace-nowrap shadow-xs">
                              <Clock size={11} className="animate-pulse text-amber-700" />
                              Pending
                            </span>
                          )}
                          {c.status === 'IDENTITY_REVIEW_REQUIRED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-950 text-[11px] font-black whitespace-nowrap shadow-xs">
                              <User size={11} className="text-purple-700" />
                              Investigating
                            </span>
                          )}
                          {c.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-950 text-[11px] font-black whitespace-nowrap shadow-xs">
                              <CheckCircle size={11} className="text-emerald-700" />
                              Confirmed
                            </span>
                          )}
                          {c.status === 'DISMISSED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-black whitespace-nowrap shadow-xs">
                              <XCircle size={11} className="text-slate-600" />
                              Dismissed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Student Identity Row */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-purple-100 border border-purple-300 text-purple-800 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          {getInitials(c.student_name)}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="font-black text-sm text-slate-900 leading-snug truncate">
                            {c.student_name}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-700">
                              Reg: {c.people_id}
                            </span>
                            {c.department_name && (
                              <span className="text-[10.5px] font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                                {c.department_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contest & Linked Accounts */}
                      <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-900 text-[11px] font-mono font-black shrink-0">
                          {c.contest_id}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {c.account_ids.map((acc, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-mono font-bold">
                              @{acc}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Review Reason */}
                      <div className="flex items-start gap-1.5 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl text-xs">
                        <Info size={13} className="text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-slate-900 font-semibold leading-relaxed line-clamp-2">
                            {reasonText}
                          </p>
                          <span className="text-[11px] font-black text-purple-700 block">
                            Full Breakdown →
                          </span>
                        </div>
                      </div>

                      {/* Mobile Action Buttons Bar */}
                      <div className="pt-1 flex items-center gap-2 w-full">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}
                          className="flex-1 h-9 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye size={13} className="text-slate-600" />
                          <span>Details</span>
                        </button>

                        {c.status === 'PENDING' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReview(c.case_id, 'CONFIRMED'); }}
                              className="flex-1 h-9 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <CheckCircle size={13} />
                              <span>Confirm</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReview(c.case_id, 'DISMISSED'); }}
                              className="flex-1 h-9 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <XCircle size={13} />
                              <span>Dismiss</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP & TABLET TABLE VIEW (hidden md:block) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] overflow-hidden w-full">
              <div className="overflow-x-auto w-full custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse min-w-[1400px]">
                  <thead className="bg-slate-100/90 text-slate-800 border-b border-slate-300 text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[130px] min-w-[130px]"># Ref</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[280px] min-w-[280px] text-center">Student</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[125px] min-w-[125px]">Contest</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[150px] min-w-[150px]">Linked Accounts</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[300px] min-w-[260px]">Review Reason</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[140px] min-w-[140px] text-center">Status</th>
                      <th className="py-3.5 px-3.5 font-black text-slate-900 w-[275px] min-w-[275px] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-7 h-7 text-purple-600 animate-spin" />
                            <span className="font-bold text-xs text-slate-600">Evaluating contest integrity cases...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredCases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <CheckCircle className="w-10 h-10 text-emerald-500/80" />
                            <span className="font-black text-base text-slate-900">No integrity cases found</span>
                            <span className="text-xs font-semibold text-slate-600">All student accounts are verified clean for current filters.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCases.map((c) => {
                        const cleanCaseShort = c.case_id.length > 18 ? `${c.case_id.substring(0, 15)}...` : c.case_id;

                        const reasonText = c.why_this_alert ? (
                          c.why_this_alert
                        ) : c.status === 'IDENTITY_REVIEW_REQUIRED' ? (
                          'Multiple accounts detected without official People ID mapping.'
                        ) : (
                          'Both linked accounts confirmed NOT_ATTENDED in contest window.'
                        );

                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCase(c)}
                            className="hover:bg-purple-50/50 transition-colors bg-white cursor-pointer group"
                          >
                            
                            {/* Case Ref */}
                            <td className="py-4 px-3.5 align-middle">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-black text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                                  {cleanCaseShort}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopy(c.case_id); }}
                                  title="Copy Case ID"
                                  className="text-slate-500 hover:text-purple-700 transition cursor-pointer shrink-0 p-0.5 rounded"
                                >
                                  {copiedId === c.case_id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                </button>
                              </div>
                              <span className="text-xs font-bold text-slate-600 block mt-1">
                                {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                              </span>
                            </td>

                            {/* Student Cell - Centered & Spacious */}
                            <td className="py-4 px-3.5 align-middle text-center">
                              <div className="flex items-center justify-center gap-3 text-left">
                                <div className="w-9 h-9 rounded-full bg-purple-100 border border-purple-300 text-purple-800 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                  {getInitials(c.student_name)}
                                </div>
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="font-black text-sm text-slate-900 leading-snug truncate group-hover:text-purple-700 transition-colors" title={c.student_name}>
                                    {c.student_name}
                                  </div>
                                  <div className="text-xs font-mono font-bold text-slate-700">
                                    Reg: {c.people_id}
                                  </div>
                                  {c.department_name && (
                                    <div className="text-[11px] font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-block max-w-full truncate shadow-xs" title={c.department_name}>
                                      {c.department_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Contest */}
                            <td className="py-4 px-3.5 align-middle">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-xs font-mono font-black whitespace-nowrap shadow-xs">
                                {c.contest_id}
                              </span>
                            </td>

                            {/* Linked Accounts Chips */}
                            <td className="py-4 px-3.5 align-middle">
                              <div className="flex flex-col gap-1.5 items-start">
                                {c.account_ids.map((acc, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-lg bg-purple-50/80 border border-purple-200 text-purple-900 text-xs font-mono font-bold group-hover:bg-purple-100 group-hover:border-purple-300 transition-colors whitespace-nowrap shadow-xs"
                                  >
                                    @{acc}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Review Reason */}
                            <td className="py-4 px-3.5 align-middle">
                              <div className="flex items-start gap-1.5">
                                <Info size={14} className="text-purple-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-900 leading-relaxed line-clamp-2" title={reasonText}>
                                    {reasonText}
                                  </p>
                                  <span className="text-xs font-black text-purple-700 group-hover:underline inline-block">
                                    Full Breakdown →
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Status Pill Badges - Vertically Centered & Centered Text */}
                            <td className="py-4 px-3.5 align-middle text-center w-[140px] min-w-[140px]">
                              {c.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black whitespace-nowrap shadow-xs">
                                  <Clock size={12} className="animate-pulse text-amber-700" />
                                  Pending
                                </span>
                              )}
                              {c.status === 'IDENTITY_REVIEW_REQUIRED' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-950 text-xs font-black whitespace-nowrap shadow-xs">
                                  <User size={12} className="text-purple-700" />
                                  Investigating
                                </span>
                              )}
                              {c.status === 'CONFIRMED' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-black whitespace-nowrap shadow-xs">
                                  <CheckCircle size={12} className="text-emerald-700" />
                                  Confirmed
                                </span>
                              )}
                              {c.status === 'DISMISSED' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-black whitespace-nowrap shadow-xs">
                                  <XCircle size={12} className="text-slate-600" />
                                  Dismissed
                                </span>
                              )}
                            </td>

                            {/* Action Buttons - Vertically Centered & Horizontally Centered */}
                            <td className="py-4 px-3.5 align-middle text-center w-[275px] min-w-[275px]">
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}
                                  className="h-8 px-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 text-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Eye size={13} className="text-slate-600" />
                                  <span>Details</span>
                                </button>

                                {c.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReview(c.case_id, 'CONFIRMED'); }}
                                      className="h-8 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                      <CheckCircle size={13} />
                                      <span>Confirm</span>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReview(c.case_id, 'DISMISSED'); }}
                                      className="h-8 px-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                      <XCircle size={13} />
                                      <span>Dismiss</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* REDESIGNED HUMAN-READABLE ELEGANT AUDIT LOGS VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] w-full">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  System Integrity Audit Trail
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Immutable audit log of contest syncs, attendance freeze events, and duplicate account detections.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-extrabold">
                {auditLogs.length} Events Logged
              </span>
            </div>

            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-medium">No system audit events recorded yet.</div>
              ) : (
                auditLogs.map((log) => {
                  const isOutbox = log.event_type === 'NOTIFICATION_OUTBOX_SENT';
                  const isCaseCreated = log.event_type === 'INTEGRITY_CASE_CREATED';

                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          isOutbox
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : isCaseCreated
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {isOutbox ? <Send size={15} /> : isCaseCreated ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                              isOutbox
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : isCaseCreated
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {log.event_type.replace(/_/g, ' ')}
                            </span>

                            {log.contest_id && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-mono font-bold">
                                {log.contest_id}
                              </span>
                            )}

                            {log.people_id && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold">
                                Reg: {log.people_id}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-700 pt-0.5">
                            {renderAuditDetails(log)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setInspectPayload(log.details)}
                          title="View Raw Event Data"
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Code size={12} />
                          <span>Payload</span>
                        </button>
                        <span className="text-[11px] font-semibold text-slate-400 font-mono">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* CASE DETAILS MODAL */}
        {selectedCase && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 pt-20 sm:pt-24 pb-6 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && setSelectedCase(null)}
          >
            <div className="bg-white border border-slate-200 max-w-2xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">
              
              {/* Pinned Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-5 shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">Integrity Case & Forensic Breakdown</h2>
                    <p className="text-[11px] font-semibold text-slate-500">Case ID: <span className="font-mono text-purple-700 font-bold">{selectedCase.case_id}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar min-h-0">
                {/* Student Overview Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Case Reference:</span>
                    <div className="font-mono text-purple-600 font-bold text-xs sm:text-sm mt-0.5 truncate">{selectedCase.case_id}</div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Student Identity:</span>
                    <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedCase.student_name}</div>
                    <div className="font-mono text-slate-500 text-xs font-semibold">Reg: {selectedCase.people_id}</div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Contest ID:</span>
                    <div className="font-semibold text-slate-800 mt-0.5 font-mono">{selectedCase.contest_id}</div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Case Status:</span>
                    <div className="font-black text-purple-700 text-xs sm:text-sm mt-0.5 uppercase tracking-wide">{selectedCase.status.replace(/_/g, ' ')}</div>
                  </div>
                </div>

                {/* Forensic Explanation */}
                {selectedCase.why_this_alert && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
                    <strong className="block font-bold text-amber-900 mb-1">Forensic Analysis Explanation:</strong>
                    {selectedCase.why_this_alert}
                  </div>
                )}

                {/* Account Participation Matrix (Humanized View) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Account Participation Matrix</h4>
                    <button
                      onClick={() => setInspectPayload(inspectPayload ? null : selectedCase.participation_statuses)}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Code size={12} /> View Raw JSON
                    </button>
                  </div>

                  {(() => {
                    const statuses = selectedCase.participation_statuses;
                    const accountsMap = statuses?.accounts || (typeof statuses === 'object' && !Array.isArray(statuses) ? statuses : null);

                    if (accountsMap && typeof accountsMap === 'object') {
                      const entries = Object.entries(accountsMap);
                      if (entries.length > 0) {
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {entries.map(([handle, info]: [string, any]) => {
                              const isAttended = info?.status_bool || info?.official_attendance_state === 'ATTENDED' || info?.official_attendance_state === 'PUBLIC_ATTENDED';
                              return (
                                <div key={handle} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                                      @{handle}
                                    </span>
                                    <span className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                      isAttended
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}>
                                      {info?.official_attendance_state ? info.official_attendance_state.replace(/_/g, ' ') : isAttended ? 'ATTENDED' : 'NOT ATTENDED'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/80">
                                    <div>
                                      <span className="text-slate-400 font-bold uppercase text-[9.5px]">Contest Score:</span>
                                      <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">{info?.score_display || '0/4'}</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold uppercase text-[9.5px]">Questions Solved:</span>
                                      <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">{info?.questions_solved ?? 0}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                    }

                    return (
                      <pre className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-purple-950 overflow-x-auto max-h-48 leading-relaxed">
                        {JSON.stringify(statuses, null, 2)}
                      </pre>
                    );
                  })()}
                </div>

                {/* Dispatch Status */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Notification Dispatch Status</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className={`p-2.5 rounded-xl border text-center font-bold ${
                      selectedCase.student_email_sent 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      Student Email: {selectedCase.student_email_sent ? 'SENT' : 'NOT SENT'}
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center font-bold ${
                      selectedCase.staff_email_sent 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      Staff Email: {selectedCase.staff_email_sent ? 'SENT' : 'NOT SENT'}
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center font-bold ${
                      selectedCase.staff_push_sent 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      Staff Push: {selectedCase.staff_push_sent ? 'SENT' : 'NOT SENT'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Bottom Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
                {selectedCase.status === 'PENDING' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { handleReview(selectedCase.case_id, 'CONFIRMED'); setSelectedCase(null); }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <CheckCircle size={14} /> Confirm Case
                    </button>
                    <button
                      onClick={() => { handleReview(selectedCase.case_id, 'DISMISSED'); setSelectedCase(null); }}
                      className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <XCircle size={14} /> Dismiss Alert
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-500">
                    Status: <span className="font-extrabold text-purple-700">{selectedCase.status.replace(/_/g, ' ')}</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedCase(null)}
                  className="ml-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Close Breakdown
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* RAW PAYLOAD INSPECTOR MODAL FOR AUDIT TRAIL */}
        {inspectPayload && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 pt-20 sm:pt-24 pb-6 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && setInspectPayload(null)}
          >
            <div className="bg-white border border-slate-200 max-w-xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-black text-slate-900">Event Raw Payload Data</h3>
                </div>
                <button
                  onClick={() => setInspectPayload(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
                <pre className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-purple-950 overflow-x-auto leading-relaxed">
                  {typeof inspectPayload === 'string' ? inspectPayload : JSON.stringify(inspectPayload, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
                <button
                  onClick={() => setInspectPayload(null)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  Close Payload
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bulk Import Modal */}
        <UrlImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchCases} />
      </div>
    </div>
  );
};
