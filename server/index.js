import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'instachat_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB state
const initialData = {
  users: {},          // userId -> userDoc
  usernames: {},      // lowercase username -> userId
  friendships: {},    // friendshipId -> { id, userA, userB, createdAt }
  friendRequests: {}, // reqId -> reqDoc
  conversations: {},  // convoId -> convoDoc
  messages: {},       // convoId -> [messageDoc]
  gameRooms: {},      // roomId -> roomDoc
  gameInvites: {},    // inviteId -> inviteDoc
  activeCalls: {},    // callId -> callDoc
};

let db = { ...initialData };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = { ...initialData, ...JSON.parse(raw) };
      console.log(`[DB] Loaded ${Object.keys(db.users).length} users, ${Object.keys(db.conversations).length} conversations.`);
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('[DB] Failed to load DB file, using in-memory state:', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to save DB file:', err);
  }
}

loadDb();

// Helper: Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_instachat_salt_2026').digest('hex');
}

// Helper: Deterministic conversation ID
export function getConversationId(idA, idB) {
  if (!idA || !idB) return '';
  return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

const app = express();

// Production and Local Development Allowed Origins
const ALLOWED_ORIGINS = [
  'https://instachat07.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((orig) => {
    const trimmed = orig.trim();
    if (trimmed && trimmed !== '*' && !ALLOWED_ORIGINS.includes(trimmed)) {
      ALLOWED_ORIGINS.push(trimmed);
    }
  });
}

export function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser clients, health checks, curl
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'instachat07.netlify.app' || parsed.hostname.endsWith('--instachat07.netlify.app')) {
      return true;
    }
  } catch {
    // Malformed origin
  }
  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: false,
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// Express CORS middleware applied to all routes
app.use(cors(corsOptions));
app.options('{*splat}', cors(corsOptions));

// Handle CORS rejection errors cleanly with 403 JSON
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  next(err);
});

app.use(express.json({ limit: '20mb' }));

// Production health checks for Render, Railway, Fly.io, Heroku, etc.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'instachat-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'INSTAChat Production Realtime Engine',
    version: '1.0.0',
    usersCount: Object.keys(db.users || {}).length,
  });
});

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

function getUserSockets(userId) {
  return userSockets.get(userId) || new Set();
}

function emitToUser(userId, event, data) {
  const sockets = getUserSockets(userId);
  for (const sId of sockets) {
    io.to(sId).emit(event, data);
  }
}

// Broadcast presence update
function broadcastPresence(userId, online, lastActive = Date.now()) {
  if (db.users[userId]) {
    db.users[userId].online = online;
    db.users[userId].lastActive = lastActive;
    saveDb();
  }
  io.emit('presence:changed', { userId, online, lastActive });
}

/* ========================================================================= */
/*                               AUTH ROUTES                                 */
/* ========================================================================= */

app.post('/api/auth/signup', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  const cleanUser = username.trim();
  const lowerUser = cleanUser.toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUser.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  // Check username uniqueness
  if (db.usernames[lowerUser]) {
    return res.status(409).json({ error: `Username "${cleanUser}" is already taken.` });
  }

  // Check email uniqueness
  const existingEmail = Object.values(db.users).find((u) => u.email?.toLowerCase() === cleanEmail);
  if (existingEmail) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();

  const newUser = {
    userId,
    uid: userId,
    username: cleanUser,
    usernameLower: lowerUser,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    profileImageUrl: null,
    coins: 100,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    ticTacToeWins: 0,
    connectFourWins: 0,
    rpsWins: 0,
    online: true,
    lastActive: now,
    createdAt: now,
  };

  db.users[userId] = newUser;
  db.usernames[lowerUser] = userId;
  saveDb();

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser, token: `token_${userId}` });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = Object.values(db.users).find(
    (u) => u.email?.toLowerCase() === cleanEmail || u.usernameLower === cleanEmail
  );

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email/username or password.' });
  }

  user.online = true;
  user.lastActive = Date.now();
  saveDb();

  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, token: `token_${user.userId}` });
});

