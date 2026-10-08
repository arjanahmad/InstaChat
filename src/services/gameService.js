import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

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
 * Creates a game invitation and initializes the game room
 */
export async function sendGameInvitation(senderUser, receiverUser, gameType) {
  const invitationId = `invite_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const inviteData = {
    invitationId,
    inviteId: invitationId,
    roomId,
    gameType,
    senderUser,
    senderId: senderUser.userId,
    senderUsername: senderUser.username,
    receiverUser,
    receiverId: receiverUser.userId,
    targetUserId: receiverUser.userId,
    status: 'PENDING',
    timestamp: Date.now(),
  };

  const initialRoom = {
    roomId,
    gameType,
    player1Id: senderUser.userId,
    player1Username: senderUser.username,
    player2Id: receiverUser.userId,
    player2Username: receiverUser.username,
    currentTurnPlayerId: senderUser.userId,
    boardState: Array(9).fill(''),
    status: GAME_STATUS.IN_PROGRESS,
  };

  try {
    await api.post('/api/games/rooms/create', initialRoom);
  } catch (_) {}

  try {
    await api.post('/api/games/invitations/send', inviteData);
  } catch (_) {}

  realtimeSocket.emit('game:invite', inviteData);

  return {
    invitation: inviteData,
    room: initialRoom,
  };
}

/**
 * Accept game invitation
 */
export async function acceptGameInvitation(invitation, currentUser) {
  const senderId = invitation.senderId || invitation.senderUser?.userId;
  const payload = {
    invitationId: invitation.invitationId || invitation.inviteId,
    inviteId: invitation.invitationId || invitation.inviteId,
    roomId: invitation.roomId,
    user: currentUser,
    targetUserId: senderId,
    senderId,
    receiverId: currentUser.userId,
  };

  try {
    await api.post('/api/games/invitations/respond', {
      inviteId: payload.inviteId,
      status: 'ACCEPTED',
      roomId: payload.roomId,
      senderId: payload.senderId,
      receiverId: payload.receiverId,
      responseData: { user: currentUser },
    });
  } catch (_) {}

  realtimeSocket.emit('game:accept', payload);
}

/**
 * Decline game invitation
 */
export async function declineGameInvitation(invitationId, roomId) {
  realtimeSocket.emit('game:decline', { invitationId, roomId });
}

/**
 * Subscribe to incoming game invitations
 */
export function subscribeToGameInvitations(userId, callback) {
  if (!userId) return () => {};

  let invitations = [];

  const fetchInitial = async () => {
    try {
      const res = await api.get(`/api/games/invitations/${userId}`);
      if (res.invitations) {
        invitations = res.invitations;
        callback(invitations);
      }
    } catch (_) {}
  };

  fetchInitial();

  const handleInv = (inv) => {
    const rId = inv.receiverId || inv.receiverUser?.userId;
    if (rId === userId) {
      const normalized = {
        ...inv,
        invitationId: inv.invitationId || inv.inviteId,
        inviteId: inv.invitationId || inv.inviteId,
        senderUsername: inv.senderUsername || inv.senderUser?.username,
      };
      invitations = [normalized, ...invitations.filter((i) => (i.invitationId || i.inviteId) !== normalized.invitationId)];
      callback(invitations);
    }
  };

  const unsub1 = realtimeSocket.on('game:invitation-received', handleInv);
  const unsub2 = realtimeSocket.on('game:invite-received', handleInv);
  const unsub3 = realtimeSocket.on('game:invite', handleInv);

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}

/**
 * Subscribe to a game room updates in real time
 */
export function subscribeToGameRoom(roomId, callback) {
  if (!roomId) return () => {};

  const fetchInitial = async () => {
    try {
      const res = await api.get(`/api/games/rooms/${roomId}`);
      if (res.room) callback(res.room);
    } catch (_) {}
  };

  fetchInitial();
  const pollTimer = setInterval(fetchInitial, 1500);

  const unsub = realtimeSocket.on('game:room-updated', (room) => {
    if (room.roomId === roomId) {
      callback(room);
    }
  });

  return () => {
    clearInterval(pollTimer);
    unsub();
  };
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

  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
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
  };

  try {
    await api.post(`/api/games/rooms/${room.roomId}/move`, { updateData: updates });
  } catch (_) {}

  realtimeSocket.emit('game:move', {
    roomId: room.roomId,
    updateData: updates,
    targetUserId: nextPlayer,
  });
}

/**
 * Make a Connect Four move
 */
export async function makeConnectFourMove(room, col, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;
  if (room.currentTurnPlayerId !== playerId) return;

  const cols = 7;
  const rows = 6;
  const newBoard = [...room.boardState];

  let targetIndex = -1;
  for (let r = rows - 1; r >= 0; r--) {
    const idx = r * cols + col;
    if (newBoard[idx] === '') {
      targetIndex = idx;
      break;
    }
  }

  if (targetIndex === -1) return;

  const color = playerId === room.player1Id ? 'RED' : 'YELLOW';
  newBoard[targetIndex] = color;

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
  };

  realtimeSocket.emit('game:move', { roomId: room.roomId, updateData: updates });
}

function checkConnectFourWin(board, cols, rows, lastIdx, color) {
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];

  const r0 = Math.floor(lastIdx / cols);
  const c0 = lastIdx % cols;

  for (const { dr, dc } of directions) {
    const line = [lastIdx];

    for (let step = 1; step < 4; step++) {
      const r = r0 + dr * step;
      const c = c0 + dc * step;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const idx = r * cols + c;
        if (board[idx] === color) line.push(idx);
        else break;
      } else break;
    }

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
    };

    realtimeSocket.emit('game:move', { roomId: room.roomId, updateData: updates });
  } else {
    const updates = { [isP1 ? 'p1Choice' : 'p2Choice']: choice };
    realtimeSocket.emit('game:move', { roomId: room.roomId, updateData: updates });
  }
}

/**
 * Make Memory Flip move
 */
export async function makeMemoryFlipMove(room, cardIndex, playerId) {
  if (room.status !== GAME_STATUS.IN_PROGRESS) return;
  if (room.currentTurnPlayerId !== playerId) return;

  const revealed = room.revealedCards || [];
  const matched = room.matchedCards || [];

  if (matched.includes(cardIndex) || revealed.includes(cardIndex)) return;

  if (revealed.length === 0) {
    realtimeSocket.emit('game:move', {
      roomId: room.roomId,
      updateData: { revealedCards: [cardIndex] },
    });
  } else if (revealed.length === 1) {
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

    realtimeSocket.emit('game:move', {
      roomId: room.roomId,
      updateData: {
        revealedCards: [firstIdx, cardIndex],
        matchedCards: newMatched,
        p1Pairs,
        p2Pairs,
      },
    });

    setTimeout(() => {
      realtimeSocket.emit('game:move', {
        roomId: room.roomId,
        updateData: {
          revealedCards: [],
          currentTurnPlayerId: allMatched ? '' : nextTurn,
          status: allMatched ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
          winnerId,
          winnerUsername,
          isDraw,
        },
      });
    }, isMatch ? 300 : 1000);
  }
}

/**
 * Handle Rematch request
 */
export async function requestRematch(room, playerId) {
  realtimeSocket.emit('game:rematch', { roomId: room.roomId, playerId });
}
