import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown, Check } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 88;

/**
 * Check if the touch target or any of its scroll parents is currently scrolled down.
 * If any container has scrolled down (scrollTop > 2), pull-to-refresh must NOT trigger,
 * allowing normal upward scrolling momentum.
 */
function isScrolledDown(target: EventTarget | null): boolean {
  if (typeof window === 'undefined') return false;

  const winY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  if (winY > 2) return true;

  const mainEl = document.getElementById('main-content');
  if (mainEl && mainEl.scrollTop > 2) return true;

  let el = target as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    try {
      if (el.scrollTop > 2) {
        return true;
      }
    } catch (_) {}
    el = el.parentElement;
  }
  return false;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isThresholdReached, setIsThresholdReached] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const reachedThresholdRef = useRef<boolean>(false);
  const safetyTimeoutRef = useRef<any>(null);
  const touchMoveListenerRef = useRef<((e: TouchEvent) => void) | null>(null);

  const triggerHaptic = (pattern: number | number[] = 14) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const detachTouchMove = useCallback(() => {
    if (touchMoveListenerRef.current) {
      window.removeEventListener('touchmove', touchMoveListenerRef.current);
      touchMoveListenerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) {
      detachTouchMove();
      return;
    }

    if (!e.touches || e.touches.length !== 1) {
      isPullingRef.current = false;
      detachTouchMove();
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // Finger moving UP (user scrolling down into content) -> cancel pull immediately
    if (deltaY <= 0) {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
      detachTouchMove();
      return;
    }

    // Cancel if horizontal swipe (e.g. tabs/carousel/slider)
    if (Math.abs(deltaX) > 20 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
      detachTouchMove();
      return;
    }

    // Deadzone: activate pull once vertical intent is detected
    if (deltaY > 8 && deltaY > Math.abs(deltaX) * 1.2) {
      if (e.cancelable) {
        e.preventDefault();
      }

      // Smooth rubberband dampening curve
      const damped = Math.min((deltaY - 8) * 0.44, MAX_PULL_DISTANCE);
      setPullDistance(damped);

      if (damped >= PULL_THRESHOLD && !reachedThresholdRef.current) {
        reachedThresholdRef.current = true;
        setIsThresholdReached(true);
        triggerHaptic(18);
      } else if (damped < PULL_THRESHOLD && reachedThresholdRef.current) {
        reachedThresholdRef.current = false;
        setIsThresholdReached(false);
      }
    }
  }, [disabled, isRefreshing, detachTouchMove]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;

    // Do not interfere if user is interacting with text inputs or controls
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName?.toLowerCase();
      if (['input', 'textarea', 'select', 'button', 'a'].includes(tag) || target.isContentEditable) {
        isPullingRef.current = false;
        detachTouchMove();
        return;
      }
    }

    const winY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (winY > 2 || isScrolledDown(e.target)) {
      isPullingRef.current = false;
      detachTouchMove();
      return;
    }

    const touchY = e.touches[0]?.clientY || 0;
    const touchX = e.touches[0]?.clientX || 0;

    // Allow pull gesture to start anywhere in the upper 75% of the viewport when scrolled to top
    const maxAllowedStartY = typeof window !== 'undefined' ? window.innerHeight * 0.75 : 600;
    if (touchY > maxAllowedStartY) {
      isPullingRef.current = false;
      detachTouchMove();
      return;
    }

    startYRef.current = touchY;
    startXRef.current = touchX;
    isPullingRef.current = true;
    reachedThresholdRef.current = false;

    detachTouchMove();
    touchMoveListenerRef.current = handleTouchMove;
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
  }, [disabled, isRefreshing, handleTouchMove, detachTouchMove]);

  const executeRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(48); // Keep capsule parked visibly
    triggerHaptic([18, 32, 18]);

    // Safety timeout: automatically release after 4.5s
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      setIsThresholdReached(false);
      setIsSuccess(false);
      setPullDistance(0);
    }, 4500);

    try {
      // 1. Dispatch custom events to refresh any active page
      window.dispatchEvent(new CustomEvent('pull_to_refresh', { detail: { timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('refresh_dashboard_summary'));
      window.dispatchEvent(new CustomEvent('reload_active_tab_data'));

      // 2. Execute onRefresh prop
      if (onRefresh) {
        await onRefresh();
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Show brief success checkmark
      setIsSuccess(true);
      triggerHaptic(24);
      await new Promise(resolve => setTimeout(resolve, 450));
    } catch (err) {
      console.warn('Pull-to-refresh warning:', err);
    } finally {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      setTimeout(() => {
        setIsRefreshing(false);
        setIsThresholdReached(false);
        setIsSuccess(false);
        setPullDistance(0);
      }, 150);
    }
  }, [onRefresh]);

  const handleTouchEnd = useCallback(async () => {
    detachTouchMove();
    if (!isPullingRef.current || disabled || isRefreshing) return;
    isPullingRef.current = false;

    const shouldRefresh = reachedThresholdRef.current;
    reachedThresholdRef.current = false;

    if (shouldRefresh) {
      await executeRefresh();
    } else {
      setPullDistance(0);
      setIsThresholdReached(false);
    }
  }, [disabled, isRefreshing, detachTouchMove, executeRefresh]);

  // Touch event listeners for mobile / touch devices
  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const handleBlur = () => {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
      detachTouchMove();
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('blur', handleBlur);
      detachTouchMove();
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [handleTouchStart, handleTouchEnd, detachTouchMove]);

  const progressPercent = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);
  const rotation = Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);

  return (
    <div className="relative w-full min-h-full flex-1 flex flex-col">
      {/* Floating Refresh Indicator Capsule (Smooth Spring Below Top Navbar) */}
      {(pullDistance > 6 || isRefreshing) && (
        <div
          className="fixed left-0 right-0 top-14 sm:top-16 z-[999999] pointer-events-none flex justify-center"
          style={{
            transform: `translate3d(0, ${pullDistance}px, 0)`,
            transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease',
            opacity: Math.min(pullDistance / 14, 1)
          }}
        >
          <div className={`flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-2xl border backdrop-blur-2xl transition-all duration-200 ${
            isSuccess
              ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/50 ring-4 ring-emerald-400/30 scale-105'
              : isRefreshing
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-indigo-300 shadow-indigo-500/50 ring-4 ring-brand-400/30 scale-105'
              : isThresholdReached
              ? 'bg-brand-600 text-white border-brand-400 shadow-brand-500/50 scale-105 ring-4 ring-brand-400/40'
              : 'bg-white/95 dark:bg-navy-900/95 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-white/10 shadow-slate-900/20'
          }`}>
            {isSuccess ? (
              <Check className="w-4 h-4 text-white stroke-[3] animate-bounce" />
            ) : isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : isThresholdReached ? (
              <ArrowDown className="w-4 h-4 text-white stroke-[2.5] animate-bounce" />
            ) : (
              <div className="relative w-4 h-4 flex items-center justify-center">
                <RefreshCw
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
                <svg className="absolute inset-0 -rotate-90 pointer-events-none w-4 h-4" viewBox="0 0 36 36">
                  <path
                    className="text-brand-500"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
            )}
            <span className="text-xs font-black tracking-wide font-sans">
              {isSuccess
                ? 'All Data Updated!'
                : isRefreshing
                ? 'Syncing Fresh Intelligence...'
                : isThresholdReached
                ? 'Release to Refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Page Content with Native Elastic Pull Feedback on Touch */}
      <div
        className="w-full min-h-full flex-1 flex flex-col will-change-transform"
        style={{
          transform: (pullDistance > 0 || isRefreshing)
            ? `translate3d(0, ${isRefreshing ? 44 : Math.round(pullDistance * 0.42)}px, 0)`
            : undefined,
          transition: isPullingRef.current ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
};
