/**
 * heartbeat.ts — Production-Grade Safe Keep-Alive Probe Manager
 * 
 * Provides safe background liveness pings to mitigate cold-starts.
 * Features:
 * - Singleton timer lifecycle (no duplicate timers)
 * - Pings ONLY lightweight /health endpoint (never triggers DB queries)
 * - Pauses automatically when tab is hidden or backgrounded
 * - Resumes on visibilitychange
 * - Guarded against overlapping concurrent in-flight requests
 * - Fails silently without crashing or alerting the user
 */

let heartbeatTimer: any = null;
let isPinging = false;

import { PRODUCTION_BACKEND_URL, isCapacitorNative } from '../config/apiConfig';

const getHealthUrl = (): string => {
  const origin = PRODUCTION_BACKEND_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

  if (isCapacitorNative()) {
    return `${origin}/health`;
  }

  // Local dev: use relative path (proxied by Vite)
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (window.location.port === '3000' || window.location.port === '5173')
  ) {
    return '/api/system/health';
  }

  return `${origin}/health`;
};

const sendPing = async () => {
  if (isPinging) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  isPinging = true;
  try {
    const url = getHealthUrl();
    await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      keepalive: true
    });
  } catch (_err) {
    // Silent fail - heartbeat is purely a cold-start mitigation
  } finally {
    isPinging = false;
  }
};

export const startSafeHeartbeat = () => {
  if (typeof window === 'undefined') return;
  if (heartbeatTimer) return; // Prevent multiple overlapping timers

  // Initial immediate lightweight ping
  sendPing();

  // 3.5 minute interval (210,000 ms)
  heartbeatTimer = setInterval(sendPing, 210000);

  // Tab visibility integration: Pause when hidden, ping when returning
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      sendPing();
    }
  });

  window.addEventListener('beforeunload', stopSafeHeartbeat);
};

export const stopSafeHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  isPinging = false;
};
