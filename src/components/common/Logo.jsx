import React from 'react';

export default function Logo({ size = 'medium', showTagline = false }) {
  const iconSize = size === 'small' ? 28 : size === 'large' ? 52 : 38;
  const textSize = size === 'small' ? '1.1rem' : size === 'large' ? '1.85rem' : '1.4rem';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      <img
        src="/logo.svg"
        alt="INSTAChat"
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(0, 102, 255, 0.45)',
          display: 'block',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          className="brand-font"
          style={{
            fontSize: textSize,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ffffff 0%, #38bdf8 50%, #0066ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
          }}
        >
          INSTAChat
        </span>
        {showTagline && (
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>
            Made by <strong style={{ color: '#00d2ff' }}>Arjan</strong>
          </span>
        )}
      </div>
    </div>
  );
}
