import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth, getOrInitAuth } from '../services/firebase';
import api, { clearApiCache } from '../services/api';
import { AuthState, AuthUser, AuthContextType } from '../services/auth/authTypes';
import { isMobileBrowser } from '../services/googleAuth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
  const login = useCallback((newToken: string | null, newUser: any) => {
    if (newToken) {
      setToken(newToken);
      // Removed localStorage.setItem('token', newToken); to rely on Firebase Auth
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
      section_id: newUser.section_id || null,
      // HOD multi-department scope — populated from backend on every login/session
      authorized_department_ids: Array.isArray(newUser.authorized_department_ids)
        ? newUser.authorized_department_ids
        : [],
      authorized_department_codes: Array.isArray(newUser.authorized_department_codes)
        ? newUser.authorized_department_codes
        : [],
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
    setAuthState('AUTH_UNAUTHENTICATED');
  }, [clearAuthError]);

  // Handle global auth_logout event triggered by api.ts on expired refresh
  useEffect(() => {
    const handleGlobalLogout = () => {
      logout();
    };
    window.addEventListener('auth_logout', handleGlobalLogout);
    return () => window.removeEventListener('auth_logout', handleGlobalLogout);
  }, [logout]);

  // Centralized Firebase User Resolution Helper (Checks getRedirectResult, currentUser, onAuthStateChanged, and bounded polling)
  const resolveAuthenticatedFirebaseUser = useCallback(async (authInstance: any): Promise<FirebaseUser | null> => {
    // Step 1: Check getRedirectResult
    try {
      const { getRedirectResult } = await import('firebase/auth');
      const result = await getRedirectResult(authInstance).catch((e) => {
        console.warn('[AUTH RESOLVE] getRedirectResult note:', e?.message || e);
        return null;
      });
      if (result && result.user) {
        console.log('[AUTH RESOLVE] Resolved Firebase user via getRedirectResult');
        return result.user;
      }
    } catch (err) {
      console.warn('[AUTH RESOLVE] Error checking getRedirectResult:', err);
    }

    // Step 2: Check authInstance.currentUser
    if (authInstance.currentUser) {
      console.log('[AUTH RESOLVE] Resolved Firebase user via auth.currentUser');
      return authInstance.currentUser;
    }

    // Step 3: Bounded wait for onAuthStateChanged / currentUser polling
    return new Promise<FirebaseUser | null>((resolve) => {
      let isSettled = false;

      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        if (user && !isSettled) {
          isSettled = true;
          unsubscribe();
          console.log('[AUTH RESOLVE] Resolved Firebase user via onAuthStateChanged');
          resolve(user);
        }
      });

      const pollInterval = setInterval(() => {
        if (authInstance.currentUser && !isSettled) {
          isSettled = true;
          clearInterval(pollInterval);
          unsubscribe();
          console.log('[AUTH RESOLVE] Resolved Firebase user via polling auth.currentUser');
          resolve(authInstance.currentUser);
        }
      }, 350);

      // Bounded timeout (6 seconds max wait)
      setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          clearInterval(pollInterval);
          unsubscribe();
          console.warn('[AUTH RESOLVE] Bounded timeout reached without active Firebase user');
          resolve(null);
        }
      }, 6000);
    });
  }, []);

  // App Initialization & Firebase Auth State Lifecycle
  useEffect(() => {
    let isMounted = true;
    let unsubscribeFirebase: (() => void) | undefined;
    const isBackendExchangingRef = { current: false };

    const performBackendExchange = async (fbUser: FirebaseUser) => {
      if (isBackendExchangingRef.current) return;
      isBackendExchangingRef.current = true;
      setAuthState('AUTHENTICATED_PENDING_BACKEND');

      try {
        console.log('[AUTH] Initiating backend session exchange');
        const idToken = await fbUser.getIdToken();
        const backendRes = await api.post('/auth/google', { id_token: idToken }, { timeout: 35000 });

        if (backendRes.data && backendRes.data.authenticated && isMounted) {
          console.log('[AUTH] Backend session created successfully, establishing user role session');
          login(backendRes.data.access_token || '', backendRes.data.user);
        } else {
          throw new Error('Unable to establish authenticated session with institutional server.');
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[AUTH] Backend verification failed:', err);
          try {
            const authInstance = getOrInitAuth();
            await firebaseSignOut(authInstance);
          } catch (_) {}
          const errMsg = err.response?.data?.detail || err.message || 'Google sign-in could not be completed. Please try again.';
          setAuthError(errMsg);
          setAuthState('AUTH_ERROR');
        }
      } finally {
        isBackendExchangingRef.current = false;
      }
    };

    const processAuthLifecycle = async () => {
      try {
        console.log('[AUTH] Starting auth initialization lifecycle');

        const isMobileRedirect = !!(
          sessionStorage.getItem('nec_mobile_google_redirect') ||
          (typeof window !== 'undefined' && (window.location.search.includes('state=') || window.location.search.includes('code=')))
        );

        if (isMobileRedirect) {
          console.log('[MOBILE AUTH] Returning from mobile Google redirect flow');
          setAuthState('AUTH_REDIRECT_PROCESSING');
          sessionStorage.removeItem('nec_mobile_google_redirect');

          const authInstance = getOrInitAuth();
          const fbUser = await resolveAuthenticatedFirebaseUser(authInstance);

          if (fbUser && isMounted) {
            await performBackendExchange(fbUser);
            return;
          } else if (isMounted) {
            console.warn('[MOBILE AUTH] Unable to resolve Firebase user after redirect');
            setAuthError('Google sign-in could not be completed. Please try again.');
            setAuthState('AUTH_ERROR');
            return;
          }
        }

        // Standard auth lifecycle listener
        const initFirebaseListener = async () => {
          if (!isMounted) return;
          try {
            const authInstance = getOrInitAuth();

            unsubscribeFirebase = onAuthStateChanged(authInstance, async (fbUser: FirebaseUser | null) => {
              if (!isMounted) return;

              if (fbUser && fbUser.email) {
                const storedUserStr = localStorage.getItem('user');
                const isDeepLinkActive = typeof window !== 'undefined' && window.location.href.includes('oauth-callback');
                if (!storedUserStr && !isVerifyingRef.current && !isDeepLinkActive) {
                  isVerifyingRef.current = true;
                  await performBackendExchange(fbUser);
                  isVerifyingRef.current = false;
                } else if (storedUserStr) {
                  setAuthState('AUTHORIZED');
                }
              } else {
                if (isVerifyingRef.current) return;

                const storedToken = localStorage.getItem('token');
                if (storedToken && storedToken.trim() !== '') {
                  try {
                    const res = await api.get('/auth/session');
                    if (res && res.data && res.data.authenticated && res.data.user && isMounted) {
                      const u = res.data.user;
                      const formattedUser: AuthUser = {
                        uid: `user_${u.id}`,
                        name: u.username || 'User',
                        email: u.email || '',
                        role: u.role || 'student',
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
                  } catch (e) {}
                }

                const storedUser = localStorage.getItem('user');
                if (storedUser && isMounted) {
                  setAuthState('AUTHORIZED');
                  return;
                }

                if (isMounted) setAuthState('AUTH_UNAUTHENTICATED');
              }
            });
          } catch (_e) {
            if (isMounted) {
              const storedUser = localStorage.getItem('user');
              setAuthState(storedUser ? 'AUTHORIZED' : 'AUTH_UNAUTHENTICATED');
            }
          }
        };

        // Defer listener initialization after initial paint for fast LCP when not returning from redirect
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => initFirebaseListener(), { timeout: 2000 });
        } else {
          setTimeout(initFirebaseListener, 1200);
        }
      } catch (_err) {
        if (isMounted) {
          const storedUser = localStorage.getItem('user');
          setAuthState(storedUser ? 'AUTHORIZED' : 'AUTH_UNAUTHENTICATED');
        }
      }
    };

    processAuthLifecycle();

    return () => {
      isMounted = false;
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, [login, resolveAuthenticatedFirebaseUser]);

  // Safety Timeout: 15s maximum wait for loading states to prevent permanent loading spinners
  useEffect(() => {
    if (authState === 'AUTHENTICATING' || authState === 'AUTHENTICATED_PENDING_BACKEND' || authState === 'AUTH_REDIRECT_PROCESSING') {
      const timeout = setTimeout(() => {
        if (authState === 'AUTHENTICATING' || authState === 'AUTHENTICATED_PENDING_BACKEND' || authState === 'AUTH_REDIRECT_PROCESSING') {
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
        // login() sets authState to AUTHORIZED, so no further action needed here
      } else {
        // Received a response but no user — treat as failure
        setAuthError('Google sign-in could not be completed. Please try again.');
        setAuthState('AUTH_ERROR');
      }
    } catch (error: any) {
      const msg = error.message || 'Google sign-in could not be completed. Please try again.';
      // Only set AUTH_ERROR if not a redirect flow (redirect flows navigate away — no state to reset)
      if (!msg.startsWith('REDIRECT_IN_PROGRESS')) {
        setAuthError(msg);
        setAuthState('AUTH_ERROR');
      }
    }
    // NOTE: No finally block needed — success path: login() → AUTHORIZED state.
    // Failure/cancel path: AUTH_ERROR set in catch. Redirect path: page navigates away.
  };

  // OTP Send trigger
  const sendOtp = async (emailToUse: string) => {
    clearAuthError();
    setAuthState('AUTHENTICATING');
    try {
      const res = await api.post('/auth/send-otp', { email: emailToUse });
      setAuthState('AUTH_UNAUTHENTICATED');
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

  const isHodScoped = !!user && ['hod', 'department hod', 'department_hod'].includes(
    (user.role || '').trim().toLowerCase()
  );
  const isGlobalAccess = !!user && ['admin', 'administrator', 'super admin', 'super_admin', 'principal', 'management'].includes(
    (user.role || '').trim().toLowerCase()
  );

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
    isAuthenticated: authState === 'AUTHORIZED' || !!user,
    isHodScoped,
    isGlobalAccess,
    authorizedDepartmentIds: user?.authorized_department_ids ?? [],
    authorizedDepartmentCodes: user?.authorized_department_codes ?? [],
  }), [user, token, authState, authError, authNotice, login, signInWithGoogle, sendOtp, verifyOtp, logout, clearAuthError, isHodScoped, isGlobalAccess]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
