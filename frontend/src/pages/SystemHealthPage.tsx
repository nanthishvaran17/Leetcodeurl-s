import React, { useState, useEffect } from 'react';
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
  ArrowUpRight
} from 'lucide-react';
import api from '../services/api';

interface HealthData {
  status: string;
  timestamp: string;
  environment: string;
  components: {
    database: { status: string; type: string };
    firestore: { status: string; type: string };
    scheduler: { status: string; type: string };
    sync_engine: { status: string; run_id: string | null };
  };
}

interface MetricsData {
  total_active_students: number;
  verified_profiles_count: number;
  failed_sync_count: number;
  identity_mismatch_count: number;
  pending_sync_count: number;
  data_accuracy_rate_percentage: number;
  latest_weekly_session: {
    week_number: number | null;
    session_date: string | null;
    status: string;
  };
  sync_tracker: any;
}

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    fetchHealthAndMetrics();
    const interval = setInterval(fetchHealthAndMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthAndMetrics = async () => {
    try {
      const [hRes, mRes] = await Promise.all([
        api.get('/system/health'),
        api.get('/system/metrics')
      ]);
      setHealth(hRes.data);
      setMetrics(mRes.data);
    } catch (err) {
      console.error("Health fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBatchSync = async () => {
    setSyncing(true);
    try {
      await api.post('/students/refresh-all');
      await fetchHealthAndMetrics();
    } catch (err) {
      console.error("Sync trigger error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const isOk = status === 'OPERATIONAL' || status === 'HEALTHY' || status === 'RUNNING';
    const isWarn = status === 'BUSY' || status === 'DEGRADED';

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider space-x-1.5 shadow-sm ${
        isOk ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' :
        isWarn ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400' :
        'bg-rose-500/20 border border-rose-500/30 text-rose-400'
      }`}>
        {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : isWarn ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        <span>{status}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Evaluating System Health & Component Status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Hero Banner with Rich Styling */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>INSTITUTIONAL OPERATIONS & MONITORING • REALTIME HEALTH MATRIX</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              System Health & <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">Data Truth Center</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Live status monitoring for SQLite DB, Cloud Firestore, APScheduler cron workers, identity validation, and sync progress.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchHealthAndMetrics}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl border border-white/20 transition-all backdrop-blur-md flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={handleTriggerBatchSync}
              disabled={syncing || metrics?.sync_tracker?.is_running}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-xl shadow-brand-500/30 transition-all disabled:opacity-50 flex items-center space-x-2 transform hover:scale-105"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{syncing ? 'Launching Sync...' : metrics?.sync_tracker?.is_running ? 'Sync in Progress' : 'Start Live Batch Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl hover:border-brand-500/50 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
              <Database className="w-6 h-6" />
            </div>
            {renderStatusBadge(health?.components.database.status || 'CHECKING')}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">Database Engine</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
              SQLAlchemy SQLite / Postgres store holding 273 verified student profiles.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl hover:border-sky-500/50 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500">
              <Cloud className="w-6 h-6" />
            </div>
            {renderStatusBadge(health?.components.firestore.status || 'CHECKING')}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">Cloud Firestore</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
              Google Cloud Firestore realtime stats & pre-calculated leaderboards.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl hover:border-amber-500/50 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <Clock className="w-6 h-6" />
            </div>
            {renderStatusBadge(health?.components.scheduler.status || 'CHECKING')}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">APScheduler Cron</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
              Sunday session (08:00–09:30 AM IST) & 2-hour auto-sync triggers.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl hover:border-emerald-500/50 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Cpu className="w-6 h-6" />
            </div>
            {renderStatusBadge(health?.components.sync_engine.status || 'CHECKING')}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">Sync Engine Lock</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
              Concurrency protection ensuring 1 active sync worker at a time.
            </p>
          </div>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 shadow-lg">
          <div className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-1">Data Accuracy Rate</div>
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
            {metrics?.data_accuracy_rate_percentage ?? 100}%
          </div>
          <div className="text-[11px] text-gray-500 font-bold mt-1">Verified against LeetCode GraphQL</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg">
          <div className="text-xs font-black uppercase text-gray-400 tracking-wider mb-1">Verified Roster Profiles</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">
            {metrics?.verified_profiles_count ?? 0} / {metrics?.total_active_students ?? 273}
          </div>
          <div className="text-[11px] text-gray-500 font-bold mt-1">Strict identity mapped</div>
        </div>

        <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 shadow-lg">
          <div className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider mb-1">Failed Sync Retries</div>
          <div className="text-3xl font-black text-rose-700 dark:text-rose-300">
            {metrics?.failed_sync_count ?? 0}
          </div>
          <div className="text-[11px] text-gray-500 font-bold mt-1">Old verified data preserved</div>
        </div>

        <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-lg">
          <div className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-1">Identity Mismatches</div>
          <div className="text-3xl font-black text-amber-700 dark:text-amber-300">
            {metrics?.identity_mismatch_count ?? 0}
          </div>
          <div className="text-[11px] text-gray-500 font-bold mt-1">Flagged for URL verification</div>
        </div>
      </div>
    </div>
  );
};
