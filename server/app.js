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
  pendingEvents: {},  // userId -> [ { id, event, data, timestamp } ]
  typing: {},         // convoId -> { userId, username, isTyping, timestamp }
};

export let db = { ...initialData };
export let isDbDirty = false;
let lastStoreSyncTime = 0;
const SYNC_CACHE_TTL_MS = 1000;

export function loadDb() {
  try {
    let sourcePath = DB_FILE;
    if (!fs.existsSync(sourcePath)) {
      const bundledSeed = path.join(currentDir, 'data', 'instachat_db.json');
      const rootSeed = path.join(process.cwd(), 'server', 'data', 'instachat_db.json');
      if (fs.existsSync(bundledSeed)) {
        sourcePath = bundledSeed;
      } else if (fs.existsSync(rootSeed)) {
        sourcePath = rootSeed;
      }
    }
    if (fs.existsSync(sourcePath)) {
      const raw = fs.readFileSync(sourcePath, 'utf-8');
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
        pendingEvents: { ...initialData.pendingEvents, ...(parsed.pendingEvents || {}) },
        typing: { ...initialData.typing, ...(parsed.typing || {}) },
      };
      console.log(`[DB] Loaded ${Object.keys(db.users).length} users, ${Object.keys(db.friendRequests).length} friend requests from ${sourcePath}.`);
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

const CLOUDINARY_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME || 'jdkg4l75';
const CLOUDINARY_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'battlechat_upload';
const CLOUDINARY_DB_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/instachat_persistent_db.json`;

function applyRemoteData(remoteData) {
  if (!remoteData || typeof remoteData !== 'object') return;
  db = {
    ...initialData,
    ...db,
    ...remoteData,
    users: { ...initialData.users, ...(db.users || {}), ...(remoteData.users || {}) },
    usernames: { ...initialData.usernames, ...(db.usernames || {}), ...(remoteData.usernames || {}) },
    friendships: { ...initialData.friendships, ...(db.friendships || {}), ...(remoteData.friendships || {}) },
    friendRequests: { ...initialData.friendRequests, ...(db.friendRequests || {}), ...(remoteData.friendRequests || {}) },
    conversations: { ...initialData.conversations, ...(db.conversations || {}), ...(remoteData.conversations || {}) },
    messages: { ...initialData.messages, ...(db.messages || {}), ...(remoteData.messages || {}) },
    gameRooms: { ...initialData.gameRooms, ...(db.gameRooms || {}), ...(remoteData.gameRooms || {}) },
    gameInvites: { ...initialData.gameInvites, ...(db.gameInvites || {}), ...(remoteData.gameInvites || {}) },
    activeCalls: { ...initialData.activeCalls, ...(db.activeCalls || {}), ...(remoteData.activeCalls || {}) },
    pendingEvents: { ...initialData.pendingEvents, ...(db.pendingEvents || {}), ...(remoteData.pendingEvents || {}) },
  };
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (_) {}
}

export async function syncDbFromStore(force = false) {
  const now = Date.now();
  if (!force && (now - lastStoreSyncTime < SYNC_CACHE_TTL_MS)) {
    return;
  }

  // Load from local file first
  loadDb();

  // 1. Try Netlify Blobs
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'instachat-db', consistency: 'strong' });
    const remoteData = await store.get('db_state', { type: 'json' });
    if (remoteData && typeof remoteData === 'object' && Object.keys(remoteData.users || {}).length > 0) {
      applyRemoteData(remoteData);
      lastStoreSyncTime = now;
      console.log(`[DB] Netlify Blobs synced: ${Object.keys(db.users).length} users, ${Object.keys(db.friendRequests).length} friend requests.`);
      return;
    }
  } catch (_) {
    // Non-fatal fallback
  }

  // 2. Fallback to Cloudinary persistent store
  try {
    const cloudRes = await fetch(`${CLOUDINARY_DB_URL}?t=${now}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (cloudRes.ok) {
      const remoteData = await cloudRes.json();
      if (remoteData && typeof remoteData === 'object' && Object.keys(remoteData.users || {}).length > 0) {
        applyRemoteData(remoteData);
        lastStoreSyncTime = now;
        console.log(`[DB] Cloudinary persistent store synced: ${Object.keys(db.users).length} users.`);
      }
    }
  } catch (_) {
    // Non-fatal
  }
}

