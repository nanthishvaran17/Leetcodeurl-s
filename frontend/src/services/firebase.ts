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

if (isFirebaseConfigured()) {
  try {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn("Firebase lazy initialization mode active:", err);
  }
}

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

export const auth = authInstance;

export const createGoogleProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const googleProvider = createGoogleProvider();

export default appInstance;
