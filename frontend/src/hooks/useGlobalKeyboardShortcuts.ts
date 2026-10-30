import { useEffect } from 'react';
import { useKeyboardContext } from '../context/KeyboardContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

export interface GlobalKeyboardHandlers {
  onOpenCommandPalette: () => void;
  onFocusSearch: () => void;
  onToggleShortcutsModal: () => void;
  onNavigateTab: (tab: string) => void;
  onToggleAiWidget: () => void;
  onToggleNotifications?: () => void;
  onToggleSidebar?: () => void;
  onStudentQuickSearch?: () => void;
  onGenerateReport?: () => void;
  isTabAllowed?: (tab: string) => boolean;
  userRole?: string | null;
}

export const useGlobalKeyboardShortcuts = ({
  onOpenCommandPalette,
  onFocusSearch,
  onToggleShortcutsModal,
  onNavigateTab,
  onToggleAiWidget,
  onToggleNotifications,
  onToggleSidebar,
  onStudentQuickSearch,
  onGenerateReport,
  isTabAllowed,
  userRole,
}: GlobalKeyboardHandlers) => {
  const { executeEscHandler } = useKeyboardContext();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useNotification();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        (activeElement as HTMLElement).isContentEditable
      );

      // --- 1. ESCAPE ---
      if (e.key === 'Escape') {
        if (isInput) {
          (activeElement as HTMLElement).blur();
        }
        const handled = executeEscHandler();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // If user is typing inside text input, ignore global navigation & modal shortcuts
      if (isInput) return;

      // Check if user has active text selected or highlighted (e.g. copying text like staff name)
      const hasTextSelection = typeof window !== 'undefined' && Boolean(window.getSelection()?.toString().trim());

      // Check if any modal dialog or backdrop is currently open
      const isModalOpen = typeof document !== 'undefined' && Boolean(
        document.querySelector('[aria-modal="true"], [role="dialog"], .fixed.inset-0')
      );

      // If text is selected or a modal is open, avoid hijacking keystrokes that might conflict with copying or modal interaction
      if (hasTextSelection) {
        // Allow native copying (Ctrl+C / Cmd+C) without triggering any custom navigation or shortcuts
        return;
      }

      // When a modal dialog is actively open, don't trigger global background shortcuts (like ? guide, search, sidebar toggle, or theme toggle)
      if (isModalOpen) {
        return;
      }

      // --- 2. HELP / SHORTCUTS GUIDE (?) ---
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleShortcutsModal();
        return;
      }

      // --- 3. COMMAND PALETTE (CTRL/CMD + K) ---
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // --- 4. TOGGLE SIDEBAR (CTRL/CMD + B) ---
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (onToggleSidebar) {
          onToggleSidebar();
        } else {
          window.dispatchEvent(new CustomEvent('toggle_sidebar'));
        }
        notify.info('Sidebar toggled', undefined, { duration: 1500 });
        return;
      }

      // --- 5. SEARCH (/) ---
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // --- 6. STUDENT QUICK SEARCH (CTRL/CMD + SHIFT + S) ---
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (onStudentQuickSearch) {
          onStudentQuickSearch();
        } else {
          onOpenCommandPalette();
        }
        return;
      }

      // --- 7. DASHBOARD NAVIGATION (CTRL/CMD + SHIFT + R) ---
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onNavigateTab('dashboard');
        notify.info('Navigating to Dashboard', undefined, { duration: 1500 });
        return;
      }

      // --- 8. TOGGLE DARK / LIGHT MODE (ALT + D) ---
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
        const nextTheme = theme === 'dark' ? 'Light' : 'Dark';
        notify.info(`${nextTheme} mode enabled`, undefined, { duration: 1500 });
        return;
      }

      // --- 9. FAST ROLE-AWARE NAVIGATION (ALT + KEY) ---
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key ? e.key.toLowerCase() : '';
        const code = e.code || '';
        let targetTab: string | null = null;

        if (key === 'h' || code === 'KeyH' || key === 'i' || code === 'KeyI' || key === 'a' || code === 'KeyA') {
          e.preventDefault();
          e.stopPropagation();
          onToggleAiWidget();
          return;
        } else if (key === 'r') targetTab = 'reports';
        else if (key === 'f') targetTab = 'faculty-action-center';
        else if (key === 'm') targetTab = 'hod-command-center';
        else if (key === 'w') targetTab = 'weekly-contest';
        else if (key === 's') targetTab = 'system-health';
        else if (key === 'n') {
          e.preventDefault();
          if (onToggleNotifications) {
            onToggleNotifications();
          } else {
            window.dispatchEvent(new CustomEvent('toggle_notifications'));
          }
          return;
        }

        if (targetTab) {
          e.preventDefault();
          if (isTabAllowed && !isTabAllowed(targetTab)) {
            notify.error('Access Restricted', `Your account role does not have permission to access ${targetTab.toUpperCase()}.`);
            return;
          }
          onNavigateTab(targetTab);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    executeEscHandler,
    onOpenCommandPalette,
    onFocusSearch,
    onToggleShortcutsModal,
    onNavigateTab,
    onToggleAiWidget,
    onToggleNotifications,
    onToggleSidebar,
    onStudentQuickSearch,
    onGenerateReport,
    isTabAllowed,
    userRole,
    theme,
    toggleTheme,
    notify,
  ]);
};
