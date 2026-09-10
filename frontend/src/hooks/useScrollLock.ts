import { useEffect, useLayoutEffect } from 'react';

// Global counter for active scroll locks
let scrollLockCount = 0;

/**
 * A robust scroll lock hook that prevents "stale lock" states.
 * It counts the number of active locks globally.
 * When the first lock is requested, it hides the body overflow.
 * When the last lock is released, it restores the body overflow.
 * 
 * @param lock {boolean} Whether the scroll should be locked.
 */
export const useScrollLock = (lock: boolean = true) => {
  // Use useLayoutEffect to ensure DOM manipulation happens synchronously before browser paint
  useLayoutEffect(() => {
    if (!lock) return;
    
    // Increment active locks
    scrollLockCount += 1;
    
    if (scrollLockCount === 1) {
      document.body.classList.add('global-scroll-lock');
    }

    return () => {
      // Decrement active locks
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      
      if (scrollLockCount === 0) {
        document.body.classList.remove('global-scroll-lock');
      }
    };
  }, [lock]);
};
