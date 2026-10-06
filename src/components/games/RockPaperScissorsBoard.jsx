import React from 'react';

export default function RockPaperScissorsBoard({ room, currentUserId, onChoiceSelected }) {
  const isP1 = currentUserId === room.player1Id;
  const myChoice = isP1 ? room.p1Choice : room.p2Choice;
  const oppChoice = isP1 ? room.p2Choice : room.p1Choice;

  const choices = [
    { id: 'ROCK', label: 'Rock', icon: '✊' },
    { id: 'PAPER', label: 'Paper', icon: '✋' },
    { id: 'SCISSORS', label: 'Scissors', icon: '✌️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '440px', margin: '0 auto' }}>
      {/* Scoreboard */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '16px 20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{room.player1Username}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00d2ff' }}>{room.p1Score || 0}</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            ROUND {room.currentRound || 1} / {room.maxRounds || 3}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>VS</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{room.player2Username || 'Opponent'}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7' }}>{room.p2Score || 0}</div>
        </div>
      </div>

      {/* Last Round Result Banner */}
      {room.lastRoundResult && (
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 210, 255, 0.15)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {room.lastRoundResult}
        </div>
      )}

      {/* Status Prompt */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        {myChoice && !oppChoice && 'Waiting for opponent to choose...'}
        {!myChoice && oppChoice && 'Opponent has made their move! Choose yours!'}
        {!myChoice && !oppChoice && 'Select your weapon for this round:'}
      </div>

      {/* Choice Buttons */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
        {choices.map((c) => {
          const isSelected = myChoice === c.id;
          const isDisabled = !!myChoice || room.status !== 'IN_PROGRESS';

          return (
            <button
              key={c.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onChoiceSelected(c.id)}
              style={{
                width: '100px',
                height: '110px',
                borderRadius: 'var(--radius-lg)',
                background: isSelected
                  ? 'linear-gradient(135deg, #0066ff, #00d2ff)'
                  : 'rgba(15, 28, 63, 0.85)',
                border: isSelected ? '2px solid #ffffff' : '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isDisabled ? 'default' : 'pointer',
                boxShadow: isSelected ? '0 0 25px rgba(0, 210, 255, 0.5)' : 'var(--shadow-sm)',
                transform: isSelected ? 'scale(1.05)' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: '2.5rem' }}>{c.icon}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
