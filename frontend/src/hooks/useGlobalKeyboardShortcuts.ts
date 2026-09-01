import { useEffect } from 'react';
import { useKeyboardContext } from '../context/KeyboardContext';

export const useGlobalKeyboardShortcuts = (
  onOpenCommandPalette: () => void,
  onFocusSearch: () => void
) => {
  const { currentContext, executeEscHandler } = useKeyboardContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input Protection - do not intercept keys if user is typing
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        (activeElement as HTMLElement).isContentEditable
      );

      // --- ESCAPE ---
      if (e.key === 'Escape') {
        if (isInput) {
          // Allow ESC to blur inputs
          (activeElement as HTMLElement).blur();
          return;
        }

        // If not GLOBAL, and we have a registered handler, execute it
        if (currentContext !== 'GLOBAL') {
          const handled = executeEscHandler();
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }

      // If user is typing in an input, ignore all other global shortcuts
      if (isInput) return;

      // --- COMMAND PALETTE (CTRL/CMD + K) ---
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // --- SEARCH (/) or (CTRL/CMD + /) ---
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // --- HELP (?) ---
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // We can wire this up to open a help modal later
        // e.preventDefault();
        // onOpenHelpModal();
        return;
      }
      
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentContext, executeEscHandler, onOpenCommandPalette, onFocusSearch]);
};
