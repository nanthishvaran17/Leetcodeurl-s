import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth, getOrInitAuth } from '../services/firebase';
import api, { clearApiCache } from '../services/api';
import { AuthState, AuthUser, AuthContextType } from '../services/auth/authTypes';
import { checkGoogleRedirectResult, isMobileBrowser } from '../services/googleAuth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });

  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? 'AUTHORIZED' : 'INITIALIZING';
  });

  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  // Helper to clear error state
  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  // Standard login handler
  const login = useCallback((newToken: string, newUser: any) => {
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('token', newToken);
    }
    const formattedUser: AuthUser = {
      uid: newUser.uid || `user_${newUser.id || '1'}`,
      name: newUser.username || newUser.name || 'User',
      email: newUser.email || '',
      role: newUser.role || 'student',
      isProfileLinked: newUser.isProfileLinked !== undefined ? newUser.isProfileLinked : true,
      id: newUser.id,
      username: newUser.username,
      department_id: newUser.department_id || null,
      section_id: newUser.section_id || null
    };
    setUser(formattedUser);
    localStorage.setItem('user', JSON.stringify(formattedUser));
    clearAuthError();
    setAuthState('AUTHORIZED');
  }, [clearAuthError]);

  // Standard logout handler
  const logout = useCallback(async () => {
    setAuthState('AUTHENTICATING');
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_user');
    sessionStorage.clear();
    clearApiCache();

    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore API logout errors
    }

    try {
      const activeAuth = auth || getOrInitAuth();
      if (activeAuth) {
        await firebaseSignOut(activeAuth);
      }
    } catch (_err) {
      // Ignore Firebase signout errors
    }

    clearAuthError();
    setAuthState('UNAUTHENTICATED');
  }, [clearAuthError]);

  // Handle global auth_logout event triggered by api.ts on expired refresh
  useEffect(() => {
    const handleGlobalLogout = () => {
      logout();
    };
    window.addEventListener('auth_logout', handleGlobalLogout);
    return () => window.removeEventListener('auth_logout', handleGlobalLogout);
  }, [logout]);

  // App Initialization & Firebase Auth State Lifecycle
  useEffect(() => {
    let isMounted = true;

    const initializeAuthLifecycle = async () => {
      try {
        // 1. Check Google redirect result first (if returning from redirect flow on Mobile Web)
        const isMobileRedirect = !!(
          sessionStorage.getItem('nec_mobile_google_redirect') ||
          (typeof window !== 'undefined' && (window.location.search.includes('state=') || window.location.search.includes('code=')))
        );

        if (isMobileRedirect) {
          console.log('[MOBILE AUTH] Returning from mobile Google redirect flow');
          setAuthState('AUTHENTICATING');
          isVerifyingRef.current = true;
          try {
            const redirectRes = await checkGoogleRedirectResult();
            if (redirectRes && redirectRes.user && isMounted) {
              login(redirectRes.access_token || '', redirectRes.user);
              isVerifyingRef.current = false;
              return;
            }
          } catch (redirectErr: any) {
            if (isMounted) {
              const errMsg = redirectErr.response?.data?.detail || redirectErr.message || 'Google sign-in could not be completed. Please try again.';
              console.error('[MOBILE AUTH] Redirect auth failed:', errMsg);
              setAuthError(errMsg);
              setAuthState('AUTH_ERROR');
              isVerifyingRef.current = false;
              return;
            }
          } finally {
            sessionStorage.removeItem('nec_mobile_google_redirect');
            isVerifyingRef.current = false;
          }
        }

        // 2. Check HttpOnly server session endpoint if token exists
        const storedToken = localStorage.getItem('token');
        if (storedToken && storedToken.trim() !== '') {
          const res = await api.get('/auth/session').catch(() => null);
          if (res && res.data && res.data.authenticated && res.data.user && isMounted) {
            const u = res.data.user;
            const formattedUser: AuthUser = {
              uid: `user_${u.id}`,
              name: u.username || 'User',
              email: u.email || '',
              role: u.role || 'Admin',
              isProfileLinked: true,
              id: u.id,
              username: u.username,
              department_id: u.department_id || null
            };
            setUser(formattedUser);
            localStorage.setItem('user', JSON.stringify(formattedUser));
            setAuthState('AUTHORIZED');
            return;
          }
        }

        // 3. If stored user exists and session check didn't fail hard, keep authorized state
        const storedUser = localStorage.getItem('user');
        if (storedUser && isMounted) {
          setAuthState('AUTHORIZED');
          return;
        }

        if (isMounted) setAuthState('UNAUTHENTICATED');
      } catch (_err) {
        if (isMounted) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setAuthState('AUTHORIZED');
          } else {
            setAuthState('UNAUTHENTICATED');
          }
        }
      }
    };

    initializeAuthLifecycle();

    // 4. Subscribe to Firebase Auth state listener for seamless Google sign-in
    let unsubscribeFirebase: (() => void) | undefined;
    try {
      const activeAuth = auth || getOrInitAuth();
      if (activeAuth) {
        unsubscribeFirebase = onAuthStateChanged(activeAuth, async (fbUser: FirebaseUser | null) => {
          if (!isMounted) return;
          if (fbUser && fbUser.email) {
            // Only perform backend verification if we don't already have an active authorized session or active verification in-flight
            const storedUserStr = localStorage.getItem('user');
            if (!storedUserStr && !isVerifyingRef.current) {
              isVerifyingRef.current = true;
              setAuthState('AUTHENTICATED_PENDING_BACKEND');
              try {
                console.log('[MOBILE AUTH] Firebase auth state listener triggered');
                console.log('[MOBILE AUTH] ID token obtained');
                console.log('[MOBILE AUTH] Backend session requested');
                const idToken = await fbUser.getIdToken(true);
                const backendRes = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });
                if (backendRes.data && backendRes.data.authenticated && isMounted) {
                  console.log('[MOBILE AUTH] Backend session created');
                  console.log('[MOBILE AUTH] Auth state updated');
                  console.log('[MOBILE AUTH] Redirecting to dashboard');
                  console.log('[MOBILE AUTH] Login completed');
                  login(backendRes.data.access_token || '', backendRes.data.user);
                }
              } catch (err: any) {
                if (isMounted) {
                  console.warn('[MOBILE AUTH] Backend verification failed:', err);
                  try { await firebaseSignOut(activeAuth); } catch (_) {}
                  const errMsg = err.response?.data?.detail || err.message || 'Google sign-in could not be completed. Please try again.';
                  setAuthError(errMsg);
                  setAuthState('AUTH_ERROR');
                }
              } finally {
                isVerifyingRef.current = false;
              }
            }
          }
        });
      }
    } catch (_e) {
      // Firebase lazy init fallback
    }

    return () => {
      isMounted = false;
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, [login]);

  // Safety Timeout: 15s maximum wait for loading states to prevent permanent loading spinners
  useEffect(() => {
    if (authState === 'AUTHENTICATING' || authState === 'AUTHENTICATED_PENDING_BACKEND') {
      const timeout = setTimeout(() => {
        if (authState === 'AUTHENTICATING' || authState === 'AUTHENTICATED_PENDING_BACKEND') {
          console.warn('[MOBILE AUTH] Auth process timed out after 15s. Resetting state.');
          isVerifyingRef.current = false;
          setAuthError('Google sign-in could not be completed. Please try again.');
          setAuthState('AUTH_ERROR');
        }
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [authState]);

  // Google Sign-In trigger
  const signInWithGoogle = async () => {
    clearAuthError();
    setAuthState('AUTHENTICATING');
    try {
      const { authenticateWithGoogle } = await import('../services/googleAuth');
      const res = await authenticateWithGoogle();
      if (res && res.user) {
        login(res.access_token || '', res.user);
      }
    } catch (error: any) {
      const msg = error.message || 'Google sign-in could not be completed. Please try again.';
      setAuthError(msg);
      setAuthState('AUTH_ERROR');
    }
  };

  // OTP Send trigger
  const sendOtp = async (emailToUse: string) => {
    clearAuthError();
    setAuthState('AUTHENTICATING');
    try {
      const res = await api.post('/auth/send-otp', { email: emailToUse });
      setAuthState('UNAUTHENTICATED');
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to send OTP code.';
      setAuthError(msg);
      setAuthState('AUTH_ERROR');
      throw err;
    }
  };

  // OTP Verify trigger
  const verifyOtp = async (emailToUse: string, otpCode: string) => {
    clearAuthError();
    setAuthState('AUTHENTICATING');
    try {
      const res = await api.post('/auth/verify-otp', { email: emailToUse, otp: otpCode });
      login(res.data.access_token, res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Invalid verification code.';
      setAuthError(msg);
      setAuthState('AUTH_ERROR');
      throw err;
    }
  };

  const contextValue = useMemo(() => ({
    user,
    token,
    authState,
    authError,
    authNotice,
    login,
    signInWithGoogle,
    sendOtp,
    verifyOtp,
    logout,
    clearAuthError,
    isAuthenticated: authState === 'AUTHORIZED' || !!user
  }), [user, token, authState, authError, authNotice, login, signInWithGoogle, sendOtp, verifyOtp, logout, clearAuthError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';
