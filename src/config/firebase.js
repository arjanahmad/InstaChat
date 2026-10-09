import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyCjShUCZutExsdZC3Gw-fWtMGP_ggOoC_Q',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'battlechat-5329e.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'battlechat-5329e',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'battlechat-5329e.firebasestorage.app',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '800187924567',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:800187924567:android:4cfbd607ebcb887ba26312',
};

// Initialize Firebase only if API key is provided
const app = firebaseConfig.apiKey && !getApps().length ? initializeApp(firebaseConfig) : (getApps().length ? getApp() : null);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export default app;
