import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { getOrInitAuth, createGoogleProvider } from './firebase';
import api from './api';

export interface GoogleAuthResult {
  authenticated: boolean;
  access_token?: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    department_id?: number | null;
    section_id?: number | null;
  };
}

/** Check whether running inside native Android/iOS Capacitor container */
export const isNativeMobile = (): boolean => {
  try {
    // @ts-ignore — window.Capacitor is injected by native runtime bridge
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

let redirectCheckPromise: Promise<GoogleAuthResult | null> | null = null;

/**
 * Safely checks if the user is returning from a Google signInWithRedirect flow on Web.
 */
export const checkGoogleRedirectResult = async (): Promise<GoogleAuthResult | null> => {
  if (redirectCheckPromise) return redirectCheckPromise;

  redirectCheckPromise = (async () => {
    try {
      const auth = getOrInitAuth();
      const cred = await getRedirectResult(auth);
      if (cred && cred.user && cred.user.email) {
        console.log('[GOOGLE_REDIRECT_SUCCESS] Redirect result retrieved from Firebase Auth.');
        const idToken = await cred.user.getIdToken(true);
        const response = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });
        if (response.data && response.data.authenticated) {
          return response.data;
        }
      }
    } catch (err: any) {
      const errStr = String(err?.message || err?.code || err || '');
      if (
        errStr.includes('missing initial state') ||
        errStr.includes('sessionStorage') ||
        err?.code === 'auth/missing-initial-state' ||
        err?.code === 'auth/web-storage-unsupported'
      ) {
        console.warn('[GOOGLE_REDIRECT_STORAGE_PARTITIONED] Handled missing initial state gracefully');
        if (typeof window !== 'undefined' && window.history && window.location.search.includes('state=')) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } else {
        console.warn('[GOOGLE_REDIRECT_CHECK_ERR]', err);
      }
    }
    return null;
  })();

  return redirectCheckPromise;
};

// ========================================================
// PKCE (RFC 7636) Cryptographic Utilities
// ========================================================
function generateRandomString(length: number = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => possible[byte % possible.length]).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  }
  // Fallback
  return codeVerifier;
}

// Active in-flight PKCE session
interface ActivePkceSession {
  code_verifier: string;
  state: string;
  timestamp: number;
  resolve?: (res: GoogleAuthResult) => void;
  reject?: (err: Error) => void;
}

let activePkceSession: ActivePkceSession | null = null;
let isProcessingCallback = false;

/**
 * Authoritative Single Handler for Native OAuth Callbacks.
 * Validates State + Exchanges PKCE Authorization Code via Secure Backend HTTPS API.
 */
