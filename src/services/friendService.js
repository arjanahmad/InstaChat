import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

/**
 * Searches users by username (exact or partial)
 */
export async function searchUsers(searchTerm, currentUserId) {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  try {
    const res = await api.get(`/api/friends/search?q=${encodeURIComponent(searchTerm.trim())}&currentUserId=${currentUserId || ''}`);
    return res.users || [];
  } catch (err) {
    console.debug('Search users error:', err);
    return [];
  }
}

/**
 * Sends a friend request
 */
export async function sendFriendRequest(senderUser, receiverUser) {
  if (!senderUser || !receiverUser) throw new Error('Invalid users');

  const res = await api.post('/api/friends/request', {
    senderUser,
    receiverUser,
  });

  return res.request;
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(request, currentUser) {
  const currentId = currentUser.userId || currentUser.uid;
  const res = await api.post('/api/friends/accept', {
    requestId: request.requestId,
    currentUserId: currentId,
  });
  return res;
}

/**
 * Rejects or cancels a friend request
 */
export async function rejectFriendRequest(requestId) {
  const res = await api.post('/api/friends/reject', { requestId });
  return res;
}

/**
 * Updates a friend's local custom nickname (e.g. "Arjan ❤️")
 */
export async function updateFriendNickname(currentUserId, friendId, nickname) {
  return await api.post('/api/friends/nickname', {
    currentUserId,
    friendId,
    nickname,
  });
}

/**
 * Real-time subscription to user's friends list
 */
export function subscribeToFriends(userId, callback) {
  if (!userId) return () => {};

  let isSubscribed = true;

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

  // Robust real-time sync: poll every 2.5s unconditionally
  const pollTimer = setInterval(() => {
    if (isSubscribed) {
      fetchFriends();
    }
  }, 2500);

  // Listen to realtime socket presence and friendship events
  const unsubPresence = realtimeSocket.on('presence:changed', () => {
    fetchFriends();
  });

  const unsubAccepted = realtimeSocket.on('friend:request-accepted', () => {
    fetchFriends();
  });

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

  // Robust real-time sync: poll every 2.5s unconditionally
  const pollTimer = setInterval(() => {
    if (isSubscribed) {
      fetchRequests();
    }
  }, 2500);

  const unsubReceived = realtimeSocket.on('friend:request-received', (reqDoc) => {
    if (reqDoc.receiverId === userId) {
      fetchRequests();
    }
  });

  const unsubAccepted = realtimeSocket.on('friend:request-accepted', () => {
    fetchRequests();
  });

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
    if (isSubscribed) {
      fetchRequests();
    }
  }, 3000);

  const unsubAccepted = realtimeSocket.on('friend:request-accepted', () => {
    fetchRequests();
  });

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubAccepted();
  };
}
