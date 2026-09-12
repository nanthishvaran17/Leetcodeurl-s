import { Notification } from '../context/GlobalNotificationContext';

export interface NotificationTarget {
  path?: string;
  modalType?: 'FILE_PREVIEW' | 'STUDENT_PROFILE' | 'REPORT_PREVIEW' | null;
  entityId?: string;
  entityType?: string;
  requireRBACCheck: boolean;
  fallbackText?: string;
  aiPrompt?: string;
  contextType?: 'CONTEST' | 'STUDENT' | 'REPORT' | 'QUALITY' | 'SETTINGS' | 'GENERAL';
}

export function resolveNotificationDestination(notification: Notification): NotificationTarget {
  const { type, actionRoute, entityType, entityId, fileId, title, message } = notification;

  // File downloads/previews bypass normal routing
  if (fileId || entityType === 'FILE') {
    return {
      modalType: 'FILE_PREVIEW',
      entityId: fileId || entityId,
      entityType: 'FILE',
      requireRBACCheck: true,
      fallbackText: 'File no longer available.',
      aiPrompt: `Summarize the attached document: "${title}"`,
      contextType: 'REPORT'
    };
  }

  if (entityType === 'REPORT' || type === 'REPORT_GENERATED') {
    return {
      path: 'reports',
      modalType: entityId ? 'REPORT_PREVIEW' : undefined,
      entityId: entityId,
      entityType: 'REPORT',
      requireRBACCheck: true,
      fallbackText: 'Report no longer available.',
      aiPrompt: `Summarize the findings in the official report: "${title}"`,
      contextType: 'REPORT'
    };
  }

  if (entityType === 'CONTEST' || type === 'CONTEST_RESULT' || type === 'WEEKLY_CONTEST') {
    const contestId = entityId || (actionRoute?.match(/\d+/)?.[0]);
    return {
      path: 'weekly-contest',
      entityId: contestId,
      entityType: 'CONTEST',
      requireRBACCheck: false,
      aiPrompt: contestId ? `Analyze Weekly Contest ${contestId} and summarize top performers and key insights.` : `Analyze the latest weekly contest performance.`,
      contextType: 'CONTEST'
    };
  }

  if (entityType === 'STUDENT' || type === 'STUDENT_ACTIVITY' || type === 'ACHIEVEMENT') {
    return {
      path: 'students',
      entityId: entityId,
      entityType: 'STUDENT',
      requireRBACCheck: false,
      aiPrompt: `Analyze the student profile and placement readiness for ${title}`,
      contextType: 'STUDENT'
    };
  }

  if (type === 'DATA_QUALITY' || type === 'SYNC_FAILURE') {
    return {
      path: 'data-quality',
      entityType: 'QUALITY',
      requireRBACCheck: false,
      aiPrompt: `Explain the recent data quality alerts and profile validation issues.`,
      contextType: 'QUALITY'
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
    if (routeClean.startsWith('contest') || routeClean.startsWith('weekly-contest')) routeClean = 'weekly-contest';
    if (routeClean.startsWith('performance')) routeClean = 'students';
    if (routeClean.startsWith('activity')) routeClean = 'audit';
    if (routeClean.startsWith('admin')) routeClean = 'admin';

    // Override generic dashboard routes for specific types
    if (routeClean === 'dashboard' && (type === 'ACCOUNT_UPDATE' || type === 'PROFILE_UPDATE')) {
      routeClean = 'settings';
    }

    return {
      path: routeClean,
      requireRBACCheck: false,
      entityId: entityId,
      entityType: entityType,
      aiPrompt: `Help me understand this alert: "${title} - ${message}"`,
      contextType: 'GENERAL'
    };
  }

  // Type-based fallbacks if actionRoute is missing
  if (type === 'ACCOUNT_UPDATE' || type === 'PROFILE_UPDATE') {
    return { path: 'settings', requireRBACCheck: false, contextType: 'SETTINGS', aiPrompt: 'Review my security and notification preference settings.' };
  }
  if (type === 'DIRECT_MESSAGE') {
    return { path: 'messages', requireRBACCheck: false, contextType: 'GENERAL', aiPrompt: 'Help me draft a reply to this message.' };
  }

  // Generic fallback
  return {
    path: 'dashboard',
    requireRBACCheck: false,
    aiPrompt: `Provide an overview of institutional statistics for "${title}".`,
    contextType: 'GENERAL'
  };
}
