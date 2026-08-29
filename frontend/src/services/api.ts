import axios from 'axios';
import { auth } from '../firebase';

// Smart API Base URL Resolution for Local Development vs Production Hosting
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  // Fallback ONLY if env is somehow completely missing
  return '/api';
};

const API_BASE = getApiBaseUrl();

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
const activeControllers = new Map<string, AbortController>();
const responseCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60000; // Increased to 60 seconds

export const getCachedData = (key: string) => {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
};

export const setCachedData = (key: string, data: any) => {
  responseCache.set(key, { timestamp: Date.now(), data });
};

export const clearApiCache = () => {
  responseCache.clear();
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

api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('token');

  // If Firebase currentUser exists, ensure we fetch/refresh the latest ID Token
  if (auth && auth.currentUser) {
    try {
      const fbToken = await auth.currentUser.getIdToken();
      if (fbToken) {
        token = fbToken;
        localStorage.setItem('token', fbToken);
      }
    } catch (_err) {
      // Ignore token refresh errors and fallback to stored token
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Resilient Response Interceptor: Automatic Retry for Render Cold Starts & Network Glitches
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config || (config._retryCount && config._retryCount >= 2)) {
      return Promise.reject(error);
    }

    // Identify cold-start or gateway timeout conditions
    const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
    const isGatewayError = error.response && [502, 503, 504].includes(error.response.status);
    const isNetworkError = !error.response && Boolean(error.request);
    
    // Do NOT retry intentionally canceled/aborted requests
    const isCanceled = axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED';

    if (!isCanceled && (isTimeout || isGatewayError || isNetworkError)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delayMs = config._retryCount * 2000;
      console.warn(`[API_COLD_START_RETRY] Retrying request to ${config.url} (Attempt ${config._retryCount}/2) in ${delayMs}ms...`);
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
  
  // Only cancel if this isn't a duplicate in-flight request (handled below)
  if (!inFlightRequests.has(key)) {
    if (activeControllers.has(baseUrl)) {
      activeControllers.get(baseUrl)?.abort();
    }
    const controller = new AbortController();
    activeControllers.set(baseUrl, controller);
    if (!config) config = {};
    config.signal = controller.signal;
  }
  
  // If we have any cache, return it IMMEDIATELY
  if (cached) {
    // If it's stale (older than TTL), fetch fresh data in background silently
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
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
            if (activeControllers.get(baseUrl)?.signal === config?.signal) {
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
    if (activeControllers.get(baseUrl)?.signal === config?.signal) {
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
