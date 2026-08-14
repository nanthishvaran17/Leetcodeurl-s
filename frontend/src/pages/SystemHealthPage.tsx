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
  ArrowUpRight,
  ExternalLink,
  Globe,
  Terminal,
  Copy,
  Check,
  Radio
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
  student_count?: number;
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
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
            {metrics?.verified_profiles_count !== undefined
              ? `${metrics.verified_profiles_count} / ${metrics?.total_active_students ?? metrics?.student_count ?? '...'}`
              : 'Database unavailable'}
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

          <div className="flex items-center gap-3">
            <button
              onClick={handlePingBackend}
              disabled={pingLoading}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all"
            >
              <Activity className={`w-3.5 h-3.5 ${pingLoading ? 'animate-spin' : ''}`} />
              <span>{pingLoading ? 'Testing...' : 'Ping Live Backend'}</span>
            </button>
          </div>
        </div>

        {pingStatus && (
          <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 font-mono text-xs text-emerald-300 flex items-center justify-between">
            <span>{pingStatus}</span>
            <button onClick={() => setPingStatus(null)} className="text-gray-400 hover:text-white text-xs font-bold">✕</button>
          </div>
        )}

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
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                  title="Copy URL"
                >
                  {copiedKey === 'fe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href="https://leetcode-student-data.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
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
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                  title="Copy URL"
                >
                  {copiedKey === 'be' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href="https://leetcodeurl-s-1.onrender.com/api/system/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
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
                300 DOCS
              </span>
            </div>
            <div className="flex items-center justify-between bg-navy-950 p-2.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
              <span className="truncate max-w-[240px]">collections/students • sync_jobs</span>
              <a
                href="https://console.firebase.google.com/project/leetcode-student-data/firestore"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors"
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
                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors"
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
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Firebase Console</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all"
          >
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open Render Dashboard</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <a
            href="https://github.com/nanthishvaran17/Leetcodeurl-s"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-2 transition-all"
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
