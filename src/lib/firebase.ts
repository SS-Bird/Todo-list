import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

type FirebaseInitConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  measurementId?: string;
  // Optional fields that we may add later without changing call sites
  storageBucket?: string;
  messagingSenderId?: string;
};

const firebaseConfig: FirebaseInitConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  // storageBucket and messagingSenderId are optional for now
  // storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  // messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// Enable offline persistence by default (multi-tab safe). Ignore failures so the app still runs.
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch(() => {
    /* Persistence is best-effort; fall back to memory cache if it fails. */
  });
}

// Lazily initialize Analytics only in production when supported and measurementId is present.
let analytics: Analytics | undefined;
if (typeof window !== 'undefined' && import.meta.env.PROD && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  isAnalyticsSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}

export { app, auth, db };
export type { FirebaseApp };

