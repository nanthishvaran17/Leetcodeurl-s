import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown, Sparkles } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 60;
const MAX_PULL_DISTANCE = 85;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isThresholdReached, setIsThresholdReached] = useState<boolean>(false);

  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const reachedThresholdRef = useRef<boolean>(false);

  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Only allow pull to refresh when user is at the very top of the page
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 2) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = true;
      reachedThresholdRef.current = false;
    } else {
      isPullingRef.current = false;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // If horizontal scroll is dominant, cancel pull
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 2 && deltaY > 0) {
      // Damped non-linear resistance formula
      const damped = Math.min(Math.pow(deltaY, 0.85) * 1.8, MAX_PULL_DISTANCE);
      setPullDistance(damped);

      if (damped >= PULL_THRESHOLD && !reachedThresholdRef.current) {
        reachedThresholdRef.current = true;
        setIsThresholdReached(true);
        triggerHaptic(12);
      } else if (damped < PULL_THRESHOLD && reachedThresholdRef.current) {
        reachedThresholdRef.current = false;
        setIsThresholdReached(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    isPullingRef.current = false;

    if (reachedThresholdRef.current) {
      setIsRefreshing(true);
      setPullDistance(52); // Keep indicator visibly parked during refresh
      triggerHaptic([15, 40, 15]);

      try {
        // Dispatch global sync events
        window.dispatchEvent(new CustomEvent('pull_to_refresh'));
        window.dispatchEvent(new CustomEvent('refresh_dashboard_summary'));
        
        if (onRefresh) {
          await onRefresh();
        } else {
          // Default refresh animation duration
          await new Promise(resolve => setTimeout(resolve, 900));
        }
      } catch (err) {
        console.warn('Pull-to-refresh action warning:', err);
      } finally {
        // Smoothly exit after slight pause
        setTimeout(() => {
          setIsRefreshing(false);
          setIsThresholdReached(false);
          setPullDistance(0);
        }, 300);
      }
    } else {
      setPullDistance(0);
      setIsThresholdReached(false);
    }
  }, [disabled, isRefreshing, onRefresh]);

  useEffect(() => {
    // Attach passive touch listeners on window for highest performance
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const rotation = Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);

  return (
    <div className="relative w-full">
      {/* Pull Indicator Capsule */}
      {(pullDistance > 5 || isRefreshing) && (
        <div
          className="fixed left-0 right-0 top-14 sm:top-16 z-[9999] pointer-events-none flex justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate3d(0, ${pullDistance}px, 0)`,
            opacity: Math.min(pullDistance / 25, 1)
          }}
        >
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-xl border backdrop-blur-xl transition-all duration-200 ${
            isRefreshing
              ? 'bg-emerald-500/90 text-white border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/40'
              : isThresholdReached
              ? 'bg-brand-600 text-white border-brand-400 shadow-brand-500/30 scale-105'
              : 'bg-white/95 dark:bg-navy-900/95 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/10 shadow-slate-900/10'
          }`}>
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: !isRefreshing ? `rotate(${rotation}deg)` : undefined
              }}
            />
            <span className="text-[11px] font-black tracking-wide">
              {isRefreshing
                ? 'Syncing Nandha Intelligence...'
                : isThresholdReached
                ? 'Release to Refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div
        className="w-full transition-transform duration-100 ease-out"
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translate3d(0, ${pullDistance * 0.4}px, 0)` : undefined
        }}
      >
        {children}
      </div>
    </div>
  );
};