export async function syncDbToStore() {
  if (!isDbDirty) return;
  isDbDirty = false;

  // 1. Try Netlify Blobs
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'instachat-db', consistency: 'strong' });
    await store.setJSON('db_state', db);
    lastStoreSyncTime = Date.now();
    console.log(`[DB] Netlify Blobs saved: ${Object.keys(db.users).length} users.`);
  } catch (_) {}

  // 2. Try Cloudinary raw upload
  try {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
    formData.append('file', blob, 'instachat_persistent_db.json');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', 'instachat_persistent_db');
    formData.append('resource_type', 'raw');
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');

    await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(3500),
    });
    lastStoreSyncTime = Date.now();
  } catch (_) {}
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
  if (ioInstance) {
    const sockets = userSocketsMap.get(userId);
    if (sockets) {
      for (const sId of sockets) {
        ioInstance.to(sId).emit(event, data);
      }
    }
  }

  // Dual-mode reliability: queue for polling delivery
  if (!db.pendingEvents) db.pendingEvents = {};
  if (!db.pendingEvents[userId]) db.pendingEvents[userId] = [];
  db.pendingEvents[userId].push({
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    event,
    data,
    timestamp: Date.now(),
  });

  const cutoff = Date.now() - 60000;
  db.pendingEvents[userId] = db.pendingEvents[userId].filter((e) => e.timestamp > cutoff).slice(-50);
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

  // Async sync user to Cloudinary distributed store for multi-container discovery
  try {
    const { passwordHash: _, ...safeSnapshot } = newUser;
    const fd = new FormData();
    const b = new Blob([JSON.stringify(safeSnapshot)], { type: 'application/json' });
    fd.append('file', b, `${lowerUser}.json`);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('public_id', `instachat_user_${lowerUser}`);

    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
      method: 'POST',
      body: fd,
    }).catch(() => {});
  } catch (_) {}

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

