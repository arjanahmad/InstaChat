import React from 'react';

export default function Avatar({ src, name = 'User', size = 44, online = false, showStatus = true }) {
  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Consistent background color based on name
  const colors = [
    'linear-gradient(135deg, #0066ff, #00d2ff)',
    'linear-gradient(135deg, #6366f1, #a855f7)',
    'linear-gradient(135deg, #0284c7, #38bdf8)',
    'linear-gradient(135deg, #059669, #10b981)',
    'linear-gradient(135deg, #d97706, #f59e0b)',
  ];
  const charCode = (name || '').charCodeAt(0) || 0;
  const bg = colors[charCode % colors.length];

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid rgba(255, 255, 255, 0.1)',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: size * 0.4,
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <span
          className={`presence-dot ${online ? 'online' : 'offline'}`}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(10, size * 0.26),
            height: Math.max(10, size * 0.26),
            borderWidth: 2,
          }}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
