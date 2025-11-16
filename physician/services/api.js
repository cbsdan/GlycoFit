import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { 
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, isTokenExpired } from '../config/firebase-config';
import { API_URL } from '../config/constants';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      let token = await SecureStore.getItemAsync('auth_token');
      
      // Check if token exists and is not expired
      if (token && !isTokenExpired(token)) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else if (token && isTokenExpired(token) && auth?.currentUser) {
        // If token is expired but user is logged in, refresh it
        try {
          const newToken = await auth.currentUser.getIdToken(true);
          await SecureStore.setItemAsync('auth_token', newToken);
          config.headers['Authorization'] = `Bearer ${newToken}`;
        } catch (refreshError) {
          console.error("Failed to refresh token on request:", refreshError);
        }
      }
    } catch (error) {
      console.error("Error setting auth token in request:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear any potentially invalid tokens
      if (error.response?.data?.message?.includes('expired')) {
        await SecureStore.deleteItemAsync('auth_token');
      }
      
      // Only try to refresh if the user is actually logged in
      if (auth?.currentUser) {
        try {
          const newToken = await auth.currentUser.getIdToken(true);
          
          if (newToken) {
            await SecureStore.setItemAsync('auth_token', newToken);
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error("Error refreshing token on 401:", refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

const storeUserData = async (authToken, userData) => {
  await SecureStore.setItemAsync('auth_token', authToken);
  await AsyncStorage.setItem('user', JSON.stringify(userData));
};

export const authService = {
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      
      const response = await api.post('/auth/get-user', { uid: user.uid });
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Check if user has physician role
        if (userData.role !== 'physician') {
          // Sign out the user since they don't have physician access
          await auth.signOut();
          return {
            success: false,
            error: 'Access denied. This portal is for physicians only.',
          };
        }
        
        await storeUserData(idToken, userData);
        return {
          success: true,
          user: userData,
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to get user data',
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  logout: async () => {
    try {
      await auth.signOut();
      await SecureStore.deleteItemAsync('auth_token');
      await AsyncStorage.removeItem('user');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Failed to logout',
      };
    }
  },

  getCurrentUser: async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return null;
      }

      const idToken = await currentUser.getIdToken();
      const response = await api.post('/auth/get-user', { uid: currentUser.uid });
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Check if user has physician role
        if (userData.role !== 'physician') {
          // Sign out the user since they don't have physician access
          await auth.signOut();
          await SecureStore.deleteItemAsync('auth_token');
          await AsyncStorage.removeItem('user');
          return null;
        }
        
        await storeUserData(idToken, userData);
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  forgotPassword: async (email) => {
    try {
      // TODO: Implement forgot password functionality
      // This will use Firebase's sendPasswordResetEmail
      return {
        success: true,
        message: 'Password reset email sent',
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: 'Failed to send password reset email',
      };
    }
  },
};

export default api;
