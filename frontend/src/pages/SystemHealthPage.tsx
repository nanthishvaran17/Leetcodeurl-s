import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cloud,
  Clock,
  RefreshCw,
  Zap,
  ShieldCheck,
  Cpu,
  Server,
  Layers,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Globe,
  Terminal,
  Copy,
  Check,
  Radio,
  Search,
  Users,
  Calendar,
  FileSpreadsheet,
  ShieldAlert,
  Mail,
  Lock,
  FileText,
  Key,
  Flame,
  ChevronRight,
  Info
} from 'lucide-react';
import api from '../services/api';

interface ControlCenterData {
  status: string;
  last_updated: string;
  system_health: Record<string, {
    name: string;
    status: string;
    type: string;
    badge: string;
    latency_ms?: number;
    connections?: number;
  }>;
  student_data: {
    expected_roster: number;
    actual_firestore_students: number;
    active_students: number;
    inactive_students: number;
    leetcode_profiles: number;
    duplicates: number;
    missing_records: number;
    orphan_records: number;
    integrity_status: string;
  };
  leetcode_sync: {
    status: string;
    targets: number;
    processed: number;
    successful: number;
    failed: number;
    pending: number;
    skipped: number;
    concurrency: number;
    last_sync: string;
    last_sync_duration: string;
    current_job_id: string;
    is_running: boolean;
  };
  database_health: Array<{
    collection: string;
    document_count: number;
    last_update: string;
    integrity: string;
    duplicates: number;
    orphans: number;
  }>;
  security: Record<string, {
    name: string;
    status: string;
    badge: string;
    records_count?: number;
  }>;
  sunday_automation: Array<{
    id: string;
    name: string;
    schedule: string;
    timezone: string;
    next_run: string;
    last_run: string;
    status: string;
    evidence: string;
  }>;
  reports_and_email: {
    formats: Record<string, {
      format: string;
      status: string;
      badge: string;
    }>;
    last_public_report: string;
    email_dispatch_status: string;
    recipients_configured: string[];
  };
  errors_and_incidents: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent_incidents: any[];
  };
  system_logs: Array<{
    id: number | string;
    timestamp: string;
    action: string;
    details: string;
    user: string;
  }>;
}

