import React, { useState, useEffect } from 'react';
import { Phone, Video, ShieldCheck, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { subscribeToFriends } from '../services/friendService';

export default function CallsView() {
  const { currentUser } = useAuth();
  const { startCall } = useCall();
  const [friends, setFriends] = useState([]);
  const [micStatus, setMicStatus] = useState('checking');
  const [camStatus, setCamStatus] = useState('checking');

  useEffect(() => {
    if (!currentUser?.userId) return;
    const unsub = subscribeToFriends(currentUser.userId, setFriends);
    return unsub;
  }, [currentUser?.userId]);

  useEffect(() => {
    // Check device permissions
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const hasMic = devices.some((d) => d.kind === 'audioinput');
        const hasCam = devices.some((d) => d.kind === 'videoinput');
        setMicStatus(hasMic ? 'ready' : 'unavailable');
        setCamStatus(hasCam ? 'ready' : 'unavailable');
      }).catch(() => {
        setMicStatus('unknown');
        setCamStatus('unknown');
      });
    }
  }, []);

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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            WebRTC Calling Hub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            High-Definition real-time peer-to-peer audio and video communication powered by WebRTC & STUN/TURN relays.
          </p>
        </div>

        {/* Network & Hardware Status Banner */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '24px',
            border: '1px solid rgba(0, 210, 255, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                STUN + TURN Relays Configured
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Cross-network mobile data & Wi-Fi NAT traversal ready
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-online">
              <CheckCircle2 size={12} /> Mic: {micStatus}
            </span>
            <span className="badge badge-online">
              <CheckCircle2 size={12} /> Camera: {camStatus}
            </span>
          </div>
        </div>

        {/* Online Friends to Call */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '14px' }}>
          Call Friends
        </h3>

        {friends.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Users size={40} opacity={0.4} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Add friends to start making WebRTC voice and video calls!</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {friends.map((friend) => {
              const displayName = friend.customNickname || friend.friendUsername || 'Friend';
              const isOnline = !!friend.friendOnline;

              return (
                <div
                  key={friend.friendId}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar
                      src={friend.friendProfileImageUrl}
                      name={displayName}
                      size={46}
                      online={isOnline}
                    />
                    <div>
                      <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#ffffff' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: isOnline ? '#10b981' : 'var(--text-dim)' }}>
                        {isOnline ? 'Online now' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => startCall(friend, false)}
                      className="btn-icon"
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                      title="Audio Call"
                    >
                      <Phone size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startCall(friend, true)}
                      className="btn-icon"
                      style={{ background: 'rgba(0, 102, 255, 0.15)', color: '#00d2ff' }}
                      title="Video Call"
                    >
                      <Video size={17} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
