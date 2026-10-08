import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

/**
 * Deterministically generates conversation ID for two users.
 * Guarantees User A -> User B and User B -> User A resolve to the exact same conversation.
 */
export function getConversationId(uidA, uidB) {
  if (!uidA || !uidB) return '';
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Ensures conversation exists before sending or viewing messages
 */
export async function ensureConversation(userA, userB) {
  const res = await api.post('/api/conversations/ensure', { userA, userB });
  return res.conversation;
}

/**
 * Sends a message in a conversation.
 * Handles text, image, voice, video, and documents.
 */
export async function sendMessage(conversationId, messageData) {
  const res = await api.post(`/api/conversations/${conversationId}/messages`, messageData);
  if (res.message) {
    const targetUserId = messageData.receiverId || messageData.otherUserId;
    if (targetUserId) {
      realtimeSocket.emit('chat:message-received', {
        targetUserId,
        ...res.message,
      });
    }
  }
  return res.message;
}

/**
 * Real-time listener for messages in a conversation
 */
export function subscribeToMessages(conversationId, callback) {
  if (!conversationId) return () => {};

  let messagesMap = new Map();
  let isSubscribed = true;

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/api/conversations/${conversationId}/messages`);
      if (isSubscribed && res.messages) {
        messagesMap.clear();
        res.messages.forEach((m) => messagesMap.set(m.messageId, m));
        callback(Array.from(messagesMap.values()));
      }
    } catch (err) {
      console.debug('Failed to fetch messages:', err);
    }
  };

  fetchHistory();

  const pollTimer = setInterval(() => {
    if (!realtimeSocket.isConnected && isSubscribed) {
      fetchHistory();
    }
  }, 2500);

  const handleMessage = (newMsg) => {
    if (newMsg.conversationId === conversationId) {
      messagesMap.set(newMsg.messageId, newMsg);
      callback(Array.from(messagesMap.values()));
    }
  };

  const unsubSent = realtimeSocket.on('chat:message-sent', handleMessage);
  const unsubReceived = realtimeSocket.on('chat:message-received', handleMessage);

  const unsubDelivered = realtimeSocket.on('chat:messages-delivered', ({ conversationId: cId }) => {
    if (cId === conversationId) {
      messagesMap.forEach((m) => {
        if (m.status === 'SENT') m.status = 'DELIVERED';
      });
      callback(Array.from(messagesMap.values()));
    }
  });

  const unsubRead = realtimeSocket.on('chat:messages-read', ({ conversationId: cId }) => {
    if (cId === conversationId) {
      messagesMap.forEach((m) => {
        m.status = 'READ';
        m.isRead = true;
        m.read = true;
      });
      callback(Array.from(messagesMap.values()));
    }
  });

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubSent();
    unsubReceived();
    unsubDelivered();
    unsubRead();
  };
}

/**
 * Mark messages as DELIVERED when receiver receives message or opens conversation
 */
export async function markMessagesAsDelivered(conversationId, receiverId) {
  if (!conversationId || !receiverId) return;
  try {
    await api.post(`/api/conversations/${conversationId}/delivered`, { receiverId });
  } catch (err) {
    console.debug('markMessagesAsDelivered error:', err);
  }
}

/**
 * Mark messages as READ when receiver opens the conversation
 */
export async function markMessagesAsRead(conversationId, currentUserId) {
  if (!conversationId || !currentUserId) return;
  try {
    await api.post(`/api/conversations/${conversationId}/read`, { readerId: currentUserId });
  } catch (err) {
    console.debug('markMessagesAsRead error:', err);
  }
}

/**
 * Sets typing status in real time
 */
export function setTypingStatus(conversationId, userId, username, isTyping, receiverId = null) {
  realtimeSocket.emit('chat:typing', {
    conversationId,
    userId,
    username,
    receiverId,
    isTyping,
  });
}

/**
 * Listens to typing indicator in a conversation for the other participant
 */
export function subscribeToTyping(conversationId, currentUserId, callback) {
  if (!conversationId || !currentUserId) return () => {};

  return realtimeSocket.on('chat:typing', (data) => {
    if (data.conversationId === conversationId && data.userId !== currentUserId) {
      callback(data.isTyping ? data.username : null);
    }
  });
}

/**
 * Listens to all conversations where user is a participant
 */
export function subscribeToConversations(userId, callback) {
  if (!userId) return () => {};

  let isSubscribed = true;

  const fetchConversations = async () => {
    try {
      const res = await api.get(`/api/conversations/${userId}`);
      if (isSubscribed && res.conversations) {
        callback(res.conversations);
      }
    } catch (err) {
      console.debug('Failed to fetch conversations:', err);
    }
  };

  fetchConversations();

  const pollTimer = setInterval(() => {
    if (!realtimeSocket.isConnected && isSubscribed) {
      fetchConversations();
    }
  }, 3500);

  const handleMsg = () => fetchConversations();
  const unsubSent = realtimeSocket.on('chat:message-sent', handleMsg);
  const unsubReceived = realtimeSocket.on('chat:message-received', handleMsg);

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubSent();
    unsubReceived();
  };
}
