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
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  logout: async () => {
    try {
      // Delete FCM token from backend before signing out
      try {
        await api.delete('/physician/fcm-token');
        console.log('FCM token deleted from backend');
      } catch (fcmError) {
        console.log('Warning: Failed to delete FCM token:', fcmError);
        // Continue with logout even if FCM deletion fails
      }
      
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

// ============================================
// PHYSICIAN PROFILE API
// ============================================
export const physicianAPI = {
  getProfile: async () => {
    try {
      const response = await api.get('/physician/profile');
      return response.data;
    } catch (error) {
      console.error('Get physician profile error:', error);
      throw error;
    }
  },

  updateProfile: async (data) => {
    try {
      const response = await api.put('/physician/profile', data);
      return response.data;
    } catch (error) {
      console.error('Update physician profile error:', error);
      throw error;
    }
  },

  updateAvailability: async (data) => {
    try {
      const response = await api.put('/physician/availability', data);
      return response.data;
    } catch (error) {
      console.error('Update availability error:', error);
      throw error;
    }
  },

  getStats: async () => {
    try {
      const response = await api.get('/physician/stats');
      return response.data;
    } catch (error) {
      console.error('Get physician stats error:', error);
      throw error;
    }
  },

  uploadProfilePicture: async (imageUri) => {
    try {
      const formData = new FormData();
      
      // Extract filename from URI
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
      });

      const response = await api.post('/physician/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Upload profile picture error:', error);
      throw error;
    }
  },

  saveFCMToken: async (fcmToken) => {
    try {
      const response = await api.post('/physician/fcm-token', { fcmToken });
      console.log('FCM token saved to backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error saving FCM token:', error.response?.data || error.message);
      throw error;
    }
  },

  deleteFCMToken: async (fcmToken) => {
    try {
      const response = await api.delete('/physician/fcm-token', {
        data: { fcmToken }
      });
      console.log('FCM token deleted from backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error deleting FCM token:', error.response?.data || error.message);
      throw error;
    }
  },
};

// ============================================
// PATIENT MANAGEMENT API
// ============================================
export const patientAPI = {
  getRequests: async (urgency) => {
    try {
      const params = urgency ? { urgency } : {};
      const response = await api.get('/physician/patients/requests', { params });
      return response.data;
    } catch (error) {
      console.error('Get patient requests error:', error);
      throw error;
    }
  },

  acceptRequest: async (requestId) => {
    try {
      const response = await api.post(`/physician/patients/requests/${requestId}/accept`, {});
      return response.data;
    } catch (error) {
      console.error('Accept patient request error:', error);
      throw error;
    }
  },

  declineRequest: async (requestId, reason) => {
    try {
      const response = await api.post(`/physician/patients/requests/${requestId}/decline`, { reason });
      return response.data;
    } catch (error) {
      console.error('Decline patient request error:', error);
      throw error;
    }
  },

  getPatients: async (search) => {
    try {
      const params = search ? { search } : {};
      const response = await api.get('/physician/patients', { params });
      return response.data;
    } catch (error) {
      console.error('Get patients error:', error);
      throw error;
    }
  },

  getPatientDetails: async (patientId) => {
    try {
      const response = await api.get(`/physician/patients/${patientId}`);
      return response.data;
    } catch (error) {
      console.error('Get patient details error:', error);
      throw error;
    }
  },
};

// ============================================
// CONSULTATION API
// ============================================
export const consultationAPI = {
  create: async (data) => {
    try {
      const response = await api.post('/physician/consultations', data);
      return response.data;
    } catch (error) {
      console.error('Create consultation error:', error);
      throw error;
    }
  },

  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/physician/consultations', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Get consultations error:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/physician/consultations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get consultation error:', error);
      throw error;
    }
  },

  start: async (id) => {
    try {
      const response = await api.post(`/physician/consultations/${id}/start`);
      return response.data;
    } catch (error) {
      console.error('Start consultation error:', error);
      throw error;
    }
  },

  complete: async (id, data) => {
    try {
      const response = await api.post(`/physician/consultations/${id}/complete`, data);
      return response.data;
    } catch (error) {
      console.error('Complete consultation error:', error);
      throw error;
    }
  },

  cancel: async (id, reason) => {
    try {
      const response = await api.post(`/physician/consultations/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Cancel consultation error:', error);
      throw error;
    }
  },

  reschedule: async (id, data) => {
    try {
      const response = await api.post(`/physician/consultations/${id}/reschedule`, data);
      return response.data;
    } catch (error) {
      console.error('Reschedule consultation error:', error);
      throw error;
    }
  },
};

// ============================================
// PRESCRIPTION API
// ============================================
export const prescriptionAPI = {
  create: async (data) => {
    try {
      const response = await api.post('/physician/prescriptions', data);
      return response.data;
    } catch (error) {
      console.error('Create prescription error:', error);
      throw error;
    }
  },

  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/physician/prescriptions', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Get prescriptions error:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/physician/prescriptions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get prescription error:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/physician/prescriptions/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Update prescription error:', error);
      throw error;
    }
  },

  refill: async (id) => {
    try {
      const response = await api.post(`/physician/prescriptions/${id}/refill`);
      return response.data;
    } catch (error) {
      console.error('Refill prescription error:', error);
      throw error;
    }
  },

  cancel: async (id, reason) => {
    try {
      const response = await api.post(`/physician/prescriptions/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Cancel prescription error:', error);
      throw error;
    }
  },
};

