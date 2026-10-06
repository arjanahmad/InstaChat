import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCjShUCZutExsdZC3Gw-fWtMGP_ggOoC_Q',
  authDomain: 'battlechat-5329e.firebaseapp.com',
  projectId: 'battlechat-5329e',
  storageBucket: 'battlechat-5329e.firebasestorage.app',
  messagingSenderId: '800187924567',
  appId: '1:800187924567:web:4cfbd607ebcb887ba26312',
};

async function testSub() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const t = Date.now().toString().slice(-4);
  const userAEmail = `sub_a_${t}@instachat.io`;
  const userBEmail = `sub_b_${t}@instachat.io`;

  const credA = await createUserWithEmailAndPassword(auth, userAEmail, 'password123');
  const uidA = credA.user.uid;
  console.log('Created User A:', uidA);

  const credB = await createUserWithEmailAndPassword(auth, userBEmail, 'password123');
  const uidB = credB.user.uid;
  console.log('Created User B:', uidB);

  // Sign in as A and send friend request to B
  await signInWithEmailAndPassword(auth, userAEmail, 'password123');
  const reqId = `${uidA}_${uidB}`;
  const reqData = {
    requestId: reqId,
    senderId: uidA,
    senderUsername: `SubA_${t}`,
    receiverId: uidB,
    receiverUsername: `SubB_${t}`,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'friendRequests', reqId), reqData);
    console.log('[SUCCESS] User A wrote friend request to friendRequests/' + reqId);
  } catch (err) {
    console.error('[ERROR] User A writing friend request:', err.message);
  }

  // Sign in as B and query friendRequests
  await signInWithEmailAndPassword(auth, userBEmail, 'password123');

  // Test 1: Direct getDoc by reqId
  try {
    const snapDoc = await getDoc(doc(db, 'friendRequests', reqId));
    console.log('[SUCCESS] User B direct getDoc exists:', snapDoc.exists(), snapDoc.data());
  } catch (err) {
    console.error('[ERROR] User B direct getDoc:', err.message);
  }

  // Test 2: Query by receiverId
  try {
    const q = query(collection(db, 'friendRequests'), where('receiverId', '==', uidB));
    const snapQuery = await getDocs(q);
    console.log('[SUCCESS] User B query where receiverId==uidB count:', snapQuery.size);
  } catch (err) {
    console.error('[ERROR] User B query where receiverId==uidB:', err.message);
  }

  process.exit(0);
}

testSub().catch(err => {
  console.error(err);
  process.exit(1);
});
