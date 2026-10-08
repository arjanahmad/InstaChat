import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, ShieldCheck, Zap } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import MediaModal from './MediaModal';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function ChatWindow({ onBack }) {
  const { currentUser } = useAuth();
  const {
    activeFriend,
    messages,
    typingFriend,
    uploadProgress,
    isUploading,
    handleTyping,
    sendTextMessage,
    sendMediaMessage,
    sendVoiceMessage,
  } = useChat();

  const [previewMedia, setPreviewMedia] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom on message list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingFriend]);

  if (!activeFriend) {
    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(0, 102, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 30px rgba(0, 102, 255, 0.25)',
          }}
        >
          <MessageSquare size={38} color="#00d2ff" />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
          Select a Conversation
        </h3>
        <p style={{ maxWidth: '380px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Choose a friend from the left sidebar to start messaging, share media, send voice notes, make audio/video calls, or challenge them to multiplayer games.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '24px',
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={16} color="#10b981" /> End-to-End Private
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={16} color="#00d2ff" /> Real-Time WebRTC
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Chat Header */}
      <ChatHeader
        friend={activeFriend}
        typingUser={typingFriend}
        onBack={onBack}
      />

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.9rem',
              maxWidth: '320px',
            }}
          >
            <p>No messages here yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Say hello to start the conversation! 👋
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUser?.userId;
            return (
              <MessageBubble
                key={msg.messageId || msg.id}
                message={msg}
                isOwn={isOwn}
                onMediaClick={(url, type) => setPreviewMedia({ url, type })}
              />
            );
          })
        )}

        {/* Typing indicator bubble */}
        {typingFriend && (
          <div
            data-testid="typing-indicator"
            style={{
              alignSelf: 'flex-start',
              padding: '8px 14px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(15, 28, 63, 0.75)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--soft-cyan)', fontWeight: 500 }}>
              {typingFriend} is typing
            </span>
            <span style={{ display: 'flex', gap: '3px' }}>
              <span className="presence-dot online" style={{ width: 4, height: 4, animation: 'pulseGlow 0.6s infinite alternate' }} />
              <span className="presence-dot online" style={{ width: 4, height: 4, animation: 'pulseGlow 0.8s infinite alternate' }} />
              <span className="presence-dot online" style={{ width: 4, height: 4, animation: 'pulseGlow 1.0s infinite alternate' }} />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <MessageInput
        onSendMessage={sendTextMessage}
        onSendMedia={sendMediaMessage}
        onSendVoice={sendVoiceMessage}
        onTyping={handleTyping}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
      />

      {/* Fullscreen Media Modal */}
      {previewMedia && (
        <MediaModal
          mediaUrl={previewMedia.url}
          mediaType={previewMedia.type}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </div>
  );
}