// ============================================
// APPOINTMENT API
// ============================================
export const appointmentAPI = {
  create: async (data) => {
    try {
      const response = await api.post('/physician/appointments', data);
      return response.data;
    } catch (error) {
      console.error('Create appointment error:', error);
      throw error;
    }
  },

  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/physician/appointments', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Get appointments error:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/physician/appointments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get appointment error:', error);
      throw error;
    }
  },

  confirm: async (id) => {
    try {
      const response = await api.post(`/physician/appointments/${id}/confirm`);
      return response.data;
    } catch (error) {
      console.error('Confirm appointment error:', error);
      throw error;
    }
  },

  cancel: async (id, reason) => {
    try {
      const response = await api.post(`/physician/appointments/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Cancel appointment error:', error);
      throw error;
    }
  },

  reschedule: async (id, data) => {
    try {
      const response = await api.post(`/physician/appointments/${id}/reschedule`, data);
      return response.data;
    } catch (error) {
      console.error('Reschedule appointment error:', error);
      throw error;
    }
  },

  complete: async (id, data) => {
    try {
      const response = await api.post(`/physician/appointments/${id}/complete`, data);
      return response.data;
    } catch (error) {
      console.error('Complete appointment error:', error);
      throw error;
    }
  },
};

// ========== CHAT SERVICE ==========
export const chatService = {
  // Get or create a conversation
  getOrCreateConversation: async (patientId, physicianId, relationshipId) => {
    try {
      const response = await api.post('/chat/conversation', {
        patient_id: patientId,
        physician_id: physicianId,
        relationship_id: relationshipId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating/getting conversation:', error);
      throw error;
    }
  },

  // Get all conversations for the physician
  getConversations: async () => {
    try {
      const response = await api.get('/chat/conversations', {
        params: { role: 'physician' }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  },

  // Get messages for a conversation
  getMessages: async (conversationId, limit = 50, skip = 0) => {
    try {
      const response = await api.get(`/chat/conversation/${conversationId}/messages`, {
        params: { role: 'physician', limit, skip }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  },

  // Send a message (HTTP fallback)
  sendMessage: async (conversationId, content, messageType = 'text') => {
    try {
      const response = await api.post('/chat/message', {
        conversation_id: conversationId,
        content,
        sender_role: 'physician',
        message_type: messageType
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Mark messages as read
  markMessagesAsRead: async (conversationId) => {
    try {
      const response = await api.put(`/chat/conversation/${conversationId}/read`, null, {
        params: { role: 'physician' }
      });
      return response.data;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Send image message
  sendImageMessage: async (conversationId, imageUri) => {
    try {
      const formData = new FormData();
      formData.append('conversation_id', conversationId);
      formData.append('sender_role', 'physician');
      formData.append('message_type', 'image');
      
      // Get filename from URI
      const filename = imageUri.split('/').pop();
      
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename || 'image.jpg',
      });

      const response = await api.post('/chat/message/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error sending image message:', error);
      throw error;
    }
  },
};

// export const availabilityService = {
//   create: async (data) => {
//     try {
//       const response = await api.post('/physician/availability-schedule', data);
//       return response.data;
//     } catch (error) {
//       console.error('Create availability error:', error);
//       throw error;
//     }
//   },

//   getAll: async (params) => {
//     try {
//       const response = await api.get('/physician/availability-schedule', { params });
//       return response.data;
//     } catch (error) {
//       console.error('Get availability error:', error);
//       throw error;
//     }
//   },

//   update: async (id, data) => {
//     try {
//       const response = await api.put(`/physician/availability-schedule/${id}`, data);
//       return response.data;
//     } catch (error) {
//       console.error('Update availability error:', error);
//       throw error;
//     }
//   },

//   delete: async (id) => {
//     try {
//       const response = await api.delete(`/physician/availability-schedule/${id}`);
//       return response.data;
//     } catch (error) {
//       console.error('Delete availability error:', error);
//       throw error;
//     }
//   },
// ========== FCM TOKEN MANAGEMENT ==========

const saveFCMToken = async (fcmToken) => {
  try {
    const response = await api.post('/physician/fcm-token', { fcmToken });
    console.log('FCM token saved to backend:', response.data);
    
    // Also store locally for logout purposes
    try {
      await SecureStore.setItemAsync('fcm_token', fcmToken);
    } catch (storageError) {
      console.warn('Failed to store FCM token locally:', storageError);
      // Don't throw - backend save is successful
    }
    
    return response.data;
  } catch (error) {
    console.error('Error saving FCM token:', error.response?.data || error.message);
    throw error;
  }
};

const deleteFCMToken = async (fcmToken = null) => {
  try {
    // If no token provided, retrieve from secure storage
    let tokenToDelete = fcmToken;
    if (!tokenToDelete) {
      try {
        tokenToDelete = await SecureStore.getItemAsync('fcm_token');
      } catch (error) {
        console.warn('Failed to retrieve FCM token from storage:', error);
      }
    }

    const response = await api.post('/physician/fcm-token/delete', { fcmToken: tokenToDelete });
    console.log('FCM token deleted from backend:', response.data);
    
    // Clear from local storage
    try {
      await SecureStore.deleteItemAsync('fcm_token');
    } catch (storageError) {
      console.warn('Failed to delete FCM token from storage:', storageError);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error deleting FCM token:', error.response?.data || error.message);
    throw error;
  }
};

// Add FCM functions to api object
api.saveFCMToken = saveFCMToken;
api.deleteFCMToken = deleteFCMToken;

export default api;
