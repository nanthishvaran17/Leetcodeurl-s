import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { getOrInitAuth, createGoogleProvider } from './firebase';
import api from './api';
import { API_BASE_URL } from '../config/apiConfig';

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

/** Check whether running in a mobile web browser (e.g. Chrome on Android, Safari on iOS) */
export const isMobileBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchScreen = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || (isTouchScreen && isSmallScreen);
};

/** Detect common in-app browsers that block OAuth (Instagram, FB, LinkedIn, TikTok, etc.) */
export const isInAppBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const inAppSignatures = [
    'FBAN', 'FBAV', 'Instagram', 'LinkedIn', 'Snapchat',
    'TikTok', 'Twitter', 'Bytedance', 'Line', 'MicroMessenger', 'WeChat'
  ];
  return inAppSignatures.some(sig => ua.includes(sig));
};

/** Probe if local storage / IndexedDB is available (detect Safari Private Browsing / Partitioning blocks) */
export const isStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
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
  return codeVerifier;
}

// Active in-flight PKCE session
interface ActivePkceSession {
  code_verifier: string;
  state: string;
  timestamp: number;
  resolve?: (res: GoogleAuthResult) => void;
  reject?: (err: Error) => void;
  /** Safety timeout handle — must be cleared on success/failure/cancel */
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

let activePkceSession: ActivePkceSession | null = null;
let isProcessingCallback = false;

/**
 * Cleans up the active PKCE session completely.
 * Clears the safety timeout, clears sessionStorage, and nulls the session reference.
 */
function cleanupPkceSession(): void {
  if (activePkceSession?.timeoutHandle) {
    clearTimeout(activePkceSession.timeoutHandle);
  }
  activePkceSession = null;
  sessionStorage.removeItem('nec_pkce_verifier');
  sessionStorage.removeItem('nec_pkce_state');
}

/**
 * Authoritative Single Handler for Native OAuth Callbacks.
 * Validates State + Exchanges PKCE Authorization Code via Secure Backend HTTPS API.
 *
 * Called from:
 *   - App.tsx `appUrlOpen` (warm-start: app already running)
 *   - App.tsx `getLaunchUrl()` (cold-start: app launched by the deep-link intent)
 */
export const handleOAuthCallbackUrl = async (urlStr: string): Promise<GoogleAuthResult | null> => {
  if (!urlStr || !urlStr.includes('oauth-callback')) {
    return null;
  }

  if (isProcessingCallback) {
    console.log('[MOBILE AUTH] Already processing callback in flight, ignoring duplicate event.');
    return null;
  }

  isProcessingCallback = true;
  console.log('[MOBILE AUTH] CALLBACK_RECEIVED');

  // Close the Chrome Custom Tab if it is still open.
  // NOTE: In most cases it is already closed when the deep link fires — this is a safety call only.
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {
      console.log('[MOBILE AUTH] Browser close skipped/failed — already closed, continuing.');
    });
  } catch (_e) {}

  try {
    // -------------------------------------------------------
    // Robust URL parsing — handles both:
    //   org.nandhaengg.leetcodesync://oauth-callback?code=...
    //   leetcodesync://oauth-callback?code=...
    // -------------------------------------------------------
    const questionMarkIdx = urlStr.indexOf('?');
    const base = questionMarkIdx !== -1 ? urlStr.substring(0, questionMarkIdx) : urlStr;
    const queryString = questionMarkIdx !== -1 ? urlStr.substring(questionMarkIdx + 1) : '';
    const searchParams = new URLSearchParams(queryString);

    if (!base.startsWith('org.nandhaengg.leetcodesync://oauth-callback') &&
        !base.startsWith('leetcodesync://oauth-callback')) {
      throw new Error('Invalid callback URL scheme or host.');
    }

    console.log('[MOBILE AUTH] CALLBACK_URL_VALIDATED');

    const errorParam = searchParams.get('error');
    const codeParam = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (errorParam) {
      const errMsg = errorParam.toLowerCase().includes('cancel')
        ? 'Google sign-in was cancelled.'
        : errorParam;
      console.log('[MOBILE AUTH] AUTH_FAILED Reason:', errMsg);
      throw new Error(errMsg);
    }

    if (!codeParam) {
      console.log('[MOBILE AUTH] AUTH_FAILED Reason: No authorization code in callback');
      throw new Error('No authorization code returned in callback.');
    }

    const expectedState = activePkceSession?.state || sessionStorage.getItem('nec_pkce_state');
    const codeVerifier = activePkceSession?.code_verifier || sessionStorage.getItem('nec_pkce_verifier');

    if (!expectedState || !codeVerifier) {
      console.log('[MOBILE AUTH] AUTH_FAILED Reason: Missing expected state or verifier (PKCE expired or session lost)');
      throw new Error('OAuth session expired. Please sign in again.');
    }

    if (expectedState !== stateParam) {
      console.log('[MOBILE AUTH] AUTH_FAILED Reason: State mismatch');
      throw new Error('OAuth State verification failed (possible CSRF attempt).');
    }

    console.log('[MOBILE AUTH] STATE_VALIDATED');
    console.log('[MOBILE AUTH] PKCE_VERIFIER_RESOLVED');

    let res: any = null;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[MOBILE AUTH] BACKEND_SESSION_STARTED Attempt ${attempt}/${maxAttempts}`);
        res = await api.post('/auth/google/exchange-code', {
          code: codeParam,
          code_verifier: codeVerifier,
          state: stateParam || ''
        }, { timeout: 10000 });

        if (res.data && res.data.authenticated) break;
      } catch (postErr: any) {
        console.warn(`[MOBILE AUTH] BACKEND_SESSION Attempt ${attempt} note:`, postErr?.message || postErr);

        const isClientError = postErr?.response?.status >= 400 && postErr?.response?.status < 500;

        if (isClientError || attempt >= maxAttempts) {
          throw postErr;
        }
        await new Promise(r => setTimeout(r, 800)); // 800ms retry delay
      }
    }

    if (res && res.data && res.data.authenticated && res.data.user) {
      console.log('[MOBILE AUTH] BACKEND_SESSION_SUCCESS');
      console.log('[MOBILE AUTH] AUTHENTICATION_COMPLETE');

      const result: GoogleAuthResult = {
        authenticated: true,
        access_token: res.data.access_token || '',
        user: res.data.user
      };

      if (activePkceSession?.resolve) {
        activePkceSession.resolve(result);
      }
      cleanupPkceSession();

      console.log('[MOBILE AUTH] DASHBOARD_REDIRECT');
      return result;
    }

    console.log('[MOBILE AUTH] AUTH_FAILED Reason: Invalid session response from server');
    throw new Error('Unable to establish authenticated session with institutional server.');
  } catch (err: any) {
    console.error('[MOBILE AUTH] AUTH_FAILED Error:', err?.message || err);
    if (activePkceSession?.reject) {
      activePkceSession.reject(err);
    }
    cleanupPkceSession();
    throw err;
  } finally {
    // Extended reset window: Chrome Custom Tab delivers appUrlOpen slightly after
    // browserFinished (now removed). Give 2s to prevent duplicate event blocking.
    setTimeout(() => {
      isProcessingCallback = false;
    }, 2000);
  }
};

/**
 * Native Android Mobile Google Sign-In using Chrome Custom Tab + PKCE (RFC 7636).
 * Zero tokens, passwords, or credentials are ever transmitted via URL parameters.
 *
 * FIX: The `browserFinished` listener has been intentionally removed.
 *
 * REASON: Chrome Custom Tab fires `browserFinished` BEFORE the Android OS delivers
 * the deep-link `appUrlOpen` event back to the Capacitor app. The old listener was
 * causing a race: it would reject the in-flight Promise 600ms after the tab closed,
 * but the `appUrlOpen` event (with the valid auth code) arrived immediately after —
 * finding `activePkceSession` already null and dropping the successful callback.
 *
 * The 90-second safety timeout handles genuine abandonment (user walks away).
 * Cold-start abandonment is handled by `App.tsx getLaunchUrl()` returning null.
 */
const authenticateWithGoogleMobile = async (): Promise<GoogleAuthResult> => {
  console.log('[MOBILE AUTH] AUTH_STARTED');

  // Clean up any stale previous session before starting a fresh one.
  // This prevents listener accumulation across retries.
  if (activePkceSession) {
    console.log('[MOBILE AUTH] Cleaning up stale previous PKCE session before new attempt.');
    cleanupPkceSession();
  }

  const { Browser } = await import('@capacitor/browser');

  const scheme = 'org.nandhaengg.leetcodesync';
  let bridgeBase = 'https://leetcodeurl-s-roan.vercel.app';
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    bridgeBase = window.location.origin;
  }

  // Authoritative production API endpoint — resolved from centralized config
  const apiBase = API_BASE_URL;

  // 1. Generate PKCE parameters
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  // Persist in sessionStorage in case WebView is recycled (cold-start recovery)
  sessionStorage.setItem('nec_pkce_verifier', codeVerifier);
  sessionStorage.setItem('nec_pkce_state', state);

  const authUrl = `${bridgeBase}/mobile-auth.html?scheme=${scheme}&code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}&api_base=${encodeURIComponent(apiBase)}`;

  console.log('[MOBILE AUTH] OAuth redirect URL prepared');
  console.log('[MOBILE AUTH] Launching Chrome Custom Tab');

  return new Promise<GoogleAuthResult>((resolve, reject) => {
    // Safety timeout: 90 seconds maximum wait for user to complete Google sign-in.
    // This is the ONLY cancellation path for abandonment — browserFinished is NOT used
    // because it fires before appUrlOpen delivers the auth code on success.
    const timeoutHandle = setTimeout(() => {
      if (activePkceSession) {
        console.warn('[MOBILE AUTH] AUTH_TIMEOUT — 90s elapsed without callback');
        activePkceSession.reject?.(new Error('Google sign-in could not be completed. Please try again.'));
        cleanupPkceSession();
      }
    }, 90000);

    activePkceSession = {
      code_verifier: codeVerifier,
      state: state,
      timestamp: Date.now(),
      resolve,
      reject,
      timeoutHandle,
    };

    // -------------------------------------------------------
    // NOTE: browserFinished listener intentionally NOT added here.
    // See function JSDoc above for the full explanation.
    // -------------------------------------------------------

    // Launch Chrome Custom Tab
    Browser.open({ url: authUrl, windowName: '_self' }).catch((_err) => {
      console.error('[MOBILE AUTH] Failed to open Chrome Custom Tab:', _err?.message || _err);
      if (activePkceSession) {
        activePkceSession.reject?.(new Error('Unable to open browser for Google authentication.'));
        cleanupPkceSession();
      }
    });
  });
};

/**
 * Universal Google Sign-In Entrypoint.
 * Automatically handles:
 * - Native Mobile App: Chrome Custom Tab + PKCE
 * - Mobile Web Browser: Firebase Redirect Flow (safe against popup blockers and ITP)
 * - Desktop Web Browser: Existing Firebase Popup Flow (100% untouched)
 */
export const authenticateWithGoogle = async (): Promise<GoogleAuthResult> => {
  if (isNativeMobile()) {
    return authenticateWithGoogleMobile();
  }

  const authInstance = getOrInitAuth();
  const provider = createGoogleProvider();

  // Mobile Web Browser Flow: Try direct popup flow first (allowed in touch/click event handlers)
  if (isMobileBrowser()) {
    console.log('[MOBILE AUTH] Login initiated');
    console.log('[MOBILE AUTH] Google authentication started (Mobile Web)');
    try {
      console.log('[MOBILE AUTH] Attempting mobile popup authentication...');
      const cred = await signInWithPopup(authInstance, provider);
      if (cred && cred.user) {
        console.log('[MOBILE AUTH] OAuth callback received');
        console.log('[MOBILE AUTH] Firebase result received');
        console.log('[MOBILE AUTH] Firebase user verified');
        const idToken = await cred.user.getIdToken(true);
        console.log('[MOBILE AUTH] ID token obtained');
        console.log('[MOBILE AUTH] Backend session requested');
        const response = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });
        if (response.data && response.data.authenticated) {
          console.log('[MOBILE AUTH] Backend session created');
          console.log('[MOBILE AUTH] Auth state updated');
          console.log('[MOBILE AUTH] Redirecting to dashboard');
          console.log('[MOBILE AUTH] Login completed');
          return response.data;
        }
      }
    } catch (popupErr: any) {
      const code = popupErr?.code || '';
      console.warn('[MOBILE AUTH] Mobile popup note:', code || popupErr?.message);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in was cancelled.');
      }
      // If popup was blocked or unsupported, fallback to redirect flow
      console.log('[MOBILE AUTH] Popup blocked or unhandled; initiating robust redirect flow...');

      // PRE-FLIGHT CHECKS FOR MOBILE REDIRECT FLOW
      if (isInAppBrowser()) {
        console.warn('[MOBILE AUTH] In-app browser detected, blocking redirect');
        throw new Error('IN_APP_BROWSER_BLOCKED: Please open this link in Chrome or Safari to sign in.');
      }

      if (!isStorageAvailable()) {
        console.warn('[MOBILE AUTH] Storage unavailable (likely Safari Private Browsing), blocking redirect');
        throw new Error('STORAGE_UNAVAILABLE: Private browsing blocks sign-in. Please try a regular browser tab.');
      }

      sessionStorage.setItem('nec_mobile_google_redirect', '1');
      await signInWithRedirect(authInstance, provider);
      return new Promise(() => {}); // Page will redirect
    }
  }

  // Desktop Web Browser Flow: Existing Working Popup Flow (PRESERVED 100% UNCHANGED)
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
