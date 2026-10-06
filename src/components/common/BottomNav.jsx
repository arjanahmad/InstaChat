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
} from 'lucide-react';

export default function BottomNav({ activeTab, onTabChange, unreadCount = 0 }) {
  const primaryTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chats', label: 'Chats', icon: MessageSquare, badge: unreadCount },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'calls', label: 'Calls', icon: PhoneCall },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      className="mobile-only glass-panel"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderRadius: 0,
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        zIndex: 100,
        padding: '0 8px',
        background: 'rgba(7, 12, 28, 0.94)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {primaryTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: 1,
              height: '100%',
              background: 'transparent',
              color: isActive ? 'var(--soft-cyan)' : 'var(--text-muted)',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} color={isActive ? '#00d2ff' : 'currentColor'} />
              {item.badge > 0 && (
                <span
                  className="badge-count"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    fontSize: '0.65rem',
                    minWidth: 16,
                    height: 16,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: isActive ? 600 : 500 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
