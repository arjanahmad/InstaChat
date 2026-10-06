import { describe, it, expect } from 'vitest';
import { GAME_TYPES } from '../services/gameService';

describe('Multiplayer Game Algorithms', () => {
  it('validates Tic Tac Toe winning combinations', () => {
    const winLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    const board = ['X', 'X', 'X', 'O', 'O', '', '', '', ''];
    let winner = null;

    for (const [a, b, c] of winLines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        winner = board[a];
        break;
      }
    }

    expect(winner).toBe('X');
  });

  it('validates Rock Paper Scissors rules', () => {
    const checkWinner = (p1, p2) => {
      if (p1 === p2) return 'DRAW';
      if (
        (p1 === 'ROCK' && p2 === 'SCISSORS') ||
        (p1 === 'PAPER' && p2 === 'ROCK') ||
        (p1 === 'SCISSORS' && p2 === 'PAPER')
      ) {
        return 'P1';
      }
      return 'P2';
    };

    expect(checkWinner('ROCK', 'SCISSORS')).toBe('P1');
    expect(checkWinner('PAPER', 'ROCK')).toBe('P1');
    expect(checkWinner('SCISSORS', 'PAPER')).toBe('P1');
    expect(checkWinner('ROCK', 'PAPER')).toBe('P2');
    expect(checkWinner('ROCK', 'ROCK')).toBe('DRAW');
  });

  it('verifies game catalog types', () => {
    expect(GAME_TYPES.TIC_TAC_TOE).toBe('TIC_TAC_TOE');
    expect(GAME_TYPES.CONNECT_FOUR).toBe('CONNECT_FOUR');
    expect(GAME_TYPES.ROCK_PAPER_SCISSORS).toBe('ROCK_PAPER_SCISSORS');
    expect(GAME_TYPES.MEMORY_FLIP).toBe('MEMORY_FLIP');
  });
});
