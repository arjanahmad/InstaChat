import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  signUp as authSignUp,
  logIn as authLogIn,
  logOut as authLogOut,
  resetPassword as authResetPassword,
  updateUserProfile as authUpdateProfile,
  updatePresence,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let userDocUnsub = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Subscribe to user Firestore doc for live updates (stats, coins, etc.)
        userDocUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({
              ...docSnap.data(),
              uid: firebaseUser.uid,
              email: firebaseUser.email,
            });
            // Update presence once user document exists
            updatePresence(firebaseUser.uid, true);
          } else {
            setCurrentUser({
              userId: firebaseUser.uid,
              uid: firebaseUser.uid,
              username: firebaseUser.displayName || 'User',
              email: firebaseUser.email,
            });
          }
          setLoading(false);
        }, (err) => {
          console.warn('User doc snapshot error:', err);
          setCurrentUser({
            userId: firebaseUser.uid,
            uid: firebaseUser.uid,
            username: firebaseUser.displayName || 'User',
            email: firebaseUser.email,
          });
          setLoading(false);
        });
      } else {
        if (userDocUnsub) userDocUnsub();
        setCurrentUser(null);
        setLoading(false);
      }
    });

    // Window presence events
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        updatePresence(auth.currentUser.uid, false);
      }
    };

    const handleVisibilityChange = () => {
      if (auth.currentUser) {
        updatePresence(auth.currentUser.uid, !document.hidden);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      authUnsub();
      if (userDocUnsub) userDocUnsub();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const res = await authLogIn(email, password);
      return res;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const signup = async (username, email, password) => {
    setAuthError(null);
    try {
      const res = await authSignUp(username, email, password);
      return res;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await authLogOut();
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
      await authUpdateProfile(currentUser.userId, updates);
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
