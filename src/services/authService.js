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

  // 1. Create Firebase Auth user first so request is authenticated (required by firestore.rules)
  const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  const user = userCredential.user;

  // 2. Check username uniqueness with authenticated session
  const q = query(
    collection(db, 'users'),
    where('usernameLower', '==', trimmedUser.toLowerCase())
  );
  const snap = await getDocs(q);
  if (!snap.empty && snap.docs.some(d => d.id !== user.uid)) {
    // Delete newly created auth user since username is taken
    try {
      await user.delete();
    } catch (_) {}
    throw new Error(`Username "${trimmedUser}" is already taken. Please choose another.`);
  }

  // 3. Set Auth display name
  await updateProfile(user, { displayName: trimmedUser });

  // Create Firestore User Document matching Android / Backend schema
  const userDoc = {
    userId: user.uid,
    username: trimmedUser,
    usernameLower: trimmedUser.toLowerCase(),
    email: trimmedEmail,
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
    lastActive: Date.now(),
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', user.uid), userDoc);
  return { ...userDoc, authUser: user };
}

/**
 * Log in existing user
 */
export async function logIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Set presence to online
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      online: true,
      lastActive: Date.now(),
    });
  } catch (_) {}

  const userDocSnap = await getDoc(doc(db, 'users', user.uid));
  const userData = userDocSnap.exists() ? userDocSnap.data() : { userId: user.uid, email: user.email };
  return { ...userData, authUser: user };
}

/**
 * Log out user and set offline
 */
export async function logOut() {
  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        online: false,
        lastActive: Date.now(),
      });
    } catch (_) {}
  }
  await signOut(auth);
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, {
    ...updates,
    lastActive: Date.now(),
  });
}

/**
 * Set user online/offline status
 */
export async function updatePresence(userId, isOnline) {
  if (!userId) return;
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, {
      online: isOnline,
      lastActive: Date.now(),
    });
  } catch (err) {
    console.debug('Failed to update presence:', err.message);
  }
}
