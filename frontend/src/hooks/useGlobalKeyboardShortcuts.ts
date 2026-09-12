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
          return;
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
        const key = e.key.toLowerCase();
        let targetTab: string | null = null;

        if (key === 'h') targetTab = 'dashboard';
        else if (key === 'r') targetTab = 'reports';
        else if (key === 'f') targetTab = 'faculty-action-center';
        else if (key === 'm') targetTab = 'hod-command-center';
        else if (key === 'w') targetTab = 'weekly-contest';
        else if (key === 's') targetTab = 'system-health';
        else if (key === 'i' || key === 'a') {
          e.preventDefault();
          onToggleAiWidget();
          return;
        } else if (key === 'n') {
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
