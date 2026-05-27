import { initializeApp } from 'firebase/app';
import { 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  initializeAuth 
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

// Check if variables are valid and not placeholders
const isConfigValid = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_firebase_api_key' && 
  !firebaseConfig.apiKey.startsWith('your_') &&
  !firebaseConfig.apiKey.includes('placeholder');

export let app: any = null;
export let auth: any = null;
export let db: any = null;
export let storage: any = null;

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Firebase Client successfully initialized with IndexedDB/Local persistence.');
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err);
  }
} else {
  console.warn('⚠️ Firebase Client is running in hybrid offline fallback mode because environment variables are placeholders or unconfigured.');
}
