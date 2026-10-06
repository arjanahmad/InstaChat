import React from 'react';

export default function MemoryFlipBoard({ room, isMyTurn, onCardClick }) {
  const deck = room.boardState || [];
  const revealed = room.revealedCards || [];
  const matched = room.matchedCards || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      {/* Pairs Score */}
      <div style={{ display: 'flex', gap: '24px', fontSize: '0.9rem', color: '#ffffff' }}>
        <span>
          {room.player1Username}: <strong style={{ color: '#00d2ff' }}>{room.p1Pairs || 0}</strong> pairs
        </span>
        <span>
          {room.player2Username || 'P2'}: <strong style={{ color: '#a855f7' }}>{room.p2Pairs || 0}</strong> pairs
        </span>
      </div>

      {/* 4x4 Grid of Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 70px)',
          gridTemplateRows: 'repeat(4, 70px)',
          gap: '10px',
        }}
      >
        {deck.map((symbol, index) => {
          const isRevealed = revealed.includes(index);
          const isMatched = matched.includes(index);
          const canClick = isMyTurn && !isRevealed && !isMatched && room.status === 'IN_PROGRESS';

          return (
            <button
              key={index}
              type="button"
              disabled={!canClick}
              onClick={() => onCardClick(index)}
              style={{
                width: '70px',
                height: '70px',
                borderRadius: 'var(--radius-md)',
                background: isMatched
                  ? 'rgba(16, 185, 129, 0.25)'
                  : isRevealed
                  ? 'linear-gradient(135deg, #0066ff, #00d2ff)'
                  : 'rgba(15, 28, 63, 0.85)',
                border: isMatched
                  ? '2px solid #10b981'
                  : isRevealed
                  ? '2px solid #00d2ff'
                  : '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                cursor: canClick ? 'pointer' : 'default',
                boxShadow: isRevealed || isMatched ? '0 0 16px rgba(0, 210, 255, 0.4)' : 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
                transform: isRevealed ? 'rotateY(180deg)' : 'none',
              }}
            >
              {isRevealed || isMatched ? symbol : '❓'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
