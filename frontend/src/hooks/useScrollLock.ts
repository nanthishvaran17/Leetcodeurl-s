import { useLayoutEffect, useEffect } from 'react';

// Global counter for active scroll locks
let scrollLockCount = 0;
let preservedScrollY = 0;

/**
 * Check if any modal, drawer, or dialog is currently present in the DOM
 */
export function hasActiveModalDOM(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"], [aria-modal="true"], .modal-backdrop, .modal-overlay-responsive, [data-modal-active="true"], [data-scroll-locked="true"], #modal-scroll-container, [id*="modal-scroll"], [class*="modal-overlay"], [class*="modal-backdrop"]'
    )
  );
}

/**
 * Robust lock that stops background scrolling on iOS Safari, Android, and Desktop
 */
export function applyLock() {
  if (typeof document === 'undefined') return;
  // Capture current scroll offset
  preservedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

  document.body.classList.add('global-scroll-lock');
  document.documentElement.classList.add('global-scroll-lock');

  // Lock position to freeze background securely on mobile & iOS
  document.body.style.position = 'fixed';
  document.body.style.top = `-${preservedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
}

/**
 * Completely clean all scroll lock classes and inline styles from body and html, restoring exact scroll position
 */
export function applyUnlock() {
  if (typeof document === 'undefined') return;
  const previousTop = document.body.style.top;

  document.body.classList.remove('global-scroll-lock');
  document.documentElement.classList.remove('global-scroll-lock');

  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('left');
  document.body.style.removeProperty('right');
  document.body.style.removeProperty('width');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow-y');
  document.body.style.removeProperty('touch-action');
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow-y');

  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.touchAction = '';

  // Restore previous scroll position without abrupt jumping
  if (previousTop) {
    const scrollY = -parseInt(previousTop, 10);
    if (!isNaN(scrollY) && scrollY >= 0) {
      window.scrollTo(0, scrollY);
    }
  } else if (preservedScrollY > 0) {
    window.scrollTo(0, preservedScrollY);
  }
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
      applyLock();
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
  }, 1500);
}
