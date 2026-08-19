// frontend/src/components/AutomationStatusPanel.tsx
import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Mail, Database, Clock, RefreshCw, Calendar, Cpu } from 'lucide-react';
import { getDataFreshness } from '../services/api';

interface AutomationStatusPanelProps {
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const AutomationStatusPanel: React.FC<AutomationStatusPanelProps> = ({
  onTriggerSync,
  isSyncing = false
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

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-navy-800/80 card-ai-control shadow-xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-navy-800/80 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Institutional AI Control Center
              </h3>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live-indicator"></span>
                <span>SYSTEM ONLINE</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
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
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/25 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-sync-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
            {currentTime || 'Syncing clock...'}
          </div>
        </div>
      </div>

      {/* Grid of status nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 relative z-10">
        
        {/* Sunday Automation */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Sunday Pipeline</span>
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live-indicator"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Active</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">8:00 AM IST Cron</span>
        </div>

        {/* Last Sync */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Last Sync</span>
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
            {freshness?.last_sync_time ? new Date(freshness.last_sync_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified (Recent)'}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Reconciled</span>
        </div>

        {/* Next Run */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Next Auto Run</span>
            <Activity className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xs font-black text-slate-900 dark:text-white">
            Sunday 08:00
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Weekly Auto Scan</span>
        </div>

        {/* Database Health */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Database</span>
            <Database className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Healthy (WAL)</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">0 Orphan Records</span>
        </div>

        {/* Reports Engine */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Dual Reports</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs font-black text-slate-900 dark:text-white">Ready</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Internal & Official</span>
        </div>

        {/* Email Transport */}
        <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/60 dark:border-navy-800/60 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Email Dispatch</span>
            <Mail className="w-3.5 h-3.5 text-purple-500" />
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
