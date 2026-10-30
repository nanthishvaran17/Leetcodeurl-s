import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, X, Check } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { playAppleGlassChime } from '../utils/audioChime';

export const OfflineIndicatorBanner: React.FC = () => {
  // STRICT TRUTH: Only set isOffline initially if navigator explicitly reports false
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check connectivity by testing health ping
  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      triggerHaptic('warning');
      return false;
    }
    try {
      setIsRetrying(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        setIsOffline(false);
        setIsDismissed(false);
        setShowReconnected(true);
        triggerHaptic('success');
        try { playAppleGlassChime(); } catch {}

        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = setTimeout(() => {
          setShowReconnected(false);
        }, 2500);

        window.dispatchEvent(new CustomEvent('app_online_resync'));
        return true;
      } else {
        // Only mark offline if browser navigator also reports offline
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
    // When the browser comes online
    const handleOnline = () => {
      setIsOffline(false);
      setIsDismissed(false);
      setShowReconnected(true);
      triggerHaptic('success');
      try { playAppleGlassChime(); } catch {}

      // Dispatch global re-sync event so active views can silently refresh
      window.dispatchEvent(new CustomEvent('app_online_resync'));

      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      reconnectedTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 2500);
    };

    // When the browser goes offline
    const handleOffline = () => {
      setIsOffline(true);
      setIsDismissed(false);
      setShowReconnected(false);
      triggerHaptic('warning');
    };

    // Custom network error event dispatched by api.ts - ONLY when genuinely offline
    const handleApiNetworkError = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
        setIsDismissed(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('api_network_offline', handleApiNetworkError);

    // Initial sanity check on mount: if browser is online, force isOffline to false
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsOffline(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('api_network_offline', handleApiNetworkError);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
    };
  }, []);

  // ONLY show when genuinely offline or when just reconnected! Never show for false alarms.
  const shouldShow = !isDismissed && (isOffline || showReconnected);

  return (
    <AnimatePresence>
      {shouldShow && (
        <div className="fixed z-[100] inset-x-0 bottom-20 sm:bottom-6 flex justify-center pointer-events-none px-3 select-none touch-manipulation">
          <motion.div
            key={showReconnected ? 'reconnected' : 'offline'}
            initial={{ y: 28, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 440, damping: 28 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 40 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 14) setIsDismissed(true);
            }}
            className="pointer-events-auto max-w-[96vw] sm:max-w-fit"
            role="status"
            aria-live="polite"
          >
            <div
              className={`inline-flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-full border transition-all duration-300 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_4px_12px_rgba(0,0,0,0.35)] ${
                showReconnected
                  ? 'bg-slate-900 border-emerald-500/60 text-emerald-100 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900 border-amber-500/60 text-amber-100 ring-1 ring-amber-500/30'
              }`}
            >
              {/* Ambient Pulse Dot / Icon */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {showReconnected ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  </span>
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                  </span>
                )}

                {showReconnected ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.8px]" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 stroke-[2.2px]" />
                )}
              </div>

              {/* Typography Content */}
              <div className="flex items-center gap-1.5 whitespace-nowrap text-xs tracking-tight">
                {showReconnected ? (
                  <>
                    <span className="font-extrabold text-white text-[11px] sm:text-xs">Back Online</span>
                    <span className="text-white/40 font-normal">•</span>
                    <span className="text-[10.5px] sm:text-[11px] font-semibold text-emerald-300">Syncing live records</span>
                  </>
                ) : (
                  <>
                    <span className="font-extrabold text-white text-[11px] sm:text-xs">Offline</span>
                    <span className="text-white/40 font-normal">•</span>
                    <span className="text-[10.5px] sm:text-[11px] font-semibold text-amber-300">Using Saved Cache</span>
                  </>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1 sm:gap-1.5 pl-0.5 shrink-0">
                {isOffline && (
                  <button
                    type="button"
                    onClick={checkConnectivity}
                    disabled={isRetrying}
                    className="h-6 px-2 sm:px-2.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-92 text-[10px] sm:text-[10.5px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="Retry connection"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin text-amber-300' : 'text-amber-300'}`} />
                    <span>{isRetrying ? 'Checking...' : 'Retry'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="h-6 w-6 rounded-full hover:bg-white/15 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Dismiss"
                  aria-label="Dismiss banner"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.2px]" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
