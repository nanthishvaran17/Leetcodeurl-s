import { useEffect, useRef } from 'react';

// Global LIFO stack of escape handlers to cleanly handle nested modals, drawers, and overlays
const escStack: Array<() => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (escStack.length > 0) {
          // Blur active input or editable element if focused so cursor doesn't remain floating
          const activeEl = document.activeElement as HTMLElement | null;
          if (activeEl && typeof activeEl.blur === 'function') {
            activeEl.blur();
          }

          // Execute topmost handler in the stack
          const topHandler = escStack[escStack.length - 1];
          if (topHandler) {
            e.preventDefault();
            e.stopPropagation();
            topHandler();
          }
        }
      }
    },
    true // Capture phase: catches ESC with highest priority before bubbling
  );
}

/**
 * Universal hook to bind an Escape key handler for any modal, drawer, dialog, or popup.
 * Automatically pushes to and pops from a global LIFO stack so nested modals close one by one.
 * 
 * @param onClose Callback to run when Escape is pressed
 * @param isEnabled Whether the escape handler is currently active (defaults to true)
 */
export function useEscapeKey(onClose?: () => void, isEnabled = true) {
  const handlerRef = useRef(onClose);
  handlerRef.current = onClose;

  useEffect(() => {
    if (!isEnabled || !onClose) return;

    const handler = () => {
      handlerRef.current?.();
    };

    escStack.push(handler);

    return () => {
      const idx = escStack.lastIndexOf(handler);
      if (idx !== -1) {
        escStack.splice(idx, 1);
      }
    };
  }, [isEnabled, Boolean(onClose)]);
}
