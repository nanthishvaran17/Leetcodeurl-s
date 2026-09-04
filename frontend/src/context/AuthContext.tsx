import React, { createContext, useContext, useState, useEffect } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth, getOrInitAuth } from '../firebase';
import api from '../services/api';


export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'student' | 'staff' | 'admin' | 'Super Admin';
  registerNo?: string | null;
  department?: string | null;
  department_id?: number | null;
  year?: string | null;
  section?: string | null;
  leetcodeUsername?: string | null;
  isProfileLinked: boolean;
  id?: number;
  username?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  login: (token: string, user: any) => void;
  signInWithGoogle: () => Promise<void>;
  sendOtp: (email: string) => Promise<any>;
  verifyOtp: (email: string, otp: string) => Promise<any>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check HttpOnly Cookie Backend Session on initial load
  useEffect(() => {
    let isMounted = true;
    const checkBackendSession = async () => {
      try {
        const res = await api.get('/auth/session');
        if (res.data && res.data.authenticated && res.data.user && isMounted) {
          const u = res.data.user;
          const formattedUser: AuthUser = {
            uid: `admin_${u.id}`,
            name: u.username || 'Admin User',
            email: u.email || '',
            role: u.role || 'Admin',
            isProfileLinked: true,
            id: u.id,
            username: u.username
          };
          setUser(formattedUser);
        }
      } catch (_err) {
        // Unauthenticated session - safe ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkBackendSession();

    return () => {
      isMounted = false;
    };
  }, []);


  // NOTE: We intentionally do NOT use onAuthStateChanged to assign application
  // roles. Firebase auth state is for the Firebase layer only. Application roles
  // and sessions are managed exclusively by the backend via /api/auth/google.
  // This prevents the frontend-only role-assignment security vulnerability.




  const login = (newToken: string, newUser: any) => {
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('token', newToken);
    }
    const formattedUser: AuthUser = {
      uid: newUser.uid || `admin_${newUser.id || '1'}`,
      name: newUser.username || newUser.name || 'User',
      email: newUser.email || '',
      role: newUser.role || 'student',
      isProfileLinked: newUser.isProfileLinked !== undefined ? newUser.isProfileLinked : true,
      id: newUser.id,
      username: newUser.username
    };
    setUser(formattedUser);
    localStorage.setItem('user', JSON.stringify(formattedUser));
  };


  const signInWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const { authenticateWithGoogle } = await import('../services/googleAuth');
      const res = await authenticateWithGoogle();
      if (res && res.user) {
        login('', res.user);
      }
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };


  const sendOtp = async (emailToUse: string) => {
    setAuthError(null);
    const res = await api.post('/auth/send-otp', { email: emailToUse });
    return res.data;
  };

  const verifyOtp = async (emailToUse: string, otpCode: string) => {
    setAuthError(null);
    const res = await api.post('/auth/verify-otp', { email: emailToUse, otp: otpCode });
    login(res.data.access_token, res.data.user);
    return res.data;
  };

  const logout = async () => {
    setLoading(true);
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_user');
    sessionStorage.clear();

    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore API logout error
    }
    try {
      const activeAuth = auth || getOrInitAuth();
      if (activeAuth) {
        await firebaseSignOut(activeAuth);
      }
    } catch (_err) {
      // Ignore firebase sign out error
    }
    setLoading(false);
  };

  const clearAuthError = React.useCallback(() => setAuthError(null), []);

  const contextValue = React.useMemo(() => ({
    user,
    token,
    loading,
    authError,
    login,
    signInWithGoogle,
    sendOtp,
    verifyOtp,
    logout,
    clearAuthError,
    isAuthenticated: !!user
  }), [user, token, loading, authError, clearAuthError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';
