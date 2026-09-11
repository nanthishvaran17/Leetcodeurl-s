/**
 * Centralized API Base URL Configuration
 * SINGLE SOURCE OF TRUTH for all API communications across Website & Capacitor Android APK.
 */

// Primary Production Backend Base URL
export const PRODUCTION_BACKEND_URL = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  'https://leetcodeurl-s-3mig.onrender.com';

/**
 * Resolves the API Base URL dynamically based on execution environment:
 * 1. Capacitor Native Android/iOS App -> Uses absolute Backend HTTPS URL (/api)
 * 2. Web Browser (Vite dev server / Vercel hosting) -> Uses '/api' relative path or explicit VITE_API_URL
 */
export const getApiBaseUrl = (): string => {
  const isNative = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.origin.includes('capacitor://') ||
    window.location.origin.includes('ionic://')
  );

  if (isNative) {
    const base = PRODUCTION_BACKEND_URL.replace(/\/api\/?$/, '');
    return `${base}/api`;
  }

  // Web Browser context:
  // On localhost / 127.0.0.1, always use relative '/api' so requests are same-origin and proxied cleanly by Vite dev server
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/api';
  }

  if (import.meta.env.VITE_API_URL) {
    const envBase = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
    return `${envBase}/api`;
  }

  return 'https://leetcodeurl-s-3mig.onrender.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${API_BASE_URL.replace(/\/api$/, '')}${cleanPath}`;
  }
  return `${API_BASE_URL}${cleanPath}`;
};
