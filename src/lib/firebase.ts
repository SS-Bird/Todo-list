import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase initialization and configuration.
 * Sets up Firebase services (Auth, Firestore, Analytics) with environment-based configuration.
 */

type FirebaseInitConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  measurementId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

// Load Firebase configuration from environment variables
const firebaseConfig: FirebaseInitConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase app (reuse existing if already initialized)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// Enable offline persistence for multi-tab support
// Falls back gracefully if persistence is unavailable
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch(() => {
    /* Persistence is best-effort; fall back to memory cache if it fails. */
  });
}

// Initialize Analytics only in production when supported
// Analytics is initialized for side effects but not used directly (Firebase manages it internally)
if (typeof window !== 'undefined' && import.meta.env.PROD && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      // Initialize analytics (Firebase manages internally - variable intentionally unused)
      void getAnalytics(app);
    }
  });
}

export { app, auth, db };
export type { FirebaseApp };

