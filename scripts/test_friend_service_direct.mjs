import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
};

async function testFriendServiceDirectly() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const t = Date.now().toString().slice(-4);
  const userAEmail = `fs_a_${t}@instachat.io`;
  const userBEmail = `fs_b_${t}@instachat.io`;

  const credA = await createUserWithEmailAndPassword(auth, userAEmail, 'password123');
  const uidA = credA.user.uid;
  const userA = { userId: uidA, username: `FsA_${t}`, email: userAEmail };
  await setDoc(doc(db, 'users', uidA), userA);

  const credB = await createUserWithEmailAndPassword(auth, userBEmail, 'password123');
  const uidB = credB.user.uid;
  const userB = { userId: uidB, username: `FsB_${t}`, email: userBEmail };
  await setDoc(doc(db, 'users', uidB), userB);

  // Now login as A
  await signInWithEmailAndPassword(auth, userAEmail, 'password123');

  // Test getDoc on friends subcollection
  try {
    const friendRef = doc(db, 'friends', uidA, 'userFriends', uidB);
    const snap = await getDoc(friendRef);
    console.log('[SUCCESS] Friend subcollection read exists:', snap.exists());
  } catch (err) {
    console.error('[ERROR] Friend subcollection read failed:', err.message);
  }

  // Test getDoc on friendRequests
  const reqId = `${uidA}_${uidB}`;
  try {
    const reqRef = doc(db, 'friendRequests', reqId);
    const snap = await getDoc(reqRef);
    console.log('[SUCCESS] friendRequests read exists:', snap.exists());
  } catch (err) {
    console.error('[ERROR] friendRequests read failed:', err.message);
  }

  // Test setDoc on friendRequests
  try {
    const reqData = {
      requestId: reqId,
      senderId: uidA,
      senderUsername: userA.username,
      receiverId: uidB,
      receiverUsername: userB.username,
      status: 'PENDING',
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'friendRequests', reqId), reqData);
    console.log('[SUCCESS] friendRequests setDoc succeeded!');
  } catch (err) {
    console.error('[ERROR] friendRequests setDoc failed:', err.message);
  }

  // Now login as B and test onSnapshot on incoming friend requests
  await signInWithEmailAndPassword(auth, userBEmail, 'password123');
  try {
    const q = query(collection(db, 'friendRequests'), where('receiverId', '==', uidB));
    const snap = await getDocs(q);
    console.log('[SUCCESS] User B getDocs found incoming requests:', snap.size);
  } catch (err) {
    console.error('[ERROR] User B query incoming requests failed:', err.message);
  }

  process.exit(0);
}

testFriendServiceDirectly().catch(e => {
  console.error(e);
  process.exit(1);
});
