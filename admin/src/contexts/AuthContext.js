import React, { createContext, useState, useEffect, useContext } from 'react';
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

  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);

      if (user) {
        try {
          // Get user details from backend
          const response = await axios.post(`${API_URL}/auth/get-user`, {
            uid: user.uid
          });

          const userData = response.data.data;

          // Check if user has admin role
          if (userData.role !== 'admin') {
            await signOut(auth);
            setError('Access denied. Admin privileges required.');
            setCurrentUser(null);
            setUserDetails(null);
          } else {
            setCurrentUser(user);
            setUserDetails(userData);
          }
        } catch (err) {
          console.error('Error fetching user details:', err);
          setError('Failed to verify admin status');
          await signOut(auth);
          setCurrentUser(null);
          setUserDetails(null);
        }
      } else {
        setCurrentUser(null);
        setUserDetails(null);
      }
      setLoading(false);
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
      await signOut(auth);
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
    isAdmin: userDetails?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
