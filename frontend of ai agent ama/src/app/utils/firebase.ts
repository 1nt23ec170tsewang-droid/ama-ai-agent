import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate config is real (not placeholder env vars)
const isConfigValid =
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_firebase_api_key' &&
  !firebaseConfig.apiKey.startsWith('your_') &&
  !firebaseConfig.apiKey.includes('placeholder');

export let app: any = null;
export let auth: any = null;
export let db: any = null;
export let storage: any = null;

if (isConfigValid) {
  try {
    // Reuse existing Firebase app if already initialized (React StrictMode / HMR safe)
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    // Try initializeAuth for persistent IndexedDB sessions (best for PWA/mobile).
    // If Auth was already instantiated (StrictMode double-invoke or HMR),
    // fall back to getAuth() which returns the existing instance safely.
    try {
      auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      // "Auth already instantiated" — just get the existing instance
      auth = getAuth(app);
    }

    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Firebase initialized (IndexedDB + LocalStorage persistence).');
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err);
    // Do NOT rethrow — let app render in offline fallback mode
  }
} else {
  console.warn(
    '⚠️ Firebase env vars are missing or placeholder. Running in offline/REST fallback mode.'
  );
}
