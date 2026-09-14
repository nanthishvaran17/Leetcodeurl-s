import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, Lock, Filter } from 'lucide-react';
import api from '../services/api';

interface SecurityItem {
  id: number;
  audit_id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  resource: string;
  contest: string;
  result: string;
  denial_reason: string;
  ip_hash: string;
  user_agent_category: string;
}

export const SecurityActivitySection: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'BLOCKED' | 'ALERTS'>('ALL');
  const [activities, setActivities] = useState<SecurityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 25);
  const lastFetchedFilterRef = useRef<string | null>(null);

  const fetchSecurityActivities = async (selectedFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/settings/security-activity?filter_type=${selectedFilter}&limit=100`);
      setActivities(res.data.activities || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load security activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    if (lastFetchedFilterRef.current === filter) return;
    lastFetchedFilterRef.current = filter;
    fetchSecurityActivities(filter);
  }, [filter]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'ALLOWED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
          <ShieldCheck className="w-3.5 h-3.5" />
          SUCCESS
        </span>
      );
    }
    if (s === 'BLOCKED' || s === 'DENIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
          <Lock className="w-3.5 h-3.5" />
          BLOCKED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40">
        <AlertTriangle className="w-3.5 h-3.5" />
        ALERT
      </span>
    );
  };

  const paginatedActivities = activities.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-navy-800 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            SECURITY ACTIVITY
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time audit log of protected resource access, authorization decisions, and security alerts.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl flex-wrap">
          {(['ALL', 'SUCCESS', 'BLOCKED', 'ALERTS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                filter === tab
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => fetchSecurityActivities(filter)}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-navy-600 dark:hover:text-navy-400 transition-colors cursor-pointer"
            title="Refresh Security Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      ) : loading && activities.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm animate-pulse">
          Loading security activity logs...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          No security events recorded for filter "{filter}".
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (block md:hidden, no horizontal scroll) */}
          <div className="block md:hidden space-y-2.5">
            {paginatedActivities.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm space-y-2.5"
              >
                {/* Header: Timestamp + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                  <div>{getStatusBadge(item.result)}</div>
                </div>

                {/* User & Action Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-navy-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">User / Role:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {item.user} <span className="text-[10px] font-normal text-slate-400">({item.role})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Action:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono truncate">
                      {item.action}
                    </span>
                  </div>
                  {item.resource && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Resource:</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate font-mono text-[11px]">
                        {item.resource}
                      </span>
                    </div>
                  )}
                  {item.denial_reason && (
                    <div className="pt-1 border-t border-slate-100 dark:border-navy-800/80 text-[10.5px] text-slate-500">
                      {item.denial_reason}
                    </div>
                  )}
                </div>

                {/* Footer: Contest Session + Source Hash */}
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1">
                  <span>Session: {item.contest || 'N/A'}</span>
                  <span>{item.ip_hash}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-navy-700">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User / Role</th>
                  <th className="py-3 px-4">Action / Resource</th>
                  <th className="py-3 px-4">Contest Session</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reason / Details</th>
                  <th className="py-3 px-4">Source Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-800 text-slate-700 dark:text-slate-300">
                {paginatedActivities.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <div>{item.user}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.role}</div>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <div className="text-slate-900 dark:text-slate-100">{item.action}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{item.resource}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                      {item.contest || 'N/A'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(item.result)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={item.denial_reason}>
                      {item.denial_reason || 'Access Authorized'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      {item.ip_hash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {activities.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500 font-medium">
              <div>
                Showing <strong className="text-slate-900 dark:text-white">{Math.min((page - 1) * pageSize + 1, activities.length)}</strong> to{' '}
                <strong className="text-slate-900 dark:text-white">{Math.min(page * pageSize, activities.length)}</strong> of{' '}
                <strong className="text-slate-900 dark:text-white">{activities.length}</strong> Events
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                  <span className="text-[10px] text-slate-400 px-1 font-mono">Show:</span>
                  {[10, 25, 50, 100].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => { setPageSize(sz); setPage(1); }}
                      className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                        pageSize === sz
                          ? 'bg-brand-600 text-white shadow-xs font-black'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 transition font-bold cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-bold px-1">
                    {page} / {Math.ceil(activities.length / pageSize) || 1}
                  </span>
                  <button
                    disabled={page >= Math.ceil(activities.length / pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-800 transition font-bold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
