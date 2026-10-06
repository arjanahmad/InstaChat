import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Searches users by username (exact or prefix)
 */
export async function searchUsers(searchTerm, currentUserId) {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const term = searchTerm.trim().toLowerCase();
  const results = new Map();

  try {
    // 1. Exact match on usernameLower
    const exactQuery = query(
      collection(db, 'users'),
      where('usernameLower', '==', term)
    );
    const exactSnap = await getDocs(exactQuery);
    exactSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.userId !== currentUserId) {
        results.set(data.userId, data);
      }
    });

    // 2. Direct lookup by userId
    const docById = await getDoc(doc(db, 'users', searchTerm.trim()));
    if (docById.exists()) {
      const data = docById.data();
      if (data.userId !== currentUserId) {
        results.set(data.userId, data);
      }
    }

    // 3. Prefix search
    if (results.size === 0) {
      const prefixQuery = query(
        collection(db, 'users'),
        where('usernameLower', '>=', term),
        where('usernameLower', '<=', term + '\uf8ff')
      );
      const prefixSnap = await getDocs(prefixQuery);
      prefixSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId !== currentUserId) {
          results.set(data.userId, data);
        }
      });
    }
  } catch (err) {
    console.debug('Search users error:', err);
  }

  return Array.from(results.values());
}

/**
 * Sends a friend request
 */
export async function sendFriendRequest(senderUser, receiverUser) {
  if (!senderUser || !receiverUser) throw new Error('Invalid users');
  const sId = senderUser.userId || senderUser.uid;
  const rId = receiverUser.userId || receiverUser.uid;
  const sName = senderUser.username || senderUser.displayName || 'User';
  const rName = receiverUser.username || receiverUser.displayName || 'User';

  console.log('[sendFriendRequest] Step 0: start', { sId, rId, sName, rName });

  if (sId === rId) {
    throw new Error('You cannot add yourself as a friend.');
  }

  // Check if already friends
  console.log('[sendFriendRequest] Step 1: checking friends');
  const existingFriend = await getDoc(
    doc(db, 'friends', sId, 'userFriends', rId)
  );
  if (existingFriend.exists()) {
    throw new Error(`You are already friends with ${rName}.`);
  }

  // Check if pending request exists via direct document ID
  console.log('[sendFriendRequest] Step 2: checking existingReq');
  const requestId = `${sId}_${rId}`;
  const existingReq = await getDoc(doc(db, 'friendRequests', requestId));
  if (existingReq.exists() && existingReq.data().status === 'PENDING') {
    throw new Error('Friend request already sent.');
  }

  console.log('[sendFriendRequest] Step 3: setDoc');
  const reqData = {
    requestId,
    senderId: sId,
    senderUsername: sName,
    senderProfileImageUrl: senderUser.profileImageUrl || null,
    receiverId: rId,
    receiverUsername: rName,
    receiverProfileImageUrl: receiverUser.profileImageUrl || null,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'friendRequests', requestId), reqData);
  console.log('[sendFriendRequest] Step 4: done!');
  return reqData;
}

/**
 * Accept a friend request:
 * Sets status to ACCEPTED and adds both users to friends/{uid}/userFriends/{friendId}
 */
export async function acceptFriendRequest(request, currentUser) {
  const reqRef = doc(db, 'friendRequests', request.requestId);
  await updateDoc(reqRef, { status: 'ACCEPTED' });

  const currentId = currentUser.userId || currentUser.uid;
  const currentName = currentUser.username || currentUser.displayName || 'User';
  const isCurrentReceiver = request.receiverId === currentId;
  const friendId = isCurrentReceiver ? request.senderId : request.receiverId;
  const friendUsername = isCurrentReceiver ? request.senderUsername : request.receiverUsername;
  const friendProfileImg = isCurrentReceiver
    ? request.senderProfileImageUrl
    : request.receiverProfileImageUrl;

  // Add friend to current user's friends list
  await setDoc(doc(db, 'friends', currentId, 'userFriends', friendId), {
    friendId,
    friendUsername,
    friendProfileImageUrl: friendProfileImg || null,
    friendOnline: false,
    customNickname: '',
    friendshipDate: Date.now(),
  });

  // Add current user to friend's friends list
  await setDoc(doc(db, 'friends', friendId, 'userFriends', currentId), {
    friendId: currentId,
    friendUsername: currentName,
    friendProfileImageUrl: currentUser.profileImageUrl || null,
    friendOnline: true,
    customNickname: '',
    friendshipDate: Date.now(),
  });
}

/**
 * Rejects or cancels a friend request
 */
export async function rejectFriendRequest(requestId) {
  const reqRef = doc(db, 'friendRequests', requestId);
  await deleteDoc(reqRef);
}

/**
 * Updates a friend's local custom nickname (e.g. "Arjan ❤️")
 */
export async function updateFriendNickname(currentUserId, friendId, nickname) {
  const ref = doc(db, 'friends', currentUserId, 'userFriends', friendId);
  await updateDoc(ref, {
    customNickname: nickname.trim(),
  });
}

/**
 * Listens to user's friends list in real time
 */
export function subscribeToFriends(userId, callback) {
  if (!userId) return () => {};

  const colRef = collection(db, 'friends', userId, 'userFriends');
  return onSnapshot(colRef, async (snap) => {
    const friendList = snap.docs.map((d) => d.data());
    
    // Fetch live presence from users collection for each friend
    if (friendList.length > 0) {
      try {
        const enriched = await Promise.all(
          friendList.map(async (f) => {
            const uSnap = await getDoc(doc(db, 'users', f.friendId));
            if (uSnap.exists()) {
              const uData = uSnap.data();
              return {
                ...f,
                friendOnline: !!uData.online,
                lastActive: uData.lastActive || 0,
                friendProfileImageUrl: uData.profileImageUrl || f.friendProfileImageUrl,
              };
            }
            return f;
          })
        );
        callback(enriched);
        return;
      } catch (_) {}
    }
    callback(friendList);
  });
}

/**
 * Listens to pending incoming friend requests
 */
export function subscribeToIncomingFriendRequests(userId, callback) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'friendRequests'),
    where('receiverId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .filter((r) => r.status === 'PENDING');
      callback(list);
    },
    (err) => {
      console.warn('subscribeToIncomingFriendRequests listener error:', err);
    }
  );
}

/**
 * Listens to pending outgoing friend requests
 */
export function subscribeToOutgoingFriendRequests(userId, callback) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'friendRequests'),
    where('senderId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .filter((r) => r.status === 'PENDING');
      callback(list);
    },
    (err) => {
      console.warn('subscribeToOutgoingFriendRequests listener error:', err);
    }
  );
}
