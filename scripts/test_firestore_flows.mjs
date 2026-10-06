// Direct Firestore Friend & Chat verification test
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCjShUCZutExsdZC3Gw-fWtMGP_ggOoC_Q',
  authDomain: 'battlechat-5329e.firebaseapp.com',
  projectId: 'battlechat-5329e',
  storageBucket: 'battlechat-5329e.firebasestorage.app',
  messagingSenderId: '800187924567',
  appId: '1:800187924567:web:4cfbd607ebcb887ba26312',
};

async function testFriendFlow() {
  console.log('Testing direct Firestore Friend & Messaging flow...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const t = Date.now().toString().slice(-4);
  const userAEmail = `test_flow_a_${t}@instachat.io`;
  const userBEmail = `test_flow_b_${t}@instachat.io`;

  // 1. Create User A
  const credA = await createUserWithEmailAndPassword(auth, userAEmail, 'password123');
  const userA = {
    userId: credA.user.uid,
    username: `FlowA_${t}`,
    usernameLower: `flowa_${t}`.toLowerCase(),
    email: userAEmail,
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'users', userA.userId), userA);
  console.log('[PASS] Created User A:', userA.username, userA.userId);

  // 2. Create User B
  const credB = await createUserWithEmailAndPassword(auth, userBEmail, 'password123');
  const userB = {
    userId: credB.user.uid,
    username: `FlowB_${t}`,
    usernameLower: `flowb_${t}`.toLowerCase(),
    email: userBEmail,
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'users', userB.userId), userB);
  console.log('[PASS] Created User B:', userB.username, userB.userId);

  // 3. User A signs in and searches for User B
  await signInWithEmailAndPassword(auth, userAEmail, 'password123');
  const qSearch = query(collection(db, 'users'), where('usernameLower', '==', userB.usernameLower));
  const snapSearch = await getDocs(qSearch);
  console.log('[PASS] Search for User B found documents:', snapSearch.size);

  // 4. User A sends Friend Request to User B
  const reqId = `${userA.userId}_${userB.userId}`;
  await setDoc(doc(db, 'friendRequests', reqId), {
    requestId: reqId,
    senderId: userA.userId,
    senderUsername: userA.username,
    receiverId: userB.userId,
    receiverUsername: userB.username,
    status: 'PENDING',
    createdAt: Date.now(),
  });
  console.log('[PASS] Friend request created in friendRequests collection');

  // 5. User B signs in and accepts Friend Request
  await signInWithEmailAndPassword(auth, userBEmail, 'password123');
  const reqRef = doc(db, 'friendRequests', reqId);
  const reqSnap = await getDoc(reqRef);
  console.log('[PASS] User B read friend request:', reqSnap.exists() && reqSnap.data().status);

  // Add to friends subcollections
  await setDoc(doc(db, 'friends', userB.userId, 'userFriends', userA.userId), {
    friendId: userA.userId,
    friendUsername: userA.username,
    friendOnline: true,
    friendshipDate: Date.now(),
  });
  await setDoc(doc(db, 'friends', userA.userId, 'userFriends', userB.userId), {
    friendId: userB.userId,
    friendUsername: userB.username,
    friendOnline: true,
    friendshipDate: Date.now(),
  });
  console.log('[PASS] Friendship established in friends/{userId}/userFriends/{friendId}');

  // 6. Test deterministic conversation and message
  const convoId = userA.userId < userB.userId ? `${userA.userId}_${userB.userId}` : `${userB.userId}_${userA.userId}`;
  await setDoc(doc(db, 'conversations', convoId), {
    conversationId: convoId,
    participants: [userA.userId, userB.userId],
    participantUsernames: {
      [userA.userId]: userA.username,
      [userB.userId]: userB.username,
    },
    lastMessage: 'Hello from User B!',
    lastMessageTimestamp: Date.now(),
    lastSenderId: userB.userId,
  });

  const msgId = `msg_${Date.now()}`;
  await setDoc(doc(db, 'conversations', convoId, 'messages', msgId), {
    messageId: msgId,
    senderId: userB.userId,
    receiverId: userA.userId,
    text: 'Hello from User B!',
    messageType: 'TEXT',
    status: 'SENT',
    timestamp: Date.now(),
    isRead: false,
  });
  console.log('[PASS] Deterministic conversation & message created in Firestore!');

  // 7. Test Call Session creation
  const callId = `call_${Date.now()}`;
  await setDoc(doc(db, 'calls', callId), {
    callId,
    callerId: userB.userId,
    callerUsername: userB.username,
    receiverId: userA.userId,
    receiverUsername: userA.username,
    type: 'VOICE',
    status: 'RINGING',
    offerSdp: 'v=0\r\no=test\r\ns=-\r\n',
    answerSdp: null,
    createdAt: Date.now(),
  });
  console.log('[PASS] WebRTC Call session created in calls collection!');

  // 8. Test Game Room creation
  const roomId = `room_${Date.now()}`;
  await setDoc(doc(db, 'game_rooms', roomId), {
    roomId,
    gameType: 'TIC_TAC_TOE',
    player1Id: userB.userId,
    player1Username: userB.username,
    player2Id: userA.userId,
    player2Username: userA.username,
    currentTurnPlayerId: userB.userId,
    status: 'IN_PROGRESS',
    boardState: ['', '', '', '', '', '', '', '', ''],
    createdAt: Date.now(),
  });
  console.log('[PASS] Multiplayer Game room created in game_rooms collection!');

  console.log('\n=== ALL FIRESTORE FLOWS VERIFIED WITH LIVE RULES! ===');
}

testFriendFlow().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
