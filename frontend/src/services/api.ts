import axios from 'axios';
import { auth } from '../firebase';

// Smart API Base URL Resolution for Local Development vs Production Hosting
const getApiBaseUrl = () => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isLocal && import.meta.env.DEV) {
    return 'http://127.0.0.1:8000/api';
  }

  // Production Cloud Hosting
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
  },
});


// In-flight GET request deduplication map to prevent redundant concurrent network round-trips
const inFlightRequests = new Map<string, Promise<any>>();
const responseCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 30000; // 30 seconds TTL

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

export const getRequestKey = (config: any): string => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${method}:${url}:${params}`;
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

    if (isTimeout || isGatewayError || isNetworkError) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delayMs = config._retryCount * 2000;
      console.warn(`[API_COLD_START_RETRY] Retrying request to ${config.url} (Attempt ${config._retryCount}/2) in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(config);
    }

    return Promise.reject(error);
  }
);


export const triggerFullSync = async (triggeredBy = 'admin') => {
  const res = await api.post(`/sync/full?triggered_by=${encodeURIComponent(triggeredBy)}`);
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
