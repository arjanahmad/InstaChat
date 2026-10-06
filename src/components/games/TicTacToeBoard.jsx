import React from 'react';

export default function TicTacToeBoard({ room, isMyTurn, onCellClick }) {
  const board = room.boardState || Array(9).fill('');
  const winningLine = room.winningLine || [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 100px)',
        gridTemplateRows: 'repeat(3, 100px)',
        gap: '10px',
        margin: '0 auto',
      }}
    >
      {board.map((cell, index) => {
        const isWinCell = winningLine.includes(index);
        const canClick = isMyTurn && cell === '' && room.status === 'IN_PROGRESS';

        return (
          <button
            key={index}
            type="button"
            data-testid={`ttt-cell-${index}`}
            disabled={!canClick}
            onClick={() => onCellClick(index)}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: 'var(--radius-md)',
              background: isWinCell
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(5, 150, 105, 0.6))'
                : 'rgba(15, 28, 63, 0.8)',
              border: isWinCell
                ? '2px solid #10b981'
                : '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: cell === 'X' ? '#00d2ff' : '#f59e0b',
              cursor: canClick ? 'pointer' : 'default',
              boxShadow: isWinCell ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {cell}
          </button>
        );
      })}
    </div>
  );
}
