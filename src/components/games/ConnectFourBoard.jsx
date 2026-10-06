import React from 'react';

export default function ConnectFourBoard({ room, isMyTurn, onColumnClick }) {
  const cols = 7;
  const rows = 6;
  const board = room.boardState || Array(42).fill('');
  const winningLine = room.winningLine || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Column Hover Drop Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 44px)', gap: '6px', marginBottom: '8px' }}>
        {Array.from({ length: cols }).map((_, col) => (
          <button
            key={col}
            type="button"
            disabled={!isMyTurn || room.status !== 'IN_PROGRESS'}
            onClick={() => onColumnClick(col)}
            className="btn-secondary"
            style={{
              width: '44px',
              height: '32px',
              padding: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isMyTurn ? '#00d2ff' : 'var(--text-dim)',
            }}
          >
            ▼
          </button>
        ))}
      </div>

      {/* 7x6 Grid Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 44px)',
          gridTemplateRows: 'repeat(6, 44px)',
          gap: '6px',
          padding: '12px',
          background: 'rgba(10, 20, 50, 0.95)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid rgba(0, 102, 255, 0.4)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        {board.map((cell, index) => {
          const isWinCell = winningLine.includes(index);
          const isRed = cell === 'RED';
          const isYellow = cell === 'YELLOW';

          return (
            <div
              key={index}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isRed
                  ? 'radial-gradient(circle at 35% 35%, #ff4b4b 0%, #dc2626 100%)'
                  : isYellow
                  ? 'radial-gradient(circle at 35% 35%, #fde047 0%, #ca8a04 100%)'
                  : 'rgba(5, 10, 25, 0.8)',
                border: isWinCell
                  ? '3px solid #10b981'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isWinCell
                  ? '0 0 16px #10b981'
                  : isRed
                  ? '0 0 10px rgba(239, 68, 68, 0.5)'
                  : isYellow
                  ? '0 0 10px rgba(234, 179, 8, 0.5)'
                  : 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
                transition: 'all 0.2s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
