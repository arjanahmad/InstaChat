import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const GAME_TYPES = {
  TIC_TAC_TOE: 'TIC_TAC_TOE',
  CONNECT_FOUR: 'CONNECT_FOUR',
  ROCK_PAPER_SCISSORS: 'ROCK_PAPER_SCISSORS',
  MEMORY_FLIP: 'MEMORY_FLIP',
};

export const GAME_STATUS = {
  WAITING: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
};

/**
 * Creates a game invitation
 */
export async function sendGameInvitation(senderUser, receiverUser, gameType) {
  const invitationId = `invite_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Create Room Initial State
  const initialRoom = createInitialRoomState(roomId, gameType, senderUser, receiverUser);
  await setDoc(doc(db, 'game_rooms', roomId), initialRoom);

  // 2. Create Invitation doc
  const inviteData = {
    invitationId,
    gameType,
    senderId: senderUser.userId,
    senderUsername: senderUser.username,
    receiverId: receiverUser.userId,
    receiverUsername: receiverUser.username,
    status: 'PENDING',
    roomId,
    timestamp: Date.now(),
  };

  await setDoc(doc(db, 'game_invitations', invitationId), inviteData);
  return { invitation: inviteData, room: initialRoom };
}

/**
 * Creates initial room data matching Android schema
 */
function createInitialRoomState(roomId, gameType, player1, player2 = null) {
  let boardState = [];
  if (gameType === GAME_TYPES.TIC_TAC_TOE) {
    boardState = Array(9).fill('');
  } else if (gameType === GAME_TYPES.CONNECT_FOUR) {
    boardState = Array(42).fill(''); // 7 cols x 6 rows
  } else if (gameType === GAME_TYPES.MEMORY_FLIP) {
    // 16 cards (8 pairs shuffled deterministically)
    const icons = ['⚡', '💎', '🔥', '🚀', '⭐', '🎮', '👑', '🔮'];
    const deck = [...icons, ...icons].sort(() => Math.random() - 0.5);
    boardState = deck;
  }

  return {
    roomId,
    gameType,
    player1Id: player1.userId,
    player1Username: player1.username,
    player2Id: player2 ? player2.userId : null,
    player2Username: player2 ? player2.username : null,
    currentTurnPlayerId: player1.userId,
    status: player2 ? GAME_STATUS.IN_PROGRESS : GAME_STATUS.WAITING,
    boardState,

    // RPS specific
    p1Choice: null,
    p2Choice: null,
    p1Score: 0,
    p2Score: 0,
    currentRound: 1,
    maxRounds: 3,
    lastRoundResult: '',

    // Memory Flip specific
    revealedCards: [],
    matchedCards: [],
    p1Pairs: 0,
    p2Pairs: 0,

    // Outcome
    winnerId: null,
    winnerUsername: null,
    isDraw: false,
    winningLine: [],

    // Rematch
    rematchPlayer1: false,
    rematchPlayer2: false,

    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Accept game invitation
 */
export async function acceptGameInvitation(invitation, currentUser) {
  // Update invitation status
  await updateDoc(doc(db, 'game_invitations', invitation.invitationId), {
    status: 'ACCEPTED',
  });

  // Update room status
  const roomRef = doc(db, 'game_rooms', invitation.roomId);
  await updateDoc(roomRef, {
    player2Id: currentUser.userId,
    player2Username: currentUser.username,
    status: GAME_STATUS.IN_PROGRESS,
    updatedAt: Date.now(),
  });
}

/**
 * Decline game invitation
 */
export async function declineGameInvitation(invitationId, roomId) {
  await updateDoc(doc(db, 'game_invitations', invitationId), {
    status: 'DECLINED',
  });
  if (roomId) {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      status: GAME_STATUS.CANCELLED,
    });
  }
}

/**
 * Subscribe to incoming game invitations
 */
export function subscribeToGameInvitations(userId, callback) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'game_invitations'),
    where('receiverId', '==', userId),
    where('status', '==', 'PENDING')
  );

  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const list = snap.docs
      .map((d) => d.data())
      .filter((inv) => now - (inv.timestamp || 0) < 60000); // 60s expiration
    callback(list);
  });
}

/**
 * Subscribe to a game room
 */
export function subscribeToGameRoom(roomId, callback) {
  if (!roomId) return () => {};
  return onSnapshot(doc(db, 'game_rooms', roomId), (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback(null);
    }
  });
}

/**
 * Make a Tic Tac Toe move
 */
export async function makeTicTacToeMove(room, index, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;
  if (room.currentTurnPlayerId !== playerId) return;
  if (room.boardState[index] !== '') return;

  const symbol = playerId === room.player1Id ? 'X' : 'O';
  const newBoard = [...room.boardState];
  newBoard[index] = symbol;

  // Check win or draw
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],           // diags
  ];

  let winnerId = null;
  let winnerUsername = null;
  let winningLine = [];

  for (const line of winLines) {
    const [a, b, c] = line;
    if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
      winnerId = playerId;
      winnerUsername = playerId === room.player1Id ? room.player1Username : room.player2Username;
      winningLine = line;
      break;
    }
  }

  const isDraw = !winnerId && newBoard.every((cell) => cell !== '');
  const nextPlayer = playerId === room.player1Id ? room.player2Id : room.player1Id;

  const updates = {
    boardState: newBoard,
    currentTurnPlayerId: winnerId || isDraw ? '' : nextPlayer,
    status: winnerId || isDraw ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
    winnerId,
    winnerUsername,
    isDraw,
    winningLine,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, 'game_rooms', room.roomId), updates);

  if (winnerId || isDraw) {
    await updatePlayerStats(room, winnerId, isDraw, 'ticTacToeWins');
  }
}

/**
 * Make a Connect Four move (drops disc into column 0..6)
 */
export async function makeConnectFourMove(room, col, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;
  if (room.currentTurnPlayerId !== playerId) return;

  const cols = 7;
  const rows = 6;
  const newBoard = [...room.boardState];

  // Find lowest empty slot in chosen col (col is 0..6)
  let targetIndex = -1;
  for (let r = rows - 1; r >= 0; r--) {
    const idx = r * cols + col;
    if (newBoard[idx] === '') {
      targetIndex = idx;
      break;
    }
  }

  if (targetIndex === -1) return; // Column full

  const color = playerId === room.player1Id ? 'RED' : 'YELLOW';
  newBoard[targetIndex] = color;

  // Check 4-in-a-row
  const winResult = checkConnectFourWin(newBoard, cols, rows, targetIndex, color);

  let winnerId = null;
  let winnerUsername = null;
  let winningLine = [];

  if (winResult) {
    winnerId = playerId;
    winnerUsername = playerId === room.player1Id ? room.player1Username : room.player2Username;
    winningLine = winResult;
  }

  const isDraw = !winnerId && newBoard.every((c) => c !== '');
  const nextPlayer = playerId === room.player1Id ? room.player2Id : room.player1Id;

  const updates = {
    boardState: newBoard,
    currentTurnPlayerId: winnerId || isDraw ? '' : nextPlayer,
    status: winnerId || isDraw ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
    winnerId,
    winnerUsername,
    isDraw,
    winningLine,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, 'game_rooms', room.roomId), updates);

  if (winnerId || isDraw) {
    await updatePlayerStats(room, winnerId, isDraw, 'connectFourWins');
  }
}

function checkConnectFourWin(board, cols, rows, lastIdx, color) {
  const directions = [
    { dr: 0, dc: 1 },  // Horizontal
    { dr: 1, dc: 0 },  // Vertical
    { dr: 1, dc: 1 },  // Diagonal down-right
    { dr: 1, dc: -1 }, // Diagonal down-left
  ];

  const r0 = Math.floor(lastIdx / cols);
  const c0 = lastIdx % cols;

  for (const { dr, dc } of directions) {
    const line = [lastIdx];

    // Positive direction
    for (let step = 1; step < 4; step++) {
      const r = r0 + dr * step;
      const c = c0 + dc * step;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const idx = r * cols + c;
        if (board[idx] === color) line.push(idx);
        else break;
      } else break;
    }

    // Negative direction
    for (let step = 1; step < 4; step++) {
      const r = r0 - dr * step;
      const c = c0 - dc * step;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const idx = r * cols + c;
        if (board[idx] === color) line.push(idx);
        else break;
      } else break;
    }

    if (line.length >= 4) {
      return line.slice(0, 4);
    }
  }
  return null;
}

/**
 * Make Rock Paper Scissors choice
 */
export async function makeRpsChoice(room, choice, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;

  const isP1 = playerId === room.player1Id;
  const p1Choice = isP1 ? choice : room.p1Choice;
  const p2Choice = !isP1 ? choice : room.p2Choice;

  // If both players have made their choice for this round
  if (p1Choice && p2Choice) {
    let p1Score = room.p1Score || 0;
    let p2Score = room.p2Score || 0;
    let roundResult = '';

    if (p1Choice === p2Choice) {
      roundResult = `Draw! Both chose ${p1Choice}`;
    } else if (
      (p1Choice === 'ROCK' && p2Choice === 'SCISSORS') ||
      (p1Choice === 'PAPER' && p2Choice === 'ROCK') ||
      (p1Choice === 'SCISSORS' && p2Choice === 'PAPER')
    ) {
      p1Score += 1;
      roundResult = `${room.player1Username} won the round with ${p1Choice}!`;
    } else {
      p2Score += 1;
      roundResult = `${room.player2Username} won the round with ${p2Choice}!`;
    }

    const nextRound = (room.currentRound || 1) + 1;
    let winnerId = null;
    let winnerUsername = null;
    let isFinished = false;

    // Best of 3 (or first to 2)
    if (p1Score >= 2) {
      winnerId = room.player1Id;
      winnerUsername = room.player1Username;
      isFinished = true;
    } else if (p2Score >= 2) {
      winnerId = room.player2Id;
      winnerUsername = room.player2Username;
      isFinished = true;
    } else if (nextRound > (room.maxRounds || 3)) {
      isFinished = true;
      if (p1Score > p2Score) {
        winnerId = room.player1Id;
        winnerUsername = room.player1Username;
      } else if (p2Score > p1Score) {
        winnerId = room.player2Id;
        winnerUsername = room.player2Username;
      }
    }

    const updates = {
      p1Choice: isFinished ? p1Choice : null,
      p2Choice: isFinished ? p2Choice : null,
      p1Score,
      p2Score,
      currentRound: nextRound,
      lastRoundResult: roundResult,
      status: isFinished ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
      winnerId,
      winnerUsername,
      isDraw: isFinished && !winnerId,
      updatedAt: Date.now(),
    };

    await updateDoc(doc(db, 'game_rooms', room.roomId), updates);

    if (isFinished) {
      await updatePlayerStats(room, winnerId, !winnerId, 'rpsWins');
    }
  } else {
    // Only one player picked so far
    await updateDoc(doc(db, 'game_rooms', room.roomId), {
      [isP1 ? 'p1Choice' : 'p2Choice']: choice,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Make a Memory Flip card flip
 */
export async function makeMemoryFlipMove(room, cardIndex, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;
  if (room.currentTurnPlayerId !== playerId) return;

  const revealed = room.revealedCards || [];
  const matched = room.matchedCards || [];

  if (matched.includes(cardIndex) || revealed.includes(cardIndex)) return;

  if (revealed.length === 0) {
    // First card flipped
    await updateDoc(doc(db, 'game_rooms', room.roomId), {
      revealedCards: [cardIndex],
      updatedAt: Date.now(),
    });
  } else if (revealed.length === 1) {
    // Second card flipped
    const firstIdx = revealed[0];
    const firstCard = room.boardState[firstIdx];
    const secondCard = room.boardState[cardIndex];

    const isMatch = firstCard === secondCard;
    const isP1 = playerId === room.player1Id;

    let p1Pairs = room.p1Pairs || 0;
    let p2Pairs = room.p2Pairs || 0;
    const newMatched = [...matched];

    if (isMatch) {
      newMatched.push(firstIdx, cardIndex);
      if (isP1) p1Pairs++;
      else p2Pairs++;
    }

    const allMatched = newMatched.length === (room.boardState?.length || 16);
    let winnerId = null;
    let winnerUsername = null;
    let isDraw = false;

    if (allMatched) {
      if (p1Pairs > p2Pairs) {
        winnerId = room.player1Id;
        winnerUsername = room.player1Username;
      } else if (p2Pairs > p1Pairs) {
        winnerId = room.player2Id;
        winnerUsername = room.player2Username;
      } else {
        isDraw = true;
      }
    }

    const nextTurn = isMatch ? playerId : (isP1 ? room.player2Id : room.player1Id);

    // Update with both cards revealed
    await updateDoc(doc(db, 'game_rooms', room.roomId), {
      revealedCards: [firstIdx, cardIndex],
      matchedCards: newMatched,
      p1Pairs,
      p2Pairs,
      updatedAt: Date.now(),
    });

    // Reset revealed after 1 second if not match, or immediately clear if match
    setTimeout(async () => {
      await updateDoc(doc(db, 'game_rooms', room.roomId), {
        revealedCards: [],
        currentTurnPlayerId: allMatched ? '' : nextTurn,
        status: allMatched ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
        winnerId,
        winnerUsername,
        isDraw,
        updatedAt: Date.now(),
      });

      if (allMatched) {
        await updatePlayerStats(room, winnerId, isDraw, 'wins');
      }
    }, isMatch ? 400 : 1200);
  }
}

/**
 * Handle Rematch request
 */
export async function requestRematch(room, playerId) {
  const isP1 = playerId === room.player1Id;
  const updates = {
    [isP1 ? 'rematchPlayer1' : 'rematchPlayer2']: true,
  };

  const otherWantsRematch = isP1 ? room.rematchPlayer2 : room.rematchPlayer1;
  if (otherWantsRematch) {
    // Both agreed! Reset room state
    const p1 = { userId: room.player1Id, username: room.player1Username };
    const p2 = { userId: room.player2Id, username: room.player2Username };
    const resetState = createInitialRoomState(room.roomId, room.gameType, p1, p2);
    await setDoc(doc(db, 'game_rooms', room.roomId), resetState);
    return;
  }

  await updateDoc(doc(db, 'game_rooms', room.roomId), updates);
}

/**
 * Updates win/loss/coin stats for players in users/{userId}
 */
async function updatePlayerStats(room, winnerId, isDraw, specificWinKey) {
  try {
    const p1Ref = doc(db, 'users', room.player1Id);
    const p2Ref = room.player2Id ? doc(db, 'users', room.player2Id) : null;

    if (isDraw) {
      await updateDoc(p1Ref, { draws: increment(1), gamesPlayed: increment(1), coins: increment(5) });
      if (p2Ref) await updateDoc(p2Ref, { draws: increment(1), gamesPlayed: increment(1), coins: increment(5) });
    } else if (winnerId) {
      const loserRef = winnerId === room.player1Id ? p2Ref : p1Ref;
      const winnerRef = winnerId === room.player1Id ? p1Ref : p2Ref;

      if (winnerRef) {
        await updateDoc(winnerRef, {
          wins: increment(1),
          gamesPlayed: increment(1),
          coins: increment(25),
          currentStreak: increment(1),
          [specificWinKey]: increment(1),
        });
      }
      if (loserRef) {
        await updateDoc(loserRef, {
          losses: increment(1),
          gamesPlayed: increment(1),
          currentStreak: 0,
        });
      }
    }
  } catch (err) {
    console.debug('Error updating player stats:', err);
  }
}
