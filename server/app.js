import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

let currentDir = process.cwd();
try {
  if (typeof __dirname !== 'undefined') {
    currentDir = __dirname;
  } else if (typeof import.meta !== 'undefined' && import.meta.url) {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch (_) {
  currentDir = process.cwd();
}

// Support both standard server and serverless /tmp environments
const IS_SERVERLESS = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = IS_SERVERLESS ? path.join('/tmp', 'instachat_data') : path.join(currentDir, 'data');
const DB_FILE = path.join(DATA_DIR, 'instachat_db.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[DB] Could not ensure DATA_DIR:', e.message);
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

export let db = { ...initialData };
export let isDbDirty = false;
let lastStoreSyncTime = 0;
const SYNC_CACHE_TTL_MS = 1000;

export function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      db = {
        ...initialData,
        ...parsed,
        users: { ...initialData.users, ...(parsed.users || {}) },
        usernames: { ...initialData.usernames, ...(parsed.usernames || {}) },
        friendships: { ...initialData.friendships, ...(parsed.friendships || {}) },
        friendRequests: { ...initialData.friendRequests, ...(parsed.friendRequests || {}) },
        conversations: { ...initialData.conversations, ...(parsed.conversations || {}) },
        messages: { ...initialData.messages, ...(parsed.messages || {}) },
        gameRooms: { ...initialData.gameRooms, ...(parsed.gameRooms || {}) },
        gameInvites: { ...initialData.gameInvites, ...(parsed.gameInvites || {}) },
        activeCalls: { ...initialData.activeCalls, ...(parsed.activeCalls || {}) },
      };
      console.log(`[DB] Loaded ${Object.keys(db.users).length} users, ${Object.keys(db.friendRequests).length} friend requests from disk.`);
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('[DB] Failed to load DB file, using in-memory state:', err.message);
  }
}

export function saveDb() {
  isDbDirty = true;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    // Non-fatal in read-only environments
    console.warn('[DB] Failed to save DB file:', err.message);
  }
}

export async function syncDbFromStore(force = false) {
  const now = Date.now();
  if (!force && (now - lastStoreSyncTime < SYNC_CACHE_TTL_MS)) {
    return;
  }

  // Load from local file first
  loadDb();

  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'instachat-db', consistency: 'strong' });
    const remoteData = await store.get('db_state', { type: 'json' });
    if (remoteData && typeof remoteData === 'object') {
      db = {
        ...initialData,
        ...remoteData,
        users: { ...initialData.users, ...(remoteData.users || {}) },
        usernames: { ...initialData.usernames, ...(remoteData.usernames || {}) },
        friendships: { ...initialData.friendships, ...(remoteData.friendships || {}) },
        friendRequests: { ...initialData.friendRequests, ...(remoteData.friendRequests || {}) },
        conversations: { ...initialData.conversations, ...(remoteData.conversations || {}) },
        messages: { ...initialData.messages, ...(remoteData.messages || {}) },
        gameRooms: { ...initialData.gameRooms, ...(remoteData.gameRooms || {}) },
        gameInvites: { ...initialData.gameInvites, ...(remoteData.gameInvites || {}) },
        activeCalls: { ...initialData.activeCalls, ...(remoteData.activeCalls || {}) },
      };
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      } catch (_) {}
      lastStoreSyncTime = now;
      console.log(`[DB] Netlify Blobs synced: ${Object.keys(db.users).length} users, ${Object.keys(db.friendRequests).length} friend requests.`);
    }
  } catch (err) {
    // Non-fatal fallback (local disk / memory)
  }
}

export async function syncDbToStore() {
  if (!isDbDirty) return;
  isDbDirty = false;

  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'instachat-db', consistency: 'strong' });
    await store.setJSON('db_state', db);
    lastStoreSyncTime = Date.now();
    console.log(`[DB] Netlify Blobs saved: ${Object.keys(db.users).length} users, ${Object.keys(db.friendRequests).length} friend requests.`);
  } catch (err) {
    // Non-fatal
  }
}

loadDb();

// Helper: Hash password
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_instachat_salt_2026').digest('hex');
}

// Helper: Deterministic conversation ID
export function getConversationId(idA, idB) {
  if (!idA || !idB) return '';
  return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

export const app = express();

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

app.use(cors(corsOptions));
app.options('{*splat}', cors(corsOptions));

app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  next(err);
});

// Sync persistent DB state before processing incoming request
app.use(async (req, res, next) => {
  try {
    await syncDbFromStore();
  } catch (_) {}

  res.on('finish', () => {
    if (isDbDirty) {
      syncDbToStore().catch(() => {});
    }
  });

  next();
});

app.use(express.json({ limit: '20mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'instachat-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    usersCount: Object.keys(db.users || {}).length,
    requestsCount: Object.keys(db.friendRequests || {}).length,
    lastSync: lastStoreSyncTime,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'instachat-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    usersCount: Object.keys(db.users || {}).length,
    requestsCount: Object.keys(db.friendRequests || {}).length,
    lastSync: lastStoreSyncTime,
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'INSTAChat Production Realtime Engine',
    version: '1.0.0',
    usersCount: Object.keys(db.users || {}).length,
    requestsCount: Object.keys(db.friendRequests || {}).length,
  });
});

// Socket integration hooks
let ioInstance = null;
let userSocketsMap = new Map();

export function setIoInstance(io, socketsMap) {
  ioInstance = io;
  if (socketsMap) userSocketsMap = socketsMap;
}

export function emitToUser(userId, event, data) {
  if (!ioInstance) return;
  const sockets = userSocketsMap.get(userId);
  if (sockets) {
    for (const sId of sockets) {
      ioInstance.to(sId).emit(event, data);
    }
  }
}

export function broadcastPresence(userId, online, lastActive = Date.now()) {
  if (db.users[userId]) {
    db.users[userId].online = online;
    db.users[userId].lastActive = lastActive;
    saveDb();
  }
  if (ioInstance) {
    ioInstance.emit('presence:changed', { userId, online, lastActive });
  }
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

  if (db.usernames[lowerUser]) {
    return res.status(409).json({ error: `Username "${cleanUser}" is already taken.` });
  }

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
  if (ioInstance) {
    ioInstance.emit('user:profile-updated', safeUser);
  }
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

  for (const fsItem of Object.values(db.friendships)) {
    let friendId = null;
    let customNickname = '';
    if (fsItem.userA === userId) {
      friendId = fsItem.userB;
      customNickname = fsItem.nicknameA || '';
    } else if (fsItem.userB === userId) {
      friendId = fsItem.userA;
      customNickname = fsItem.nicknameB || '';
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
        friendshipDate: fsItem.createdAt,
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
  const fsItem = db.friendships[fKey];

  if (fsItem) {
    if (fsItem.userA === currentUserId) fsItem.nicknameA = (nickname || '').trim();
    else fsItem.nicknameB = (nickname || '').trim();
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
