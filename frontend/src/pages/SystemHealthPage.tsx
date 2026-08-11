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
  Server
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
    if (status === 'OPERATIONAL' || status === 'HEALTHY' || status === 'RUNNING') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{status}</span>
        </span>
      );
    }
    if (status === 'BUSY' || status === 'DEGRADED') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold space-x-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{status}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold space-x-1">
        <XCircle className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl bg-gradient-to-r from-navy-950 via-slate-900 to-navy-900 border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Institutional Operations & Monitoring</span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Activity className="w-7 h-7 text-emerald-400" />
              System Health & Data Truth Center
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Live status monitoring for SQLite DB, Cloud Firestore, APScheduler cron workers, identity validation, and sync progress.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchHealthAndMetrics}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleTriggerBatchSync}
              disabled={syncing || metrics?.sync_tracker?.is_running}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{syncing ? 'Launching Sync...' : metrics?.sync_tracker?.is_running ? 'Sync in Progress' : 'Start Live Batch Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Database className="w-4 h-4 text-brand-400" />
              <span>Database Engine</span>
            </div>
            {renderStatusBadge(health?.components.database.status || 'CHECKING')}
          </div>
          <p className="text-xs text-gray-400">SQLAlchemy SQLite / Postgres store holding 273 verified student profiles.</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Cloud className="w-4 h-4 text-sky-400" />
              <span>Cloud Firestore</span>
            </div>
            {renderStatusBadge(health?.components.firestore.status || 'CHECKING')}
          </div>
          <p className="text-xs text-gray-400">Google Cloud Firestore realtime stats & pre-calculated leaderboards.</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>APScheduler Cron</span>
            </div>
            {renderStatusBadge(health?.components.scheduler.status || 'CHECKING')}
          </div>
          <p className="text-xs text-gray-400">Sunday session (08:00–09:30 AM IST) & 2-hour auto-sync triggers.</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Sync Engine Lock</span>
            </div>
            {renderStatusBadge(health?.components.sync_engine.status || 'CHECKING')}
          </div>
          <p className="text-xs text-gray-400">Concurrency protection ensuring 1 active sync worker at a time.</p>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
          <div className="text-xs text-gray-400 font-semibold mb-1">Data Accuracy Rate</div>
          <div className="text-3xl font-black text-emerald-400">
            {metrics?.data_accuracy_rate_percentage ?? 0}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Verified against LeetCode GraphQL</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-gray-800">
          <div className="text-xs text-gray-400 font-semibold mb-1">Verified Student Profiles</div>
          <div className="text-3xl font-black text-white">
            {metrics?.verified_profiles_count ?? 0} / {metrics?.total_active_students ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Strict identity mapped</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-500/20 bg-rose-950/10">
          <div className="text-xs text-gray-400 font-semibold mb-1">Failed Sync Retries</div>
          <div className="text-3xl font-black text-rose-400">
            {metrics?.failed_sync_count ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Old verified data preserved</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-950/10">
          <div className="text-xs text-gray-400 font-semibold mb-1">Identity Mismatches</div>
          <div className="text-3xl font-black text-amber-400">
            {metrics?.identity_mismatch_count ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Flagged for URL verification</div>
        </div>
      </div>
    </div>
  );
};
