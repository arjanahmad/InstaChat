import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  signUp as authSignUp,
  logIn as authLogIn,
  logOut as authLogOut,
  resetPassword as authResetPassword,
  updateUserProfile as authUpdateProfile,
  getStoredUser,
  refreshUserProfile,
  updatePresence,
} from '../services/authService';
import { realtimeSocket } from '../services/realtimeSocket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let unsubAuth = () => {};

    if (auth) {
      unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const fresh = await refreshUserProfile(firebaseUser.uid);
            if (fresh) {
              setCurrentUser(fresh);
              realtimeSocket.init(firebaseUser.uid);
            }
          } catch (_) {}
        } else {
          const stored = getStoredUser();
          if (stored?.userId) {
            setCurrentUser(stored);
            realtimeSocket.init(stored.userId);
          } else {
            setCurrentUser(null);
          }
        }
        setLoading(false);
      });
    } else {
      const stored = getStoredUser();
      if (stored?.userId) {
        realtimeSocket.init(stored.userId);
        refreshUserProfile(stored.userId).then((fresh) => {
          if (fresh) setCurrentUser(fresh);
        }).catch(() => {});
      }
      setLoading(false);
    }

    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.userId) return;

    const unsubProfile = realtimeSocket.on('user:profile-updated', (updatedUser) => {
      if (updatedUser?.userId === currentUser?.userId) {
        setCurrentUser(updatedUser);
      }
    });

    const handleBeforeUnload = () => {
      updatePresence(currentUser.userId, false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubProfile();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.userId]);

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const user = await authLogIn(email, password);
      setCurrentUser(user);
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const signup = async (username, email, password) => {
    setAuthError(null);
    try {
      const user = await authSignUp(username, email, password);
      setCurrentUser(user);
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await authLogOut();
      setCurrentUser(null);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const forgotPassword = async (email) => {
    setAuthError(null);
    try {
      await authResetPassword(email);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const updateProfileData = async (updates) => {
    if (!currentUser?.userId) return;
    try {
      const user = await authUpdateProfile(currentUser.userId, updates);
      setCurrentUser(user);
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    login,
    signup,
    logout,
    forgotPassword,
    updateProfileData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
