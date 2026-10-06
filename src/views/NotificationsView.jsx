import React, { useState, useEffect } from 'react';
import { Bell, Trash2, CheckCircle2, MessageSquare, Phone, Gamepad2, UserPlus } from 'lucide-react';
import { notificationService } from '../services/notificationService';

export default function NotificationsView({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = notificationService.subscribe(setNotifications);
    return unsub;
  }, []);

  const handleItemClick = (item) => {
    if (item.action) {
      item.action();
    } else if (item.type === 'game' && onNavigate) {
      onNavigate('games');
    } else if (item.type === 'call' && onNavigate) {
      onNavigate('calls');
    } else if (item.type === 'message' && onNavigate) {
      onNavigate('chats');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getIcon = (type) => {
    switch (type) {
      case 'game': return <Gamepad2 size={18} color="#f59e0b" />;
      case 'call': return <Phone size={18} color="#10b981" />;
      case 'message': return <MessageSquare size={18} color="#00d2ff" />;
      case 'friend': return <UserPlus size={18} color="#a855f7" />;
      default: return <Bell size={18} color="#38bdf8" />;
    }
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
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Notifications
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              Real-time activity, incoming calls, friend updates, and game challenges.
            </p>
          </div>

          {notifications.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => notificationService.markAllAsRead()}
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={() => notificationService.clearAll()}
                className="btn-icon"
                title="Clear all"
                style={{ width: 34, height: 34, color: '#ef4444' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Bell size={44} opacity={0.3} />
            <h4 style={{ color: '#ffffff', margin: 0 }}>No notifications right now</h4>
            <p style={{ fontSize: '0.85rem', maxWidth: '320px', margin: 0 }}>
              You're all caught up! New messages, call alerts, and game challenges will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className="glass-panel"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  borderLeft: n.read ? '1px solid var(--border-glass)' : '3px solid var(--soft-cyan)',
                  background: n.read ? 'var(--bg-glass)' : 'rgba(0, 102, 255, 0.12)',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getIcon(n.type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {formatTime(n.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {n.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
