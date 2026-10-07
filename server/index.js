import http from 'http';
import { Server } from 'socket.io';
import {
  app,
  db,
  saveDb,
  isOriginAllowed,
  setIoInstance,
  emitToUser,
  broadcastPresence,
} from './app.js';

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
  },
  pingTimeout: 30000,
  pingInterval: 15000,
});

// Map of userId -> Set of socketIds
const userSockets = new Map();
// Map of socketId -> userId
const socketUser = new Map();

setIoInstance(io, userSockets);

/* ========================================================================= */
/*                           SOCKET.IO REALTIME                              */
/* ========================================================================= */

io.on('connection', (socket) => {
  let boundUserId = null;

  socket.on('auth:register', ({ userId }) => {
    if (!userId) return;
    boundUserId = userId;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUser.set(socket.id, userId);

    socket.join(`user_${userId}`);
    broadcastPresence(userId, true);
    console.log(`[Socket] User ${userId} connected on socket ${socket.id}`);
  });

  // Typing indicator
  socket.on('chat:typing', ({ conversationId, userId, username, receiverId, isTyping }) => {
    if (receiverId) {
      emitToUser(receiverId, 'chat:typing', { conversationId, userId, username, isTyping });
    }
  });

  // Realtime WebRTC Signaling
  socket.on('webrtc:call-offer', (callData) => {
    const { callId, receiverId, callerId } = callData;
    db.activeCalls[callId] = {
      ...callData,
      status: 'RINGING',
      createdAt: Date.now(),
    };
    emitToUser(receiverId, 'webrtc:incoming-call', callData);
    console.log(`[WebRTC] Call offer relayed from ${callerId} to ${receiverId}`);
  });

  socket.on('webrtc:call-answer', (answerData) => {
    const { callId, callerId, answerSdp } = answerData;
    if (db.activeCalls[callId]) {
      db.activeCalls[callId].status = 'CONNECTED';
      db.activeCalls[callId].answerSdp = answerSdp;
    }
    emitToUser(callerId, 'webrtc:call-answered', answerData);
    console.log(`[WebRTC] Call answered for ${callId}`);
  });

  socket.on('webrtc:ice-candidate', ({ callId, targetUserId, candidate }) => {
    emitToUser(targetUserId, 'webrtc:ice-candidate', { callId, candidate });
  });

  socket.on('webrtc:call-hangup', ({ callId, otherUserId }) => {
    if (db.activeCalls[callId]) {
      db.activeCalls[callId].status = 'ENDED';
      delete db.activeCalls[callId];
    }
    emitToUser(otherUserId, 'webrtc:call-ended', { callId });
  });

  // Multiplayer Games Events
  socket.on('game:invite-send', (inviteData) => {
    const { inviteId, receiverId } = inviteData;
    db.gameInvites[inviteId] = inviteData;
    saveDb();
    emitToUser(receiverId, 'game:invite-received', inviteData);
  });

  socket.on('game:invite-respond', ({ inviteId, status, roomId, responseData }) => {
    const invite = db.gameInvites[inviteId];
    if (invite) {
      invite.status = status;
      saveDb();

      emitToUser(invite.senderId, 'game:invite-status', { inviteId, status, roomId, ...responseData });
      emitToUser(invite.receiverId, 'game:invite-status', { inviteId, status, roomId, ...responseData });
    }
  });

  socket.on('game:join-room', ({ roomId, player }) => {
    socket.join(`game_${roomId}`);
    console.log(`[Game] Player ${player?.username} joined room ${roomId}`);
  });

  socket.on('game:create-room', (roomData) => {
    db.gameRooms[roomData.roomId] = roomData;
    saveDb();
    emitToUser(roomData.player1Id, 'game:room-created', roomData);
    emitToUser(roomData.player2Id, 'game:room-created', roomData);
  });

  socket.on('game:update-room', ({ roomId, roomData }) => {
    if (db.gameRooms[roomId]) {
      db.gameRooms[roomId] = { ...db.gameRooms[roomId], ...roomData, updatedAt: Date.now() };
    } else {
      db.gameRooms[roomId] = { ...roomData, updatedAt: Date.now() };
    }
    saveDb();
  });

  socket.on('game:move', ({ roomId, updateData }) => {
    const room = db.gameRooms[roomId];
    if (room) {
      Object.assign(room, updateData, { updatedAt: Date.now() });
      saveDb();

      emitToUser(room.player1Id, 'game:room-updated', room);
      emitToUser(room.player2Id, 'game:room-updated', room);
    }
  });

  socket.on('game:rematch', ({ roomId, playerId }) => {
    const room = db.gameRooms[roomId];
    if (!room) return;

    const isP1 = playerId === room.player1Id;
    if (isP1) room.rematchPlayer1 = true;
    else room.rematchPlayer2 = true;

    if (room.rematchPlayer1 && room.rematchPlayer2) {
      if (room.gameType === 'TIC_TAC_TOE') room.boardState = Array(9).fill('');
      else if (room.gameType === 'CONNECT_FOUR') room.boardState = Array(42).fill('');
      else if (room.gameType === 'ROCK_PAPER_SCISSORS') {
        room.p1Choice = null;
        room.p2Choice = null;
        room.p1Score = 0;
        room.p2Score = 0;
        room.currentRound = 1;
        room.lastRoundResult = '';
      }
      room.status = 'IN_PROGRESS';
      room.winnerId = null;
      room.winnerUsername = null;
      room.isDraw = false;
      room.winningLine = [];
      room.rematchPlayer1 = false;
      room.rematchPlayer2 = false;
      room.currentTurnPlayerId = room.player1Id;
    }

    room.updatedAt = Date.now();
    saveDb();

    emitToUser(room.player1Id, 'game:room-updated', room);
    emitToUser(room.player2Id, 'game:room-updated', room);
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    if (boundUserId) {
      const set = userSockets.get(boundUserId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(boundUserId);
          broadcastPresence(boundUserId, false, Date.now());
        }
      }
      socketUser.delete(socket.id);
      console.log(`[Socket] User ${boundUserId} disconnected`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  INSTAChat Production Realtime Server running on   `);
  console.log(`  http://0.0.0.0:${PORT}                             `);
  console.log(`====================================================`);
});
