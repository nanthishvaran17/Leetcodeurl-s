import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import api, { clearApiCache } from '../services/api';
import { clearContestCache } from '../services/contestCache';
import { queryClient } from '../lib/react-query';
import { AuthState, AuthUser } from '../services/auth/authTypes';
import { isMobileBrowser } from '../services/googleAuth';
import { AuthContext } from './authContextDef';

// AuthContext and useAuth are defined in authContextDef.ts — import from there.
// This file only exports AuthProvider to satisfy Vite Fast Refresh (components-only exports).


const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 Hour Inactivity Timeout (60 Minutes)
const LAST_ACTIVITY_KEY = 'nec_last_activity';

// Helper to evaluate whether the current session is expired due to inactivity (>1 hour) or JWT expiration
const checkSessionExpired = (): boolean => {
  try {
    const token = localStorage.getItem('token');
    if (token && token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        if (payload?.exp && payload.exp * 1000 <= Date.now()) {
          return true;
        }
      }
    }
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) {
      if (localStorage.getItem('user')) {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        return false;
      }
      return true;
    }
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    if (isNaN(elapsed) || elapsed >= INACTIVITY_TIMEOUT_MS) {
      return true;
    }
  } catch (_e) {}
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      if (checkSessionExpired()) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        return null;
      }
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      if (checkSessionExpired()) {
        return null;
      }
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  });

  const [authState, setAuthState] = useState<AuthState>(() => {
    if (checkSessionExpired()) {
      return 'AUTH_UNAUTHENTICATED';
    }
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
    const nowStr = Date.now().toString();
    localStorage.setItem(LAST_ACTIVITY_KEY, nowStr);

    if (newToken) {
      setToken(newToken);
      localStorage.setItem('token', newToken);
    }
    const formattedUser: AuthUser = {
      uid: newUser.uid || `user_${newUser.id || '1'}`,
      name: (newUser.full_name || newUser.name || newUser.displayName || newUser.username || (newUser.email ? newUser.email.split('@')[0] : 'User')).trim(),
      email: newUser.email || '',
      role: newUser.role || 'student',
      isProfileLinked: newUser.isProfileLinked !== undefined ? newUser.isProfileLinked : true,
      id: newUser.id,
      username: newUser.username,
      full_name: newUser.full_name || newUser.name || null,
      displayName: newUser.displayName || newUser.name || null,
      department_id: newUser.department_id || null,
      section_id: newUser.section_id || null,
      institutional_id: newUser.institutional_id || null,
      designation: newUser.designation || null,
      staff_verification_status: newUser.staff_verification_status || 'NOT_SUBMITTED',
      profile_photo: newUser.profile_photo || null,
      photoURL: newUser.photoURL || null,
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
    clearApiCache();
    clearContestCache();
    // Flush all React Query in-memory cache so role-scoped queries re-fetch fresh data
    queryClient.clear();
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
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.clear();
    clearApiCache();
    clearContestCache();
    // Flush all React Query in-memory cache to prevent stale data leaking to next session
    queryClient.clear();

    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore API logout errors
    }

    try {
      const { getOrInitAuth } = await import('../services/firebase');
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      const activeAuth = getOrInitAuth();
      if (activeAuth) {
        await firebaseSignOut(activeAuth);
      }
    } catch (_err) {
      // Ignore Firebase signout errors
    }

    clearAuthError();
    setAuthState('AUTH_UNAUTHENTICATED');
  }, [clearAuthError]);

  // Automatic 1-Hour Inactivity Timeout & Session Termination Monitor
  useEffect(() => {
    if (authState !== 'AUTHORIZED' && !user) return;

    let lastUpdate = 0;
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 10000) { // Throttle activity writes to once every 10 seconds
        lastUpdate = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    // Periodic check every 30 seconds for inactivity timeout (> 1 hour)
    const checkInterval = setInterval(() => {
      if (checkSessionExpired()) {
        console.warn('[AUTH] 1-Hour Session timeout detected. Auto-terminating session.');
        logout();
        setAuthNotice('Session automatically terminated after 1 hour of inactivity. Please log in again.');
      }
    }, 30000);

    // Immediate check when returning to tab / refocusing window (e.g. reopening after 1-2 days)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        if (checkSessionExpired()) {
          console.warn('[AUTH] Session expired upon tab focus / return. Auto-terminating session.');
          logout();
          setAuthNotice('Session automatically terminated after 1 hour of inactivity. Please log in again.');
        } else {
          updateActivity();
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(checkInterval);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [authState, user, logout]);

  // Handle global events: auth_logout, profile updates, and token refresh
  useEffect(() => {
    const handleGlobalLogout = () => {
      logout();
    };
    
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUser((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, ...e.detail };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      }
    };

    const handleTokenRefreshed = (e: any) => {
      if (e.detail) {
        setToken(e.detail);
        localStorage.setItem('token', e.detail);
      }
    };

    window.addEventListener('auth_logout', handleGlobalLogout);
    window.addEventListener('nec_user_profile_updated', handleProfileUpdate);
    window.addEventListener('nec_token_refreshed', handleTokenRefreshed);
    
    return () => {
      window.removeEventListener('auth_logout', handleGlobalLogout);
      window.removeEventListener('nec_user_profile_updated', handleProfileUpdate);
      window.removeEventListener('nec_token_refreshed', handleTokenRefreshed);
    };
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
    const { onAuthStateChanged } = await import('firebase/auth');
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
            const { getOrInitAuth } = await import('../services/firebase');
            const { signOut: firebaseSignOut } = await import('firebase/auth');
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

        const { getOrInitAuth } = await import('../services/firebase');

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
            const { onAuthStateChanged } = await import('firebase/auth');

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
                
                // FORCE RE-LOGIN if token is missing but we're supposedly logged in (fixes APK state)
                if (!storedToken || storedToken.trim() === '') {
                  console.warn('[AUTH] Missing token in localStorage, forcing re-authentication');
                  localStorage.removeItem('user');
                  if (isMounted) setAuthState('AUTH_UNAUTHENTICATED');
                  return;
                }

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
                        department_id: u.department_id || null,
                        section_id: u.section_id || null,
                        institutional_id: u.institutional_id || null,
                        designation: u.designation || null,
                        staff_verification_status: u.staff_verification_status || 'NOT_SUBMITTED',
                        authorized_department_ids: Array.isArray(u.authorized_department_ids) ? u.authorized_department_ids : [],
                        authorized_department_codes: Array.isArray(u.authorized_department_codes) ? u.authorized_department_codes : [],
                      };
                      setUser(formattedUser);
                      localStorage.setItem('user', JSON.stringify(formattedUser));
                      setAuthState('AUTHORIZED');
                      return;
                    }
                  } catch (e) {}
                }

                // Fallback catch - should not reach here due to the force logout above
                if (isMounted) setAuthState('AUTH_UNAUTHENTICATED');

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
