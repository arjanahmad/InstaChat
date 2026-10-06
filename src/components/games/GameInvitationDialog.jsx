import React from 'react';
import { Gamepad2, Check, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';

export default function GameInvitationDialog() {
  const { pendingInvitations, acceptInvite, declineInvite } = useGame();

  if (!pendingInvitations || pendingInvitations.length === 0) return null;
  const invite = pendingInvitations[0];

  const getGameName = (type) => {
    switch (type) {
      case 'TIC_TAC_TOE': return 'Tic Tac Toe';
      case 'CONNECT_FOUR': return 'Connect Four';
      case 'ROCK_PAPER_SCISSORS': return 'Rock Paper Scissors';
      case 'MEMORY_FLIP': return 'Memory Flip';
      default: return 'Game Match';
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 2600, background: 'rgba(5, 8, 20, 0.85)' }}
    >
      <div
        className="glass-panel-elevated modal-content"
        style={{
          padding: '30px 24px',
          maxWidth: '380px',
          textAlign: 'center',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 25px rgba(245, 158, 11, 0.3)',
          }}
        >
          <Gamepad2 size={32} color="#f59e0b" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
          Game Challenge!
        </h3>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          <strong style={{ color: '#ffffff' }}>{invite.senderUsername}</strong> has invited you to play{' '}
          <strong style={{ color: 'var(--soft-cyan)' }}>{getGameName(invite.gameType)}</strong>!
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => declineInvite(invite)}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px' }}
          >
            <X size={16} /> Decline
          </button>

          <button
            type="button"
            data-testid="accept-game-btn"
            onClick={() => acceptInvite(invite)}
            className="btn-primary"
            style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Check size={16} /> Accept & Play
          </button>
        </div>
      </div>
    </div>
  );
}
