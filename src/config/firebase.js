import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCjShUCZutExsdZC3Gw-fWtMGP_ggOoC_Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'battlechat-5329e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'battlechat-5329e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'battlechat-5329e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '800187924567',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:800187924567:web:4cfbd607ebcb887ba26312',
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
