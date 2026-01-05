import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { authService } from '../services/api';
import { GoogleSignin as RNGoogleSignin } from '@react-native-google-signin/google-signin';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Check if user is authenticated on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in to Firebase
        try {
          // Check if we have user data stored locally
          const storedUser = await AsyncStorage.getItem('user');
          const storedToken = await SecureStore.getItemAsync('auth_token');
          const loginTimestamp = await SecureStore.getItemAsync('login_timestamp');
          
          // Check if login has expired (3 months = 90 days)
          if (loginTimestamp) {
            const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000;
            const currentTime = Date.now();
            const loginTime = parseInt(loginTimestamp, 10);
            
            if ((currentTime - loginTime) > threeMonthsInMs) {
              console.log('Login session expired (3 months), signing out');
              await clearStoredData();
              await auth.signOut();
              setUser(null);
              setIsAuthenticated(false);
              setIsLoading(false);
              return;
            }
          }
          
          // Get Firebase token (without forcing refresh to avoid clock skew)
          // Only force refresh if we don't have a stored token
          const shouldForceRefresh = !storedToken;
          const freshToken = await firebaseUser.getIdToken(shouldForceRefresh);
          
          if (storedUser && storedToken) {
            // We have stored data, only update token if we forced a refresh
            if (shouldForceRefresh) {
              await SecureStore.setItemAsync('auth_token', freshToken);
              console.log('Auth token refreshed from Firebase');
            }
            
            // Use stored data
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else if (storedUser) {
            // We have user but no token, set the fresh token
            await SecureStore.setItemAsync('auth_token', freshToken);
            if (!loginTimestamp) {
              await SecureStore.setItemAsync('login_timestamp', Date.now().toString());
            }
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            // No stored user, get fresh data from backend
            // The fresh token is already available for API calls
            await SecureStore.setItemAsync('auth_token', freshToken);
            if (!loginTimestamp) {
              await SecureStore.setItemAsync('login_timestamp', Date.now().toString());
            }
            
            const result = await authService.getCurrentUser();
            if (result) {
              setUser(result);
              setIsAuthenticated(true);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        // User is signed out
        setUser(null);
        setIsAuthenticated(false);
        await clearStoredData();
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const checkAuthState = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const loginTimestamp = await SecureStore.getItemAsync('login_timestamp');
      
      // Check if login has expired (3 months = 90 days)
      if (loginTimestamp) {
        const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000;
        const currentTime = Date.now();
        const loginTime = parseInt(loginTimestamp, 10);
        
        if ((currentTime - loginTime) > threeMonthsInMs) {
          console.log('Login session expired (3 months), clearing data');
          await clearStoredData();
          setIsLoading(false);
          return;
        }
      }
      
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearStoredData = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('login_timestamp');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Error clearing stored data:', error);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return result;
      } else {
        return result;
      }
    } catch (error) {
      console.error('Login error in context:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const result = await authService.register(userData);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return result;
      } else {
        return result;
      }
    } catch (error) {
      console.error('Registration error in context:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async (idToken, confirmRegistration = false) => {
    try {
      setIsLoading(true);
      const result = await authService.googleSignIn(idToken, confirmRegistration);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return result;
      } else {
        return result;
      }
    } catch (error) {
      console.error('Google sign-in error in context:', error);
      return {
        success: false,
        error: error.message || 'Google sign-in failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Sign out from Google Sign-in to clear the cached account
      try {
        await RNGoogleSignin.signOut();
        console.log('Signed out from Google Sign-in');
      } catch (googleError) {
        console.warn('Google Sign-out warning:', googleError);
        // Don't throw - continue with logout even if Google sign-out fails
      }
      
      // Sign out from backend/Firebase
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Logout error in context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserData = (userData) => {
    setUser(userData);
    AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const refreshUserData = async () => {
    try {
      const result = await authService.getCurrentUser();
      if (result) {
        setUser(result);
        await AsyncStorage.setItem('user', JSON.stringify(result));
        return result;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    firebaseUser,
    login,
    register,
    googleSignIn,
    logout,
    updateUserData,
    refreshUserData,
    setIsLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
