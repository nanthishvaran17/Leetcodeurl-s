import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown, Check } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 48;
const MAX_PULL_DISTANCE = 96;

/**
 * Check if the touch target or any of its scroll parents is currently scrolled down.
 * If any container has scrolled down (scrollTop > 4), pull-to-refresh must NOT trigger,
 * allowing normal upward scrolling momentum.
 */
function isScrolledDown(target: EventTarget | null): boolean {
  if (typeof window === 'undefined') return false;

  const winY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  if (winY > 4) return true;

  let el = target as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    try {
      if (el.scrollTop > 4) {
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

    // Horizontal swipe gesture (e.g. tabs, slider, carousel) -> cancel pull
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) >= Math.abs(deltaY) * 0.75) {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
      detachTouchMove();
      return;
    }

    // If target has scrolled down during gesture -> abort
    if (isScrolledDown(e.target)) {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
      detachTouchMove();
      return;
    }

    // Deadzone: smooth start after 6px of intentional downward drag
    if (deltaY > 6) {
      if (e.cancelable) {
        e.preventDefault();
      }

      // Smooth rubberband dampening curve
      const damped = Math.min((deltaY - 6) * 0.48, MAX_PULL_DISTANCE);
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

    // Do not interfere if user is interacting with text inputs or controls
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) {
        isPullingRef.current = false;
        detachTouchMove();
        return;
      }
    }

    // Only allow pull-to-refresh if the page and container are at the very top
    if (isScrolledDown(e.target)) {
      isPullingRef.current = false;
      detachTouchMove();
      return;
    }

    const touchY = e.touches[0]?.clientY || 0;
    const touchX = e.touches[0]?.clientX || 0;

    // Do not trigger if touch starts in the bottom 15% of viewport
    if (touchY > (window.innerHeight || 800) * 0.85) {
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
    setPullDistance(50); // Keep capsule parked visibly
    triggerHaptic([18, 32, 18]);

    // Safety timeout: automatically release after 5s in case an endpoint hangs
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      setIsThresholdReached(false);
      setIsSuccess(false);
      setPullDistance(0);
    }, 5000);

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
      await new Promise(resolve => setTimeout(resolve, 550));
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

  // Support Mouse Drag Down for Desktop / DevTools testing
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (disabled || isRefreshing || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (['input', 'textarea', 'select', 'button', 'a'].includes(tag) || target.isContentEditable) return;
      }
      if (isScrolledDown(e.target)) return;
      if (e.clientY > (window.innerHeight || 800) * 0.8) return;

      const startY = e.clientY;
      const startX = e.clientX;
      let pulling = true;
      let reached = false;

      const handleMouseMove = (me: MouseEvent) => {
        if (!pulling || isRefreshing) return;
        const deltaY = me.clientY - startY;
        const deltaX = me.clientX - startX;

        if (deltaY <= 0 || (Math.abs(deltaX) > 8 && Math.abs(deltaX) >= Math.abs(deltaY) * 0.75)) {
          pulling = false;
          setPullDistance(0);
          setIsThresholdReached(false);
          return;
        }

        if (deltaY > 6) {
          const damped = Math.min((deltaY - 6) * 0.48, MAX_PULL_DISTANCE);
          setPullDistance(damped);
          if (damped >= PULL_THRESHOLD && !reached) {
            reached = true;
            setIsThresholdReached(true);
          } else if (damped < PULL_THRESHOLD && reached) {
            reached = false;
            setIsThresholdReached(false);
          }
        }
      };

      const handleMouseUp = async () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        if (pulling && reached && !isRefreshing) {
          pulling = false;
          await executeRefresh();
        } else {
          pulling = false;
          setPullDistance(0);
          setIsThresholdReached(false);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [disabled, isRefreshing, executeRefresh]);

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

  const rotation = Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);

  return (
    <div className="relative w-full h-full flex-1 min-h-0 flex flex-col">
      {/* Floating Refresh Indicator Capsule (Smooth Spring Below Top Navbar) */}
      {(pullDistance > 4 || isRefreshing) && (
        <div
          className="fixed left-0 right-0 top-14 sm:top-16 z-[999999] pointer-events-none flex justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate3d(0, ${pullDistance}px, 0)`,
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
              <RefreshCw
                className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
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

      {/* Page Content with Native Elastic Pull Feedback */}
      <div
        className="w-full h-full flex-1 min-h-0 flex flex-col transition-transform duration-100 ease-out"
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translate3d(0, ${pullDistance * 0.32}px, 0)` : undefined
        }}
      >
        {children}
      </div>
    </div>
  );
};
