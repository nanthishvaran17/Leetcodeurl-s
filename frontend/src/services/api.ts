import axios from 'axios';
import { auth } from '../firebase';

// Authoritative Production Backend Base URL (used by native apps only)
const PRODUCTION_BACKEND_URL = 'https://leetcodeurl-s-3mig.onrender.com';

// Smart API Base URL Resolution for Local Development vs Native Mobile (Capacitor/Android) vs Production Hosting
const getApiBaseUrl = () => {
  // Check if running inside native mobile app container (Capacitor Android / iOS)
  const isNative = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.origin.includes('capacitor://') ||
    window.location.origin.includes('ionic://')
  );

  // Native Android/iOS Capacitor app MUST always use full production HTTPS endpoint (no proxy)
  if (isNative) {
    return `${PRODUCTION_BACKEND_URL}/api`;
  }

  // All web browsers (local dev AND production Vercel) use relative /api
  // In production: Vercel proxy routes /api/* → Render backend (no CORS needed)
  // In local dev: Vite dev server or relative path works the same way
  return '/api';
};

const API_BASE = getApiBaseUrl();

export const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true' // Bypasses localtunnel's "Click to Continue" warning page
  },
});


// In-flight GET request deduplication map to prevent redundant concurrent network round-trips
const inFlightRequests = new Map<string, Promise<any>>();
const activeControllers = new Map<string, { controller: AbortController; key: string }>();
const responseCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 120_000; // 2 minutes — fast-enough for live staff use, eliminates redundant fetches

// Per-URL TTL overrides (milliseconds). Heavier endpoints get longer cache.
const URL_TTL_OVERRIDES: Record<string, number> = {
  '/students/leaderboard-fast': 120_000,   // 2 min
  '/public/leaderboard': 120_000,           // 2 min
  '/analytics/department-comparison': 300_000, // 5 min
  '/analytics/data-quality': 300_000,       // 5 min
  '/sessions/dashboard-summary': 60_000,   // 1 min (synced more often)
  '/public/stats': 300_000,                // 5 min
};

const getEffectiveTtl = (url: string): number => {
  for (const [pattern, ttl] of Object.entries(URL_TTL_OVERRIDES)) {
    if (url.includes(pattern)) return ttl;
  }
  return CACHE_TTL_MS;
};

export const getCachedData = (key: string, url?: string) => {
  const cached = responseCache.get(key);
  const ttl = url ? getEffectiveTtl(url) : CACHE_TTL_MS;
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  try {
    const sessionItem = sessionStorage.getItem(`swr_${key}`);
    if (sessionItem) {
      const parsed = JSON.parse(sessionItem);
      if (parsed && Date.now() - parsed.timestamp < ttl) {
        responseCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch (_e) {}
  return null;
};

export const setCachedData = (key: string, data: any) => {
  const entry = { timestamp: Date.now(), data };
  responseCache.set(key, entry);
  try {
    // Persist small-to-medium JSON in sessionStorage for instant sub-millisecond tab restores
    const serialized = JSON.stringify(entry);
    if (serialized.length < 500_000) {
      sessionStorage.setItem(`swr_${key}`, serialized);
    }
  } catch (_e) {}
};

export const clearApiCache = () => {
  responseCache.clear();
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('swr_')) sessionStorage.removeItem(k);
    });
  } catch (_e) {}
};

export const getRequestKey = (url: string, config?: any): string => {
  const params = config?.params ? JSON.stringify(config.params) : '';
  let userScope = 'public';
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      userScope = `${user.id || 'N/A'}:${user.role || 'N/A'}:${user.department_id || 'N/A'}`;
    }
  } catch (e) {}
  return `get:${userScope}:${url}:${params}`;
};

// Synchronous sub-millisecond request header dispatch
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Periodic background keep-alive ping to prevent Render free-tier cold starts
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      originalGet.call(api, '/health').catch(() => {});
    }
  }, 8 * 60 * 1000); // Ping every 8 minutes
}

// ------------------------------------------------------------------
// AUTHENTICATION & SILENT REFRESH ARCHITECTURE
// ------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void, reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

export const globalLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  clearApiCache();
  
  // Prevent infinite reload loops if we're already on login or landing
  if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
    window.location.href = '/login';
  } else if (window.location.pathname === '/login') {
    // We are already on login, but we want to ensure any stuck auth state is cleared
    // without triggering a full page reload loop
    window.dispatchEvent(new Event('auth_logout'));
  }
};

