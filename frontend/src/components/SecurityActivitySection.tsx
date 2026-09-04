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
  const lastFetchedFilterRef = useRef<string | null>(null);

  const fetchSecurityActivities = async (selectedFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/settings/security-activity?filter_type=${selectedFilter}&limit=50`);
      setActivities(res.data.activities || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load security activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lastFetchedFilterRef.current === filter) return;
    lastFetchedFilterRef.current = filter;
    fetchSecurityActivities(filter);
  }, [filter]);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
          <ShieldCheck className="w-3.5 h-3.5" />
          SUCCESS
        </span>
      );
    }
    if (s === 'BLOCKED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
          <Lock className="w-3.5 h-3.5" />
          BLOCKED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40">
        <AlertTriangle className="w-3.5 h-3.5" />
        ALERT
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl p-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            SECURITY ACTIVITY
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time audit log of protected resource access, authorization decisions, and security alerts.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl">
          {(['ALL', 'SUCCESS', 'BLOCKED', 'ALERTS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                filter === tab
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => fetchSecurityActivities(filter)}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-navy-600 dark:hover:text-navy-400 transition-colors"
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
              {activities.map((item) => (
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
      )}
    </div>
  );
};