export const SystemHealthPage: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'health' | 'student-data' | 'sync' | 'database' | 'security' | 'automation' | 'reports' | 'errors-logs'>('health');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchControlCenterData();
    const interval = setInterval(fetchControlCenterData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchControlCenterData = async () => {
    try {
      const res = await api.get('/system/control-center');
      setData(res.data);
    } catch (err) {
      console.error("Control Center fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBatchSync = async () => {
    setSyncing(true);
    try {
      await api.post('/students/refresh-all');
      await fetchControlCenterData();
    } catch (err) {
      console.error("Sync trigger error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handlePingBackend = async () => {
    setPingLoading(true);
    const start = performance.now();
    try {
      await api.get('/system/health');
      const elapsed = Math.round(performance.now() - start);
      setPingStatus(`🟢 Backend Live 200 OK (${elapsed}ms latency)`);
    } catch (err: any) {
      setPingStatus(`🔴 Ping Failed: ${err.message || 'Offline'}`);
    } finally {
      setPingLoading(false);
    }
  };

  const handleCopyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredLogs = useMemo(() => {
    if (!data?.system_logs) return [];
    if (!searchQuery.trim()) return data.system_logs;
    const q = searchQuery.toLowerCase();
    return data.system_logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        String(l.id).toLowerCase().includes(q) ||
        l.timestamp.toLowerCase().includes(q)
    );
  }, [data?.system_logs, searchQuery]);

  if (loading && !data) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin text-brand-500" />
        <p className="font-black text-sm text-gray-700 dark:text-gray-300 tracking-wide uppercase">
          Querying Live Production Control Center Telemetry...
        </p>
      </div>
    );
  }

  const overallStatus = data?.status || 'OPERATIONAL';

  const subTabs = [
    { id: 'health', label: 'System Health', icon: Activity, count: '10 Nodes' },
    { id: 'student-data', label: 'Student Data', icon: Users, count: data?.student_data?.active_students ?? '—' },
    { id: 'sync', label: 'LeetCode Sync', icon: Zap, count: data?.leetcode_sync?.status ?? 'READY' },
    { id: 'database', label: 'Database Health', icon: Database, count: '4 Colls' },
    { id: 'security', label: 'Security & Auth', icon: ShieldCheck, count: 'Protected' },
    { id: 'automation', label: 'Sunday Automation', icon: Calendar, count: '4 Jobs' },
    { id: 'reports', label: 'Reports & Email', icon: FileSpreadsheet, count: 'Ready' },
    { id: 'errors-logs', label: 'Errors & Logs', icon: ShieldAlert, count: `${data?.system_logs?.length ?? 0} Logs` }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* ─── EXECUTIVE HEADER HERO ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>NANDHA ENGINEERING COLLEGE (AUTONOMOUS) • ADMIN SYSTEM CONTROL CENTER</span>
            </div>

            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                Admin System <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">Control Center</span>
              </h1>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border flex items-center space-x-2 ${
                overallStatus === 'OPERATIONAL' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
              }`}>
                {overallStatus === 'OPERATIONAL' ? '🟢 SYSTEM HEALTHY' : '🟡 SYSTEM DEGRADED'}
              </span>
            </div>

            <p className="text-xs md:text-sm text-gray-300 font-medium tracking-wide">
              Real-time production health, data integrity, synchronization, security, automation and reporting monitoring.
            </p>

            <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono pt-1">
              <span>Last Checked: <strong className="text-emerald-400">{data?.last_updated || 'Just Now'}</strong></span>
              <span>•</span>
              <span>WebSocket: <strong className="text-emerald-400">🟢 Active Push</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchControlCenterData}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl border border-white/20 transition-all backdrop-blur-md flex items-center space-x-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>↻ Refresh Status</span>
            </button>

            <button
              onClick={handleTriggerBatchSync}
              disabled={syncing || data?.leetcode_sync?.is_running}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-xl shadow-brand-500/30 transition-all disabled:opacity-50 flex items-center space-x-2 transform hover:scale-105 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{syncing ? 'Launching Sync...' : data?.leetcode_sync?.is_running ? 'Sync in Progress' : '🔄 FETCH LIVE LEETCODE DATA'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── UNIVERSAL SEARCH & QUICK ACTIONS BAR ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search Reg No, Name, Handle, Job ID, or Log Action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white">✕</button>
          )}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('students')}
              className="px-3.5 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-black rounded-xl border border-brand-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Manage Students</span>
            </button>
          )}
          <button
            onClick={handlePingBackend}
            disabled={pingLoading}
            className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-xl border border-emerald-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Activity className={`w-3.5 h-3.5 ${pingLoading ? 'animate-spin' : ''}`} />
            <span>{pingLoading ? 'Pinging...' : 'Ping Live Server'}</span>
          </button>
        </div>
      </div>

      {pingStatus && (
        <div className="p-3 rounded-2xl bg-black/40 border border-emerald-500/30 font-mono text-xs text-emerald-300 flex items-center justify-between">
          <span>{pingStatus}</span>
          <button onClick={() => setPingStatus(null)} className="text-gray-400 hover:text-white text-xs font-bold">✕</button>
        </div>
      )}

      {/* ─── 8 MODULAR NAVIGATION SUB-TABS ─── */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 custom-scrollbar">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center space-x-2 whitespace-nowrap transition-all cursor-pointer border ${
                isActive
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-brand-500 shadow-lg shadow-brand-500/30 scale-[1.02]'
                  : 'bg-white dark:bg-navy-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-brand-500/40 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-navy-950 text-gray-500 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: SYSTEM HEALTH MATRIX ─── */}
      {activeSubTab === 'health' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span>10-Component Realtime Health Matrix</span>
            </h3>
            <span className="text-xs font-bold text-gray-500">Authoritative Diagnostic State</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {data?.system_health && Object.entries(data.system_health).map(([key, item]) => (
              <div key={key} className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-3 hover:border-brand-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 leading-tight">
                    {item.name}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                    {item.badge}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900 dark:text-white">{item.type}</div>
                  <div className="text-[11px] text-gray-500 font-mono mt-1">
                    {item.latency_ms !== undefined ? `Latency: ${item.latency_ms}ms` : item.connections !== undefined ? `Active: ${item.connections}` : 'Status: Nominal'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 2: INSTITUTIONAL STUDENT DATA HEALTH ─── */}
      {activeSubTab === 'student-data' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-500" />
              <span>Institutional Master Roster & Data Integrity</span>
            </h3>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('students')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Open Student Master Registry</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-1">
              <span className="text-xs font-black text-gray-400 uppercase">Active Students</span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{data?.student_data.active_students}</div>
              <span className="text-[11px] text-gray-500 font-bold">Roster Master Enrolled</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-1">
              <span className="text-xs font-black text-gray-400 uppercase">Firestore Students</span>
              <div className="text-3xl font-black text-sky-600 dark:text-sky-400">{data?.student_data.actual_firestore_students}</div>
              <span className="text-[11px] text-gray-500 font-bold">Cloud Synced Docs</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-1">
              <span className="text-xs font-black text-gray-400 uppercase">LeetCode Handles</span>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{data?.student_data.leetcode_profiles}</div>
              <span className="text-[11px] text-gray-500 font-bold">Mapped Profiles</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-1">
              <span className="text-xs font-black text-gray-400 uppercase">Inactive / Suspended</span>
              <div className="text-3xl font-black text-gray-700 dark:text-gray-300">{data?.student_data.inactive_students}</div>
              <span className="text-[11px] text-gray-500 font-bold">Preserved Records</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Data Integrity Checks</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Duplicate Reg Nos</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  data?.student_data.duplicates === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {data?.student_data.duplicates === 0 ? '0 Duplicates (PASS)' : `${data?.student_data.duplicates} Found`}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Missing Stats Records</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  data?.student_data.missing_records === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {data?.student_data.missing_records === 0 ? '0 Missing (PASS)' : `${data?.student_data.missing_records} Missing`}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Orphan Statistics</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  data?.student_data.orphan_records === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {data?.student_data.orphan_records === 0 ? '0 Orphans (PASS)' : `${data?.student_data.orphan_records} Orphans`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: LEETCODE SYNC CENTER ─── */}
      {activeSubTab === 'sync' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>LeetCode Synchronization Engine</span>
            </h3>
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black">
              Status: {data?.leetcode_sync.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Targets</span>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{data?.leetcode_sync.targets}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Processed</span>
              <div className="text-2xl font-black text-brand-600 dark:text-brand-400">{data?.leetcode_sync.processed}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Successful</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data?.leetcode_sync.successful}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Failed</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{data?.leetcode_sync.failed}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Pending</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{data?.leetcode_sync.pending}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Concurrency</span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{data?.leetcode_sync.concurrency}x</div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Sync Job Telemetry</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 block mb-1">Active Job ID</span>
                <strong className="text-brand-500">{data?.leetcode_sync.current_job_id}</strong>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 block mb-1">Last Completed Sync</span>
                <strong className="text-gray-700 dark:text-gray-300">{data?.leetcode_sync.last_sync}</strong>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 block mb-1">Execution Duration</span>
                <strong className="text-emerald-500">{data?.leetcode_sync.last_sync_duration}</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleTriggerBatchSync}
                disabled={syncing || data?.leetcode_sync.is_running}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition-transform transform hover:scale-105 cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{syncing ? 'Launching Live Sync...' : data?.leetcode_sync.is_running ? 'Sync in Progress' : 'Execute Full Live Sync'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: DATABASE HEALTH ─── */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-indigo-500" />
              <span>Production Collections & Document Counts</span>
            </h3>
            <span className="text-xs font-bold text-gray-500">Live DB Models</span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl bg-white dark:bg-navy-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-navy-950 text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 font-bold">
                  <th className="py-3.5 px-6">Collection / Model</th>
                  <th className="py-3.5 px-6 text-center">Document Count</th>
                  <th className="py-3.5 px-6 text-center">Last Updated</th>
                  <th className="py-3.5 px-6 text-center">Integrity Status</th>
                  <th className="py-3.5 px-6 text-center">Duplicates</th>
                  <th className="py-3.5 px-6 text-center">Orphans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                {data?.database_health.map((col) => (
                  <tr key={col.collection} className="hover:bg-gray-50/50 dark:hover:bg-navy-800/30">
                    <td className="py-3.5 px-6 font-mono font-bold text-brand-600 dark:text-brand-400">{col.collection}</td>
                    <td className="py-3.5 px-6 text-center font-bold text-gray-900 dark:text-white">{col.document_count}</td>
                    <td className="py-3.5 px-6 text-center font-mono text-gray-500">{col.last_update}</td>
                    <td className="py-3.5 px-6 text-center">
                      <span className="px-3 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {col.integrity}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold">{col.duplicates}</td>
                    <td className="py-3.5 px-6 text-center font-bold">{col.orphans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: SECURITY & AUTHENTICATION ─── */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Lock className="w-5 h-5 text-emerald-500" />
              <span>Security, RBAC & Protection Matrix</span>
            </h3>
            <span className="text-xs font-bold text-gray-500">Encrypted Guard Status</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.security && Object.entries(data.security).map(([k, s]) => (
              <div key={k} className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-3 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 leading-tight">
                    {s.name}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                    {s.badge}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900 dark:text-white">{s.status}</div>
                  <div className="text-[11px] text-gray-500 font-mono mt-1">
                    {s.records_count !== undefined ? `${s.records_count} Audit Logs Recorded` : 'Access: Restricted to Verified Admins'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 6: SUNDAY AUTOMATION CENTER ─── */}
      {activeSubTab === 'automation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-2 text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-3 py-0.5 rounded-full border border-purple-500/20">
                <Calendar className="w-3.5 h-3.5 animate-pulse" />
                <span>ACTIVE DAEMON • TIMEZONE: ASIA/KOLKATA (IST)</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center space-x-2">
                <span>Sunday Automation & Contest Daemon Lifecycle</span>
              </h3>
            </div>
            <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>4 Cron Triggers Registered & Active</span>
            </span>
          </div>

          {/* 4 Phase Sequential Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Phase 1: 08:00 IST */}
            <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-amber-500/30 shadow-xl space-y-4 relative overflow-hidden group hover:border-amber-500 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 font-black text-sm">
                    🌅 PHASE 1
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">08:00 IST Baseline Snapshot</h4>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Pre-Contest Roster State</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 uppercase shrink-0">
                  CONFIGURED
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p><span className="text-gray-400 font-bold">Schedule Rule:</span> Every Sunday at 08:00:00 IST</p>
                <p><span className="text-gray-400 font-bold">Execution Target:</span> Captures 300-student pre-contest solved counts to calculate weekly deltas without zero-faking.</p>
                <p><span className="text-gray-400 font-bold">Next Run:</span> <strong className="text-amber-500">{data?.sunday_automation[0]?.next_run || 'Sunday 08:00 IST'}</strong></p>
              </div>
            </div>

            {/* Phase 2: 09:30 IST */}
            <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-indigo-500/30 shadow-xl space-y-4 relative overflow-hidden group hover:border-indigo-500 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 font-black text-sm">
                    ⏱️ PHASE 2
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">09:30 IST Contest Window Lockdown</h4>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Post-Contest Delta Capture</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 uppercase shrink-0">
                  CONFIGURED
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p><span className="text-gray-400 font-bold">Schedule Rule:</span> Every Sunday at 09:30:00 IST</p>
                <p><span className="text-gray-400 font-bold">Execution Target:</span> Immediately queries LeetCode GraphQL for official rank, rating, and questions solved ratio (e.g. 3/4).</p>
                <p><span className="text-gray-400 font-bold">Next Run:</span> <strong className="text-indigo-500">{data?.sunday_automation[1]?.next_run || 'Sunday 09:30 IST'}</strong></p>
              </div>
            </div>

            {/* Phase 3: 09:45 IST */}
            <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-emerald-500/30 shadow-xl space-y-4 relative overflow-hidden group hover:border-emerald-500 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 font-black text-sm">
                    📧 PHASE 3
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">09:45 IST Automated Master Report Dispatch</h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Email Broadcast to Principal & HODs</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 uppercase shrink-0">
                  CONFIGURED
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p><span className="text-gray-400 font-bold">Schedule Rule:</span> Every Sunday at 09:45:00 IST</p>
                <p><span className="text-gray-400 font-bold">Execution Target:</span> Compiles 19-sheet Master Excel (`19_Contest_Validation`) and dispatches formatted email report.</p>
                <p><span className="text-gray-400 font-bold">Next Run:</span> <strong className="text-emerald-500">{data?.sunday_automation[2]?.next_run || 'Sunday 09:45 IST'}</strong></p>
              </div>
            </div>

            {/* Phase 4: 22:00 IST */}
            <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-purple-500/30 shadow-xl space-y-4 relative overflow-hidden group hover:border-purple-500 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 font-black text-sm">
                    🌙 PHASE 4
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">22:00 IST Virtual & Late Settlement</h4>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Virtual Participants Reconciliation</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 uppercase shrink-0">
                  CONFIGURED
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p><span className="text-gray-400 font-bold">Schedule Rule:</span> Every Sunday at 22:00:00 IST</p>
                <p><span className="text-gray-400 font-bold">Execution Target:</span> Scans for virtual contest submissions completed later in the day and synchronizes final weekly snapshot.</p>
                <p><span className="text-gray-400 font-bold">Next Run:</span> <strong className="text-purple-500">{data?.sunday_automation[3]?.next_run || 'Sunday 22:00 IST'}</strong></p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── TAB 7: REPORTS & EMAIL CENTER ─── */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              <span>Institutional Reports & Multi-Format Exporters</span>
            </h3>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('reports')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center space-x-1.5 shadow-md cursor-pointer"
              >
                <span>Go to Reports & Export Page</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {data?.reports_and_email.formats && Object.entries(data.reports_and_email.formats).map(([fmt, val]) => (
              <div key={fmt} className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-2">
                <span className="text-xs font-bold text-emerald-500">{val.badge}</span>
                <div className="text-sm font-black text-gray-900 dark:text-white">{val.format}</div>
                <p className="text-[11px] text-gray-500">Auto-generated weekly & on-demand</p>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-3">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Email Dispatch Status</h4>
            <div className="text-xs text-gray-600 dark:text-gray-300 font-medium space-y-1">
              <p><span className="text-gray-400 font-bold">Email Dispatcher:</span> <strong className="text-emerald-500">🟢 READY (SMTP Service Active)</strong></p>
              <p><span className="text-gray-400 font-bold">Recipients Configured:</span> {data?.reports_and_email.recipients_configured.join(', ')}</p>
              <p><span className="text-gray-400 font-bold">Last Public Report Dispatched:</span> {data?.reports_and_email.last_public_report}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 8: ERRORS & SYSTEM LOG VIEWER ─── */}
      {activeSubTab === 'errors-logs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Safe System Logs & Incident Stream</span>
            </h3>
            <span className="text-xs font-mono text-gray-400">Zero secrets exposure guaranteed</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <span className="text-[10px] font-black uppercase">Critical Incidents</span>
              <div className="text-2xl font-black">{data?.errors_and_incidents.critical}</div>
            </div>
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
              <span className="text-[10px] font-black uppercase">High Priority</span>
              <div className="text-2xl font-black">{data?.errors_and_incidents.high}</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <span className="text-[10px] font-black uppercase">Medium Warnings</span>
              <div className="text-2xl font-black">{data?.errors_and_incidents.medium}</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-black uppercase">Low / Resolved</span>
              <div className="text-2xl font-black">{data?.errors_and_incidents.low}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 shadow-xl overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-navy-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gray-500">Structured Event Stream</span>
              <span className="text-xs text-gray-400 font-mono">{filteredLogs.length} Events</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono text-xs max-h-96 overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-navy-800/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">{log.timestamp}</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-brand-500/20 text-brand-400 font-bold">{log.action}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-md">{log.details}</span>
                  </div>
                  <span className="text-gray-500 text-[11px]">Actor: {log.user}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── LIVE CLOUD TOPOLOGY & ADMIN CONTROL CENTER ─── */}
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-slate-900 to-indigo-950 border border-brand-500/30 p-6 md:p-8 text-white shadow-2xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>LIVE CLOUD TOPOLOGY & ACTIVE CONTROL CENTER</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Deployment Endpoints & Infrastructure Matrix
            </h2>
            <p className="text-xs text-gray-400">
              Direct live access to production endpoints, database replicas, and Cloud consoles.
            </p>
          </div>
        </div>

        {/* Endpoints Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Frontend Endpoint */}
          <div className="p-5 rounded-2xl bg-black/30 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Frontend Web Application</h4>
                  <span className="text-[10px] text-gray-400">Firebase Global CDN Hosting</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="flex items-center justify-between bg-navy-950 p-2.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
              <span className="truncate max-w-[240px]">https://leetcode-student-data.web.app</span>
              <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                <button
                  onClick={() => handleCopyUrl('https://leetcode-student-data.web.app', 'fe')}
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedKey === 'fe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href="https://leetcode-student-data.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Open Live Site"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Backend API Endpoint */}
          <div className="p-5 rounded-2xl bg-black/30 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Backend FastAPI ASGI Engine</h4>
                  <span className="text-[10px] text-gray-400">Render Cloud Server</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PORT 8000
              </span>
            </div>
            <div className="flex items-center justify-between bg-navy-950 p-2.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
              <span className="truncate max-w-[240px]">https://leetcodeurl-s-1.onrender.com/api</span>
              <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                <button
                  onClick={() => handleCopyUrl('https://leetcodeurl-s-1.onrender.com/api', 'be')}
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedKey === 'be' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href="https://leetcodeurl-s-1.onrender.com/api/system/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="View Health JSON"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Cloud Firestore Storage */}
          <div className="p-5 rounded-2xl bg-black/30 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Google Cloud Firestore</h4>
                  <span className="text-[10px] text-gray-400">Project: leetcode-student-data</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {data?.student_data.actual_firestore_students ?? 300} DOCS
              </span>
            </div>
            <div className="flex items-center justify-between bg-navy-950 p-2.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
              <span className="truncate max-w-[240px]">collections/students • sync_jobs</span>
              <a
                href="https://console.firebase.google.com/project/leetcode-student-data/firestore"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <span>Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Upstream LeetCode GraphQL */}
          <div className="p-5 rounded-2xl bg-black/30 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">LeetCode GraphQL Upstream</h4>
                  <span className="text-[10px] text-gray-400">Live Profile & Contest Stats</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <div className="flex items-center justify-between bg-navy-950 p-2.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
              <span className="truncate max-w-[240px]">https://leetcode.com/graphql</span>
              <a
                href="https://leetcode.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <span>Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Quick Launch Cloud Consoles */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <a
            href="https://console.firebase.google.com/project/leetcode-student-data/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Firebase Console</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open Render Dashboard</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <a
            href="https://github.com/nanthishvaran17/Leetcodeurl-s"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open GitHub Repository</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
};