app.post('/api/auth/logout', (req, res) => {
  const { userId } = req.body;
  if (userId && db.users[userId]) {
    db.users[userId].online = false;
    db.users[userId].lastActive = Date.now();
    saveDb();
    broadcastPresence(userId, false, db.users[userId].lastActive);
  }
  res.json({ success: true });
});

app.get('/api/auth/me/:userId', (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post('/api/auth/update-profile', (req, res) => {
  const { userId, updates } = req.body;
  if (!userId || !db.users[userId]) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = db.users[userId];
  if (updates.profileImageUrl !== undefined) user.profileImageUrl = updates.profileImageUrl;
  if (updates.username && updates.username.trim() !== user.username) {
    const newLower = updates.username.trim().toLowerCase();
    if (db.usernames[newLower] && db.usernames[newLower] !== userId) {
      return res.status(409).json({ error: 'Username is already taken' });
    }
    delete db.usernames[user.usernameLower];
    user.username = updates.username.trim();
    user.usernameLower = newLower;
    db.usernames[newLower] = userId;
  }
  user.lastActive = Date.now();
  saveDb();

  const { passwordHash, ...safeUser } = user;
  io.emit('user:profile-updated', safeUser);
  res.json({ user: safeUser });
});

/* ========================================================================= */
/*                              FRIEND ROUTES                                */
/* ========================================================================= */

app.get('/api/friends/search', (req, res) => {
  const { q, currentUserId } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ users: [] });
  }

  const queryClean = q.trim().toLowerCase();
  const matched = [];

  for (const u of Object.values(db.users)) {
    if (u.userId === currentUserId) continue;
    if (u.usernameLower.includes(queryClean) || u.userId === q.trim()) {
      const { passwordHash, ...safeUser } = u;
      matched.push(safeUser);
    }
  }

  res.json({ users: matched });
});

app.get('/api/friends/:userId', (req, res) => {
  const { userId } = req.params;
  const friendList = [];

  for (const fs of Object.values(db.friendships)) {
    let friendId = null;
    let customNickname = '';
    if (fs.userA === userId) {
      friendId = fs.userB;
      customNickname = fs.nicknameA || '';
    } else if (fs.userB === userId) {
      friendId = fs.userA;
      customNickname = fs.nicknameB || '';
    }

    if (friendId && db.users[friendId]) {
      const fu = db.users[friendId];
      friendList.push({
        friendId: fu.userId,
        friendUsername: fu.username,
        friendProfileImageUrl: fu.profileImageUrl,
        friendOnline: fu.online,
        lastActive: fu.lastActive,
        customNickname,
        friendshipDate: fs.createdAt,
      });
    }
  }

  res.json({ friends: friendList });
});

app.get('/api/friends/:userId/requests', (req, res) => {
  const { userId } = req.params;
  const incoming = [];
  const outgoing = [];

  for (const reqDoc of Object.values(db.friendRequests)) {
    if (reqDoc.status === 'PENDING') {
      if (reqDoc.receiverId === userId) incoming.push(reqDoc);
      if (reqDoc.senderId === userId) outgoing.push(reqDoc);
    }
  }

  res.json({ incoming, outgoing });
});

