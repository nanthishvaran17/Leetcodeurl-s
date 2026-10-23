import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, X, Database } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const OfflineIndicatorBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Check connectivity by pinging an ultra-lightweight endpoint or testing navigator
  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      return false;
    }
    try {
      setIsRetrying(true);
      // Small fast health check / ping
      const res = await fetch('/api/public/stats', {
        method: 'HEAD',
        cache: 'no-store'
      }).catch(() => null);

      if (res && (res.ok || res.status < 500)) {
        setIsOffline(false);
        setIsDismissed(false);
        triggerHaptic('success');
        return true;
      } else {
        // If server is unreachable
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setIsOffline(true);
        }
        return false;
      }
    } catch (_e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
      }
      return false;
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsDismissed(false);
      setShowReconnected(true);
      triggerHaptic('success');

      // Dispatch global re-sync event so active views can silently refresh
      window.dispatchEvent(new CustomEvent('app_online_resync'));

      // Auto-hide the "Back Online" message after 3.2 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3200);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsDismissed(false);
      setShowReconnected(false);
      triggerHaptic('warning');
    };

    // Custom network error event dispatched by api.ts when network fails
    const handleApiNetworkError = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('api_network_offline', handleApiNetworkError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('api_network_offline', handleApiNetworkError);
    };
  }, []);

  // Neither offline nor showing reconnected message
  if ((!isOffline && !showReconnected) || (isOffline && isDismissed)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[100] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md pointer-events-none transition-all duration-300 animate-slide-down top-[max(0.75rem,env(safe-area-inset-top,0.75rem))]"
    >
      <div
        className={`pointer-events-auto rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl border transition-all flex items-center justify-between gap-3 ${
          showReconnected
            ? 'bg-emerald-950/95 dark:bg-emerald-950/95 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
            : 'bg-slate-900/95 dark:bg-navy-950/95 border-amber-500/40 text-slate-100 shadow-black/50'
        }`}
      >
        {/* Left: Animated Status Icon & Details */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              showReconnected
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {showReconnected ? (
              <Wifi className="w-4.5 h-4.5 animate-pulse" />
            ) : (
              <WifiOff className="w-4.5 h-4.5 animate-bounce-subtle" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black tracking-wide truncate">
                {showReconnected ? 'Back Online' : "You're Offline"}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black uppercase tracking-wider border ${
                  showReconnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                <Database className="w-2.5 h-2.5 shrink-0" />
                {showReconnected ? 'Synced' : 'Cached Mode'}
              </span>
            </div>

            <p className="text-[10.5px] font-medium text-slate-300 dark:text-slate-400 truncate">
              {showReconnected
                ? 'Syncing latest live rankings & updates...'
                : 'Showing saved roster & offline records smoothly'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!showReconnected && (
            <button
              type="button"
              onClick={checkConnectivity}
              disabled={isRetrying}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer touch-manipulation disabled:opacity-50"
              title="Test connection and retry"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin text-amber-300' : 'text-amber-300'}`} />
              <span>{isRetrying ? 'Checking...' : 'Retry'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer touch-manipulation"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
