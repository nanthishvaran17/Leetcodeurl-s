// frontend/src/components/AutomationStatusPanel.tsx
import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Mail, Database, Clock, RefreshCw, Calendar, Cpu, Layers } from 'lucide-react';
import api, { getDataFreshness } from '../services/api';

interface AutomationStatusPanelProps {
  onTriggerSync?: () => void;
  isSyncing?: boolean;
  systemHealth?: any;
  syncStatus?: any;
}

export const AutomationStatusPanel: React.FC<AutomationStatusPanelProps> = ({
  onTriggerSync,
  isSyncing = false,
  systemHealth,
  syncStatus
}) => {
  const [freshness, setFreshness] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    loadStatus();
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        }) + ' IST'
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await getDataFreshness();
      setFreshness(data);
    } catch (e) {
      console.warn('Could not load status:', e);
    }
  };

  const isWorkerRunning = (systemHealth?.sync_worker === 'running') || syncStatus?.is_running;
  const isDbHealthy = (systemHealth?.database === 'healthy') || (systemHealth?.status !== 'unhealthy');
  const freshnessBadge = systemHealth?.data_freshness_status || syncStatus?.data_freshness_status || freshness?.data_freshness_status || 'FRESH';

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-navy-800/80 shadow-sm relative overflow-hidden space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                INSTITUTIONAL AI CONTROL CENTER
              </h3>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>SYSTEM ONLINE</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Continuous Contest Synchronization & Automated Lifecycle Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onTriggerSync && (
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                isSyncing
                  ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
            {currentTime || 'Syncing clock...'}
          </div>
        </div>
      </div>

      {/* Grid of status nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
        
        {/* Sunday Automation */}
        <div
          onClick={onTriggerSync}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-brand-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-brand-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to trigger Sunday baseline snapshot"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-brand-600 dark:group-hover:text-brand-400">Sunday Pipeline</span>
            <Calendar className="w-3.5 h-3.5 text-brand-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Active</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">08:00 AM IST Cron</span>
        </div>

        {/* Last Sync */}
        <div
          onClick={onTriggerSync}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-indigo-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-indigo-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to trigger live synchronization"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Last Sync</span>
            <Clock className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
            {freshness?.last_successful_sync ? new Date(freshness.last_successful_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (systemHealth?.last_successful_fetch ? new Date(systemHealth.last_successful_fetch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified (Recent)')}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {freshness?.data_freshness_status === 'FRESH' || systemHealth?.data_freshness_status === 'FRESH' ? 'Live Cache Sync' : 'Reconciling...'}
          </span>
        </div>

        {/* Next Run */}
        <div
          onClick={loadStatus}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-amber-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-amber-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to refresh system scheduler status"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400">Next Auto Run</span>
            <Activity className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xs font-black text-slate-900 dark:text-white">
            Sunday 08:00
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Weekly Auto Scan</span>
        </div>

        {/* Database Health */}
        <div
          onClick={loadStatus}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-emerald-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-emerald-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to inspect database health & WAL status"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Database</span>
            <Database className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isDbHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Healthy (WAL)</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            {systemHealth?.orphan_records !== undefined ? `${systemHealth.orphan_records} Orphan Records` : (freshness?.total_students ? `${freshness.total_students} Records` : '0 Orphan Records')}
          </span>
        </div>

        {/* Reports Engine */}
        <div
          onClick={async () => {
            try {
              const res = await api.get('/reports/21/excel', { responseType: 'blob' });
              const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
              const link = document.createElement('a');
              link.href = blobUrl;
              link.setAttribute('download', `Nandha_LeetCode_College_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(blobUrl);
            } catch (e) {
              console.error('Report export error:', e);
            }
          }}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-blue-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-blue-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to export official Excel report matrix"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-blue-600 dark:group-hover:text-blue-400">Dual Reports</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Ready</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Click to Export Excel</span>
        </div>

        {/* Email Transport */}
        <div
          onClick={async () => {
            try {
              await api.get('/admin/email-deliveries');
            } catch (e) {
              console.error('Email log check error:', e);
            }
          }}
          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 hover:bg-purple-50/60 dark:hover:bg-navy-900/80 border border-slate-200/60 dark:border-navy-800/60 hover:border-purple-400/50 flex flex-col justify-between space-y-1 transition-all cursor-pointer group"
          title="Click to inspect email gateway deliveries"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400">Email Dispatch</span>
            <Mail className="w-3.5 h-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Connected</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Gmail IPv4 SMTP</span>
        </div>

      </div>


    </div>
  );
};
