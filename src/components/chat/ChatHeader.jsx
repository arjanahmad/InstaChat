import React from 'react';
import { Phone, Video, Gamepad2, ArrowLeft, MoreVertical } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useCall } from '../../context/CallContext';
import { useGame } from '../../context/GameContext';

export default function ChatHeader({ friend, typingUser, onBack }) {
  const { startCall } = useCall();
  const { setIsInviteModalOpen, setSelectedGameType } = useGame();

  if (!friend) return null;

  const displayName = friend.customNickname || friend.friendUsername || friend.username || 'Friend';
  const isOnline = !!friend.friendOnline;

  const handleAudioCall = () => {
    startCall(friend, false);
  };

  const handleVideoCall = () => {
    startCall(friend, true);
  };

  const handleChallengeGame = () => {
    setIsInviteModalOpen(true);
  };

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        zIndex: 10,
        background: 'rgba(11, 19, 43, 0.85)',
      }}
    >
      {/* Left: Back button (mobile) + Friend Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="btn-icon mobile-only"
            style={{ width: 34, height: 34 }}
            title="Back to chats"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <Avatar
          src={friend.friendProfileImageUrl || friend.profileImageUrl}
          name={displayName}
          size={42}
          online={isOnline}
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
            {displayName}
          </span>
          <span style={{ fontSize: '0.74rem', color: typingUser ? 'var(--soft-cyan)' : isOnline ? '#10b981' : 'var(--text-dim)', fontWeight: typingUser ? 600 : 400 }}>
            {typingUser ? `${typingUser} is typing...` : isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Right: Audio Call, Video Call, Game Challenge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleAudioCall}
          className="btn-icon"
          title="Start Audio Call"
        >
          <Phone size={18} />
        </button>

        <button
          type="button"
          onClick={handleVideoCall}
          className="btn-icon"
          title="Start Video Call"
        >
          <Video size={18} />
        </button>

        <button
          type="button"
          onClick={handleChallengeGame}
          className="btn-icon"
          title="Challenge to Game"
          style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)' }}
        >
          <Gamepad2 size={18} />
        </button>
      </div>
    </div>
  );
}
