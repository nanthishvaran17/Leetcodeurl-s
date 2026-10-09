import axios from 'axios';
import { API_BASE_URL, getApiBaseUrl, isCapacitorNative, getApiUrl as configGetApiUrl } from '../config/apiConfig';
export const getApiUrl = configGetApiUrl;

export const getAuthHeaders = async () => {
  let jwtToken = null;
  try {
    jwtToken = localStorage.getItem('token');
  } catch (e) {}
  
  if (jwtToken) {
    return { Authorization: `Bearer ${jwtToken}` };
  }
  try {
    const { getAuthInstance, getOrInitAuth } = await import('./firebase');
    const auth = getAuthInstance() || getOrInitAuth();
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch (_e) {}
  return { Authorization: '' };
};

const api = axios.create({
  baseURL: API_BASE_URL,
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

let firebaseModulePromise: Promise<any> | null = null;
const getFirebaseModule = () => {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import('./firebase').catch(err => {
      firebaseModulePromise = null;
      return null;
    });
  }
  return firebaseModulePromise;
};

// Asynchronous sub-millisecond request header dispatch
api.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  if (config.url && config.url.startsWith('/api/')) {
    config.url = config.url.substring(4);
  }

  // If request data is FormData, delete fixed Content-Type header so Axios/browser sets boundary automatically
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  // Fix: Provide the actual Origin header for Capacitor requests to pass backend CSRF validation.
  // CapacitorHttp native fetch drops the Origin header in some WebView versions.
  // We use window.location.origin to supply the real origin (not hardcoded).
  if (isCapacitorNative()) {
    const originVal = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'capacitor://localhost';
    config.headers['Origin'] = originVal;
    config.headers['X-App-Origin'] = originVal;
    config.headers['X-Capacitor-Platform'] = 'android';
  }

  try {
    // Skip token attachment for auth endpoints to prevent Firebase from hanging
    const isAuthRoute = config.url && (config.url.includes('/auth/login') || config.url.includes('/auth/refresh'));
    
    if (!isAuthRoute) {
      let jwtToken = null;
      try {
        jwtToken = localStorage.getItem('token');
      } catch (e) {}
      
      if (jwtToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${jwtToken}`;
      } else if (!jwtToken && !config.headers.Authorization) {
        const fbMod = await getFirebaseModule();
        if (fbMod) {
          const auth = fbMod.getAuthInstance?.() || fbMod.getOrInitAuth?.();
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[API] Could not attach auth token:', e);
  }
  return config;
});

// Periodic background keep-alive ping to prevent Render free-tier cold starts (Cross-tab coordinated)
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const lastPing = localStorage.getItem('last_health_ping');
      const now = Date.now();
      if (!lastPing || now - parseInt(lastPing) > 7 * 60 * 1000) {
        localStorage.setItem('last_health_ping', now.toString());
        originalGet.call(api, '/health').catch(() => {});
      }
    }
  }, 60 * 1000); // Check every minute, but ping at most once every 7 minutes globally across tabs
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

    // --- 0. BAILOUT FOR AUTH ROUTES ---
    const isAuthRoute = config.url && (config.url.includes('auth/login') || config.url.includes('auth/refresh') || config.url.includes('auth/session'));
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // --- 1. HANDLE AUTHENTICATION FAILURES (401) ---
    if (error.response && error.response.status === 401) {
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

      return new Promise(async (resolve, reject) => {
        // Attempt silent refresh using Firebase SDK
        try {
          const fbMod = await getFirebaseModule();
          const auth = fbMod?.getAuthInstance?.() || fbMod?.getOrInitAuth?.();
          if (!auth?.currentUser) {
            processQueue(new Error('No current user'), null);
            globalLogout();
            return reject(new Error('No current user'));
          }
          auth.currentUser.getIdToken(true)
            .then((newToken: string) => {
              try {
                localStorage.setItem('token', newToken);
                window.dispatchEvent(new CustomEvent('nec_token_refreshed', { detail: newToken }));
              } catch (_) {}
              config.headers['Authorization'] = 'Bearer ' + newToken;
              processQueue(null, newToken);
              resolve(api(config));
            })
            .catch((err: any) => {
              processQueue(err, null);
              globalLogout();
              reject(err);
            })
            .finally(() => {
              isRefreshing = false;
            });
        } catch (err) {
          processQueue(err, null);
          globalLogout();
          reject(err);
        }
      });
    }

    // --- 2. HANDLE NETWORK COLD STARTS / GATEWAY ERRORS (Auto-retry up to 3 times for cold-starts/502 Bad Gateway) ---
    if (config._retryCount && config._retryCount >= 3) {
      return Promise.reject(error);
    }

    const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
    const isGatewayError = error.response && [502, 503, 504].includes(error.response.status);
    const isNetworkError = !error.response && Boolean(error.request);
    const isCanceled = axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED';

    if (!isCanceled && (isTimeout || isGatewayError || isNetworkError)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delayMs = Math.min(2500, config._retryCount * 800);
      console.warn(`[API_COLD_START_RETRY] Retrying request to ${config.url} (Attempt ${config._retryCount}/3) in ${delayMs}ms due to server cold start...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// Stale-While-Revalidate GET Override for extreme speed
const originalGet = api.get;
api.get = async function (url: string, config?: any) {
  // Never cache live sync endpoints
  if (url.includes('/sync/status') || url.includes('/sync/jobs')) {
    return originalGet.call(api, url, config);
  }

  const key = getRequestKey(url, config);
  const cached = responseCache.get(key);
  
  // URL-based cancellation (only if explicitly requested via config.cancelPrior or if caller passed a signal)
  const baseUrl = url.split('?')[0];
  if (config?.cancelPrior && !inFlightRequests.has(key)) {
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


const getActiveUserTriggerTag = (fallback = 'admin'): string => {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      const name = u.full_name || u.name || u.displayName || u.username || (u.email ? u.email.split('@')[0] : null);
      if (name) return name;
    }
  } catch (e) {}
  return fallback;
};

export const triggerFullSync = async (triggeredBy?: string) => {
  const tag = triggeredBy || getActiveUserTriggerTag('admin');
  const res = await api.post(`/sync/full?triggered_by=${encodeURIComponent(tag)}`);
  return res.data;
};

export const triggerTargetedSync = async (studentIds: number[], triggeredBy?: string) => {
  const tag = triggeredBy || getActiveUserTriggerTag('admin');
  const res = await api.post('/sync/targeted', { student_ids: studentIds, triggered_by: tag });
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

let lastLoggedNav = '';
let lastLoggedNavTime = 0;

export const logActivity = async (action: string, description?: string, details?: any) => {
  try {
    if (action === 'PAGE_NAVIGATE') {
      const navKey = `${description || ''}:${JSON.stringify(details || {})}`;
      const now = Date.now();
      if (lastLoggedNav === navKey && now - lastLoggedNavTime < 3000) {
        return; // Deduplicate rapid identical page navigation logs
      }
      lastLoggedNav = navKey;
      lastLoggedNavTime = now;
    }
    await api.post('/admin/log-activity', {
      action,
      description: description || action,
      metadata: details
    }).catch(() => null);
  } catch (_e) {}
};

export default api;
