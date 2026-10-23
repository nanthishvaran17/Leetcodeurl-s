import { SwipeHandle } from '../components/SwipeHandle';
import React, { useState, useEffect, useMemo } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { createPortal } from 'react-dom';
import { ShieldAlert, Clock, Search, Filter, RefreshCw, CheckCircle2, AlertTriangle, UserCheck, X, Eye, Laptop, Terminal, User, Activity, Globe, Settings, Mail, FileText, LogIn, LogOut, Navigation, Download, SlidersHorizontal, ListFilter } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';
import { downloadManager } from '../services/download/downloadManager';

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
  if (r.includes('MANAGEMENT') || r.includes('MGMT') || r.includes('PRINCIPAL')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700';
  if (r.includes('STAFF') || r.includes('FACULTY')) return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-700';
  if (r.includes('STUDENT')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700';
  if (r.includes('SYSTEM')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
  if (r.includes('ADMIN')) return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
};
/** Normalizes role display for clean badges (e.g. 'hod' -> 'HOD') */
const formatRoleBadge = (role: string): string => {
  if (!role) return 'UNKNOWN';
  const r = role.trim().toUpperCase();
  if (r === 'HOD') return 'HOD';
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'SUPER ADMIN') return 'SUPER ADMIN';
  return role;
};

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [limitFilter, setLimitFilter] = useState<string>('10');
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
    if (exportingExcel) return;

    if (!logs || logs.length === 0) {
      notify.warning('No audit logs available', 'No audit logs were found to export. Adjust search or filters and try again.', { category: 'ADMIN' });
      return;
    }

    let notifyToast: any = null;
    try {
      setExportingExcel(true);
      notifyToast = notify.loading('Generating Excel report...', '', { duration: 10000, category: 'ADMIN' });
      // @ts-ignore
      const excelMod: any = await import('exceljs');
      const ExcelJS = excelMod.default ? excelMod.default : (excelMod.Workbook ? excelMod : (window as any).ExcelJS);
      const workbook = new (ExcelJS.Workbook || ExcelJS)();
      const worksheet = workbook.addWorksheet('Admin Audit Trail', {
        views: [{ showGridLines: false }]
      });

      // 1. Load and embed both logos (Left: College Emblem, Right: 25 Years Logo)
      let logoLeftId: any, logoRightId: any;
      try {
        const fetchBase64 = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          const reader = new FileReader();
          return new Promise<string>((resolve) => {
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result as string);
          });
        };

        const leftBase64 = await fetchBase64('/nandha_emblem.png') || await fetchBase64('/logo.png');
        const rightBase64 = await fetchBase64('/nec_25_years_logo_transparent.png') || await fetchBase64('/nec_25_logo.png') || await fetchBase64('/nec_25_years_logo.png');

        if (leftBase64) {
          logoLeftId = workbook.addImage({ base64: leftBase64, extension: 'png' });
        }
        if (rightBase64) {
          logoRightId = workbook.addImage({ base64: rightBase64, extension: 'png' });
        }
      } catch (err) {
        console.warn('Could not load logos for Excel report:', err);
      }

      worksheet.getRow(1).height = 46;
      worksheet.getRow(2).height = 24;
      worksheet.getRow(3).height = 20;

      // Apply institutional Oxford Navy Blue (#002147) fill to header block rows 1-3
      for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 8; c++) {
          const cell = worksheet.getCell(r, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002147' } };
        }
      }

      if (logoLeftId !== undefined) {
        // Anchor to top-left (Column A) with original emblem aspect ratio (550x363)
        worksheet.addImage(logoLeftId, {
          tl: { col: 0.08, row: 0.1 },
          ext: { width: 95, height: 63 }
        });
      }

      if (logoRightId !== undefined) {
        // Anchor to top-right (Column H) - clean circular 25th jubilee emblem (447x447 1:1)
        worksheet.addImage(logoRightId, {
          tl: { col: 7.25, row: 0.1 },
          ext: { width: 75, height: 75 }
        });
      }

      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `OFFICIAL ${roleName.toUpperCase()} SYSTEM & IDENTITY AUDIT TRAIL REPORT`;
      titleCell.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      worksheet.mergeCells('A2:H2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Generated By: ${user?.full_name || user?.name || user?.username} | Role: ${roleName} | Dept: ${departmentName}`;
      subCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFDE047' } };
      subCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      worksheet.mergeCells('A3:H3');
      const genCell = worksheet.getCell('A3');
      genCell.value = `Generated At: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' })} IST | Records Count: ${logs.length}`;
      genCell.font = { name: 'Times New Roman', size: 10, color: { argb: 'FFCBD5E1' } };
      genCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      const headerRow = worksheet.addRow(['Audit ID', 'Admin', 'Admin Email', 'Role', 'Action', 'Description', 'Status', 'Timestamp']);
      headerRow.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.height = 26;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.border = { top: {style:'thin', color: {argb:'FF000000'}}, left: {style:'thin', color: {argb:'FF000000'}}, bottom: {style:'thin', color: {argb:'FF000000'}}, right: {style:'thin', color: {argb:'FF000000'}} };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      logs.forEach((l, idx) => {
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

        // Dynamic row height to prevent cell text border overflow
        const descText = String(l.description || '—');
        const rawLines = descText.split('\n').length;
        // On width 52, approx 45 chars per line
        const wrappedLineEst = Math.ceil(descText.length / 45);
        const estLines = Math.max(rawLines, wrappedLineEst);

        if (estLines >= 4) {
          row.height = estLines * 16 + 10;
        } else if (estLines === 3) {
          row.height = 54;
        } else if (estLines === 2) {
          row.height = 38;
        } else {
          row.height = 26;
        }

        const isAlt = idx % 2 === 1;
        row.eachCell(cell => {
          cell.font = { name: 'Times New Roman', size: 10 };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FF000000' } }, 
            left: { style: 'thin', color: { argb: 'FF000000' } }, 
            bottom: { style: 'thin', color: { argb: 'FF000000' } }, 
            right: { style: 'thin', color: { argb: 'FF000000' } } 
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (isAlt) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F8' } };
          }
        });
        row.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
        const stCell = row.getCell(7);
        stCell.alignment = { horizontal: 'center', vertical: 'middle' };
        stCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: l.status === 'SUCCESS' ? 'FF15803D' : 'FFE11D48' } };
      });

      // Generous & Proportioned Excel Column Widths
      const baseWidths = [24, 18, 28, 16, 22, 52, 14, 28];
      baseWidths.forEach((w, idx) => {
        const col = worksheet.getColumn(idx + 1);
        col.width = w;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `NEC_Audit_Trail_${institutionalId}_${new Date().toISOString().split('T')[0]}.xlsx`;

      const downloadRes = await downloadManager.downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      if (notifyToast) notify.dismiss(notifyToast);
      if (downloadRes.success) {
        notify.success('Audit log Excel report exported successfully!', '', { category: 'ADMIN' });
      } else {
        throw new Error(downloadRes.error || 'Excel download failed');
      }
    } catch (err: any) {
      console.warn('Failed to generate Excel report, initiating CSV fallback:', err);
      // Robust CSV Fallback: All mobile devices and office apps open CSV seamlessly
      try {
        const rows = [
          ['Audit ID', 'Admin Name', 'Admin Email', 'Admin Role', 'Action', 'Description', 'Status', 'Timestamp (IST)']
        ];
        logs.forEach(l => {
          rows.push([
            l.audit_id || '',
            l.admin_name || '',
            l.admin_email || '',
            l.admin_role || '',
            l.action || '',
            l.description || '—',
            l.status || '',
            formatAuditDate(l.created_at)
          ]);
        });
        const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const csvFilename = `NEC_Audit_Trail_${institutionalId}_${new Date().toISOString().split('T')[0]}.csv`;
        
        await downloadManager.downloadBlob(csvBlob, csvFilename, 'text/csv;charset=utf-8;');
        if (notifyToast) notify.dismiss(notifyToast);
        notify.success('Audit log report exported (CSV format for mobile compatibility)!', '', { category: 'ADMIN' });
      } catch (csvErr: any) {
        console.error('Failed to export audit report fallback:', csvErr);
        if (notifyToast) notify.dismiss(notifyToast);
        notify.error(`Failed to export report: ${err?.message || err}`, '', { category: 'ADMIN' });
      }
    } finally {
      setExportingExcel(false);
      if (notifyToast) notify.dismiss(notifyToast);
    }
  };

  const handlePrintAuditLogReport = () => {
    if (typeof window === 'undefined' || typeof window.print !== 'function') {
      notify.error('Print unavailable', 'This browser does not support printing. Open the page in a browser to print the audit report.', { category: 'ADMIN' });
      return;
    }

    // Let the mobile browser finish the click event before opening its print dialog.
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  };

  const roleOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Roles', badge: 'ALL', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
    { value: 'HOD', label: 'Head of Dept (HOD)', badge: 'HOD', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
    { value: 'ADMIN', label: 'Administrator', badge: 'ADMIN', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700' },
    { value: 'Super Admin', label: 'Super Admin', badge: 'SUPER', badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700' },
    { value: 'STAFF', label: 'Faculty / Staff', badge: 'STAFF', badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700' },
    { value: 'MANAGEMENT', label: 'Management / Principal', badge: 'MGMT', badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
    { value: 'STUDENT', label: 'Student', badge: 'STUDENT', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
    { value: 'SYSTEM', label: 'Automated System', badge: 'SYSTEM', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  ], []);

  const statusOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Statuses', badge: 'ALL', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
    { value: 'SUCCESS', label: 'SUCCESS', badge: 'OK', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
    { value: 'FAILED', label: 'FAILED', badge: 'ERR', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700' },
    { value: 'WARNING', label: 'WARNING', badge: 'WARN', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  ], []);

  const limitOptions: DropdownOption[] = useMemo(() => [
    { value: '5', label: 'Top 5 Logs', badge: '5', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
    { value: '10', label: 'Top 10 Logs', badge: '10', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
    { value: '25', label: 'Top 25 Logs', badge: '25', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
    { value: '50', label: 'Top 50 Logs', badge: '50', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
    { value: '100', label: 'Top 100 Logs', badge: '100', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
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
  }, [searchTerm, roleFilter, statusFilter, limitFilter]);

  const fetchLogs = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const lim = parseInt(limitFilter, 10) || 10;
      let url = `/admin/audit-logs?limit=${lim}`;
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

  // Lock body scroll safely when inspection modal is open
  useScrollLock(Boolean(selectedLog));

  useEffect(() => {
    if (selectedLog) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedLog(null);
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [selectedLog]);


  return (
    <div className="space-y-6 pt-0 pb-32 sm:pb-16 animate-slideUp">
      
      {/* HEADER - SLEEK MODERN MOBILE & DESKTOP HERO */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-6 md:p-8 shadow-2xl border border-indigo-500/20">
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-72 h-72 bg-brand-500/6 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2.5 max-w-2xl min-w-0">
            {/* Mobile Top Row: Pill Badge + Quick Refresh */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex max-w-full items-center space-x-1.5 sm:space-x-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-[10px] sm:text-xs font-black">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">ADMIN IDENTITY & AUDIT TRAIL</span>
              </div>

              {/* Quick Refresh Icon on Mobile */}
              <button
                onClick={() => fetchLogs()}
                disabled={loading}
                className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 active:scale-90 text-slate-200 border border-white/10 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Refresh logs"
                aria-label="Refresh logs"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white leading-snug break-words">
              Admin Identity & <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-sky-300 to-violet-400">Audit Log</span>
            </h1>
            <p className="hidden sm:block text-xs md:text-sm text-slate-300 font-semibold leading-relaxed">
              Real-time database audit log recording administrator identity, logins, page visits, report generation, email dispatches & setting modifications. Click any log entry to inspect full event telemetry.
            </p>
          </div>

          {/* MOBILE ACTION PILL */}
          <div className="flex sm:hidden items-center gap-2 pt-0.5">
            <button
              onClick={handleExportAuditLogsExcel}
              disabled={exportingExcel}
              className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500/20 active:bg-emerald-500/40 text-emerald-200 border border-emerald-400/30 text-xs font-bold transition-all active:scale-95 touch-manipulation shadow-xs cursor-pointer disabled:opacity-60"
              title="Export formatted Excel report"
            >
              <Download size={12} className={`shrink-0 text-emerald-300 ${exportingExcel ? 'animate-spin' : ''}`} />
              <span>{exportingExcel ? 'Exporting...' : 'Excel Report'}</span>
            </button>
          </div>

          {/* DESKTOP ACTION BUTTONS (sm and up) */}
          <div className="hidden sm:flex sm:items-center gap-2.5 w-full xl:w-auto shrink-0 self-start xl:self-center">
            <button
              onClick={handleExportAuditLogsExcel}
              disabled={exportingExcel}
              className="inline-flex min-w-0 items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 h-10 bg-emerald-600/80 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer border border-emerald-400/30 whitespace-nowrap touch-manipulation"
              title="Export formatted Excel report with clean column widths"
            >
              <Download className={`w-4 h-4 text-emerald-200 ${exportingExcel ? 'animate-spin' : ''}`} />
              <span>{exportingExcel ? 'Exporting...' : 'Excel Report'}</span>
            </button>
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="inline-flex min-w-0 items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-95 border border-indigo-400/30 whitespace-nowrap touch-manipulation"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls — Modern Mobile & Desktop Interface */}
      <div className="glass-card p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs bg-white/95 dark:bg-navy-950/95 backdrop-blur-md">
        
        {/* Top Filter Header: Title + Telemetry Count */}
        <div className="flex items-center justify-between gap-2 pb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
              Audit Filters &amp; Query
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
              {logs.length} Loaded
            </span>
          </div>
        </div>

        {/* 1. Search Bar */}
        <div className="relative flex items-center w-full">
          <input
            id="audit-search-input"
            type="text"
            placeholder="Search by Audit ID, Admin, Email, Action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fetchLogs();
              }
            }}
            className="w-full h-10 sm:h-11 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-bold py-2 pl-9 pr-9 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-left transition-all"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10 text-slate-400 dark:text-slate-500">
            <Search className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* 2. Quick Limit Pills Bar (Top 5, Top 10, Top 25, Top 50, Top 100) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider shrink-0 mr-0.5 flex items-center gap-1">
            <ListFilter className="w-3 h-3 text-indigo-500" />
            <span>Show:</span>
          </span>
          {(['5', '10', '25', '50', '100'] as const).map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => setLimitFilter(cnt)}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all shrink-0 cursor-pointer active:scale-95 ${
                limitFilter === cnt
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-navy-900/90 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700/80'
              }`}
            >
              Top {cnt}
            </button>
          ))}
        </div>

        {/* 3. Dropdowns (Role, Status, Limit) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full pt-0.5">
          <div className="min-w-0 w-full">
            <CustomDropdown
              id="audit-role-filter"
              label="Role Filter"
              options={roleOptions}
              value={roleFilter}
              onChange={setRoleFilter}
              icon={UserCheck}
              compact={true}
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
              compact={true}
            />
          </div>

          <div className="min-w-0 w-full col-span-2 sm:col-span-1">
            <CustomDropdown
              id="audit-limit-filter"
              label="Max Entries"
              options={limitOptions}
              value={limitFilter}
              onChange={setLimitFilter}
              icon={ListFilter}
              compact={true}
            />
          </div>
        </div>

        {/* Filter Summary / Quick Reset bar when filters active */}
        {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' || limitFilter !== '10') && (
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Active filters:
              </span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black font-mono">
                  "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {roleFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-black">
                  Role: {roleFilter}
                  <button type="button" onClick={() => setRoleFilter('ALL')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter('ALL')} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {limitFilter !== '10' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-black font-mono">
                  Top: {limitFilter}
                  <button type="button" onClick={() => setLimitFilter('10')} className="hover:text-rose-500 cursor-pointer">
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
                setLimitFilter('10');
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
                          {formatRoleBadge(log.admin_role)}
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
            <div className="md:hidden p-3 sm:p-4 space-y-3 bg-slate-50/60 dark:bg-navy-950/40">
              {logs.map((log) => {
                const actionStyle = getActionStyle(log.action);
                return (
                  <div
                    key={`mob-${log.id}`}
                    onClick={() => setSelectedLog(log)}
                    className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-navy-800 shadow-xs hover:shadow-md cursor-pointer transition-all active:scale-[0.98] touch-manipulation space-y-3"
                  >
                    {/* Header: Audit ID & Status */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-navy-800 pb-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Eye className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs truncate">{log.audit_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{log.status}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action & Admin Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase font-mono border ${actionStyle.bg}`}>
                        {actionStyle.icon}
                        <span>{log.action}</span>
                      </span>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border ${getRoleStyle(log.admin_role)}`}>
                        {formatRoleBadge(log.admin_role)}
                      </span>
                    </div>

                    {/* Description Box */}
                    <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-navy-950/70 border border-slate-100 dark:border-navy-800">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-relaxed line-clamp-2">
                        {log.description || '—'}
                      </p>
                    </div>

                    {/* Footer: Admin info & Timestamp */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3" />
                        </div>
                        <div className="min-w-0 truncate">
                          <span className="font-black text-slate-900 dark:text-white truncate block">{log.admin_name}</span>
                          <span className="text-[10px] font-mono text-slate-400 truncate block">{log.admin_email}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px] bg-slate-100 dark:bg-navy-800 px-2 py-1 rounded-lg shrink-0 border border-slate-200/60 dark:border-navy-700">
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
            {/* Mobile Drag Indicator */}
            <SwipeHandle onClose={() => setSelectedLog(null)} className="py-2" pillClassName="bg-slate-300 dark:bg-slate-700 hover:bg-slate-400" />

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
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-all cursor-pointer touch-manipulation active:scale-90"
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
                  {formatRoleBadge(selectedLog.admin_role || 'Admin')}
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
                className="px-6 py-2.5 min-h-[44px] bg-slate-900 dark:bg-navy-800 hover:bg-slate-800 dark:hover:bg-navy-700 text-white font-black rounded-2xl text-xs transition-colors cursor-pointer shadow-md touch-manipulation active:scale-95"
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
