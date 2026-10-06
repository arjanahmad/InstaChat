import React from 'react';
import {
  Home,
  MessageSquare,
  Users,
  PhoneCall,
  Gamepad2,
  Bell,
  User,
  Settings,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import Logo from './Logo';
import Avatar from './Avatar';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ activeTab, onTabChange, unreadCount = 0, incomingCallsCount = 0 }) {
  const { currentUser, logout } = useAuth();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chats', label: 'Chats', icon: MessageSquare, badge: unreadCount },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'calls', label: 'Calls', icon: PhoneCall, badge: incomingCallsCount },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className="desktop-only glass-panel"
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        padding: '20px 16px',
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '4px 8px 24px', borderBottom: '1px solid var(--border-glass)' }}>
        <Logo size="medium" showTagline={true} />
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '16px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'rgba(0, 102, 255, 0.2)' : 'transparent',
                color: isActive ? 'var(--soft-cyan)' : 'var(--text-muted)',
                border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.94rem',
                textAlign: 'left',
                width: '100%',
                position: 'relative',
              }}
            >
              <Icon size={20} color={isActive ? '#00d2ff' : 'currentColor'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span className="badge-count">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Portfolio & Developer Credit */}
      <div
        style={{
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 102, 255, 0.08)',
          border: '1px solid rgba(0, 102, 255, 0.2)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', fontWeight: 700 }}>
            DEVELOPER
          </span>
          <a
            href="https://arjanahmad.website/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00d2ff', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', textDecoration: 'none' }}
          >
            Portfolio <ExternalLink size={12} />
          </a>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#f8fafc', fontWeight: 600 }}>
          Arjan
        </div>
      </div>

      {/* User Session Footer */}
      {currentUser && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div
            onClick={() => onTabChange('profile')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden' }}
          >
            <Avatar src={currentUser.profileImageUrl} name={currentUser.username} size={36} online={true} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser.username}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="presence-dot online" style={{ width: 6, height: 6 }} />
                Online
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-icon"
            title="Log out"
            style={{ width: 34, height: 34 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}
