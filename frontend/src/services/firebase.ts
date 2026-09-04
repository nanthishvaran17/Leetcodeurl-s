import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Read configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "leetcode-student-data.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "leetcode-student-data",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "leetcode-student-data.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "384483144435",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Check if environment variables are configured (simple presence check)
export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== "";
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  try {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(appInstance);
    setPersistence(authInstance, browserLocalPersistence).catch(() => {});
    dbInstance = getFirestore(appInstance);
    storageInstance = getStorage(appInstance);
  } catch (err) {
    console.warn("Firebase lazy initialization mode active:", err);
  }
}

export const getOrInitAuth = (): Auth => {
  if (authInstance) return authInstance;
  if (!isFirebaseConfigured()) {
    throw new Error("auth/invalid-api-key: Please paste your VITE_FIREBASE_API_KEY into frontend/.env");
  }
  appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(appInstance);
  setPersistence(authInstance, browserLocalPersistence).catch(() => {});
  return authInstance;
};

export const getOrInitDb = (): Firestore => {
  if (dbInstance) return dbInstance;
  if (!appInstance) {
    getOrInitAuth();
  }
  dbInstance = getFirestore(appInstance!);
  return dbInstance;
};

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = dbInstance;
export const storage = storageInstance;

export default appInstance;
