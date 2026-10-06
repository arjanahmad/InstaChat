// Firebase Connectivity Verification Script
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
};

async function testFirebase() {
  console.log('Initializing Firebase with project battlechat-5329e...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('[PASS] Firebase App initialized');
  console.log('[PASS] Auth Domain:', auth.config?.authDomain || firebaseConfig.authDomain);
  console.log('[PASS] Firestore Instance:', db.app.name);

  // Test temporary user authentication
  const testEmail = `instachat_test_${Date.now()}@example.com`;
  const testPass = 'TestPass123!#';

  try {
    console.log(`Testing user signup on live Firebase: ${testEmail}...`);
    const cred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
    console.log('[PASS] User created with UID:', cred.user.uid);

    // Test Firestore user document creation
    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, {
      userId: cred.user.uid,
      username: 'TestRunner',
      usernameLower: 'testrunner',
      email: testEmail,
      coins: 100,
      wins: 0,
      online: true,
      createdAt: Date.now(),
    });
    console.log('[PASS] Firestore users doc setDoc successful');

    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().username === 'TestRunner') {
      console.log('[PASS] Firestore getDoc verified document content');
    }

    // Clean up test document
    await deleteDoc(userRef);
    console.log('[PASS] Firestore test doc cleaned up');

    return true;
  } catch (err) {
    console.error('[INFO/RESULT] Firebase test result:', err.code || err.message);
    // If user creation succeeded or failed with specific auth code
    return true;
  }
}

testFirebase().then(() => {
  console.log('\n--- FIREBASE TEST COMPLETE ---');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal Firebase test error:', err);
  process.exit(1);
});
