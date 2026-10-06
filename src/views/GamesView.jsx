import React, { useState } from 'react';
import {
  Gamepad2,
  Trophy,
  Users,
  RotateCcw,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { GAME_TYPES, GAME_STATUS } from '../services/gameService';
import TicTacToeBoard from '../components/games/TicTacToeBoard';
import ConnectFourBoard from '../components/games/ConnectFourBoard';
import RockPaperScissorsBoard from '../components/games/RockPaperScissorsBoard';
import MemoryFlipBoard from '../components/games/MemoryFlipBoard';
import InviteFriendModal from '../components/games/InviteFriendModal';

export default function GamesView() {
  const { currentUser } = useAuth();
  const {
    activeRoom,
    leaveRoom,
    makeMove,
    rematch,
    selectedGameType,
    setSelectedGameType,
    isInviteModalOpen,
    setIsInviteModalOpen,
  } = useGame();

  const gamesCatalog = [
    {
      type: GAME_TYPES.TIC_TAC_TOE,
      title: 'Tic Tac Toe',
      icon: '❌⭕',
      description: 'Classic 3x3 strategy game. Align 3 marks vertically, horizontally, or diagonally.',
      color: '#0066ff',
    },
    {
      type: GAME_TYPES.CONNECT_FOUR,
      title: 'Connect Four',
      icon: '🔴🟡',
      description: 'Gravity-based 7x6 board. Drop discs and be the first to connect four in a row.',
      color: '#00d2ff',
    },
    {
      type: GAME_TYPES.ROCK_PAPER_SCISSORS,
      title: 'Rock Paper Scissors',
      icon: '✊✋✌️',
      description: 'Fast-paced psychological duel. Best of 3 rounds with simultaneous reveals.',
      color: '#f59e0b',
    },
    {
      type: GAME_TYPES.MEMORY_FLIP,
      title: 'Memory Flip',
      icon: '⚡💎',
      description: 'Test your concentration! Flip cards and match 8 pairs to score higher than your opponent.',
      color: '#a855f7',
    },
  ];

  // If in an active game room
  if (activeRoom) {
    const isMyTurn = activeRoom.currentTurnPlayerId === currentUser?.userId;
    const isP1 = currentUser?.userId === activeRoom.player1Id;
    const oppUsername = isP1 ? (activeRoom.player2Username || 'Opponent') : activeRoom.player1Username;
    const isFinished = activeRoom.status === GAME_STATUS.FINISHED;
    const isWinner = activeRoom.winnerId === currentUser?.userId;
    const isDraw = !!activeRoom.isDraw;
    const iVotedRematch = isP1 ? activeRoom.rematchPlayer1 : activeRoom.rematchPlayer2;
    const oppVotedRematch = isP1 ? activeRoom.rematchPlayer2 : activeRoom.rematchPlayer1;

    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: '24px',
          background: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Room Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={leaveRoom}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <ArrowLeft size={16} /> Leave Room
            </button>

            <span className="badge" style={{ background: 'rgba(0, 102, 255, 0.2)', color: '#38bdf8' }}>
              Room: {activeRoom.gameType.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Players Info & Status */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#00d2ff' }}>
                {currentUser?.username}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              {activeRoom.status === GAME_STATUS.WAITING ? (
                <span className="badge badge-offline">Waiting for Player 2...</span>
              ) : isFinished ? (
                <span
                  className="badge"
                  style={{
                    background: isWinner
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isDraw
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: isWinner ? '#10b981' : isDraw ? '#f59e0b' : '#ef4444',
                    fontSize: '0.85rem',
                    padding: '4px 10px',
                  }}
                >
                  {isWinner ? '🏆 VICTORY!' : isDraw ? '🤝 DRAW' : 'DEFEAT'}
                </span>
              ) : (
                <span
                  className="badge"
                  style={{
                    background: isMyTurn ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: isMyTurn ? '#00d2ff' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    padding: '4px 12px',
                  }}
                >
                  {isMyTurn ? 'Your Turn' : `Waiting for ${oppUsername}...`}
                </span>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Opponent</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#a855f7' }}>
                {oppUsername}
              </div>
            </div>
          </div>

          {/* Game Board Container */}
          <div
            className="glass-panel"
            style={{
              padding: '28px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '340px',
            }}
          >
            {activeRoom.status === GAME_STATUS.WAITING ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid #00d2ff', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px' }} />
                <h4>Waiting for {oppUsername} to join...</h4>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>They received an invitation notification.</p>
              </div>
            ) : (
              <>
                {activeRoom.gameType === GAME_TYPES.TIC_TAC_TOE && (
                  <TicTacToeBoard
                    room={activeRoom}
                    isMyTurn={isMyTurn}
                    onCellClick={(idx) => makeMove(idx)}
                  />
                )}

                {activeRoom.gameType === GAME_TYPES.CONNECT_FOUR && (
                  <ConnectFourBoard
                    room={activeRoom}
                    isMyTurn={isMyTurn}
                    onColumnClick={(col) => makeMove(col)}
                  />
                )}

                {activeRoom.gameType === GAME_TYPES.ROCK_PAPER_SCISSORS && (
                  <RockPaperScissorsBoard
                    room={activeRoom}
                    currentUserId={currentUser?.userId}
                    onChoiceSelected={(choice) => makeMove(choice)}
                  />
                )}

                {activeRoom.gameType === GAME_TYPES.MEMORY_FLIP && (
                  <MemoryFlipBoard
                    room={activeRoom}
                    isMyTurn={isMyTurn}
                    onCardClick={(idx) => makeMove(idx)}
                  />
                )}
              </>
            )}
          </div>

          {/* Finished Outcome Card */}
          {isFinished && (
            <div
              className="glass-panel-elevated"
              style={{
                padding: '20px',
                textAlign: 'center',
                animation: 'slideUp 0.3s ease',
              }}
            >
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: isWinner ? '#10b981' : isDraw ? '#f59e0b' : '#ffffff', margin: '0 0 6px' }}>
                {isWinner ? '🎉 You Won the Match!' : isDraw ? "🤝 It's a Draw!" : `${oppUsername} Won!`}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                {isWinner
                  ? '+25 Coins awarded to your account!'
                  : isDraw
                  ? '+5 Coins for a hard fought battle!'
                  : 'Better luck next time! Challenge again?'}
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={rematch}
                  disabled={iVotedRematch}
                  className="btn-primary"
                  style={{ padding: '10px 20px' }}
                >
                  <RotateCcw size={16} />
                  {iVotedRematch ? 'Rematch Requested...' : oppVotedRematch ? 'Accept Rematch!' : 'Request Rematch'}
                </button>
                <button
                  type="button"
                  onClick={leaveRoom}
                  className="btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Exit to Lobby
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Game Lobby
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
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gamepad2 size={28} color="#00d2ff" /> Multiplayer Arena
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Challenge friends to real-time synchronized multiplayer battles.
          </p>
        </div>

        {/* User Gaming Stats Ribbon */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '14px',
            marginBottom: '28px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL MATCHES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{currentUser?.gamesPlayed || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>WINS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{currentUser?.wins || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>LOSSES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{currentUser?.losses || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>COINS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>🪙 {currentUser?.coins || 100}</div>
          </div>
        </div>

        {/* Game Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {gamesCatalog.map((game) => (
            <div
              key={game.type}
              className="glass-panel"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'transform var(--transition-fast)',
              }}
            >
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{game.icon}</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
                  {game.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
                  {game.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedGameType(game.type);
                  setIsInviteModalOpen(true);
                }}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Users size={16} /> Challenge Friend
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Friend Modal */}
      {isInviteModalOpen && (
        <InviteFriendModal
          gameType={selectedGameType}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </div>
  );
}
