import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { auth } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tokenCacheRef = useRef({ token: null, expiry: 0 });

  const API_URL = process.env.REACT_APP_API_URL;

  const CACHE_KEY = (uid) => `glycofit_admin_user_${uid}`;

  const cacheUserDetails = (uid, data) => {
    try {
      localStorage.setItem(CACHE_KEY(uid), JSON.stringify(data));
    } catch (_) {}
  };

  const getCachedUserDetails = (uid) => {
    try {
      const raw = localStorage.getItem(CACHE_KEY(uid));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const clearCachedUserDetails = (uid) => {
    try {
      if (uid) localStorage.removeItem(CACHE_KEY(uid));
    } catch (_) {}
  };

  // Returns a cached Firebase ID token, refreshing only when close to expiry.
  const getCachedToken = useCallback(async () => {
    if (!currentUser) return null;
    const now = Date.now();
    if (tokenCacheRef.current.token && tokenCacheRef.current.expiry > now + 60_000) {
      return tokenCacheRef.current.token;
    }
    const token = await currentUser.getIdToken();
    tokenCacheRef.current = { token, expiry: now + 55 * 60 * 1000 };
    return token;
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setError(null);

      if (user) {
        // Immediately restore session from localStorage so the UI is unblocked.
        const cached = getCachedUserDetails(user.uid);
        if (cached && cached.role === 'admin') {
          setCurrentUser(user);
          setUserDetails(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }

        // Background re-verification — refreshes cached data without blocking the UI.
        try {
          const response = await axios.post(`${API_URL}/auth/get-user`, { uid: user.uid });
          const userData = response.data.data;

          if (userData.role !== 'admin') {
            // Explicitly denied — sign out.
            clearCachedUserDetails(user.uid);
            await signOut(auth);
            setError('Access denied. Admin privileges required.');
            setCurrentUser(null);
            setUserDetails(null);
            setLoading(false);
          } else {
            cacheUserDetails(user.uid, userData);
            setCurrentUser(user);
            setUserDetails(userData);
            setLoading(false);
          }
        } catch (err) {
          console.error('Error fetching user details:', err);
          if (cached && cached.role === 'admin') {
            // Network/server failure — keep the session alive using cached data.
            // The backend middleware still validates every API request independently.
            setLoading(false);
          } else {
            // No cache and backend unreachable — can't confirm admin role.
            setError('Failed to verify admin status. Please try again.');
            await signOut(auth);
            setCurrentUser(null);
            setUserDetails(null);
            setLoading(false);
          }
        }
      } else {
        setCurrentUser(null);
        setUserDetails(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [API_URL]);

  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Get user details from backend
      const response = await axios.post(`${API_URL}/auth/get-user`, {
        uid: userCredential.user.uid
      });

      const userData = response.data.data;

      // Check if user has admin role
      if (userData.role !== 'admin') {
        await signOut(auth);
        throw new Error('Access denied. Admin privileges required.');
      }

      return userCredential.user;
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Invalid email format');
      } else if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Please try again later.');
      } else {
        throw new Error(err.message || 'Failed to login');
      }
    }
  };

  const logout = async () => {
    try {
      const uid = currentUser?.uid;
      await signOut(auth);
      clearCachedUserDetails(uid);
      setCurrentUser(null);
      setUserDetails(null);
    } catch (err) {
      console.error('Logout error:', err);
      throw new Error('Failed to logout');
    }
  };

  const value = {
    currentUser,
    userDetails,
    login,
    logout,
    loading,
    error,
    isAdmin: userDetails?.role === 'admin',
    getCachedToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
