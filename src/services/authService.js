import { api } from './api';
import { realtimeSocket } from './realtimeSocket';

const AUTH_STORAGE_KEY = 'instachat_user_session';
const TOKEN_STORAGE_KEY = 'instachat_token';

/**
 * Sign up a new user with username uniqueness check and default profile stats
 */
export async function signUp(username, email, password) {
  const trimmedUser = username.trim();
  const trimmedEmail = email.trim();

  if (trimmedUser.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

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
 * Log in existing user
 */
export async function logIn(email, password) {
  const trimmedEmail = email.trim();

  const res = await api.post('/api/auth/login', {
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
 * Log out user
 */
export async function logOut() {
  const session = getStoredUser();
  if (session?.userId) {
    try {
      await api.post('/api/auth/logout', { userId: session.userId });
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
 * Refresh user profile from backend
 */
export async function refreshUserProfile(userId) {
  if (!userId) return null;
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
  const res = await api.post('/api/auth/update-profile', {
    userId,
    updates,
  });

  if (res.user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
  }
  return res.user;
}

/**
 * Set user online/offline status
 */
export function updatePresence(userId, isOnline) {
  if (!userId) return;
  // Socket handles presence automatically upon connect/disconnect
  if (isOnline) {
    realtimeSocket.init(userId);
  }
}

/**
 * Password reset placeholder
 */
export async function resetPassword(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.');
  }
  // Local/Custom backend mock reset
  return true;
}