app.post('/api/friends/request', (req, res) => {
  const { senderUser, receiverUser } = req.body;
  if (!senderUser || !receiverUser) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const sId = senderUser.userId || senderUser.uid;
  const rId = receiverUser.userId || receiverUser.uid;

  if (sId === rId) {
    return res.status(400).json({ error: 'You cannot add yourself as a friend.' });
  }

  // Check existing friendship
  const fKey = sId < rId ? `${sId}_${rId}` : `${rId}_${sId}`;
  if (db.friendships[fKey]) {
    return res.status(400).json({ error: 'You are already friends with this user.' });
  }

  const requestId = `${sId}_${rId}`;
  if (db.friendRequests[requestId] && db.friendRequests[requestId].status === 'PENDING') {
    return res.status(400).json({ error: 'Friend request already sent.' });
  }

  const requestDoc = {
    requestId,
    senderId: sId,
    senderUsername: senderUser.username || senderUser.displayName || 'User',
    senderProfileImageUrl: senderUser.profileImageUrl || null,
    receiverId: rId,
    receiverUsername: receiverUser.username || receiverUser.displayName || 'User',
    receiverProfileImageUrl: receiverUser.profileImageUrl || null,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  db.friendRequests[requestId] = requestDoc;
  saveDb();

  // Notify receiver in real time
  emitToUser(rId, 'friend:request-received', requestDoc);
  res.status(201).json({ request: requestDoc });
});

app.post('/api/friends/accept', (req, res) => {
  const { requestId, currentUserId } = req.body;
  const reqDoc = db.friendRequests[requestId];

  if (!reqDoc) {
    return res.status(404).json({ error: 'Request not found' });
  }

  reqDoc.status = 'ACCEPTED';
  const sId = reqDoc.senderId;
  const rId = reqDoc.receiverId;

  const fKey = sId < rId ? `${sId}_${rId}` : `${rId}_${sId}`;
  db.friendships[fKey] = {
    id: fKey,
    userA: sId < rId ? sId : rId,
    userB: sId < rId ? rId : sId,
    nicknameA: '',
    nicknameB: '',
    createdAt: Date.now(),
  };

  saveDb();

  // Emit updates to both users
  emitToUser(sId, 'friend:request-accepted', { requestId, friendId: rId });
  emitToUser(rId, 'friend:request-accepted', { requestId, friendId: sId });
  res.json({ success: true, friendship: db.friendships[fKey] });
});

app.post('/api/friends/reject', (req, res) => {
  const { requestId } = req.body;
  if (db.friendRequests[requestId]) {
    delete db.friendRequests[requestId];
    saveDb();
  }
  res.json({ success: true });
});

app.post('/api/friends/nickname', (req, res) => {
  const { currentUserId, friendId, nickname } = req.body;
  const fKey = currentUserId < friendId ? `${currentUserId}_${friendId}` : `${friendId}_${currentUserId}`;
  const fs = db.friendships[fKey];

  if (fs) {
    if (fs.userA === currentUserId) fs.nicknameA = (nickname || '').trim();
    else fs.nicknameB = (nickname || '').trim();
    saveDb();
  }

  res.json({ success: true });
});

/* ========================================================================= */
/*                          CHAT & MESSAGES ROUTES                           */
/* ========================================================================= */

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const list = [];

  for (const convo of Object.values(db.conversations)) {
    if (convo.participants.includes(userId)) {
      list.push(convo);
    }
  }

  list.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
  res.json({ conversations: list });
});

app.get('/api/conversations/:convoId/messages', (req, res) => {
  const { convoId } = req.params;
  const msgs = db.messages[convoId] || [];
  res.json({ messages: msgs });
});

app.post('/api/conversations/ensure', (req, res) => {
  const { userA, userB } = req.body;
  if (!userA?.userId || !userB?.userId) {
    return res.status(400).json({ error: 'Both users required' });
  }

  const convoId = getConversationId(userA.userId, userB.userId);
  if (!db.conversations[convoId]) {
    db.conversations[convoId] = {
      conversationId: convoId,
      id: convoId,
      participants: [userA.userId, userB.userId],
      participantUsernames: {
        [userA.userId]: userA.username,
        [userB.userId]: userB.username,
      },
      lastMessage: '',
      lastMessageTimestamp: Date.now(),
      lastSenderId: '',
    };
    if (!db.messages[convoId]) db.messages[convoId] = [];
    saveDb();
  }

  res.json({ conversation: db.conversations[convoId] });
});

