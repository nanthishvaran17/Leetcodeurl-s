import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown, Sparkles } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 44;
const MAX_PULL_DISTANCE = 85;

// Helper to determine if target element or any scrollable parent is scrolled down
function getTargetScrollTop(target: EventTarget | null): number {
  let el = target as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 2) {
      try {
        const style = window.getComputedStyle(el);
        const ovY = style.overflowY;
        if (ovY === 'auto' || ovY === 'scroll') {
          return el.scrollTop;
        }
      } catch (_) {
        return el.scrollTop;
      }
    }
    el = el.parentElement;
  }
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

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
  const safetyTimeoutRef = useRef<any>(null);

  const triggerHaptic = (pattern: number | number[] = 12) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;

    // Do not interfere if user touches input, select, textarea or interactive buttons
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) {
        isPullingRef.current = false;
        return;
      }
    }

    // Only allow pull to refresh when user is at the very top of the page and container
    const scrollTop = getTargetScrollTop(e.target);
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

    // Only cancel pull if user is clearly performing a horizontal swipe (e.g. table scroll or carousel)
    // Avoid canceling on minor touch jitter during initial 1-15px finger travel
    if (Math.abs(deltaX) > 20 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setPullDistance(0);
      setIsThresholdReached(false);
      return;
    }

    // If scrolling up into the document, ignore
    if (deltaY <= 0) {
      setPullDistance(0);
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      return;
    }

    const scrollTop = getTargetScrollTop(e.target);
    if (scrollTop <= 2 && deltaY > 0) {
      // Prevent browser native pull-to-refresh / overscroll collision
      if (e.cancelable) {
        e.preventDefault();
      }

      // Smooth elastic damping formula (feels snappy and responsive)
      const damped = Math.min(deltaY * 0.52, MAX_PULL_DISTANCE);
      setPullDistance(damped);

      if (damped >= PULL_THRESHOLD && !reachedThresholdRef.current) {
        reachedThresholdRef.current = true;
        setIsThresholdReached(true);
        triggerHaptic(16);
      } else if (damped < PULL_THRESHOLD && reachedThresholdRef.current) {
        reachedThresholdRef.current = false;
        setIsThresholdReached(false);
      }
    } else {
      setPullDistance(0);
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    isPullingRef.current = false;

    const shouldRefresh = reachedThresholdRef.current;
    reachedThresholdRef.current = false;

    if (shouldRefresh) {
      setIsRefreshing(true);
      setPullDistance(48); // Keep capsule visibly parked during fetch
      triggerHaptic([15, 30, 15]);

      // Safety timeout: automatically release after 4.5s in case an API hangs
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = setTimeout(() => {
        setIsRefreshing(false);
        setIsThresholdReached(false);
        setPullDistance(0);
      }, 4500);

      try {
        // Dispatch global sync events
        window.dispatchEvent(new CustomEvent('pull_to_refresh'));
        window.dispatchEvent(new CustomEvent('refresh_dashboard_summary'));

        if (onRefresh) {
          await onRefresh();
        } else {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (err) {
        console.warn('Pull-to-refresh warning:', err);
      } finally {
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        // Smoothly close capsule
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
    // Note: touchmove MUST have { passive: false } to cancel browser native pull collision
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const handleBlur = () => {
      isPullingRef.current = false;
      reachedThresholdRef.current = false;
      setIsThresholdReached(false);
      setPullDistance(0);
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('blur', handleBlur);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const rotation = Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);

  return (
    <div className="relative w-full">
      {/* Pull Indicator Capsule */}
      {(pullDistance > 4 || isRefreshing) && (
        <div
          className="fixed left-0 right-0 top-12 sm:top-14 z-[99999] pointer-events-none flex justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate3d(0, ${pullDistance}px, 0)`,
            opacity: Math.min(pullDistance / 18, 1)
          }}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl border backdrop-blur-xl transition-all duration-200 ${
            isRefreshing
              ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/40 ring-2 ring-emerald-400/50 scale-105'
              : isThresholdReached
              ? 'bg-brand-600 text-white border-brand-400 shadow-brand-500/40 scale-105 ring-2 ring-brand-400/40'
              : 'bg-white/95 dark:bg-navy-900/95 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-navy-700 shadow-slate-900/15'
          }`}>
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: !isRefreshing ? `rotate(${rotation}deg)` : undefined
              }}
            />
            <span className="text-xs font-black tracking-wide">
              {isRefreshing
                ? 'Syncing Fresh Intelligence...'
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
          transform: pullDistance > 0 && !isRefreshing ? `translate3d(0, ${pullDistance * 0.35}px, 0)` : undefined
        }}
      >
        {children}
      </div>
    </div>
  );
};
