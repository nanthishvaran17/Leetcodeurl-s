import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  GoogleAuthProvider,
  Auth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth';

// Read configuration from Vite environment variables with authoritative institutional fallbacks
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAsP9hOeAxrIO5hbmlrPhmGa3p1vv-1Jek",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "leetcode-student-data.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "leetcode-student-data",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "leetcode-student-data.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "384483144435",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:384483144435:web:bcc3284e79ed3ac5323d86",
};

export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== "";
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: any = null;
let storageInstance: any = null;

const createAuthInstance = (app: FirebaseApp): Auth => {
  try {
    // initializeAuth with indexedDBLocalPersistence primary, browserLocalPersistence fallback
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
    });
  } catch (_e) {
    // If initializeAuth fails because app is already initialized, get standard auth and set persistence
    const a = getAuth(app);
    setPersistence(a, indexedDBLocalPersistence)
      .catch(() => setPersistence(a, browserLocalPersistence))
      .catch(() => {});
    return a;
  }
};

if (isFirebaseConfigured()) {
  try {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = createAuthInstance(appInstance);
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
  authInstance = createAuthInstance(appInstance);
  return authInstance;
};

export const getOrInitDbAsync = async (): Promise<any> => {
  if (dbInstance) return dbInstance;
  if (!appInstance) {
    getOrInitAuth();
  }
  const { getFirestore } = await import('firebase/firestore');
  dbInstance = getFirestore(appInstance!);
  return dbInstance;
};

export const getOrInitStorageAsync = async (): Promise<any> => {
  if (storageInstance) return storageInstance;
  if (!appInstance) {
    getOrInitAuth();
  }
  const { getStorage } = await import('firebase/storage');
  storageInstance = getStorage(appInstance!);
  return storageInstance;
};

export const auth = authInstance;

export const createGoogleProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const googleProvider = createGoogleProvider();

export default appInstance;


