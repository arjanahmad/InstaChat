import React from 'react';
import { Bell, Settings, PhoneCall } from 'lucide-react';
import Logo from './Logo';
import Avatar from './Avatar';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

export default function Header({ activeTab, onTabChange, unreadNotificationsCount = 0 }) {
  const { currentUser } = useAuth();
  const { activeCall } = useCall();

  const getPageTitle = () => {
    switch (activeTab) {
      case 'home': return 'Home';
      case 'chats': return 'Messages';
      case 'friends': return 'Friends';
      case 'calls': return 'Calls';
      case 'games': return 'Multiplayer Games';
      case 'notifications': return 'Notifications';
      case 'profile': return 'My Profile';
      case 'settings': return 'Settings';
      default: return 'INSTAChat';
    }
  };

  return (
    <header
      className="glass-panel"
      style={{
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        zIndex: 40,
        position: 'relative',
      }}
    >
      {/* Left: Mobile Logo or Desktop Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="mobile-only">
          <Logo size="small" />
        </div>
        <div className="desktop-only">
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Center: Active Call Ongoing Banner if in a call */}
      {activeCall && (
        <button
          onClick={() => onTabChange('calls')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            fontSize: '0.85rem',
            fontWeight: 600,
            animation: 'pulseGlow 2s infinite',
          }}
        >
          <PhoneCall size={16} />
          <span>Active {activeCall.type} Call with {activeCall.friendUsername}</span>
        </button>
      )}

      {/* Right: Quick actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => onTabChange('notifications')}
          className="btn-icon"
          title="Notifications"
          style={{ position: 'relative' }}
        >
          <Bell size={18} />
          {unreadNotificationsCount > 0 && (
            <span
              className="badge-count"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                minWidth: 8,
                padding: 0,
              }}
            />
          )}
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className="btn-icon"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        {currentUser && (
          <div
            onClick={() => onTabChange('profile')}
            style={{ cursor: 'pointer', marginLeft: '4px' }}
            title="View Profile"
          >
            <Avatar src={currentUser.profileImageUrl} name={currentUser.username} size={36} online={true} />
          </div>
        )}
      </div>
    </header>
  );
}
