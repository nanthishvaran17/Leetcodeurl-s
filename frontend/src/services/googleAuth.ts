import { signInWithPopup, signInWithRedirect, getRedirectResult, UserCredential } from 'firebase/auth';
import { getOrInitAuth, googleProvider } from './firebase';
import api from './api';

export interface GoogleAuthResult {
  authenticated: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    department_id?: number | null;
    section_id?: number | null;
  };
}

let redirectCheckPromise: Promise<GoogleAuthResult | null> | null = null;

/**
 * Safely checks if the user is returning from a Google signInWithRedirect flow.
 * Handles storage-partitioning ('missing initial state') gracefully without crashing the app.
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
        console.warn('[GOOGLE_REDIRECT_STORAGE_PARTITIONED] Handled missing initial state gracefully:', errStr);
        // Clear any orphaned redirect query params from URL if present
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

export const authenticateWithGoogle = async (): Promise<GoogleAuthResult> => {
  console.log('[GOOGLE_AUTH_STARTED] Initiating Google Sign-In...');

  try {
    const auth = getOrInitAuth();

    // Configure Provider Scopes
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');

    // Step 1: Attempt Firebase Google Sign-In Popup first (Works reliably across Desktop & Mobile with user gesture)
    let cred: UserCredential;
    try {
      cred = await signInWithPopup(auth, googleProvider);
      console.log('[GOOGLE_POPUP_SUCCESS] Firebase Google popup authenticated successfully.');
    } catch (popupErr: any) {
      const errStr = String(popupErr?.message || popupErr?.code || '');
      console.warn('[GOOGLE_POPUP_FAIL]', popupErr.code, popupErr.message);

      if (
        errStr.includes('missing initial state') ||
        errStr.includes('sessionStorage') ||
        popupErr.code === 'auth/missing-initial-state' ||
        popupErr.code === 'auth/web-storage-unsupported'
      ) {
        throw new Error(
          'Mobile browser storage restriction detected. Please sign in using your institutional Email/Password or Secure OTP login.'
        );
      } else if (popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in was cancelled.');
      } else if (popupErr.code === 'auth/unauthorized-domain' || errStr.includes('unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        throw new Error(
          `Unauthorized Domain: "${currentHost}" is not authorized in Firebase Console. Add "${currentHost}" under Firebase Console -> Authentication -> Settings -> Authorized Domains.`
        );
      } else if (popupErr.code === 'auth/popup-blocked' || errStr.includes('popup-blocked') || errStr.includes('popup')) {
        console.warn('[GOOGLE_POPUP_BLOCKED] Popup blocked by browser. Attempting resilient redirect fallback...');
        try {
          await signInWithRedirect(auth, googleProvider);
          throw new Error('Redirecting to Google Sign-In...');
        } catch (redirectErr: any) {
          const rErrStr = String(redirectErr?.message || redirectErr?.code || '');
          if (rErrStr.includes('missing initial state') || rErrStr.includes('sessionStorage')) {
            throw new Error(
              'Your browser blocked redirect storage state. Please allow third-party cookies or use Email/Password / OTP login.'
            );
          }
          throw redirectErr;
        }
      } else if (popupErr.code === 'auth/account-exists-with-different-credential') {
        throw new Error('Please sign in using your existing authentication method for this account.');
      } else {
        throw new Error(popupErr.message || 'Unable to complete Google sign-in. Please try again.');
      }
    }

    const firebaseUser = cred.user;
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error('Google account must have a valid email address.');
    }

    // Step 2: Retrieve Firebase ID Token
    const idToken = await firebaseUser.getIdToken(true);
    console.log('[GOOGLE_TOKEN_RECEIVED] Firebase ID token retrieved successfully.');

    // Step 3: Backend verification & role authorization
    console.log('[GOOGLE_BACKEND_REQUEST] Posting ID token to backend /api/auth/google...');
    const response = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });

    if (!response.data || !response.data.authenticated) {
      throw new Error('Please sign in using your authorized institutional Google account.');
    }

    return response.data;
  } catch (err: any) {
    if (err.response?.data?.detail) {
      throw new Error(err.response.data.detail);
    }
    throw new Error(err.message || 'Google authentication service is temporarily unavailable.');
  }
};

