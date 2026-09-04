import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { snapshotSyncService, SnapshotVersionInfo } from '../services/snapshotSyncService';

const APP_BUILD_VERSION_KEY = 'nec_app_build_version';
// Current app deployment revision timestamp
const CURRENT_BUILD_TIMESTAMP = '2026-09-04-v2.0.1-fixed';

export const AppUpdateNotifier: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<{ title: string; detail: string; version?: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initial build version validation
    const savedVersion = localStorage.getItem(APP_BUILD_VERSION_KEY);
    if (!savedVersion) {
      localStorage.setItem(APP_BUILD_VERSION_KEY, CURRENT_BUILD_TIMESTAMP);
    } else if (savedVersion !== CURRENT_BUILD_TIMESTAMP) {
      // Version updated from a previous session
      localStorage.setItem(APP_BUILD_VERSION_KEY, CURRENT_BUILD_TIMESTAMP);
    }

    // 2. Subscribe to Snapshot Sync Service (authoritative backend dataset updates)
    const unsubscribeSnapshot = snapshotSyncService.subscribe((info: SnapshotVersionInfo) => {
      setUpdateInfo({
        title: 'New Contest Dataset Published!',
        detail: `Session ${info.contest_name || 'Weekly Contest'} snapshot (v${info.data_version}) is live.`,
        version: `v${info.data_version}`
      });
      setUpdateAvailable(true);
    });

    // 3. Service Worker / PWA update listener (if PWA service worker is registered)
    const handleSWUpdate = () => {
      setUpdateInfo({
        title: 'New App Version Available!',
        detail: 'A new frontend update has been deployed. Reload to load the latest features.',
        version: 'v2.0.1'
      });
      setUpdateAvailable(true);
    };

    window.addEventListener('sw_update_available', handleSWUpdate);

    // 4. Periodic lightweight version check (every 45s) comparing index HTML last-modified or build ETag
    const versionCheckInterval = setInterval(async () => {
      try {
        const response = await fetch('/index.html', { method: 'HEAD', cache: 'no-cache' });
        const etag = response.headers.get('etag') || response.headers.get('last-modified');
        const storedEtag = sessionStorage.getItem('app_index_etag');
        if (storedEtag && etag && storedEtag !== etag) {
          setUpdateInfo({
            title: 'New System Update Available!',
            detail: 'Nandha Engineering College app has been updated. Click to apply improvements.',
            version: 'Latest'
          });
          setUpdateAvailable(true);
        } else if (etag) {
          sessionStorage.setItem('app_index_etag', etag);
        }
      } catch (_e) {
        // Silent fail
      }
    }, 45000);

    return () => {
      unsubscribeSnapshot();
      window.removeEventListener('sw_update_available', handleSWUpdate);
      clearInterval(versionCheckInterval);
    };
  }, []);

  const handleApplyUpdate = () => {
    setIsUpdating(true);
    localStorage.setItem(APP_BUILD_VERSION_KEY, CURRENT_BUILD_TIMESTAMP);
    
    // Clear dynamic session cache key to ensure fresh assets load
    sessionStorage.clear();
    
    // Smooth reload to immediately apply new build bundle
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-md w-full px-4 animate-slide-down">
      <div className="bg-gradient-to-r from-slate-950 via-navy-950 to-indigo-950 text-white rounded-3xl p-5 shadow-2xl border border-brand-500/40 backdrop-blur-xl relative overflow-hidden">
        {/* Glow accent decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-brand-500/20 rounded-full blur-xl pointer-events-none" />
        
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3.5 pr-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 p-0.5 shadow-lg shrink-0 flex items-center justify-center animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <h4 className="text-sm font-black text-white tracking-tight">
                {updateInfo?.title || 'System Update Available!'}
              </h4>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                {updateInfo?.version || 'v2.0.1'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {updateInfo?.detail || 'Click below to instantly refresh and apply the latest performance updates.'}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nandha Engineering College</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-brand-500/30 transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Updating...' : 'Update App Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
