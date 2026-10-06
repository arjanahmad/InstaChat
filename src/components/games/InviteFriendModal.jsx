import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Send } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { subscribeToFriends } from '../../services/friendService';

export default function InviteFriendModal({ gameType, onClose }) {
  const { currentUser } = useAuth();
  const { inviteFriendToGame } = useGame();
  const [friends, setFriends] = useState([]);
  const [invitingId, setInvitingId] = useState(null);

  useEffect(() => {
    if (!currentUser?.userId) return;
    const unsub = subscribeToFriends(currentUser.userId, setFriends);
    return unsub;
  }, [currentUser?.userId]);

  const handleInvite = async (friend) => {
    setInvitingId(friend.friendId);
    try {
      await inviteFriendToGame(friend, gameType);
      onClose();
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel-elevated modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '420px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gamepad2 size={20} color="#f59e0b" /> Invite Friend to Play
          </h3>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Pick a friend to send a live multiplayer game challenge:
        </p>

        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            No friends added yet. Add friends first to challenge them!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {friends.map((friend) => {
              const displayName = friend.customNickname || friend.friendUsername || 'Friend';
              const isInviting = invitingId === friend.friendId;

              return (
                <div
                  key={friend.friendId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-glass)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar
                      src={friend.friendProfileImageUrl}
                      name={displayName}
                      size={40}
                      online={!!friend.friendOnline}
                    />
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: friend.friendOnline ? '#10b981' : 'var(--text-dim)' }}>
                        {friend.friendOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="challenge-friend-btn"
                    disabled={isInviting}
                    onClick={() => handleInvite(friend)}
                    className="btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    }}
                  >
                    {isInviting ? 'Inviting...' : <><Send size={14} /> Challenge</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
