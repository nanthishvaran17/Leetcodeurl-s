import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, Clock, Search, Filter, RefreshCw, CheckCircle2, AlertTriangle, UserCheck, X, Eye, Laptop, Terminal } from 'lucide-react';
import api from '../services/api';

const formatAuditDate = (dateString: string) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
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

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [roleFilter, statusFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = '/admin/audit-logs?limit=100';
      if (roleFilter !== 'ALL') url += `&role=${encodeURIComponent(roleFilter)}`;
      if (statusFilter !== 'ALL') url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      
      const res = await api.get(url);
      const sorted = (res.data || []).sort((a: any, b: any) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        if (da !== db) return db - da; // Descending by timestamp
        // Tie-breaker
        if (a.id && b.id) return b.id - a.id; 
        return 0;
      });
      setLogs(sorted);
    } catch (err) {
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      
      {/* ── HEADER (RICH GLOWING INSTITUTIONAL GRADIENT) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-lg border border-brand-500/30">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>ADMIN IDENTITY & AUDIT TRAIL</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Admin Identity & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Audit Log</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Real-time database audit log recording administrator identity, logins, page visits, report generation, email dispatches & setting modifications. Click any log entry to inspect full event telemetry.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="glass-card p-5 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Audit ID, Admin Name, Email, Action, or Description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-brand-600 text-white text-xs font-bold rounded-2xl hover:bg-brand-700 transition-all"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 text-xs text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="Super Admin">Super Admin</option>
              <option value="MANAGEMENT">MANAGEMENT</option>
              <option value="HOD">HOD</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 text-xs text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="WARNING">WARNING</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
            <span>Loading audit log entries...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">
            No audit activity logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/80 dark:bg-navy-900/80 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 uppercase tracking-wider">
                  <th className="py-3 px-4">Audit ID</th>
                  <th className="py-3 px-4">Admin Name / Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-brand-50/40 dark:hover:bg-brand-950/30 transition-colors cursor-pointer group"
                    title="Click to inspect full audit event telemetry"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1.5">
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-brand-500 shrink-0" />
                      <span>{log.audit_id}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white">{log.admin_name}</span>
                        <span className="text-[11px] text-gray-400">{log.admin_email}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300">
                        {log.admin_role}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                        log.action === 'PAGE_NAVIGATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300' :
                        log.action.includes('SYNC') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                        log.action.includes('LOGIN') || log.action.includes('LOGOUT') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{log.description || '—'}</div>
                      {log.ip_address && (
                        <div className="text-[9.5px] font-mono text-gray-400">IP: {log.ip_address}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SUCCESS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{log.status}</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-gray-400 text-[11px] whitespace-nowrap">
                      {formatAuditDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <div key={`mob-${log.id}`} onClick={() => setSelectedLog(log)} className="p-4 hover:bg-brand-50/40 dark:hover:bg-brand-950/30 cursor-pointer space-y-3 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-mono font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1.5">
                        <Eye className="w-3.5 h-3.5 text-brand-500" />
                        <span>{log.audit_id}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white">{log.admin_name}</span>
                        <span className="text-[11px] text-gray-400">{log.admin_email}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                        log.action === 'PAGE_NAVIGATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300' :
                        log.action.includes('SYNC') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                        log.action.includes('LOGIN') || log.action.includes('LOGOUT') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-300'
                      }`}>
                        {log.action}
                      </span>
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SUCCESS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{log.status}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs break-words">
                    {log.description || '—'}
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="px-2.5 py-0.5 rounded-full font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300">
                      {log.admin_role}
                    </span>
                    <span className="font-mono text-gray-400">
                      {formatAuditDate(log.created_at)}
                    </span>
                  </div>
                </div>
              ))}
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
          <div className="modal-container-responsive max-w-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-3xl shadow-lg p-6 space-y-4 animate-modal-content">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white font-mono">
                    {selectedLog.audit_id}
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Administrator Event & Activity Inspection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Admin Identity Card */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
                <div>
                  <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px]">Administrator / User</span>
                  <div className="font-black text-gray-900 dark:text-white text-sm mt-0.5">{selectedLog.admin_name}</div>
                  <div className="text-gray-500 text-[11px] font-mono">{selectedLog.admin_email}</div>
                </div>
                <div>
                  <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px]">Role / Access Level</span>
                  <div className="font-black text-gray-900 dark:text-white text-sm mt-0.5">{selectedLog.admin_role || 'Admin'}</div>
                  <div className="text-gray-500 text-[11px] font-mono">{selectedLog.ip_address || '127.0.0.1'}</div>
                </div>
              </div>

              {/* Event Description */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-1">
                <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px]">Event Summary & Detail</span>
                <div className="font-bold text-gray-900 dark:text-white text-xs leading-relaxed">
                  {selectedLog.details || selectedLog.action}
                </div>
              </div>

              {/* Target Metadata */}
              {(selectedLog.target_type || selectedLog.target_id) && (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
                  <div>
                    <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px]">Target Resource</span>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-300 text-xs mt-0.5">
                      {selectedLog.target_type || 'System Resource'} {selectedLog.target_id ? `(#${selectedLog.target_id})` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px]">Action Classification</span>
                    <div className="font-mono font-bold text-gray-900 dark:text-white text-xs mt-0.5">{selectedLog.action_type || 'GENERAL'}</div>
                  </div>
                </div>
              )}

              {/* User Agent / Device Signature */}
              {selectedLog.user_agent && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-1">
                  <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-indigo-500" />
                    <span>Browser & Device Signature</span>
                  </span>
                  <div className="font-mono text-[10.5px] text-gray-600 dark:text-gray-300 break-all leading-tight">
                    {selectedLog.user_agent}
                  </div>
                </div>
              )}

              {/* Detailed Key-Value Event Payload Grid */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-2">
                  <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-indigo-500" />
                    <span>Structured Event Attributes ({Object.keys(selectedLog.metadata).length} Parameters)</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Object.entries(selectedLog.metadata).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 flex flex-col justify-center">
                        <span className="text-[9.5px] font-extrabold uppercase text-gray-400 font-mono tracking-wider">{key}</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-gray-100 truncate mt-0.5">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata JSON Raw Inspector */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 space-y-1.5 font-mono">
                  <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span>Raw Event Payload Metadata (JSON)</span>
                  </span>
                  <pre className="text-[10.5px] text-emerald-400 overflow-x-auto p-2.5 bg-black/50 rounded-xl max-h-48 no-scrollbar leading-relaxed">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 dark:hover:bg-navy-700 text-gray-900 dark:text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
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
