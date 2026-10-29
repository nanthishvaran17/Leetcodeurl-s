import { useLayoutEffect, useEffect } from 'react';

// Global counter for active scroll locks
let scrollLockCount = 0;

/**
 * Check if any modal, drawer, or dialog is currently present in the DOM
 */
export function hasActiveModalDOM(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"], .modal-backdrop, .modal-overlay-responsive, [data-modal-active="true"], [data-scroll-locked="true"]'
    )
  );
}

/**
 * Completely clean all scroll lock classes and inline overflow styles from body and html
 */
export function applyUnlock() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('global-scroll-lock');
  document.documentElement.classList.remove('global-scroll-lock');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow-y');
  document.body.style.removeProperty('touch-action');
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow-y');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.touchAction = '';
}

/**
 * A robust scroll lock hook that prevents "stale lock" states.
 * It counts the number of active locks globally.
 * When the first lock is requested, it hides the body overflow.
 * When the last lock is released, it restores the body overflow.
 * 
 * @param lock {boolean} Whether the scroll should be locked.
 */
export const useScrollLock = (lock: boolean = true) => {
  useLayoutEffect(() => {
    if (!lock) {
      // If lock is explicitly false and no modal is active in DOM, auto-heal
      if (!hasActiveModalDOM()) {
        scrollLockCount = 0;
        applyUnlock();
      }
      return;
    }
    
    // Increment active locks
    scrollLockCount += 1;
    
    if (scrollLockCount === 1) {
      document.body.classList.add('global-scroll-lock');
      document.documentElement.classList.add('global-scroll-lock');
    }

    return () => {
      // Decrement active locks safely
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      
      if (scrollLockCount === 0 || !hasActiveModalDOM()) {
        scrollLockCount = 0;
        applyUnlock();
      }
    };
  }, [lock]);
};

/**
 * Global failsafe to unlock scroll when switching tabs or closing all overlays
 */
export const forceUnlockScroll = () => {
  scrollLockCount = 0;
  applyUnlock();
};

// Automatic route-navigation and visibility failsafe: ensure scroll is never trapped
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', forceUnlockScroll);
  window.addEventListener('hashchange', forceUnlockScroll);
  window.addEventListener('visibilitychange', () => {
    if (!hasActiveModalDOM()) {
      forceUnlockScroll();
    }
  });

  // Periodic safety pulse: if no dialog is present in DOM, heal body scroll automatically
  setInterval(() => {
    if (scrollLockCount > 0 && !hasActiveModalDOM()) {
      forceUnlockScroll();
    }
  }, 1200);
}
