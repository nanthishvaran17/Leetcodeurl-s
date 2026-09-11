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
 * Detects if the current runtime environment is a Capacitor Native App (Android / iOS)
 */
export const isCapacitorNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (cap?.platform && cap.platform !== 'web') return true;
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
  if (window.location.origin.includes('capacitor://') || window.location.origin.includes('ionic://')) return true;
  if (typeof navigator !== 'undefined' && /Capacitor/i.test(navigator.userAgent)) return true;
  
  // Capacitor Android with androidScheme: 'https' or 'http' runs on origin 'https://localhost' or 'http://localhost'
  // (without a Vite dev server port like :3000 or :5173 or local backend :8000)
  if (
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port !== '3000' &&
    window.location.port !== '5173' &&
    window.location.port !== '8000'
  ) {
    return true;
  }
  return false;
};

/**
 * Resolves the API Base URL dynamically based on execution environment:
 * 1. Capacitor Native Android/iOS App -> Uses absolute Backend HTTPS URL (https://leetcodeurl-s-3mig.onrender.com/api)
 * 2. Web Browser (Vite dev server) -> Uses '/api' relative path proxied by Vite
 * 3. Production Web (Vercel) -> Uses absolute backend URL or explicit VITE_API_URL
 */
export const getApiBaseUrl = (): string => {
  if (isCapacitorNative()) {
    const base = PRODUCTION_BACKEND_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    return `${base}/api`;
  }

  // Web Browser dev environment (e.g. running on localhost:3000 or localhost:5173)
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (window.location.port === '3000' || window.location.port === '5173')
  ) {
    return '/api';
  }

  if (import.meta.env.VITE_API_URL) {
    const envBase = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    return `${envBase}/api`;
  }

  return 'https://leetcodeurl-s-3mig.onrender.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const getApiUrl = (path: string): string => {
  const currentBase = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (currentBase.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${currentBase.replace(/\/api$/, '')}${cleanPath}`;
  }
  return `${currentBase}${cleanPath}`;
};