// Resilient Response Interceptor: Automatic Retry & Silent Token Refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config) {
      return Promise.reject(error);
    }

    // --- 1. HANDLE AUTHENTICATION FAILURES (401) ---
    if (error.response && error.response.status === 401 && !config.url?.includes('/auth/login') && !config.url?.includes('/auth/refresh') && !config.url?.includes('/auth/session')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          config.headers['Authorization'] = 'Bearer ' + token;
          return api(config);
        }).catch(err => Promise.reject(err));
      }

      config._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        // Attempt silent refresh using HttpOnly cookie (or custom mobile header if provided)
        api.post('/auth/refresh')
          .then(({ data }) => {
            const newToken = data.access_token;
            localStorage.setItem('token', newToken);
            config.headers['Authorization'] = 'Bearer ' + newToken;
            processQueue(null, newToken);
            resolve(api(config));
          })
          .catch(err => {
            processQueue(err, null);
            console.warn("[AUTH] Refresh token expired or invalid. Triggering explicit logout.");
            globalLogout();
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    // --- 2. HANDLE NETWORK COLD STARTS / GATEWAY ERRORS (GET only — POSTs handle their own retry) ---
    if (config._retryCount && config._retryCount >= 2) {
      return Promise.reject(error);
    }

    const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
    const isGatewayError = error.response && [502, 503, 504].includes(error.response.status);
    const isNetworkError = !error.response && Boolean(error.request);
    const isCanceled = axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED';
    // Never auto-retry POST/PUT/DELETE — these are handled by the caller (e.g. LoginPage retry logic)
    const isReadOnly = config.method === 'get' || config.method === 'GET';

    if (!isCanceled && isReadOnly && (isTimeout || isGatewayError || isNetworkError)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delayMs = config._retryCount * 2000;
      console.warn(`[API_COLD_START_RETRY] Retrying GET to ${config.url} (Attempt ${config._retryCount}/2) in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// Stale-While-Revalidate GET Override for extreme speed
const originalGet = api.get;
api.get = async function (url: string, config?: any) {
  const key = getRequestKey(url, config);
  const cached = responseCache.get(key);
  
  // URL-based cancellation (base URL without query params)
  // Ensures that rapid filter changes cancel obsolete requests.
  const baseUrl = url.split('?')[0];
  
  // Only cancel previous request if parameters changed (different key), NOT when concurrent components call the same endpoint
  if (!inFlightRequests.has(key)) {
    const existing = activeControllers.get(baseUrl);
    if (existing && existing.key !== key) {
      existing.controller.abort();
    }
    const controller = new AbortController();
    activeControllers.set(baseUrl, { controller, key });
    if (!config) config = {};
    config.signal = controller.signal;
  }
  
  // If we have any cache, return it IMMEDIATELY
  if (cached) {
    // If it's stale (older than this URL's TTL), fetch fresh data in background silently
    if (Date.now() - cached.timestamp > getEffectiveTtl(url)) {
      if (!inFlightRequests.has(key)) {
        const req = originalGet.call(api, url, config)
          .then(res => {
            setCachedData(key, res.data); // Fixed: should be res.data, not res
            return res;
          })
          .catch(err => {
            if (axios.isCancel(err)) {
              console.log(`[Request Cancelled] ${url}`);
            } else {
              console.warn("[Background SWR Fetch Failed]", err);
            }
          })
          .finally(() => {
            inFlightRequests.delete(key);
            if (activeControllers.get(baseUrl)?.controller.signal === config?.signal) {
                activeControllers.delete(baseUrl);
            }
          });
        inFlightRequests.set(key, req);
      }
    }
    // Return cached data as an Axios Response object
    return { data: cached.data, status: 200, statusText: 'OK', headers: {}, config: config || {} } as any;
  }

  // If no cache, wait for existing in-flight request to prevent dupes
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // Otherwise, make the real request
  const req = originalGet.call(api, url, config).then(res => {
    setCachedData(key, res.data); // Store only data in cache
    return res;
  }).catch(err => {
      if (axios.isCancel(err)) {
        console.log(`[Request Cancelled] ${url}`);
      }
      throw err;
  }).finally(() => {
    inFlightRequests.delete(key);
    if (activeControllers.get(baseUrl)?.controller.signal === config?.signal) {
        activeControllers.delete(baseUrl);
    }
  });
  
  inFlightRequests.set(key, req);
  return req;
};


export const triggerFullSync = async (triggeredBy = 'admin') => {
  const res = await api.post(`/sync/full?triggered_by=${encodeURIComponent(triggeredBy)}`);
  return res.data;
};

export const triggerTargetedSync = async (studentIds: number[], triggeredBy = 'admin') => {
  const res = await api.post('/sync/targeted', { student_ids: studentIds, triggered_by: triggeredBy });
  return res.data;
};

export const getSyncStatus = async () => {
  const res = await api.get('/sync/status');
  return res.data;
};

export const getSyncJobDetails = async (jobId: string) => {
  const res = await api.get(`/sync/jobs/${jobId}`);
  return res.data;
};

export const triggerSingleStudentSync = async (studentId: number) => {
  const res = await api.post(`/sync/student/${studentId}`);
  return res.data;
};

export const getDataFreshness = async () => {
  const res = await api.get('/data/freshness');
  return res.data;
};

export const logActivity = async (action: string, description?: string, details?: any) => {
  try {
    await api.post('/admin/log-activity', {
      action,
      description: description || action,
      metadata: details
    }).catch(() => null);
  } catch (_e) {}
};

export default api;
