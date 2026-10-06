import React, { useState, useEffect } from 'react';
import ChatList from '../components/chat/ChatList';
import ChatWindow from '../components/chat/ChatWindow';
import AddFriendModal from '../components/friends/AddFriendModal';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { subscribeToFriends } from '../services/friendService';

export default function ChatsView() {
  const { currentUser } = useAuth();
  const {
    activeFriend,
    setActiveFriend,
    conversations,
    openChatWithFriend,
  } = useChat();

  const [friends, setFriends] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.userId) return;
    const unsub = subscribeToFriends(currentUser.userId, setFriends);
    return unsub;
  }, [currentUser?.userId]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left Chat List (hidden on mobile if activeFriend is open) */}
      <div
        className={activeFriend ? 'desktop-only' : ''}
        style={{
          width: 'var(--chatlist-width)',
          height: '100%',
          flexShrink: 0,
        }}
      >
        <ChatList
          friends={friends}
          conversations={conversations}
          activeFriend={activeFriend}
          onSelectFriend={(f) => openChatWithFriend(f)}
          onAddFriendClick={() => setIsAddModalOpen(true)}
        />
      </div>

      {/* Right Chat Window (hidden on mobile if no activeFriend) */}
      <div
        className={!activeFriend ? 'desktop-only' : ''}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <ChatWindow onBack={() => setActiveFriend(null)} />
      </div>

      {/* Add Friend Modal */}
      {isAddModalOpen && (
        <AddFriendModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </div>
  );
}
