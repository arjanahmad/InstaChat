import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Phone,
  Gamepad2,
  Trophy,
  Flame,
  ArrowRight,
  Shield,
  Zap,
  Sparkles,
} from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useGame } from '../context/GameContext';
import { subscribeToFriends } from '../services/friendService';

export default function HomeView({ onNavigate }) {
  const { currentUser } = useAuth();
  const { conversations, openChatWithFriend } = useChat();
  const { setSelectedGameType, setIsInviteModalOpen } = useGame();
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    if (!currentUser?.userId) return;
    const unsub = subscribeToFriends(currentUser.userId, setFriends);
    return unsub;
  }, [currentUser?.userId]);

  const onlineFriends = friends.filter((f) => !!f.friendOnline);

  const handleStartChatWithFriend = (friend) => {
    openChatWithFriend(friend);
    onNavigate('chats');
  };

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
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Welcome Hero Banner */}
        <div
          className="glass-panel"
          style={{
            padding: '28px 32px',
            background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.22) 0%, rgba(0, 210, 255, 0.12) 100%)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(0, 210, 255, 0.2)', color: 'var(--soft-cyan)', fontSize: '0.74rem', fontWeight: 700, marginBottom: '10px' }}>
              <Sparkles size={13} /> MODERN REAL-TIME PLATFORM
            </div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0', lineHeight: 1.15 }}>
              Welcome back, {currentUser?.username}!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, maxWidth: '480px' }}>
              Connect privately with friends, share media, voice call, video call, and jump into multiplayer challenges.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onNavigate('chats')}
              className="btn-primary"
            >
              <MessageSquare size={16} /> Open Chats
            </button>
            <button
              type="button"
              onClick={() => onNavigate('games')}
              className="btn-secondary"
            >
              <Gamepad2 size={16} color="#f59e0b" /> Play Games
            </button>
          </div>
        </div>

        {/* Online Friends Rail */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              Online Friends ({onlineFriends.length})
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('friends')}
              style={{ background: 'none', color: 'var(--soft-cyan)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>

          {onlineFriends.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: '0.88rem',
              }}
            >
              No friends online right now. Invite your friends to join INSTAChat!
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '6px' }}>
              {onlineFriends.map((friend) => (
                <div
                  key={friend.friendId}
                  onClick={() => handleStartChatWithFriend(friend)}
                  className="glass-panel"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    minWidth: '100px',
                    transition: 'transform var(--transition-fast)',
                  }}
                >
                  <Avatar
                    src={friend.friendProfileImageUrl}
                    name={friend.customNickname || friend.friendUsername}
                    size={48}
                    online={true}
                  />
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      maxWidth: '90px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {friend.customNickname || friend.friendUsername}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & Games Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Quick Stats Card */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} color="#f59e0b" /> Your Stats
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>GAMES WON</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{currentUser?.wins || 0}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>COIN BALANCE</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>🪙 {currentUser?.coins || 100}</div>
              </div>
            </div>
          </div>

          {/* Quick Start Call Card */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={18} color="#00d2ff" /> HD Calling
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '14px' }}>
              Crystal clear WebRTC voice and video calls with multi-STUN and TURN relays for cross-network connectivity.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('calls')}
              className="btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              Go to Calling Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
