import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Deterministically generates conversation ID for two users.
 * Guarantees both users always open the exact same conversation document.
 */
export function getConversationId(uidA, uidB) {
  if (!uidA || !uidB) return '';
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Ensures conversation exists in Firestore before sending or viewing messages
 */
export async function ensureConversation(userA, userB) {
  const convoId = getConversationId(userA.userId, userB.userId);
  const convoRef = doc(db, 'conversations', convoId);
  const snap = await getDoc(convoRef);

  if (!snap.exists()) {
    const convoData = {
      conversationId: convoId,
      participants: [userA.userId, userB.userId],
      participantUsernames: {
        [userA.userId]: userA.username,
        [userB.userId]: userB.username,
      },
      lastMessage: '',
      lastMessageTimestamp: Date.now(),
      lastSenderId: '',
    };
    await setDoc(convoRef, convoData);
    return convoData;
  }
  return snap.data();
}

/**
 * Sends a message in a conversation.
 * Handles text, image, voice, video, and documents.
 */
export async function sendMessage(conversationId, messageData) {
  const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

  const payload = {
    messageId,
    senderId: messageData.senderId,
    receiverId: messageData.receiverId,
    text: messageData.text || '',
    messageType: messageData.messageType || 'TEXT',
    imageUrl: messageData.imageUrl || null,
    videoUrl: messageData.videoUrl || null,
    voiceUrl: messageData.voiceUrl || null,
    voiceDurationSeconds: messageData.voiceDurationSeconds || 0,
    documentUrl: messageData.documentUrl || null,
    documentName: messageData.documentName || null,
    documentSize: messageData.documentSize || 0,
    documentMimeType: messageData.documentMimeType || null,
    timestamp: Date.now(),
    status: 'SENT', // Transitions from client-side SENDING -> SENT
    isRead: false,
    read: false,
  };

  await setDoc(messageRef, payload);

  // Update parent conversation summary
  let previewText = payload.text;
  if (payload.messageType === 'IMAGE') previewText = '📷 Photo';
  else if (payload.messageType === 'VIDEO') previewText = '🎥 Video';
  else if (payload.messageType === 'VOICE') previewText = '🎤 Voice note';
  else if (payload.messageType === 'DOCUMENT') previewText = `📄 ${payload.documentName || 'Document'}`;

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: previewText || 'Message',
    lastMessageTimestamp: payload.timestamp,
    lastSenderId: payload.senderId,
  });

  return payload;
}

/**
 * Real-time listener for messages in a conversation
 */
export function subscribeToMessages(conversationId, callback) {
  if (!conversationId) return () => {};

  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    }));
    callback(messages);
  }, (err) => {
    console.error('Messages subscription error:', err);
  });
}

/**
 * Mark messages as DELIVERED when receiver gets snapshot
 */
export async function markMessagesAsDelivered(conversationId, receiverId) {
  if (!conversationId || !receiverId) return;

  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    where('receiverId', '==', receiverId),
    where('status', '==', 'SENT')
  );

  const snap = await getDoc(doc(db, 'conversations', conversationId));
  if (!snap.exists()) return;

  // Query sent messages intended for receiver
  // We use batch update for atomic state progression
  try {
    const qSnap = await onSnapshot(q, async (s) => {
      if (!s.empty) {
        const batch = writeBatch(db);
        s.docs.forEach((d) => {
          batch.update(d.ref, { status: 'DELIVERED' });
        });
        await batch.commit();
      }
    });
    // Return unsubscribe
    return qSnap;
  } catch (e) {
    console.debug('Failed to mark delivered:', e);
  }
}

/**
 * Mark messages as READ when receiver opens the chat
 */
export async function markMessagesAsRead(conversationId, currentUserId) {
  if (!conversationId || !currentUserId) return;

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      where('receiverId', '==', currentUserId),
      where('status', 'in', ['SENT', 'DELIVERED'])
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.update(d.ref, {
            status: 'READ',
            isRead: true,
            read: true,
          });
        });
        await batch.commit();
      }
    });

    return unsub;
  } catch (err) {
    console.debug('markMessagesAsRead error:', err);
  }
}

/**
 * Sets typing status in Firestore for the conversation.
 */
export async function setTypingStatus(conversationId, userId, username, isTyping) {
  if (!conversationId || !userId) return;
  try {
    const typingRef = doc(db, 'conversations', conversationId, 'typing', userId);
    await setDoc(typingRef, {
      userId,
      username,
      isTyping,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.debug('setTypingStatus error:', err);
  }
}

/**
 * Listens to typing indicator in a conversation for the other participant
 */
export function subscribeToTyping(conversationId, currentUserId, callback) {
  if (!conversationId || !currentUserId) return () => {};

  const typingCol = collection(db, 'conversations', conversationId, 'typing');
  return onSnapshot(typingCol, (snap) => {
    let typingUser = null;
    const now = Date.now();

    snap.docs.forEach((d) => {
      const data = d.data();
      // If typing by friend and within last 5 seconds
      if (data.userId !== currentUserId && data.isTyping && now - (data.timestamp || 0) < 5000) {
        typingUser = data.username || 'Friend';
      }
    });

    callback(typingUser);
  });
}

/**
 * Listens to all conversations where user is a participant
 */
export function subscribeToConversations(userId, callback) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    })).sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    callback(list);
  }, (err) => {
    console.debug('Conversations subscription error:', err);
  });
}
