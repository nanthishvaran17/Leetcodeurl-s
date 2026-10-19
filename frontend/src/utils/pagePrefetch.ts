/**
 * Ultra-Fast Jet-Speed Predictive Page Preloader
 * Warms up route chunks in browser cache ahead of user interaction
 * for instant 0ms transitions across all tabs and devices.
 */

const pageImportMap: Record<string, () => Promise<any>> = {
  'dashboard': () => import('../pages/DashboardPage'),
  'students': () => import('../pages/StudentMasterPage'),
  'departments': () => import('../pages/DepartmentDashboard'),
  'weekly-contest': () => import('../pages/WeeklyContestPage'),
  'compare': () => import('../pages/ComparePage'),
  'growth': () => import('../pages/GrowthIntelligencePage'),
  'quality': () => import('../pages/DataQualityPage'),
  'reports': () => import('../pages/ReportsPage'),
  'faculty-action-center': () => import('../pages/FacultyActionCenter'),
  'faculty': () => import('../pages/FacultyActionCenter'),
  'hod-command-center': () => import('../pages/HODCommandCenter'),
  'hod': () => import('../pages/HODCommandCenter'),
  'command-center': () => import('../pages/HODCommandCenter'),
  'hr-candidate-finder': () => import('../pages/HRCandidateFinderPage'),
  'placement-finder': () => import('../pages/HRCandidateFinderPage'),
  'hr': () => import('../pages/HRCandidateFinderPage'),
  'messages': () => import('../pages/MessagesPage'),
  'system-health': () => import('../pages/SystemHealthPage'),
  'account-settings': () => import('../pages/AccountSettingsPage'),
  'account': () => import('../pages/AccountSettingsPage'),
  'profile-settings': () => import('../pages/AccountSettingsPage'),
  'settings': () => import('../pages/SettingsPage'),
  'data-issues': () => import('../pages/StudentDataIssuesPage'),
  'issues': () => import('../pages/StudentDataIssuesPage'),
  'public': () => import('../pages/PublicLeaderboardPage'),
  'hall-of-fame': () => import('../pages/HallOfFameKioskPage'),
  'audit': () => import('../pages/AuditLogPage'),
  'audit-logs': () => import('../pages/AuditLogPage'),
  'post930': () => import('../pages/Post930SolversView'),
  'post-930': () => import('../pages/Post930SolversView'),
  'profile': () => import('../pages/StudentProfilePage'),
  'student-dashboard': () => import('../pages/StudentDashboardView'),
  'staff-dashboard': () => import('../pages/StaffDashboardView'),
};

const prefetchedPages = new Set<string>();

/**
 * Prefetches a specific route bundle on hover or touch intent
 */
export function prefetchRoute(routeId: string): void {
  const normalized = routeId.trim().toLowerCase();
  if (prefetchedPages.has(normalized)) return;
  
  const loader = pageImportMap[normalized];
  if (loader) {
    prefetchedPages.add(normalized);
    loader().catch(() => {
      prefetchedPages.delete(normalized); // Allow retry on error
    });
  }
}

/**
 * Automatically warms up all core application views during browser idle time
 */
export function warmupPriorityRoutes(): void {
  if (typeof window === 'undefined') return;

  const coreRoutes = [
    'dashboard',
    'students',
    'departments',
    'weekly-contest',
    'profile',
    'public',
    'growth',
    'reports',
    'compare',
    'quality',
    'faculty-action-center',
    'hod-command-center',
    'account-settings',
    'system-health'
  ];

  const runWarmup = () => {
    let index = 0;
    const interval = setInterval(() => {
      if (index >= coreRoutes.length) {
        clearInterval(interval);
        return;
      }
      prefetchRoute(coreRoutes[index]);
      index++;
    }, 150); // Stagger every 150ms to keep CPU & network idle
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => setTimeout(runWarmup, 800), { timeout: 3000 });
  } else {
    setTimeout(runWarmup, 1200);
  }
}
