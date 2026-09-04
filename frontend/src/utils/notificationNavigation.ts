import { Notification } from '../context/GlobalNotificationContext';

export interface NotificationTarget {
  path?: string;
  modalType?: 'FILE_PREVIEW' | 'STUDENT_PROFILE' | 'REPORT_PREVIEW' | null;
  entityId?: string;
  requireRBACCheck: boolean;
  fallbackText?: string;
}

export function resolveNotificationDestination(notification: Notification): NotificationTarget {
  const { type, actionRoute, entityType, entityId, fileId } = notification;

  // File downloads/previews bypass normal routing
  if (fileId || entityType === 'FILE') {
    return {
      modalType: 'FILE_PREVIEW',
      entityId: fileId || entityId,
      requireRBACCheck: true, // Backend checks RBAC on file fetch
      fallbackText: 'File no longer available.'
    };
  }

  if (entityType === 'REPORT') {
    return {
      modalType: 'REPORT_PREVIEW',
      entityId: entityId,
      requireRBACCheck: true,
      fallbackText: 'Report no longer available.'
    };
  }

  // Fallback to actionRoute provided by backend enrichment
  if (actionRoute) {
    let routeClean = actionRoute.replace(/^\//, '').trim();
    
    // Map deep-links to App.tsx top-level tab routes
    if (routeClean.startsWith('messages')) {
      const parts = routeClean.split('/');
      const notifAny = notification as any;
      const convId = parts[1] || (notifAny.metadata && notifAny.metadata.conversation_id);
      if (convId && typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('conv', convId);
          window.history.pushState({}, '', url.toString());
        } catch (e) {}
      }
      routeClean = 'messages';
    }
    if (routeClean.startsWith('settings')) routeClean = 'settings';
    if (routeClean.startsWith('audit')) routeClean = 'audit';
    if (routeClean.startsWith('reports')) routeClean = 'reports';

    // Override generic dashboard routes for specific types
    if (routeClean === 'dashboard' && (type === 'ACCOUNT_UPDATE' || type === 'PROFILE_UPDATE')) {
      routeClean = 'settings';
    }

    return {
      path: routeClean,
      requireRBACCheck: false, // The page itself will handle data fetching and RBAC
      entityId: entityId
    };
  }

  // Type-based fallbacks if actionRoute is missing
  if (type === 'ACCOUNT_UPDATE' || type === 'PROFILE_UPDATE') {
    return { path: 'settings', requireRBACCheck: false };
  }
  if (type === 'DIRECT_MESSAGE') {
    return { path: 'messages', requireRBACCheck: false };
  }

  // Generic fallback
  return {
    path: 'dashboard',
    requireRBACCheck: false
  };
}