app.get('/api/friends/search', async (req, res) => {
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

  // Cross-container sync fallback via Cloudinary
  if (matched.length === 0) {
    try {
      const cloudRes = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/instachat_user_${queryClean}.json?t=${Date.now()}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (cloudRes.ok) {
        const u = await cloudRes.json();
        if (u && u.userId && u.userId !== currentUserId) {
          db.users[u.userId] = u;
          db.usernames[u.usernameLower] = u.userId;
          saveDb();
          const { passwordHash, ...safeUser } = u;
          matched.push(safeUser);
        }
      }
    } catch (_) {}
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

    if (friendId) {
      const fu = db.users[friendId] || {
        userId: friendId,
        username: fsItem.userA === friendId ? (fsItem.usernameA || 'Friend') : (fsItem.usernameB || 'Friend'),
        profileImageUrl: null,
        online: false,
        lastActive: Date.now(),
      };
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

  let sId = reqDoc?.senderId;
  let rId = reqDoc?.receiverId;

  if (!sId || !rId) {
    if (requestId && typeof requestId === 'string') {
      const idx = requestId.indexOf('_usr_', 4);
      if (idx !== -1) {
        sId = requestId.substring(0, idx);
        rId = requestId.substring(idx + 1);
      }
    }
  }

  if (!sId || !rId) {
    return res.status(400).json({ error: 'Invalid requestId' });
  }

  if (reqDoc) {
    reqDoc.status = 'ACCEPTED';
  } else {
    db.friendRequests[requestId] = {
      requestId,
      senderId: sId,
      receiverId: rId,
      status: 'ACCEPTED',
      createdAt: Date.now(),
    };
  }

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
/*                   REALTIME SIGNALING & EVENT RELAY ROUTES                 */
/* ========================================================================= */

// 1. Send signaling event (WebRTC, chat typing, games, custom events)
app.post('/api/signaling/send', (req, res) => {
  const { event, targetUserId, data } = req.body;
  if (!event || !targetUserId) {
    return res.status(400).json({ error: 'event and targetUserId are required' });
  }

  // Handle active call state
  if (event === 'webrtc:call-offer' && data?.callId) {
    db.activeCalls[data.callId] = {
      ...data,
      status: 'RINGING',
      createdAt: Date.now(),
    };
  } else if (event === 'webrtc:call-answer' && data?.callId) {
    if (db.activeCalls[data.callId]) {
      db.activeCalls[data.callId].status = 'CONNECTED';
      db.activeCalls[data.callId].answerSdp = data.answerSdp;
    }
  } else if (event === 'webrtc:call-hangup' && data?.callId) {
    if (db.activeCalls[data.callId]) {
      db.activeCalls[data.callId].status = 'ENDED';
      delete db.activeCalls[data.callId];
    }
  } else if (event === 'chat:typing' && data?.conversationId) {
    db.typing[data.conversationId] = {
      userId: data.userId,
      username: data.username,
      isTyping: !!data.isTyping,
      timestamp: Date.now(),
    };
  }

  emitToUser(targetUserId, event, data);
  if (event === 'webrtc:call-offer') {
    emitToUser(targetUserId, 'webrtc:incoming-call', data);
  } else if (event === 'webrtc:call-answer') {
    emitToUser(targetUserId, 'webrtc:call-answered', data);
  } else if (event === 'webrtc:call-hangup') {
    emitToUser(targetUserId, 'webrtc:call-end', data);
  } else if (event === 'game:invite' || event === 'game:invite-send') {
    const inviteId = data.invitationId || data.inviteId;
    const receiverId = targetUserId || data.receiverId || data.receiverUser?.userId;
    const senderUsername = data.senderUsername || data.senderUser?.username;
    const normalized = {
      ...data,
      invitationId: inviteId,
      inviteId,
      receiverId,
      senderUsername,
      status: 'PENDING',
    };
    if (inviteId) {
      db.gameInvites[inviteId] = normalized;
    }
    emitToUser(receiverId, 'game:invitation-received', normalized);
    emitToUser(receiverId, 'game:invite-received', normalized);
  } else if (event === 'game:accept') {
    const id = data.invitationId || data.inviteId;
    const invite = db.gameInvites[id];
    if (invite) {
      invite.status = 'ACCEPTED';
    }
    const rId = data.roomId || invite?.roomId;
    if (rId && db.gameRooms[rId]) {
      db.gameRooms[rId].status = 'IN_PROGRESS';
      emitToUser(db.gameRooms[rId].player1Id, 'game:room-updated', db.gameRooms[rId]);
      emitToUser(db.gameRooms[rId].player2Id, 'game:room-updated', db.gameRooms[rId]);
    }
    const sId = invite?.senderId || data.senderId;
    if (sId) {
      emitToUser(sId, 'game:invite-status', { inviteId: id, status: 'ACCEPTED', roomId: rId, user: data.user });
    }
  } else if (event === 'game:move' && data?.roomId) {
    let room = db.gameRooms[data.roomId];
    if (!room) {
      db.gameRooms[data.roomId] = { roomId: data.roomId, boardState: Array(9).fill(''), status: 'IN_PROGRESS', ...data.updateData };
      room = db.gameRooms[data.roomId];
    } else if (data.updateData) {
      Object.assign(room, data.updateData, { updatedAt: Date.now() });
    }
    if (room.player1Id) emitToUser(room.player1Id, 'game:room-updated', room);
    if (room.player2Id) emitToUser(room.player2Id, 'game:room-updated', room);
  }

  saveDb();
  res.json({ success: true });
});

// 2. Poll for pending events (WebRTC, call offers, typing, friend events)
app.get('/api/signaling/poll/:userId', (req, res) => {
  const { userId } = req.params;
  const cutoff = Date.now() - 60000;

  let events = [];
  if (db.pendingEvents && db.pendingEvents[userId]) {
    events = db.pendingEvents[userId].filter((e) => e.timestamp > cutoff);
    db.pendingEvents[userId] = [];
    if (events.length > 0) {
      saveDb();
    }
  }

  // Check for active ringing incoming call targeting this user
  for (const call of Object.values(db.activeCalls || {})) {
    if (call.receiverId === userId && call.status === 'RINGING' && (Date.now() - call.createdAt < 35000)) {
      if (!events.some((e) => e.event === 'webrtc:incoming-call' && e.data?.callId === call.callId)) {
        events.unshift({
          id: `ev_call_${call.callId}`,
          event: 'webrtc:incoming-call',
          data: call,
          timestamp: call.createdAt,
        });
      }
    }
  }

  res.json({ events });
});

// 3. Presence heartbeat
app.post('/api/presence/heartbeat', (req, res) => {
  const { userId } = req.body;
  if (userId && db.users[userId]) {
    db.users[userId].online = true;
    db.users[userId].lastActive = Date.now();
    saveDb();
  }
  res.json({ success: true, timestamp: Date.now() });
});

// 4. Online presence status for friends/all users
app.get('/api/presence/status', (req, res) => {
  const now = Date.now();
  const onlineUserIds = [];
  for (const user of Object.values(db.users || {})) {
    if (user.online && (now - (user.lastActive || 0) < 30000)) {
      onlineUserIds.push(user.userId);
    } else if (user.online && (now - (user.lastActive || 0) >= 30000)) {
      user.online = false;
    }
  }
  res.json({ onlineUserIds });
});

// 5. Typing indicator endpoints
app.post('/api/chat/typing', (req, res) => {
  const { conversationId, userId, username, receiverId, isTyping } = req.body;
  if (conversationId) {
    db.typing[conversationId] = {
      userId,
      username,
      isTyping: !!isTyping,
      timestamp: Date.now(),
    };
  }
  if (receiverId) {
    emitToUser(receiverId, 'chat:typing', { conversationId, userId, username, isTyping });
  }
  res.json({ success: true });
});

app.get('/api/chat/typing/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const item = db.typing[conversationId];
  if (item && item.isTyping && (Date.now() - item.timestamp < 3500)) {
    res.json({ isTyping: true, username: item.username, userId: item.userId });
  } else {
    res.json({ isTyping: false });
  }
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

app.post('/api/games/invitations/send', (req, res) => {
  const inviteData = req.body;
  const { inviteId, receiverId } = inviteData;
  if (!inviteId || !receiverId) {
    return res.status(400).json({ error: 'inviteId and receiverId required' });
  }
  db.gameInvites[inviteId] = inviteData;
  saveDb();
  emitToUser(receiverId, 'game:invitation-received', inviteData);
  emitToUser(receiverId, 'game:invite-received', inviteData);
  res.status(201).json({ invitation: inviteData });
});

app.post('/api/games/invitations/respond', (req, res) => {
  const { inviteId, status, roomId, responseData, senderId, receiverId } = req.body;
  const invite = db.gameInvites[inviteId];
  if (invite) {
    invite.status = status;
    saveDb();
    const sId = senderId || invite.senderId;
    const rId = receiverId || invite.receiverId;
    emitToUser(sId, 'game:invite-status', { inviteId, status, roomId, ...responseData });
    emitToUser(rId, 'game:invite-status', { inviteId, status, roomId, ...responseData });
  }

  const rId = roomId || invite?.roomId;
  if (rId && db.gameRooms[rId] && status === 'ACCEPTED') {
    db.gameRooms[rId].status = 'IN_PROGRESS';
    saveDb();
    emitToUser(db.gameRooms[rId].player1Id, 'game:room-updated', db.gameRooms[rId]);
    emitToUser(db.gameRooms[rId].player2Id, 'game:room-updated', db.gameRooms[rId]);
  }

  res.json({ success: true });
});

app.get('/api/games/rooms/:roomId', (req, res) => {
  const room = db.gameRooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ room });
});

app.post('/api/games/rooms/create', (req, res) => {
  const roomData = req.body;
  db.gameRooms[roomData.roomId] = roomData;
  saveDb();
  emitToUser(roomData.player1Id, 'game:room-created', roomData);
  emitToUser(roomData.player2Id, 'game:room-created', roomData);
  res.status(201).json({ room: roomData });
});

app.post('/api/games/rooms/:roomId/move', (req, res) => {
  const { roomId } = req.params;
  const { updateData } = req.body;
  const room = db.gameRooms[roomId];
  if (room) {
    Object.assign(room, updateData, { updatedAt: Date.now() });
    saveDb();
    emitToUser(room.player1Id, 'game:room-updated', room);
    emitToUser(room.player2Id, 'game:room-updated', room);
    return res.json({ success: true, room });
  }
  res.status(404).json({ error: 'Room not found' });
});

app.post('/api/games/rooms/:roomId/rematch', (req, res) => {
  const { roomId } = req.params;
  const { playerId } = req.body;
  const room = db.gameRooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

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
  res.json({ success: true, room });
});
