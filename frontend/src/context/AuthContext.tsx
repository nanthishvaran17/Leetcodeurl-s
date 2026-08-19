import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, googleProvider, db, getOrInitAuth, getOrInitDb } from '../firebase';
import api from '../services/api';

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'student' | 'staff' | 'admin' | 'Super Admin';
  registerNo?: string | null;
  department?: string | null;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Sync Google Auth state changes
  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          localStorage.setItem('token', idToken);

          const activeDb = db || getOrInitDb();
          const userDocRef = doc(activeDb, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let userData: AuthUser;

          const emailLower = (fbUser.email || '').toLowerCase().trim();
          const isAdminAccount = emailLower === 'nanthishvaran17@gmail.com' || emailLower === 'msanthoshkumar@nandhaengg.org' || fbUser.uid === 'SATDrDpJAcP07WdyyHbPjCb6u5F3';

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            const effectiveRole = isAdminAccount ? 'admin' : (data.role || 'student');

            userData = {
              uid: fbUser.uid,
              name: data.name || fbUser.displayName || 'Nanthishvaran',
              email: fbUser.email || data.email || '',
              photoURL: fbUser.photoURL || data.photoURL || '',
              role: effectiveRole,
              registerNo: data.registerNo || null,
              department: data.department || null,
              year: data.year || null,
              section: data.section || null,
              leetcodeUsername: data.leetcodeUsername || null,
              isProfileLinked: data.isProfileLinked !== undefined ? data.isProfileLinked : false,
            };

            await updateDoc(userDocRef, {
              role: effectiveRole,
              lastLoginAt: serverTimestamp()
            }).catch(() => {});
          } else {
            let matchedStudent: any = null;
            if (fbUser.email) {
              try {
                const res = await api.get('/students');
                matchedStudent = res.data.find((s: any) => s.email && s.email.toLowerCase() === fbUser.email?.toLowerCase());
              } catch (_err) {}
            }

            userData = {
              uid: fbUser.uid,
              name: fbUser.displayName || (isAdminAccount ? 'Administrator' : 'Student User'),
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || '',
              role: isAdminAccount ? 'admin' : 'student',
              registerNo: matchedStudent ? matchedStudent.reg_no : null,
              department: matchedStudent ? matchedStudent.department?.code : null,
              year: matchedStudent ? matchedStudent.year_level : null,
              section: matchedStudent ? matchedStudent.section?.name : null,
              leetcodeUsername: matchedStudent ? matchedStudent.username : null,
              isProfileLinked: !!matchedStudent,
            };

            await setDoc(userDocRef, {
              ...userData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
              isActive: true
            });
          }

          setUser(userData);
        } catch (err: any) {
          console.error("Firestore user sync error:", err);
          const emailLower = (fbUser.email || '').toLowerCase().trim();
          const isAdminAccount = emailLower === 'nanthishvaran17@gmail.com' || emailLower === 'msanthoshkumar@nandhaengg.org';
          const fallbackUser: AuthUser = {
            uid: fbUser.uid,
            name: fbUser.displayName || 'User',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || '',
            role: isAdminAccount ? 'admin' : 'student',
            isProfileLinked: false
          };
          setUser(fallbackUser);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (newToken: string, newUser: any) => {
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('token', newToken);
    }
    const formattedUser: AuthUser = {
      uid: `admin_${newUser.id || '1'}`,
      name: newUser.username || 'Admin User',
      email: newUser.email || 'nanthishvaran17@gmail.com',
      role: newUser.role || 'Admin',
      isProfileLinked: true,
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
      const activeAuth = auth || getOrInitAuth();
      await signInWithPopup(activeAuth, googleProvider);
    } catch (error: any) {
      console.error("Google sign in error:", error);
      let errorMsg = "Failed to sign in with Google.";
      if (error.code === 'auth/invalid-api-key' || error.message?.includes('invalid-api-key')) {
        errorMsg = "Firebase API Key is missing in frontend/.env. Please paste your VITE_FIREBASE_API_KEY from Firebase Console.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMsg = "Sign in popup was blocked by your browser. Please allow popups for this website.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMsg = "Google Sign-In popup was closed before completing authentication.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = "Network error. Please check your internet connection.";
      } else if (error.message) {
        errorMsg = error.message;
      }
      setAuthError(errorMsg);
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

    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore API logout error
    }
    try {
      if (auth) {
        await firebaseSignOut(auth);
      }
    } catch (_err) {
      // Ignore firebase sign out error
    }
    setLoading(false);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
