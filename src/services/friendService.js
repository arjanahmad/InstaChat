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
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

/**
 * Searches users by username (exact, prefix, substring, or ID)
 */
export async function searchUsers(searchTerm, currentUserId) {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const rawTerm = searchTerm.trim();
  const term = rawTerm.toLowerCase();
  const results = new Map();

  // 1. Direct Firestore Search if available
  if (db) {
    try {
      // A. Exact match on usernameLower
      const exactQuery = query(
        collection(db, 'users'),
        where('usernameLower', '==', term)
      );
      const exactSnap = await getDocs(exactQuery);
      exactSnap.docs.forEach((d) => {
        const data = d.data();
        const id = data.userId || data.uid || d.id;
        if (id !== currentUserId) {
          results.set(id, { ...data, userId: id });
        }
      });

      // B. Prefix search if exact match gave nothing
      if (results.size === 0) {
        const prefixQuery = query(
          collection(db, 'users'),
          where('usernameLower', '>=', term),
          where('usernameLower', '<=', term + '\uf8ff')
        );
        const prefixSnap = await getDocs(prefixQuery);
        prefixSnap.docs.forEach((d) => {
          const data = d.data();
          const id = data.userId || data.uid || d.id;
          if (id !== currentUserId) {
            results.set(id, { ...data, userId: id });
          }
        });
      }

      // C. Substring/broader scan if exact & prefix gave nothing
      if (results.size === 0) {
        try {
          const broaderQuery = query(collection(db, 'users'), limit(50));
          const broaderSnap = await getDocs(broaderQuery);
          broaderSnap.docs.forEach((d) => {
            const data = d.data();
            const id = data.userId || data.uid || d.id;
            if (id === currentUserId) return;
            const uLower = (data.usernameLower || data.username || '').toLowerCase();
            const dLower = (data.displayName || '').toLowerCase();
            const eLower = (data.email || '').toLowerCase();
            if (uLower.includes(term) || dLower.includes(term) || eLower.includes(term)) {
              results.set(id, { ...data, userId: id });
            }
          });
        } catch (_) {}
      }

      // D. Direct lookup by document ID / uid
      if (results.size === 0 && rawTerm.length >= 8) {
        try {
          const docById = await getDoc(doc(db, 'users', rawTerm));
          if (docById.exists()) {
            const data = docById.data();
            const id = data.userId || data.uid || docById.id;
            if (id !== currentUserId) {
              results.set(id, { ...data, userId: id });
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[friendService] Firestore search notice:', err.code || err.message);
    }
  }

  // 2. Fallback: Backend REST API
  try {
    const res = await api.get(
      `/api/friends/search?q=${encodeURIComponent(rawTerm)}&currentUserId=${encodeURIComponent(currentUserId || '')}`
    );
    const backendUsers = res.users || [];
    backendUsers.forEach((u) => {
      const id = u.userId || u.uid;
      if (id !== currentUserId && !results.has(id)) {
        results.set(id, u);
      }
    });
  } catch (err) {
    console.debug('Search users API error:', err);
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

  if (!sId || !rId) throw new Error('Invalid user identifiers');

  if (sId === rId) {
    throw new Error('You cannot add yourself as a friend.');
  }

  const requestId = `${sId}_${rId}`;
  const reverseRequestId = `${rId}_${sId}`;

  // 1. Direct Firestore implementation
  if (db) {
    // Check if already friends
    const existingFriendSnap = await getDoc(doc(db, 'friends', sId, 'userFriends', rId));
    if (existingFriendSnap.exists()) {
      throw new Error(`You are already friends with ${rName}.`);
    }

    // Check if request already sent
    const existingReqSnap = await getDoc(doc(db, 'friendRequests', requestId));
    if (existingReqSnap.exists() && existingReqSnap.data().status === 'PENDING') {
      throw new Error('Friend request already sent.');
    }

    // Check if the other user already sent a pending request to this user
    const reverseReqSnap = await getDoc(doc(db, 'friendRequests', reverseRequestId));
    if (reverseReqSnap.exists() && reverseReqSnap.data().status === 'PENDING') {
      throw new Error(`${rName} has already sent you a friend request. Check your requests list to accept!`);
    }

    const reqData = {
      requestId,
      senderId: sId,
      senderUid: sId,
      senderUsername: sName,
      senderProfileImageUrl: senderUser.profileImageUrl || senderUser.photoURL || null,
      receiverId: rId,
      receiverUid: rId,
      receiverUsername: rName,
      receiverProfileImageUrl: receiverUser.profileImageUrl || receiverUser.photoURL || null,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'friendRequests', requestId), reqData);

    // Sync to backend API & socket for cross-client notifications
    try {
      api.post('/api/friends/request', { senderUser, receiverUser }).catch(() => {});
    } catch (_) {}

    realtimeSocket.emit('friend:request-received', {
      targetUserId: rId,
      ...reqData,
    });

    return reqData;
  }

  // Fallback: Backend REST API
  const res = await api.post('/api/friends/request', {
    senderUser,
    receiverUser,
  });

  if (res.request) {
    realtimeSocket.emit('friend:request-received', {
      targetUserId: rId,
      ...res.request,
    });
  }

  return res.request;
}

/**
 * Accept a friend request:
 * Sets status to ACCEPTED and adds both users to friends/{uid}/userFriends/{friendId}
 */
export async function acceptFriendRequest(request, currentUser) {
  const currentId = currentUser.userId || currentUser.uid;
  const currentName = currentUser.username || currentUser.displayName || 'User';
  const currentImg = currentUser.profileImageUrl || currentUser.photoURL || null;

  const isCurrentReceiver = request.receiverId === currentId;
  const friendId = isCurrentReceiver ? request.senderId : request.receiverId;
  const friendName = isCurrentReceiver ? request.senderUsername : request.receiverUsername;
  const friendImg = isCurrentReceiver
    ? (request.senderProfileImageUrl || null)
    : (request.receiverProfileImageUrl || null);

  const now = Date.now();

  // 1. Direct Firestore implementation
  if (db) {
    // Update request status
    const reqRef = doc(db, 'friendRequests', request.requestId);
    try {
      await updateDoc(reqRef, { status: 'ACCEPTED' });
    } catch (_) {
      try {
        await deleteDoc(reqRef);
      } catch (_) {}
    }

    // Add friend to current user's friends list
    await setDoc(doc(db, 'friends', currentId, 'userFriends', friendId), {
      friendId,
      friendUsername: friendName,
      friendProfileImageUrl: friendImg,
      friendOnline: false,
      customNickname: '',
      friendshipDate: now,
    });

    // Add current user to friend's friends list
    await setDoc(doc(db, 'friends', friendId, 'userFriends', currentId), {
      friendId: currentId,
      friendUsername: currentName,
      friendProfileImageUrl: currentImg,
      friendOnline: true,
      customNickname: '',
      friendshipDate: now,
    });

    // Sync to backend API in background
    try {
      api.post('/api/friends/accept', {
        requestId: request.requestId,
        currentUserId: currentId,
      }).catch(() => {});
    } catch (_) {}

    realtimeSocket.emit('friend:request-accepted', {
      targetUserId: friendId,
      requestId: request.requestId,
      friendship: { userA: currentId, userB: friendId, createdAt: now },
    });

    return { success: true };
  }

  // Fallback: Backend REST API
  const res = await api.post('/api/friends/accept', {
    requestId: request.requestId,
    currentUserId: currentId,
  });

  realtimeSocket.emit('friend:request-accepted', {
    targetUserId: friendId,
    requestId: request.requestId,
    friendship: res.friendship,
  });

  return res;
}

/**
 * Rejects or cancels a friend request
 */
export async function rejectFriendRequest(requestId) {
  if (db) {
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
    } catch (_) {}
  }

  try {
    return await api.post('/api/friends/reject', { requestId });
  } catch (_) {
    return { success: true };
  }
}

/**
 * Updates a friend's local custom nickname (e.g. "Arjan ❤️")
 */
export async function updateFriendNickname(currentUserId, friendId, nickname) {
  const cleanNick = (nickname || '').trim();

  if (db) {
    try {
      await updateDoc(doc(db, 'friends', currentUserId, 'userFriends', friendId), {
        customNickname: cleanNick,
      });
    } catch (_) {}
  }

  return await api.post('/api/friends/nickname', {
    currentUserId,
    friendId,
    nickname: cleanNick,
  });
}

/**
 * Real-time subscription to user's friends list
 */
export function subscribeToFriends(userId, callback) {
  if (!userId) return () => {};

  let isSubscribed = true;

  // 1. Direct Firestore onSnapshot if available
  if (db) {
    const colRef = collection(db, 'friends', userId, 'userFriends');
    const unsubFirestore = onSnapshot(
      colRef,
      async (snap) => {
        if (!isSubscribed) return;
        const friendList = snap.docs.map((d) => ({ ...d.data(), friendId: d.data().friendId || d.id }));

        // Enrich live online presence from users collection
        if (friendList.length > 0) {
          try {
            const enriched = await Promise.all(
              friendList.map(async (f) => {
                try {
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
                } catch (_) {}
                return f;
              })
            );
            if (isSubscribed) callback(enriched);
            return;
          } catch (_) {}
        }

        if (isSubscribed) callback(friendList);
      },
      (err) => {
        console.warn('[friendService] Firestore friends listener warning:', err.code || err.message);
      }
    );

    // Also support socket presence events
    const unsubPresence = realtimeSocket.on('presence:changed', async () => {
      if (!isSubscribed) return;
      try {
        const snap = await getDocs(colRef);
        callback(snap.docs.map((d) => d.data()));
      } catch (_) {}
    });

    return () => {
      isSubscribed = false;
      unsubFirestore();
      unsubPresence();
    };
  }

  // 2. Fallback: API Polling + Socket
  const fetchFriends = async () => {
    try {
      const res = await api.get(`/api/friends/${userId}`);
      if (isSubscribed) {
        callback(res.friends || []);
      }
    } catch (e) {
      console.debug('Error fetching friends:', e);
    }
  };

  fetchFriends();

  const pollTimer = setInterval(() => {
    if (isSubscribed) fetchFriends();
  }, 2500);

  const unsubPresence = realtimeSocket.on('presence:changed', () => fetchFriends());
  const unsubAccepted = realtimeSocket.on('friend:request-accepted', () => fetchFriends());

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubPresence();
    unsubAccepted();
  };
}

/**
 * Real-time subscription to pending incoming friend requests
 */
export function subscribeToIncomingFriendRequests(userId, callback) {
  if (!userId) return () => {};

  let isSubscribed = true;

  // 1. Direct Firestore onSnapshot
  if (db) {
    const q = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', userId)
    );

    const unsubFirestore = onSnapshot(
      q,
      (snap) => {
        if (!isSubscribed) return;
        const list = snap.docs
          .map((d) => ({ ...d.data(), requestId: d.data().requestId || d.id }))
          .filter((r) => r.status === 'PENDING');
        callback(list);
      },
      (err) => {
        console.warn('[friendService] Incoming requests listener warning:', err.code || err.message);
      }
    );

    const unsubReceived = realtimeSocket.on('friend:request-received', (reqDoc) => {
      if (reqDoc.receiverId === userId && isSubscribed) {
        callback([reqDoc]);
      }
    });

    return () => {
      isSubscribed = false;
      unsubFirestore();
      unsubReceived();
    };
  }

  // 2. Fallback: API Polling + Socket
  const fetchRequests = async () => {
    try {
      const res = await api.get(`/api/friends/${userId}/requests`);
      if (isSubscribed) {
        callback(res.incoming || []);
      }
    } catch (e) {
      console.debug('Error fetching friend requests:', e);
    }
  };

  fetchRequests();

  const pollTimer = setInterval(() => {
    if (isSubscribed) fetchRequests();
  }, 2500);

  const unsubReceived = realtimeSocket.on('friend:request-received', (reqDoc) => {
    if (reqDoc.receiverId === userId) {
      if (isSubscribed) callback([reqDoc]);
      fetchRequests();
    }
  });

  const unsubAccepted = realtimeSocket.on('friend:request-accepted', () => fetchRequests());

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubReceived();
    unsubAccepted();
  };
}

/**
 * Real-time subscription to pending outgoing friend requests
 */
export function subscribeToOutgoingFriendRequests(userId, callback) {
  if (!userId) return () => {};

  let isSubscribed = true;

  if (db) {
    const q = query(
      collection(db, 'friendRequests'),
      where('senderId', '==', userId)
    );

    const unsubFirestore = onSnapshot(
      q,
      (snap) => {
        if (!isSubscribed) return;
        const list = snap.docs
          .map((d) => ({ ...d.data(), requestId: d.data().requestId || d.id }))
          .filter((r) => r.status === 'PENDING');
        callback(list);
      },
      (err) => {
        console.warn('[friendService] Outgoing requests listener warning:', err.code || err.message);
      }
    );

    return () => {
      isSubscribed = false;
      unsubFirestore();
    };
  }

  const fetchRequests = async () => {
    try {
      const res = await api.get(`/api/friends/${userId}/requests`);
      if (isSubscribed) {
        callback(res.outgoing || []);
      }
    } catch (e) {
      console.debug('Error fetching outgoing requests:', e);
    }
  };

  fetchRequests();

  const pollTimer = setInterval(() => {
    if (isSubscribed) fetchRequests();
  }, 3000);

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
  };
}

