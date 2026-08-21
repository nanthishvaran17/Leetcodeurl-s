import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, Search, Filter, RefreshCw, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';
import api from '../services/api';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
      setLogs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch admin audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      
      {/* ── HEADER (RICH GLOWING INSTITUTIONAL GRADIENT) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
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
              Real-time database audit log recording administrator identity, logins, report generation, email dispatches & setting modifications.
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
              placeholder="Search by Audit ID, Admin Name, Email, or Action..."
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
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 text-xs text-gray-900 dark:text-white font-medium"
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
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 text-xs text-gray-900 dark:text-white font-medium"
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
            <table className="w-full text-left text-xs border-collapse">
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
                  <tr key={log.id} className="hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                      {log.audit_id}
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
                        log.action.includes('LOGIN') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      <div>{log.description || '—'}</div>
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

                    <td className="py-3 px-4 text-right font-mono text-gray-400 text-[11px]">
                      {log.created_at || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
