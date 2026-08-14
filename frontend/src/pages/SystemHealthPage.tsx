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
  checked_at?: string;
  request_id?: string;
  environment: string;
  components: any;
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
    const isOk = status === 'OPERATIONAL' || status === 'HEALTHY' || status === 'RUNNING' || status === 'READY' || status === 'IDLE';
    const isWarn = status === 'DEGRADED' || status === 'SOURCE_UNAVAILABLE';

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

  const [selectedTechDetail, setSelectedTechDetail] = useState<any>(null);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Evaluating System Health & Component Status...</p>
      </div>
    );
  }

  const overallStatus = health?.status || 'OPERATIONAL';
  const componentsList = health?.components ? Object.entries(health.components) : [];
  const failingComponents = componentsList.filter(([_, comp]: any) => comp?.error === true || comp?.status === 'DOWN' || comp?.status === 'SOURCE_UNAVAILABLE' || comp?.status === 'STOPPED');

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>INSTITUTIONAL OPERATIONS & MONITORING • REALTIME HEALTH MATRIX</span>
            </div>

            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                System Health & <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">Data Truth Center</span>
              </h1>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border flex items-center space-x-2 ${
                overallStatus === 'OPERATIONAL' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                overallStatus === 'DEGRADED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse' :
                'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
              }`}>
                {overallStatus === 'OPERATIONAL' ? '🟢 SYSTEM OPERATIONAL' : overallStatus === 'DEGRADED' ? '🟡 SYSTEM DEGRADED' : '🔴 SYSTEM HEALTH UNAVAILABLE'}
              </span>
            </div>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Request ID: <span className="font-mono text-amber-300">{health?.request_id || 'health_req_live'}</span> • Checked At: <span className="font-mono text-emerald-300">{health?.checked_at || 'Just Now'}</span>
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
        {componentsList.map(([key, comp]: any) => (
          <div key={key} className={`p-6 rounded-3xl bg-white dark:bg-navy-900 border shadow-xl transition-all space-y-4 ${
            comp?.error || comp?.status === 'DOWN' || comp?.status === 'SOURCE_UNAVAILABLE' || comp?.status === 'STOPPED'
              ? 'border-rose-500/50 dark:border-rose-500/30 bg-rose-500/5'
              : 'border-gray-200 dark:border-gray-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl ${
                key === 'database' ? 'bg-brand-500/10 text-brand-500' :
                key === 'firestore' ? 'bg-sky-500/10 text-sky-500' :
                key === 'leetcode_source' ? 'bg-amber-500/10 text-amber-500' :
                'bg-emerald-500/10 text-emerald-500'
              }`}>
                {key === 'database' ? <Database className="w-6 h-6" /> :
                 key === 'firestore' ? <Cloud className="w-6 h-6" /> :
                 key === 'leetcode_source' ? <Activity className="w-6 h-6" /> :
                 key === 'scheduler' ? <Clock className="w-6 h-6" /> :
                 <Cpu className="w-6 h-6" />}
              </div>
              {renderStatusBadge(comp?.status || 'OPERATIONAL')}
            </div>

            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">{comp?.name || key}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
                {comp?.message || `Status: ${comp?.status}`}
              </p>
            </div>

            {(comp?.error_code || comp?.action) && (
              <button
                onClick={() => setSelectedTechDetail({ key, ...comp })}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs border border-rose-500/20 flex items-center justify-center space-x-1 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>View Technical Error Details</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Active Failures & Diagnostic Error Panels */}
      {failingComponents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase text-rose-500 tracking-wider flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Active Subsystem Anomalies ({failingComponents.length} Component Warnings)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {failingComponents.map(([key, comp]: any) => (
              <div key={key} className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm uppercase text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                    <XCircle className="w-4 h-4" />
                    <span>{comp?.name || key}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded font-mono text-[11px] bg-rose-950 text-rose-300 border border-rose-800">
                    {comp?.error_code || 'DEGRADED_STATE'}
                  </span>
                </div>

                <div className="text-xs space-y-1 font-semibold">
                  <p><span className="font-black uppercase text-gray-500">Reason:</span> {comp?.message || 'Unresponsive'}</p>
                  <p><span className="font-black uppercase text-gray-500">Last Checked:</span> {comp?.last_checked || 'Just Now'}</p>
                  <p className="text-amber-600 dark:text-amber-300 font-bold"><span className="font-black uppercase text-gray-500">Recommended Action:</span> {comp?.action || 'Inspect server log file for correlation ID'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Details Modal */}
      {selectedTechDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Technical Error Details ({selectedTechDetail.name})</span>
              </h3>
              <button onClick={() => setSelectedTechDetail(null)} className="text-gray-400 hover:text-gray-600 font-black text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs font-mono bg-navy-950 text-gray-200 p-4 rounded-2xl border border-gray-800">
              <p><span className="text-brand-400">Request ID:</span> {health?.request_id}</p>
              <p><span className="text-brand-400">Component:</span> {selectedTechDetail.name}</p>
              <p><span className="text-rose-400">Error Code:</span> {selectedTechDetail.error_code || 'UNSPECIFIED_ERROR'}</p>
              <p><span className="text-amber-400">Sanitized Message:</span> {selectedTechDetail.message}</p>
              <p><span className="text-emerald-400">Last Checked:</span> {selectedTechDetail.last_checked}</p>
              <p><span className="text-sky-400">Action:</span> {selectedTechDetail.action}</p>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setSelectedTechDetail(null)} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl">
                Close Technical Details
              </button>
            </div>
          </div>
        </div>
      )}

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
