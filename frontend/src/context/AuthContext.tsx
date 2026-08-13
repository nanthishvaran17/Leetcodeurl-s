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

  // Sync Google Auth state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let userData: AuthUser;

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            userData = {
              uid: fbUser.uid,
              name: data.name || fbUser.displayName || 'Student User',
              email: fbUser.email || data.email || '',
              photoURL: fbUser.photoURL || data.photoURL || '',
              role: data.role || 'student',
              registerNo: data.registerNo || null,
              department: data.department || null,
              year: data.year || null,
              section: data.section || null,
              leetcodeUsername: data.leetcodeUsername || null,
              isProfileLinked: data.isProfileLinked !== undefined ? data.isProfileLinked : false,
            };

            // Update last login timestamp
            await updateDoc(userDocRef, {
              lastLoginAt: serverTimestamp()
            }).catch(() => {});
          } else {
            // New Google Sign-In user: Check matching student record from backend
            let matchedStudent: any = null;
            if (fbUser.email) {
              try {
                const res = await api.get('/students');
                matchedStudent = res.data.find((s: any) => s.email && s.email.toLowerCase() === fbUser.email?.toLowerCase());
              } catch (_err) {
                // Ignore match fetch failure
              }
            }

            userData = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'Student User',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || '',
              role: 'student', // Default role MUST be student
              registerNo: matchedStudent ? matchedStudent.reg_no : null,
              department: matchedStudent ? matchedStudent.department?.code : null,
              year: matchedStudent ? matchedStudent.year_level : null,
              section: matchedStudent ? matchedStudent.section?.name : null,
              leetcodeUsername: matchedStudent ? matchedStudent.username : null,
              isProfileLinked: !!matchedStudent,
            };

            // Save new user profile to Firestore
            await setDoc(userDocRef, {
              ...userData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
              isActive: true
            });
          }

          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err: any) {
          console.error("Firestore user sync error:", err);
          // Fallback user object if Firestore read fails
          const fallbackUser: AuthUser = {
            uid: fbUser.uid,
            name: fbUser.displayName || 'User',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || '',
            role: 'student',
            isProfileLinked: false
          };
          setUser(fallbackUser);
        }
      } else {
        // If not logged in via Firebase, keep local admin token user if present
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (!savedToken && !savedUser) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (newToken: string, newUser: any) => {
    setToken(newToken);
    const formattedUser: AuthUser = {
      uid: `admin_${newUser.id || '1'}`,
      name: newUser.username || 'Admin User',
      email: newUser.email || 'admin@college.edu',
      role: newUser.role || 'Super Admin',
      isProfileLinked: true,
      id: newUser.id,
      username: newUser.username
    };
    setUser(formattedUser);
    localStorage.setItem('token', newToken);
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

  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore API logout error
    }
    try {
      await firebaseSignOut(auth);
    } catch (_err) {
      // Ignore firebase sign out error
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
        logout,
        clearAuthError,
        isAuthenticated: !!user || !!token
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
