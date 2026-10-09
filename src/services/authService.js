import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

const AUTH_STORAGE_KEY = 'instachat_user_session';
const TOKEN_STORAGE_KEY = 'instachat_token';

/**
 * Sign up a new user with username uniqueness check and default profile stats
 */
export async function signUp(username, email, password) {
  const trimmedUser = (username || '').trim();
  const trimmedEmail = (email || '').trim();

  if (trimmedUser.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
    throw new Error('Username can only contain letters, numbers, and underscores.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const normalizedUsername = trimmedUser.toLowerCase();

  // If Firebase is available, perform authoritative Firebase Auth & Firestore flow
  if (auth && db) {
    // 1. Pre-check username uniqueness in Firestore
    const qUnique = query(
      collection(db, 'users'),
      where('usernameLower', '==', normalizedUsername)
    );
    const snapUnique = await getDocs(qUnique);
    if (!snapUnique.empty) {
      throw new Error(`Username "${trimmedUser}" is already taken. Please choose another.`);
    }

    // 2. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const firebaseUser = userCredential.user;

    // 3. Set display name on Auth profile
    try {
      await updateProfile(firebaseUser, { displayName: trimmedUser });
    } catch (_) {}

    const uid = firebaseUser.uid;
    const now = Date.now();

    const userDoc = {
      userId: uid,
      uid,
      username: trimmedUser,
      normalizedUsername,
      usernameLower: normalizedUsername,
      displayName: trimmedUser,
      email: trimmedEmail,
      profileImageUrl: null,
      photoURL: null,
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

    // 4. Save to Firestore
    await setDoc(doc(db, 'users', uid), userDoc);

    // Save session locally
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userDoc));
    const token = await firebaseUser.getIdToken().catch(() => `token_${uid}`);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    // Optional sync to backend API in background for socket compatibility
    try {
      api.post('/api/auth/signup', {
        username: trimmedUser,
        email: trimmedEmail,
        password,
        userId: uid,
      }).catch(() => {});
    } catch (_) {}

    realtimeSocket.init(uid);
    return userDoc;
  }

  // Fallback: Backend REST API
  const res = await api.post('/api/auth/signup', {
    username: trimmedUser,
    email: trimmedEmail,
    password,
  });

  if (res.user && res.token) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    realtimeSocket.init(res.user.userId);
  }

  return res.user;
}

/**
 * Log in existing user by email or username
 */
export async function logIn(emailOrUsername, password) {
  const trimmed = (emailOrUsername || '').trim();

  if (!trimmed) {
    throw new Error('Please enter your email or username.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  if (auth && db) {
    let emailToUse = trimmed;

    // If login input is username (no @), look up email in Firestore
    if (!trimmed.includes('@')) {
      const q = query(
        collection(db, 'users'),
        where('usernameLower', '==', trimmed.toLowerCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('User not found. Please check your username or register.');
      }
      emailToUse = snap.docs[0].data().email;
    }

    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const uid = cred.user.uid;

    // Update presence
    try {
      await updateDoc(doc(db, 'users', uid), {
        online: true,
        lastActive: Date.now(),
      });
    } catch (_) {}

    // Fetch user profile from Firestore
    const userDocSnap = await getDoc(doc(db, 'users', uid));
    const userData = userDocSnap.exists()
      ? userDocSnap.data()
      : {
          userId: uid,
          uid,
          username: cred.user.displayName || trimmed,
          email: cred.user.email,
          createdAt: Date.now(),
        };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    const token = await cred.user.getIdToken().catch(() => `token_${uid}`);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    // Sync to backend in background
    try {
      api.post('/api/auth/login', { email: emailToUse, password }).catch(() => {});
    } catch (_) {}

    realtimeSocket.init(uid);
    return userData;
  }

  // Fallback: Backend REST API
  const res = await api.post('/api/auth/login', {
    email: trimmed,
    password,
  });

  if (res.user && res.token) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    realtimeSocket.init(res.user.userId);
  }

  return res.user;
}

/**
 * Log out user
 */
export async function logOut() {
  const session = getStoredUser();
  const uid = session?.userId || session?.uid;

  if (auth && db && uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        online: false,
        lastActive: Date.now(),
      });
    } catch (_) {}
    try {
      await signOut(auth);
    } catch (_) {}
  }

  if (uid) {
    try {
      await api.post('/api/auth/logout', { userId: uid });
    } catch (_) {}
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  realtimeSocket.disconnect();
}

/**
 * Restore stored user session
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Refresh user profile from backend / Firestore
 */
export async function refreshUserProfile(userId) {
  if (!userId) return null;

  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.debug('Failed to refresh Firestore profile:', err);
    }
  }

  try {
    const res = await api.get(`/api/auth/me/${userId}`);
    if (res.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
      return res.user;
    }
  } catch (err) {
    console.debug('Failed to refresh profile:', err);
  }

  return getStoredUser();
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  if (db && userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        lastActive: Date.now(),
      });
    } catch (err) {
      console.debug('Failed to update Firestore profile:', err);
    }
  }

  try {
    const res = await api.post('/api/auth/update-profile', {
      userId,
      updates,
    });
    if (res.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
      return res.user;
    }
  } catch (_) {}

  const current = getStoredUser();
  const updated = { ...current, ...updates };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Set user online/offline status
 */
export function updatePresence(userId, isOnline) {
  if (!userId) return;

  if (db) {
    updateDoc(doc(db, 'users', userId), {
      online: isOnline,
      lastActive: Date.now(),
    }).catch(() => {});
  }

  if (isOnline) {
    realtimeSocket.init(userId);
  }
}

/**
 * Password reset
 */
export async function resetPassword(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    throw new Error('Please enter your email address.');
  }

  if (auth) {
    await sendPasswordResetEmail(auth, trimmed);
    return true;
  }

  return true;
}
