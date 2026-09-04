import { signInWithPopup, UserCredential } from 'firebase/auth';
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

export const authenticateWithGoogle = async (): Promise<GoogleAuthResult> => {
  console.log('[GOOGLE_AUTH_STARTED] Initiating Google Sign-In popup...');

  try {
    const auth = getOrInitAuth();
    
    // Configure Provider Scopes
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');

    // Step 1: Firebase Google Sign-In Popup
    let cred: UserCredential;
    try {
      cred = await signInWithPopup(auth, googleProvider);
      console.log('[GOOGLE_POPUP_SUCCESS] Firebase Google popup authenticated successfully.');
    } catch (popupErr: any) {
      console.error('[GOOGLE_POPUP_ERROR]', popupErr);
      const errStr = String(popupErr?.message || popupErr?.code || '');
      if (errStr.includes('missing initial state') || errStr.includes('sessionStorage') || popupErr.code === 'auth/web-storage-unsupported') {
        throw new Error('Browser storage restriction detected. Please log in using your institutional Email/Password or allow third-party cookies in browser settings.');
      } else if (popupErr.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in was cancelled.');
      } else if (popupErr.code === 'auth/popup-blocked') {
        throw new Error('Please allow popups for this site and try again.');
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

    // Step 3: Backend Verification & Admin Authorization Check (35s timeout for Render cold-starts)
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