app.post('/api/conversations/:convoId/messages', (req, res) => {
  const { convoId } = req.params;
  const msgData = req.body;

  if (!msgData.senderId || !msgData.receiverId) {
    return res.status(400).json({ error: 'senderId and receiverId are required' });
  }

  const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();

  const newMsg = {
    messageId,
    id: messageId,
    conversationId: convoId,
    senderId: msgData.senderId,
    receiverId: msgData.receiverId,
    text: msgData.text || '',
    messageType: msgData.messageType || 'TEXT',
    imageUrl: msgData.imageUrl || null,
    videoUrl: msgData.videoUrl || null,
    voiceUrl: msgData.voiceUrl || null,
    voiceDurationSeconds: msgData.voiceDurationSeconds || 0,
    documentUrl: msgData.documentUrl || null,
    documentName: msgData.documentName || null,
    documentSize: msgData.documentSize || 0,
    documentMimeType: msgData.documentMimeType || null,
    timestamp: now,
    status: 'SENT',
    isRead: false,
    read: false,
  };

  if (!db.messages[convoId]) db.messages[convoId] = [];
  db.messages[convoId].push(newMsg);

  // Update conversation
  let previewText = newMsg.text;
  if (newMsg.messageType === 'IMAGE') previewText = '📷 Photo';
  else if (newMsg.messageType === 'VIDEO') previewText = '🎥 Video';
  else if (newMsg.messageType === 'VOICE') previewText = '🎤 Voice note';
  else if (newMsg.messageType === 'DOCUMENT') previewText = `📄 ${newMsg.documentName || 'Document'}`;

  if (!db.conversations[convoId]) {
    db.conversations[convoId] = {
      conversationId: convoId,
      id: convoId,
      participants: [newMsg.senderId, newMsg.receiverId],
      participantUsernames: {},
      lastMessage: previewText,
      lastMessageTimestamp: now,
      lastSenderId: newMsg.senderId,
    };
  } else {
    db.conversations[convoId].lastMessage = previewText;
    db.conversations[convoId].lastMessageTimestamp = now;
    db.conversations[convoId].lastSenderId = newMsg.senderId;
  }

  saveDb();

  // Socket broadcast to participants
  emitToUser(newMsg.senderId, 'chat:message-sent', newMsg);
  emitToUser(newMsg.receiverId, 'chat:message-received', newMsg);

  res.status(201).json({ message: newMsg });
});

app.post('/api/conversations/:convoId/read', (req, res) => {
  const { convoId } = req.params;
  const { readerId } = req.body;

  if (db.messages[convoId]) {
    let updated = false;
    for (const m of db.messages[convoId]) {
      if (m.receiverId === readerId && m.status !== 'READ') {
        m.status = 'READ';
        m.isRead = true;
        m.read = true;
        updated = true;
      }
    }
    if (updated) {
      saveDb();
      // Notify other participant of read receipt
      const convo = db.conversations[convoId];
      if (convo) {
        const otherId = convo.participants.find((p) => p !== readerId);
        if (otherId) {
          emitToUser(otherId, 'chat:messages-read', { conversationId: convoId, readerId });
        }
      }
    }
  }

  res.json({ success: true });
});

app.post('/api/conversations/:convoId/delivered', (req, res) => {
  const { convoId } = req.params;
  const { receiverId } = req.body;

  if (db.messages[convoId]) {
    let updated = false;
    for (const m of db.messages[convoId]) {
      if (m.receiverId === receiverId && m.status === 'SENT') {
        m.status = 'DELIVERED';
        updated = true;
      }
    }
    if (updated) {
      saveDb();
      const convo = db.conversations[convoId];
      if (convo) {
        const otherId = convo.participants.find((p) => p !== receiverId);
        if (otherId) {
          emitToUser(otherId, 'chat:messages-delivered', { conversationId: convoId, receiverId });
        }
      }
    }
  }

  res.json({ success: true });
});

/* ========================================================================= */
/*                              GAMES ROUTES                                 */
/* ========================================================================= */

app.get('/api/games/invitations/:userId', (req, res) => {
  const { userId } = req.params;
  const list = Object.values(db.gameInvites).filter(
    (inv) => inv.receiverId === userId && inv.status === 'PENDING'
  );
  res.json({ invitations: list });
});

