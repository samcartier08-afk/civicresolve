import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web config is public by design; access is enforced by Firebase rules and the backend token check.
const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'civicresolve.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'civicresolve-india',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:civicresolve',
  });
export const auth = getAuth(app);