export const handleOAuthCallbackUrl = async (urlStr: string): Promise<GoogleAuthResult | null> => {
  if (!urlStr || !urlStr.includes('oauth-callback')) {
    return null;
  }

  if (isProcessingCallback) {
    console.log('[OAUTH_CALLBACK] Already processing callback in flight, ignoring duplicate event.');
    return null;
  }

  isProcessingCallback = true;
  console.log('[OAUTH_CALLBACK_START] Processing PKCE authorization code callback...');

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {});
  } catch (_e) {}

  try {
    const cleanUrlStr = urlStr
      .replace(/^org\.nandhaengg\.leetcodesync:\/\//, 'https://dummy.local/')
      .replace(/^leetcodesync:\/\//, 'https://dummy.local/');

    const parsed = new URL(cleanUrlStr);
    const errorParam = parsed.searchParams.get('error');
    const codeParam = parsed.searchParams.get('code');
    const stateParam = parsed.searchParams.get('state');

    if (errorParam) {
      const errMsg = errorParam.toLowerCase().includes('cancel')
        ? 'Google sign-in was cancelled.'
        : errorParam;
      if (activePkceSession?.reject) {
        activePkceSession.reject(new Error(errMsg));
      }
      activePkceSession = null;
      throw new Error(errMsg);
    }

    if (!codeParam) {
      throw new Error('No authorization code returned in callback.');
    }

    // Validate State
    if (activePkceSession && activePkceSession.state && stateParam) {
      if (activePkceSession.state !== stateParam) {
        throw new Error('OAuth State verification failed (possible CSRF attempt).');
      }
    }

    const codeVerifier = activePkceSession?.code_verifier || '';

    // Securely exchange code + code_verifier via HTTPS backend endpoint
    const res = await api.post('/auth/google/exchange-code', {
      code: codeParam,
      code_verifier: codeVerifier,
      state: stateParam || ''
    }, { timeout: 35000 });

    if (res.data && res.data.authenticated && res.data.user) {
      const result: GoogleAuthResult = {
        authenticated: true,
        access_token: res.data.access_token || '',
        user: res.data.user
      };

      if (activePkceSession?.resolve) {
        activePkceSession.resolve(result);
      }
      activePkceSession = null;
      return result;
    }

    throw new Error('Unable to establish authenticated session with institutional server.');
  } catch (err: any) {
    if (activePkceSession?.reject) {
      activePkceSession.reject(err);
    }
    activePkceSession = null;
    throw err;
  } finally {
    setTimeout(() => {
      isProcessingCallback = false;
    }, 500);
  }
};

/**
 * Native Android Mobile Google Sign-In using Chrome Custom Tab + PKCE (RFC 7636).
 * Zero tokens, passwords, or credentials are ever transmitted via URL parameters.
 */
const authenticateWithGoogleMobile = async (): Promise<GoogleAuthResult> => {
  console.log('[GOOGLE_MOBILE_AUTH_STARTED] Initializing PKCE Authorization Code Flow...');

  const { Browser } = await import('@capacitor/browser');

  const scheme = 'org.nandhaengg.leetcodesync';
  let bridgeBase = 'https://leetcodeurl-s-roan.vercel.app';
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    bridgeBase = window.location.origin;
  }

  const apiBase = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL)) || 'https://leetcodeurl-s-roan.vercel.app/api';

  // 1. Generate PKCE parameters
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  const authUrl = `${bridgeBase}/mobile-auth.html?scheme=${scheme}&code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}&api_base=${encodeURIComponent(apiBase)}`;

  return new Promise<GoogleAuthResult>((resolve, reject) => {
    activePkceSession = {
      code_verifier: codeVerifier,
      state: state,
      timestamp: Date.now(),
      resolve,
      reject
    };

    // Listen for browser closed / dismissed by user
    let browserFinishedListener: any = null;
    Browser.addListener('browserFinished', () => {
      setTimeout(() => {
        if (activePkceSession) {
          activePkceSession.reject?.(new Error('Google sign-in was cancelled.'));
          activePkceSession = null;
        }
      }, 600);
    }).then(handle => {
      browserFinishedListener = handle;
    });

    // Launch Chrome Custom Tab
    Browser.open({ url: authUrl, windowName: '_self' }).catch((_err) => {
      if (activePkceSession) {
        activePkceSession.reject?.(new Error('Unable to open browser for Google authentication.'));
        activePkceSession = null;
      }
    });
  });
};

/**
 * Universal Google Sign-In Entrypoint.
 * Automatically delegates to Chrome Custom Tab on Native Mobile and Firebase Auth on Web.
 */
export const authenticateWithGoogle = async (): Promise<GoogleAuthResult> => {
  if (isNativeMobile()) {
    return authenticateWithGoogleMobile();
  }

  // Web Browser Flow via Firebase Auth
  const authInstance = getOrInitAuth();
  const provider = createGoogleProvider();

  try {
    const cred = await signInWithPopup(authInstance, provider);
    if (!cred || !cred.user) throw new Error('No user profile returned from Google.');

    const idToken = await cred.user.getIdToken(true);
    const response = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });
    return response.data;
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(authInstance, provider);
      return new Promise(() => {}); // Page will redirect
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in was cancelled.');
    }
    if (code === 'auth/argument-error') {
      console.warn('[FIREBASE_ARGUMENT_ERROR] Retrying with fresh provider instance...');
      const fallbackProvider = new GoogleAuthProvider();
      fallbackProvider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(authInstance, fallbackProvider);
      if (cred && cred.user) {
        const idToken = await cred.user.getIdToken(true);
        const response = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });
        return response.data;
      }
    }
    throw err;
  }
};
