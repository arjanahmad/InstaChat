import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getConversationId,
  ensureConversation,
  subscribeToMessages,
  sendMessage,
  markMessagesAsDelivered,
  markMessagesAsRead,
  setTypingStatus,
  subscribeToTyping,
  subscribeToConversations,
} from '../services/chatService';
import { uploadToCloudinary } from '../config/cloudinary';
import { sounds } from '../config/webrtc';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { currentUser } = useAuth();
  const [activeFriend, setActiveFriend] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingFriend, setTypingFriend] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const activeConversationId = activeFriend && currentUser
    ? getConversationId(currentUser.userId, activeFriend.friendId)
    : null;

  const typingTimeoutRef = useRef(null);
  const prevMessagesCountRef = useRef(0);

  // Subscribe to all conversations list
  useEffect(() => {
    if (!currentUser?.userId) {
      setConversations([]);
      return;
    }
    const unsub = subscribeToConversations(currentUser.userId, (list) => {
      setConversations(list);
    });
    return unsub;
  }, [currentUser?.userId]);

  // Handle active conversation changes
  useEffect(() => {
    if (!activeConversationId || !currentUser?.userId || !activeFriend) {
      setMessages([]);
      setTypingFriend(null);
      prevMessagesCountRef.current = 0;
      return;
    }

    // 1. Ensure conversation exists in Firestore
    ensureConversation(
      { userId: currentUser.userId, username: currentUser.username },
      { userId: activeFriend.friendId, username: activeFriend.friendUsername }
    );

    // 2. Mark messages as READ
    let markReadUnsub = null;
    markMessagesAsRead(activeConversationId, currentUser.userId).then((u) => {
      markReadUnsub = u;
    });

    // 3. Mark messages as DELIVERED
    let markDeliveredUnsub = null;
    markMessagesAsDelivered(activeConversationId, currentUser.userId).then((u) => {
      markDeliveredUnsub = u;
    });

    // 4. Subscribe to messages in active conversation
    const messagesUnsub = subscribeToMessages(activeConversationId, (msgs) => {
      // If incoming new message while chatting, play sound
      if (msgs.length > prevMessagesCountRef.current && prevMessagesCountRef.current > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUser.userId) {
          sounds.playMessageSound();
        }
      }
      prevMessagesCountRef.current = msgs.length;
      setMessages(msgs);
    });

    // 5. Subscribe to typing indicator
    const typingUnsub = subscribeToTyping(
      activeConversationId,
      currentUser.userId,
      (typer) => {
        setTypingFriend(typer);
      }
    );

    return () => {
      messagesUnsub();
      typingUnsub();
      if (markReadUnsub) markReadUnsub();
      if (markDeliveredUnsub) markDeliveredUnsub();
      // Reset typing on leave
      if (activeConversationId && currentUser?.userId) {
        setTypingStatus(activeConversationId, currentUser.userId, currentUser.username, false);
      }
    };
  }, [activeConversationId, currentUser?.userId, activeFriend?.friendId]);

  /**
   * Handle user typing event with debouncing
   */
  const handleTyping = useCallback(() => {
    if (!activeConversationId || !currentUser?.userId) return;

    setTypingStatus(activeConversationId, currentUser.userId, currentUser.username, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(activeConversationId, currentUser.userId, currentUser.username, false);
    }, 2500);
  }, [activeConversationId, currentUser?.userId, currentUser?.username]);

  /**
   * Select a friend to open conversation. Guarantees deterministic conversation load.
   */
  const openChatWithFriend = useCallback((friend) => {
    setActiveFriend(friend);
  }, []);

  /**
   * Send regular text message
   */
  const sendTextMessage = async (text) => {
    if (!text?.trim() || !activeConversationId || !currentUser || !activeFriend) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingStatus(activeConversationId, currentUser.userId, currentUser.username, false);

    const messageData = {
      senderId: currentUser.userId,
      receiverId: activeFriend.friendId,
      text: text.trim(),
      messageType: 'TEXT',
    };

    return await sendMessage(activeConversationId, messageData);
  };

  /**
   * Send media file (Image, Video, Document) via Cloudinary
   */
  const sendMediaMessage = async (file, type) => {
    if (!file || !activeConversationId || !currentUser || !activeFriend) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Upload file directly to Cloudinary
      const uploaded = await uploadToCloudinary(file, type.toLowerCase(), (progress) => {
        setUploadProgress(progress);
      });

      const messageData = {
        senderId: currentUser.userId,
        receiverId: activeFriend.friendId,
        text: '',
        messageType: type,
        imageUrl: type === 'IMAGE' ? uploaded.url : null,
        videoUrl: type === 'VIDEO' ? uploaded.url : null,
        documentUrl: type === 'DOCUMENT' ? uploaded.url : null,
        documentName: type === 'DOCUMENT' ? file.name : null,
        documentSize: type === 'DOCUMENT' ? file.size : 0,
        documentMimeType: type === 'DOCUMENT' ? file.type : null,
      };

      await sendMessage(activeConversationId, messageData);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  /**
   * Send voice note recorded via MediaRecorder
   */
  const sendVoiceMessage = async (audioBlob, durationSeconds) => {
    if (!audioBlob || !activeConversationId || !currentUser || !activeFriend) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const uploaded = await uploadToCloudinary(audioBlob, 'video', (progress) => {
        setUploadProgress(progress);
      });

      const messageData = {
        senderId: currentUser.userId,
        receiverId: activeFriend.friendId,
        text: '',
        messageType: 'VOICE',
        voiceUrl: uploaded.url,
        voiceDurationSeconds: Math.round(durationSeconds) || 1,
      };

      await sendMessage(activeConversationId, messageData);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const value = {
    activeFriend,
    setActiveFriend,
    openChatWithFriend,
    conversations,
    messages,
    typingFriend,
    uploadProgress,
    isUploading,
    handleTyping,
    sendTextMessage,
    sendMediaMessage,
    sendVoiceMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
