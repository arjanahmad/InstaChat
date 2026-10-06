import React, { useState, useRef } from 'react';
import {
  Camera,
  Copy,
  Check,
  Trophy,
  Flame,
  Coins,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../config/cloudinary';

export default function ProfileView() {
  const { currentUser, updateProfileData } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  if (!currentUser) return null;

  const copyUserId = () => {
    if (currentUser.userId) {
      navigator.clipboard.writeText(currentUser.userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const res = await uploadToCloudinary(file, 'image');
      await updateProfileData({ profileImageUrl: res.url });
    } catch (err) {
      alert('Avatar upload failed: ' + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const totalMatches = currentUser.gamesPlayed || (currentUser.wins || 0) + (currentUser.losses || 0) + (currentUser.draws || 0);
  const winRate = totalMatches > 0 ? Math.round(((currentUser.wins || 0) / totalMatches) * 100) : 0;

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
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Card Header */}
        <div
          className="glass-panel"
          style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Avatar with Upload button */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Avatar
              src={currentUser.profileImageUrl}
              name={currentUser.username}
              size={96}
              online={true}
            />
            <button
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="btn-icon"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--primary-blue)',
                color: '#ffffff',
                border: '2px solid var(--bg-surface)',
              }}
              title="Change profile avatar"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarSelected}
            />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
            {currentUser.username}
          </h2>
          <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            {currentUser.email}
          </span>

          {/* Copyable User ID */}
          <div
            onClick={copyUserId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-glass)',
              cursor: 'pointer',
              fontSize: '0.76rem',
              color: 'var(--text-dim)',
            }}
            title="Click to copy UID"
          >
            <span>UID: {currentUser.userId?.substring(0, 16)}...</span>
            {copiedId ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
          }}
        >
          <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
            <Trophy size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{currentUser.wins || 0}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Total Wins</div>
          </div>

          <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
            <Flame size={24} color="#ef4444" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{currentUser.currentStreak || 0}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Win Streak</div>
          </div>

          <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
            <Coins size={24} color="#00d2ff" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>🪙 {currentUser.coins || 100}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Coins Balance</div>
          </div>

          <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
            <ShieldCheck size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{winRate}%</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Win Rate</div>
          </div>
        </div>

        {/* Developer Credit & Portfolio Showcase */}
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.12) 0%, rgba(0, 210, 255, 0.08) 100%)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--soft-cyan)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ABOUT CREATOR
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '4px 0 2px' }}>
              Made by Arjan
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Full-Stack & Mobile Developer specializing in real-time WebRTC, distributed systems & high-performance applications.
            </p>
          </div>

          <a
            href="https://arjanahmad.website/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ flexShrink: 0, padding: '10px 18px' }}
          >
            Visit Portfolio <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
