import React, { useState } from 'react';
import { Search, MessageSquare, Plus } from 'lucide-react';
import Avatar from '../common/Avatar';

export default function ChatList({
  friends = [],
  conversations = [],
  activeFriend,
  onSelectFriend,
  onAddFriendClick,
}) {
  const [search, setSearch] = useState('');

  const filteredFriends = friends.filter((f) => {
    const name = (f.customNickname || f.friendUsername || f.username || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        borderRight: '1px solid var(--border-glass)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Header & Search */}
      <div style={{ padding: '16px 14px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Conversations
          </h2>
          <button
            type="button"
            onClick={onAddFriendClick}
            className="btn-icon"
            style={{ width: 34, height: 34 }}
            title="Add new friend"
          >
            <Plus size={18} />
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ padding: '9px 12px 9px 36px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Friends / Conversations Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filteredFriends.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <MessageSquare size={32} opacity={0.3} />
            <span style={{ fontSize: '0.88rem' }}>No conversations found</span>
            <button
              type="button"
              onClick={onAddFriendClick}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              Find Friends
            </button>
          </div>
        ) : (
          filteredFriends.map((friend) => {
            const isSelected = activeFriend?.friendId === friend.friendId;
            const displayName = friend.customNickname || friend.friendUsername || friend.username || 'Friend';
            
            // Match with conversation if exists
            const convo = conversations.find((c) =>
              c.participants?.includes(friend.friendId)
            );

            return (
              <div
                key={friend.friendId}
                onClick={() => onSelectFriend(friend)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? 'rgba(0, 102, 255, 0.22)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-active)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                  marginBottom: '4px',
                }}
              >
                <Avatar
                  src={friend.friendProfileImageUrl}
                  name={displayName}
                  size={46}
                  online={!!friend.friendOnline}
                />

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: isSelected ? 700 : 600,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayName}
                    </span>
                    {convo?.lastMessageTimestamp && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                        {formatTimestamp(convo.lastMessageTimestamp)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {convo?.lastMessage || (friend.friendOnline ? 'Online now' : 'Tap to chat')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
