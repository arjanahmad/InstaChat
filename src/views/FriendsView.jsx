import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  Gamepad2,
  Edit2,
  Search,
  Bell,
  Users,
} from 'lucide-react';
import Avatar from '../components/common/Avatar';
import AddFriendModal from '../components/friends/AddFriendModal';
import EditNicknameModal from '../components/friends/EditNicknameModal';
import FriendRequestsModal from '../components/friends/FriendRequestsModal';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useGame } from '../context/GameContext';
import {
  subscribeToFriends,
  subscribeToIncomingFriendRequests,
} from '../services/friendService';

export default function FriendsView({ onNavigateToChats }) {
  const { currentUser } = useAuth();
  const { openChatWithFriend } = useChat();
  const { startCall } = useCall();
  const { inviteFriendToGame, setIsInviteModalOpen } = useGame();

  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [editingFriend, setEditingFriend] = useState(null);

  useEffect(() => {
    if (!currentUser?.userId) return;

    const unsubFriends = subscribeToFriends(currentUser.userId, (list) => {
      setFriends(list);
    });

    const unsubReqs = subscribeToIncomingFriendRequests(currentUser.userId, (reqs) => {
      setIncomingRequests(reqs);
    });

    return () => {
      unsubFriends();
      unsubReqs();
    };
  }, [currentUser?.userId]);

  const handleStartChat = (friend) => {
    openChatWithFriend(friend);
    if (onNavigateToChats) onNavigateToChats();
  };

  const handleVoiceCall = (friend) => {
    startCall(friend, false);
  };

  const handleVideoCall = (friend) => {
    startCall(friend, true);
  };

  const filtered = friends.filter((f) => {
    const name = (f.customNickname || f.friendUsername || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Top Header & Actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Friends ({friends.length})
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              Connect, call, chat and play real-time multiplayer games.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsRequestsModalOpen(true)}
              className="btn-secondary"
              style={{ position: 'relative' }}
            >
              <Bell size={16} /> Requests
              {incomingRequests.length > 0 && (
                <span className="badge-count" style={{ marginLeft: 4 }}>
                  {incomingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <UserPlus size={16} /> Add Friend
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <Search
            size={18}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search friends by name or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '42px' }}
          />
        </div>

        {/* Friends Grid */}
        {filtered.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <Users size={48} color="#0066ff" opacity={0.6} />
            <h3 style={{ fontSize: '1.2rem', color: '#ffffff', margin: 0 }}>
              {friends.length === 0 ? 'No friends added yet' : 'No matching friends found'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '360px' }}>
              {friends.length === 0
                ? 'Send a friend request to start messaging, voice calling, or playing games!'
                : 'Try searching with a different name or clear the search bar.'}
            </p>
            {friends.length === 0 && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary"
                style={{ marginTop: '8px' }}
              >
                <UserPlus size={16} /> Find Friends
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map((friend) => {
              const displayName = friend.customNickname || friend.friendUsername || 'Friend';
              const hasNickname = !!friend.customNickname;
              const isOnline = !!friend.friendOnline;

              return (
                <div
                  key={friend.friendId}
                  className="glass-panel"
                  style={{
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                  }}
                >
                  {/* Top user row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Avatar
                      src={friend.friendProfileImageUrl}
                      name={displayName}
                      size={52}
                      online={isOnline}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '1.02rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {displayName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingFriend(friend)}
                          className="btn-icon"
                          style={{ width: 26, height: 26, border: 'none', background: 'transparent' }}
                          title="Edit Nickname"
                        >
                          <Edit2 size={13} color="var(--text-dim)" />
                        </button>
                      </div>

                      {hasNickname && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                          @{friend.friendUsername}
                        </div>
                      )}

                      <div style={{ fontSize: '0.74rem', color: isOnline ? '#10b981' : 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} style={{ width: 6, height: 6 }} />
                        {isOnline ? 'Online now' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-glass)',
                    }}
                  >
                    <button
                      type="button"
                      data-testid="open-chat-btn"
                      onClick={() => handleStartChat(friend)}
                      className="btn-secondary"
                      style={{ padding: '8px 0', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}
                      title="Open Chat"
                    >
                      <MessageSquare size={16} color="#00d2ff" />
                      Chat
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVoiceCall(friend)}
                      className="btn-secondary"
                      style={{ padding: '8px 0', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}
                      title="Audio Call"
                    >
                      <Phone size={16} color="#10b981" />
                      Call
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVideoCall(friend)}
                      className="btn-secondary"
                      style={{ padding: '8px 0', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}
                      title="Video Call"
                    >
                      <Video size={16} color="#38bdf8" />
                      Video
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleStartChat(friend);
                      }}
                      className="btn-secondary"
                      style={{ padding: '8px 0', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}
                      title="Challenge Game"
                    >
                      <Gamepad2 size={16} color="#f59e0b" />
                      Game
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <AddFriendModal onClose={() => setIsAddModalOpen(false)} />
      )}

      {isRequestsModalOpen && (
        <FriendRequestsModal
          requests={incomingRequests}
          onClose={() => setIsRequestsModalOpen(false)}
        />
      )}

      {editingFriend && (
        <EditNicknameModal
          friend={editingFriend}
          onClose={() => setEditingFriend(null)}
          onUpdated={(nickname) => {
            setFriends((prev) =>
              prev.map((f) =>
                f.friendId === editingFriend.friendId ? { ...f, customNickname: nickname } : f
              )
            );
          }}
        />
      )}
    </div>
  );
}