app.get('/api/games/rooms/:roomId', (req, res) => {
  const room = db.gameRooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ room });
});

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
    console.log(`[WebRTC] Call answer relayed to caller ${callerId}`);
  });

  socket.on('webrtc:call-reject', ({ callId, callerId, receiverId }) => {
    if (db.activeCalls[callId]) {
      db.activeCalls[callId].status = 'REJECTED';
      delete db.activeCalls[callId];
    }
    emitToUser(callerId, 'webrtc:call-rejected', { callId });
    console.log(`[WebRTC] Call rejected by ${receiverId}`);
  });

  socket.on('webrtc:call-end', ({ callId, targetUserId }) => {
    if (db.activeCalls[callId]) {
      db.activeCalls[callId].status = 'ENDED';
      delete db.activeCalls[callId];
    }
    if (targetUserId) {
      emitToUser(targetUserId, 'webrtc:call-ended', { callId });
    }
    console.log(`[WebRTC] Call ended for ${callId}`);
  });

  socket.on('webrtc:ice-candidate', ({ callId, candidate, targetUserId, isCaller }) => {
    if (targetUserId) {
      emitToUser(targetUserId, 'webrtc:ice-candidate', { callId, candidate, isCaller });
    }
  });

  // Multiplayer Games Signaling
  socket.on('game:invite', (inviteData) => {
    const { invitationId, roomId, senderUser, receiverUser, gameType } = inviteData;
    db.gameInvites[invitationId] = {
      invitationId,
      roomId,
      gameType,
      senderId: senderUser.userId,
      senderUsername: senderUser.username,
      receiverId: receiverUser.userId,
      receiverUsername: receiverUser.username,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    // Initialize Room
    let boardState = [];
    if (gameType === 'TIC_TAC_TOE') boardState = Array(9).fill('');
    else if (gameType === 'CONNECT_FOUR') boardState = Array(42).fill('');
    else if (gameType === 'MEMORY_FLIP') {
      const icons = ['⚡', '💎', '🔥', '🚀', '⭐', '🎮', '👑', '🔮'];
      boardState = [...icons, ...icons].sort(() => Math.random() - 0.5);
    }

    db.gameRooms[roomId] = {
      roomId,
      gameType,
      player1Id: senderUser.userId,
      player1Username: senderUser.username,
      player2Id: receiverUser.userId,
      player2Username: receiverUser.username,
      currentTurnPlayerId: senderUser.userId,
      status: 'WAITING',
      boardState,
      p1Choice: null,
      p2Choice: null,
      p1Score: 0,
      p2Score: 0,
      currentRound: 1,
      maxRounds: 3,
      lastRoundResult: '',
      winnerId: null,
      winnerUsername: null,
      isDraw: false,
      winningLine: [],
      rematchPlayer1: false,
      rematchPlayer2: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveDb();
    emitToUser(receiverUser.userId, 'game:invitation-received', db.gameInvites[invitationId]);
  });

  socket.on('game:accept', ({ invitationId, roomId, user }) => {
    if (db.gameInvites[invitationId]) {
      db.gameInvites[invitationId].status = 'ACCEPTED';
    }
    const room = db.gameRooms[roomId];
    if (room) {
      room.player2Id = user.userId;
      room.player2Username = user.username;
      room.status = 'IN_PROGRESS';
      room.updatedAt = Date.now();
      saveDb();

      emitToUser(room.player1Id, 'game:room-updated', room);
      emitToUser(room.player2Id, 'game:room-updated', room);
    }
  });

  socket.on('game:decline', ({ invitationId, roomId }) => {
    if (db.gameInvites[invitationId]) {
      db.gameInvites[invitationId].status = 'DECLINED';
      const senderId = db.gameInvites[invitationId].senderId;
      emitToUser(senderId, 'game:declined', { invitationId, roomId });
    }
    if (db.gameRooms[roomId]) {
      db.gameRooms[roomId].status = 'CANCELLED';
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
      // Both agreed: reset board
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
