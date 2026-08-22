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

const getHealthUrl = (): string => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isLocal) {
    return 'http://127.0.0.1:8000/health';
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    const origin = envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    return `${origin}/health`;
  }

  return 'https://leetcodeurl-s-1.onrender.com/health';
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
