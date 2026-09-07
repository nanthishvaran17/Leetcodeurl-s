import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  Auth
} from 'firebase/auth';

// Read configuration from Vite environment variables with authoritative institutional fallbacks
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyAsP9hOeAxrIO5hbmlrPhmGa3p1vv-1Jek",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "leetcode-student-data.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "leetcode-student-data",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "leetcode-student-data.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "384483144435",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:384483144435:web:bcc3284e79ed3ac5323d86",
};

export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== "";
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: any = null;
let storageInstance: any = null;

export const getOrInitApp = (): FirebaseApp => {
  if (!appInstance) {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }
  return appInstance;
};

export const getOrInitAuth = (): Auth => {
  if (!authInstance) {
    const app = getOrInitApp();
    authInstance = getAuth(app);
  }
  return authInstance;
};

// Lazy getter for auth instance — initialized on demand
export const getAuthInstance = (): Auth | null => {
  return authInstance;
};

export const getOrInitDbAsync = async (): Promise<any> => {
  if (dbInstance) return dbInstance;
  const app = getOrInitApp();
  const { getFirestore } = await import('firebase/firestore');
  dbInstance = getFirestore(app);
  return dbInstance;
};

export const getOrInitStorageAsync = async (): Promise<any> => {
  if (storageInstance) return storageInstance;
  const app = getOrInitApp();
  const { getStorage } = await import('firebase/storage');
  storageInstance = getStorage(app);
  return storageInstance;
};

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const authObj = getOrInitAuth();
    const val = (authObj as any)[prop];
    return typeof val === 'function' ? val.bind(authObj) : val;
  }
});

export const createGoogleProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

let _googleProviderInstance: GoogleAuthProvider | null = null;
export const getGoogleProvider = (): GoogleAuthProvider => {
  if (!_googleProviderInstance) {
    _googleProviderInstance = createGoogleProvider();
  }
  return _googleProviderInstance;
};

export const googleProvider = new Proxy({} as GoogleAuthProvider, {
  get(_target, prop) {
    const provider = getGoogleProvider();
    const val = (provider as any)[prop];
    return typeof val === 'function' ? val.bind(provider) : val;
  }
});

export default appInstance;
