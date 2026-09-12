export type ShortcutCategory = 'GLOBAL CONTROLS' | 'QUICK NAVIGATION' | 'QUICK ACTIONS' | 'AI ASSISTANT';

export interface ShortcutDefinition {
  id: string;
  keys: string[];
  description: string;
  category: ShortcutCategory;
  targetTab?: string;
  allowedRoles?: string[]; // null or empty means all authenticated users
  actionId?: string;
  requireInputProtection?: boolean;
}

export const GLOBAL_SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  // GLOBAL CONTROLS
  {
    id: 'close_overlay',
    keys: ['Esc'],
    description: 'Close active Modal / Drawer / Overlay / AI panel',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: false
  },
  {
    id: 'shortcuts_guide',
    keys: ['?'],
    description: 'Open Keyboard Shortcuts Guide',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: true
  },
  {
    id: 'command_palette',
    keys: ['Ctrl', 'K'],
    description: 'Open Universal Command Palette',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: false
  },
  {
    id: 'focus_search',
    keys: ['/'],
    description: 'Focus active page search bar',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: true
  },
  {
    id: 'toggle_sidebar',
    keys: ['Ctrl', 'B'],
    description: 'Collapse / Expand Sidebar',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: false
  },
  {
    id: 'toggle_theme',
    keys: ['Alt', 'D'],
    description: 'Toggle Light / Dark mode',
    category: 'GLOBAL CONTROLS',
    requireInputProtection: false
  },

  // QUICK NAVIGATION (ROLE-AWARE)
  {
    id: 'nav_dashboard',
    keys: ['Alt', 'H'],
    description: 'Dashboard',
    category: 'QUICK NAVIGATION',
    targetTab: 'dashboard',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff', 'student']
  },

  {
    id: 'nav_reports',
    keys: ['Alt', 'R'],
    description: 'Universal Reports & Analytics',
    category: 'QUICK NAVIGATION',
    targetTab: 'reports',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff']
  },
  {
    id: 'nav_faculty_actions',
    keys: ['Alt', 'F'],
    description: 'Faculty Action Center',
    category: 'QUICK NAVIGATION',
    targetTab: 'faculty-action-center',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff']
  },
  {
    id: 'nav_hod_center',
    keys: ['Alt', 'M'],
    description: 'HOD Command Center',
    category: 'QUICK NAVIGATION',
    targetTab: 'hod-command-center',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod']
  },
  {
    id: 'nav_weekly_contests',
    keys: ['Alt', 'W'],
    description: 'Weekly Contest Intelligence',
    category: 'QUICK NAVIGATION',
    targetTab: 'weekly-contest',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff']
  },
  {
    id: 'nav_system_health',
    keys: ['Alt', 'S'],
    description: 'System Health',
    category: 'QUICK NAVIGATION',
    targetTab: 'system-health',
    allowedRoles: ['admin', 'administrator', 'super_admin']
  },
  {
    id: 'nav_ai_copilot',
    keys: ['Alt', 'I'],
    description: 'Institutional Intelligence Assistant',
    category: 'QUICK NAVIGATION',
    actionId: 'toggle_ai'
  },
  {
    id: 'nav_notifications',
    keys: ['Alt', 'N'],
    description: 'Notifications Drawer',
    category: 'QUICK NAVIGATION',
    actionId: 'toggle_notifications'
  },

  // QUICK ACTIONS
  {
    id: 'student_quick_search',
    keys: ['Ctrl', 'Shift', 'S'],
    description: 'Student Quick Search',
    category: 'QUICK ACTIONS',
    actionId: 'student_search',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff']
  },
  {
    id: 'generate_report_shortcut',
    keys: ['Ctrl', 'Shift', 'R'],
    description: 'Generate Report',
    category: 'QUICK ACTIONS',
    actionId: 'generate_report',
    allowedRoles: ['admin', 'administrator', 'super_admin', 'hod', 'faculty', 'staff']
  },

  // AI ASSISTANT
  {
    id: 'ai_send',
    keys: ['Ctrl', 'Enter'],
    description: 'Send Message (inside AI input)',
    category: 'AI ASSISTANT'
  },
  {
    id: 'ai_newline',
    keys: ['Shift', 'Enter'],
    description: 'New Line (inside AI input)',
    category: 'AI ASSISTANT'
  },
  {
    id: 'ai_close',
    keys: ['Esc'],
    description: 'Close AI Panel',
    category: 'AI ASSISTANT'
  }
];

export function isShortcutAllowedForRole(
  shortcut: ShortcutDefinition,
  userRole?: string | null,
  isTabAllowed?: (tab: string) => boolean
): boolean {
  if (shortcut.targetTab && isTabAllowed) {
    return isTabAllowed(shortcut.targetTab);
  }
  if (!shortcut.allowedRoles || shortcut.allowedRoles.length === 0) {
    return true;
  }
  if (!userRole) return false;
  const roleClean = userRole.trim().toLowerCase();
  if (['admin', 'administrator', 'super_admin', 'super admin'].includes(roleClean)) {
    return true;
  }
  return shortcut.allowedRoles.some(r => r.toLowerCase() === roleClean);
}
