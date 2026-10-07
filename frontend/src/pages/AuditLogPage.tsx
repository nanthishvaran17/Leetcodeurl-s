import React, { useState, useEffect, useMemo } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { createPortal } from 'react-dom';
import { ShieldAlert, Clock, Search, Filter, RefreshCw, CheckCircle2, AlertTriangle, UserCheck, X, Eye, Laptop, Terminal, User, Activity, Globe, Settings, Mail, FileText, LogIn, LogOut, Navigation, Printer, Download } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';

const formatAuditDate = (dateString: string) => {
  if (!dateString) return '—';
  try {
    let dStr = dateString;
    if (dStr.includes('T') && !dStr.endsWith('Z') && !dStr.includes('+')) {
      dStr += 'Z';
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(d).replace(',', ' •') + ' IST';
  } catch {
    return dateString;
  }
};

/** Returns a consistent color class set per action type */
const getActionStyle = (action: string): { bg: string; icon: React.ReactNode } => {
  const a = (action || '').toUpperCase();
  if (a === 'PAGE_NAVIGATE')
    return { bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800', icon: <Navigation className="w-3 h-3" /> };
  if (a === 'ACCESS_RESOURCE')
    return { bg: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800', icon: <Globe className="w-3 h-3" /> };
  if (a.includes('LOGIN'))
    return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', icon: <LogIn className="w-3 h-3" /> };
  if (a.includes('LOGOUT'))
    return { bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800', icon: <LogOut className="w-3 h-3" /> };
  if (a.includes('SYNC'))
    return { bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', icon: <RefreshCw className="w-3 h-3" /> };
  if (a.includes('EMAIL') || a.includes('SEND'))
    return { bg: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800', icon: <Mail className="w-3 h-3" /> };
  if (a.includes('REPORT') || a.includes('GENERATE'))
    return { bg: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800', icon: <FileText className="w-3 h-3" /> };
  if (a.includes('UPDATE') || a.includes('SETTING') || a.includes('CONFIG'))
    return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800', icon: <Settings className="w-3 h-3" /> };
  return { bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700', icon: <Activity className="w-3 h-3" /> };
};

/** Returns a role badge style */
const getRoleStyle = (role: string): string => {
  const r = (role || '').toUpperCase();
  if (r.includes('SUPER')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700';
  if (r.includes('HOD')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
  if (r.includes('MANAGEMENT') || r.includes('MGMT')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700';
  if (r.includes('SYSTEM')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
  if (r.includes('ADMIN')) return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
};

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { user } = useAuth();
  const { notify } = useNotification();

  const roleName = useMemo(() => {
    const r = (user?.role || '').trim().toLowerCase();
    if (r === 'super admin' || r === 'super_admin') return 'Super Admin';
    if (r === 'admin' || r === 'administrator') return 'System Administrator';
    if (r === 'hod' || r === 'department_hod') return 'Head of Department (HOD)';
    if (r === 'deputy_hod' || r === 'deputy hod') return 'Deputy HOD';
    if (r === 'faculty' || r === 'staff') return 'Faculty Mentor';
    if (r === 'management') return 'Management Executive';
    return user?.role ? String(user.role).toUpperCase() : 'Administrator';
  }, [user?.role]);

  const departmentName = useMemo(() => {
    return user?.department || (user as any)?.dept || 'INSTITUTIONAL';
  }, [user]);

  const institutionalId = useMemo(() => {
    return user?.institutional_id || user?.registerNo || (user?.id ? `NEC-${user.id}` : 'NEC-ADMIN');
  }, [user]);

  const handleExportAuditLogsExcel = async () => {
    try {
      const notifyToast = notify.loading('Generating Excel report...', '', { duration: 10000, category: 'ADMIN' });
      // @ts-ignore
      const excelMod: any = await import('exceljs');
      const ExcelJS = excelMod.default ? excelMod.default : (excelMod.Workbook ? excelMod : (window as any).ExcelJS);
      const workbook = new (ExcelJS.Workbook || ExcelJS)();
      const worksheet = workbook.addWorksheet('Admin Audit Trail', {
        views: [{ showGridLines: false }]
      });

      worksheet.getRow(1).height = 40;
      worksheet.getRow(2).height = 22;
      worksheet.getRow(3).height = 18;

      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `OFFICIAL ${roleName.toUpperCase()} SYSTEM & IDENTITY AUDIT TRAIL REPORT`;
      titleCell.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF000080' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      worksheet.mergeCells('A2:H2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Generated By: ${user?.full_name || user?.name || user?.username} | Role: ${roleName} | Dept: ${departmentName}`;
      subCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF333333' } };
      subCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      worksheet.mergeCells('A3:H3');
      const genCell = worksheet.getCell('A3');
      genCell.value = `Generated At: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' })} IST | Records Count: ${logs.length}`;
      genCell.font = { name: 'Times New Roman', size: 10, color: { argb: 'FF555555' } };
      genCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      const headerRow = worksheet.addRow(['Audit ID', 'Admin', 'Admin Email', 'Role', 'Action', 'Description', 'Status', 'Timestamp']);
      headerRow.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.height = 25;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.border = { top: {style:'thin', color: {argb:'FF000000'}}, left: {style:'thin', color: {argb:'FF000000'}}, bottom: {style:'thin', color: {argb:'FF000000'}}, right: {style:'thin', color: {argb:'FF000000'}} };
        cell.alignment = { horizontal: 'center', vertical: 'center' };
      });

      logs.forEach(l => {
        const row = worksheet.addRow([
          l.audit_id,
          l.admin_name,
          l.admin_email,
          l.admin_role,
          l.action,
          l.description || '—',
          l.status,
          formatAuditDate(l.created_at)
        ]);
        row.eachCell(cell => {
          cell.font = { name: 'Times New Roman', size: 10 };
          cell.border = { top: {style:'thin', color:{argb:'FF000000'}}, left: {style:'thin', color:{argb:'FF000000'}}, bottom: {style:'thin', color:{argb:'FF000000'}}, right: {style:'thin', color:{argb:'FF000000'}} };
          cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
        });
        row.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
        const stCell = row.getCell(7);
        stCell.alignment = { horizontal: 'center', vertical: 'center' };
        stCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: l.status === 'SUCCESS' ? 'FF15803D' : 'FFE11D48' } };
      });

      // Compact & Proportioned Excel Column Widths
      const baseWidths = [16, 18, 22, 14, 20, 26, 12, 22];
      baseWidths.forEach((w, idx) => {
        const col = worksheet.getColumn(idx + 1);
        let maxLen = w;
        col.eachCell({ includeEmpty: false }, (cell, rowNum) => {
          if (rowNum >= 5 && cell.value) {
            const len = String(cell.value).length + 3;
            if (len > maxLen) maxLen = len;
          }
        });
        col.width = Math.min(maxLen, 28);
      });

      for(let i = 6; i <= worksheet.rowCount; i++) {
        if(i % 2 !== 0) {
          worksheet.getRow(i).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          });
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NEC_Audit_Trail_${institutionalId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      
      notify.dismiss(notifyToast);
      notify.success('Audit log Excel report exported with clean column sizing!', '', { category: 'ADMIN' });
    } catch (err: any) {
      console.error('Failed to generate Excel report', err);
      notify.error(`Failed to generate Excel report: ${err?.message || err}`, '', { category: 'ADMIN' });
    }
  };

  const handlePrintAuditLogReport = () => {
    window.print();
  };

  const roleOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Roles', badge: 'ALL', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
    { value: 'ADMIN', label: 'ADMIN', badge: 'ROLE', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700' },
    { value: 'Super Admin', label: 'Super Admin', badge: 'SUPER', badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700' },
    { value: 'MANAGEMENT', label: 'MANAGEMENT', badge: 'MGMT', badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
    { value: 'HOD', label: 'HOD', badge: 'DEPT', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
    { value: 'SYSTEM', label: 'SYSTEM', badge: 'AUTO', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  ], []);

  const statusOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Statuses', badge: 'ALL', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
    { value: 'SUCCESS', label: 'SUCCESS', badge: 'OK', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
    { value: 'FAILED', label: 'FAILED', badge: 'ERR', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700' },
    { value: 'WARNING', label: 'WARNING', badge: 'WARN', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  ], []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchLogs(controller.signal);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, roleFilter, statusFilter]);

  const fetchLogs = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = '/admin/audit-logs?limit=50';
      if (roleFilter !== 'ALL') url += `&role=${encodeURIComponent(roleFilter)}`;
      if (statusFilter !== 'ALL') url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      
      const res = await api.get(url, { signal });
      const sorted = (res.data || []).sort((a: any, b: any) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        if (da !== db) return db - da; // Descending by timestamp
        if (a.id && b.id) return b.id - a.id; 
        return 0;
      });
      setLogs(sorted);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      console.error("Failed to fetch admin audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Lock body scroll when inspection modal is open
  useEffect(() => {
    if (selectedLog) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedLog(null);
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = prevOverflow || 'unset';
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [selectedLog]);


  return (
    <div className="space-y-6 pt-2 pb-16 animate-slideUp">
      
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-2xl border border-indigo-500/20">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-72 h-72 bg-brand-500/6 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-xs font-black">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>ADMIN IDENTITY & AUDIT TRAIL</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Admin Identity & <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-sky-300 to-violet-400">Audit Log</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-semibold leading-relaxed">
              Real-time database audit log recording administrator identity, logins, page visits, report generation, email dispatches & setting modifications. Click any log entry to inspect full event telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 self-start xl:self-center">
            <button
              onClick={handlePrintAuditLogReport}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 h-11 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl text-xs font-black transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-sm whitespace-nowrap"
              title="Print Audit Log Report"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print Report</span>
            </button>
            <button
              onClick={handleExportAuditLogsExcel}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 h-11 bg-emerald-600/80 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer border border-emerald-400/30 whitespace-nowrap"
              title="Export formatted Excel report with clean column widths"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Excel Report</span>
            </button>
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-95 border border-indigo-400/30 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm bg-white dark:bg-navy-950">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* 1. Search Box (Left, Spans 6 Columns) */}
          <div className="md:col-span-6 flex flex-col space-y-1.5 min-w-0 w-full">
            <label htmlFor="audit-search-input" className="block text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate h-4 leading-4 m-0 p-0">
              Search Audit Trail
            </label>
            <div className="relative flex items-center w-full">
              <input
                id="audit-search-input"
                type="text"
                placeholder="Search by Audit ID, Admin Name, Email, Action..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchLogs();
                  }
                }}
                className="w-full h-11 min-h-[44px] bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-bold py-2 pl-10 pr-9 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-left transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 z-10 text-slate-500 dark:text-slate-400">
                <Search className="w-4 h-4 stroke-[2.5]" />
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Role & Status Filters: 2-Columns on mobile, 6 Columns on desktop */}
          <div className="md:col-span-6 grid grid-cols-2 gap-3 min-w-0 w-full">
            <div className="min-w-0 w-full">
              <CustomDropdown
                id="audit-role-filter"
                label="Role Filter"
                options={roleOptions}
                value={roleFilter}
                onChange={setRoleFilter}
                icon={UserCheck}
              />
            </div>

            <div className="min-w-0 w-full">
              <CustomDropdown
                id="audit-status-filter"
                label="Status Filter"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                icon={Filter}
              />
            </div>
          </div>
        </div>

        {/* Filter Summary / Quick Reset bar when filters active */}
        {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Active filters:
              </span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black font-mono">
                  "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {roleFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-black">
                  Role: {roleFilter}
                  <button type="button" onClick={() => setRoleFilter('ALL')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter('ALL')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg bg-white dark:bg-navy-950">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <div className="h-4 w-40 bg-slate-200 dark:bg-navy-700 rounded-lg"></div>
              <div className="h-6 w-32 bg-indigo-500/10 rounded-full"></div>
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 w-full bg-slate-50 dark:bg-navy-950/60 rounded-2xl flex flex-col justify-center gap-2 px-5 border border-slate-100 dark:border-navy-800/60">
                <div className="h-3 w-36 bg-slate-200 dark:bg-navy-700 rounded"></div>
                <div className="h-3 w-52 bg-slate-100 dark:bg-navy-800 rounded"></div>
                <div className="h-3 w-24 bg-slate-200 dark:bg-navy-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <div className="text-slate-500 dark:text-slate-400 font-bold text-sm">No audit activity logged yet.</div>
            <div className="text-slate-400 dark:text-slate-500 font-semibold text-xs mt-1">Audit logs will appear here as administrators take actions.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-900 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Audit ID</th>
                  <th className="py-3 px-4">Admin</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold bg-white dark:bg-navy-950">
                {logs.map((log) => {
                  const actionStyle = getActionStyle(log.action);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                      title="Click to inspect full audit event telemetry"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 shrink-0" />
                          <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-[11px]">{log.audit_id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs">{log.admin_name}</span>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono">{log.admin_email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border ${getRoleStyle(log.admin_role)}`}>
                          {log.admin_role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase font-mono border ${actionStyle.bg}`}>
                          {actionStyle.icon}
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-700 dark:text-slate-200 truncate text-[11px]">{log.description || '—'}</div>
                        {log.ip_address && (
                          <div className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 mt-0.5">IP: {log.ip_address}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{log.status}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-700 dark:text-slate-200 text-xs whitespace-nowrap">
                        {formatAuditDate(log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-0">
              {logs.map((log, idx) => {
                const actionStyle = getActionStyle(log.action);
                return (
                  <div
                    key={`mob-${log.id}`}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 cursor-pointer transition-all hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 active:scale-[0.99] ${
                      idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800/70' : ''
                    }`}
                  >
                    {/* Row 1: Audit ID + Action + Status */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Eye className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-[11px] truncate">{log.audit_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase font-mono border ${actionStyle.bg}`}>
                          {actionStyle.icon}
                          {log.action}
                        </span>
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{log.status}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Admin identity */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 border border-indigo-200/60 dark:border-indigo-700/40 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{log.admin_name}</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono truncate">{log.admin_email}</div>
                      </div>
                    </div>

                    {/* Row 3: Description */}
                    <div className="font-bold text-slate-700 dark:text-slate-200 text-xs leading-relaxed mb-2.5 line-clamp-2">
                      {log.description || '—'}
                    </div>

                    {/* Row 4: Role + Timestamp Pill */}
                    <div className="flex justify-between items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black border ${getRoleStyle(log.admin_role)}`}>
                        {log.admin_role}
                      </span>
                      <span className="font-mono font-black text-slate-700 dark:text-slate-200 text-[11px] bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-navy-700">
                        {formatAuditDate(log.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Audit Entry Detail Inspection Modal — Mounted via Portal to document.body */}
      {selectedLog && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Audit log detail for ${selectedLog.audit_id}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div className="modal-container-responsive max-w-xl w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-3xl shadow-2xl animate-modal-content overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-navy-800 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-700/40">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                    {selectedLog.audit_id}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Event Inspection & Telemetry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-3.5 text-xs custom-scrollbar">
              {/* Status + Action row */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const actionStyle = getActionStyle(selectedLog.action);
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase font-mono border ${actionStyle.bg}`}>
                      {actionStyle.icon}
                      {selectedLog.action}
                    </span>
                  );
                })()}
                {selectedLog.status === 'SUCCESS' ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>SUCCESS</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{selectedLog.status}</span>
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border ${getRoleStyle(selectedLog.admin_role)}`}>
                  {selectedLog.admin_role || 'Admin'}
                </span>
              </div>

              {/* Admin Identity Card */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-150 dark:border-navy-700/60">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Administrator</span>
                  <div className="font-black text-slate-900 dark:text-white text-sm mt-1">{selectedLog.admin_name}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold font-mono mt-0.5">{selectedLog.admin_email}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">IP Address</span>
                  <div className="font-black text-slate-900 dark:text-white text-sm mt-1 font-mono">{selectedLog.ip_address || '127.0.0.1'}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold mt-0.5">{formatAuditDate(selectedLog.created_at)}</div>
                </div>
              </div>

              {/* Event Description */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-150 dark:border-navy-700/60 space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Event Summary</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                  {selectedLog.details || selectedLog.description || selectedLog.action}
                </div>
              </div>

              {/* Target Metadata */}
              {(selectedLog.target_type || selectedLog.target_id) && (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-150 dark:border-navy-700/60">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Target Resource</span>
                    <div className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs mt-1">
                      {selectedLog.target_type || 'System Resource'} {selectedLog.target_id ? `(#${selectedLog.target_id})` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Classification</span>
                    <div className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs mt-1">{selectedLog.action_type || 'GENERAL'}</div>
                  </div>
                </div>
              )}

              {/* User Agent / Device Signature */}
              {selectedLog.user_agent && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-150 dark:border-navy-700/60 space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Laptop className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>Device Signature</span>
                  </span>
                  <div className="font-mono font-semibold text-[10.5px] text-slate-600 dark:text-slate-300 break-all leading-tight">
                    {selectedLog.user_agent}
                  </div>
                </div>
              )}

              {/* Detailed Key-Value Event Payload Grid */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-150 dark:border-navy-700/60 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>Event Attributes ({Object.keys(selectedLog.metadata).length})</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Object.entries(selectedLog.metadata).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex flex-col justify-center">
                        <span className="text-[9px] font-bold uppercase text-slate-700 dark:text-slate-300 font-mono tracking-wider">{key}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata JSON Raw Inspector */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 space-y-1.5 font-mono shadow-md">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span>Raw Payload (JSON)</span>
                  </span>
                  <pre className="text-[10.5px] text-emerald-400 font-bold overflow-x-auto p-2.5 bg-black/60 rounded-xl max-h-48 no-scrollbar leading-relaxed">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-navy-800/80 flex justify-end bg-slate-50/50 dark:bg-navy-900/40 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2.5 bg-slate-900 dark:bg-navy-800 hover:bg-slate-800 dark:hover:bg-navy-700 text-white font-black rounded-2xl text-xs transition-colors cursor-pointer shadow-md"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
