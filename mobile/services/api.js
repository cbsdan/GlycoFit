import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential 
} from "firebase/auth";
import { auth, isTokenExpired } from '../config/firebase-config';
import { API_URL } from '../config/constants';
import { GoogleSignin as RNGoogleSignin } from '@react-native-google-signin/google-signin';

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
  const loginTimestamp = Date.now();
  await SecureStore.setItemAsync('auth_token', authToken);
  await SecureStore.setItemAsync('login_timestamp', loginTimestamp.toString());
  await AsyncStorage.setItem('user', JSON.stringify(userData));
};

// Check if login has expired (3 months = 90 days)
const isLoginExpired = async () => {
  try {
    const loginTimestamp = await SecureStore.getItemAsync('login_timestamp');
    if (!loginTimestamp) {
      return true; // No timestamp means expired/not logged in
    }
    
    const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    const currentTime = Date.now();
    const loginTime = parseInt(loginTimestamp, 10);
    
    return (currentTime - loginTime) > threeMonthsInMs;
  } catch (error) {
    console.error('Error checking login expiration:', error);
    return true; // On error, treat as expired for security
  }
};

export const authService = {
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      
      const response = await api.post('/auth/get-user', { uid: user.uid });
      
      if (response.data.success) {
        await storeUserData(idToken, response.data.user);
        return {
          success: true,
          token: idToken,
          user: response.data.user
        };
      } else {
        throw new Error('User data not found');
      }
    } catch (error) {
      console.log("Login error:", error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed'
      };
    }
  },
  
  register: async (userData) => {
    try {
      const { email, password, firstName, lastName, avatar } = userData;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      
      const formData = new FormData();
      formData.append("uid", user.uid);
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      
      if (avatar) {
        if (typeof avatar === 'string') {
          const uriParts = avatar.split('.');
          const fileType = uriParts[uriParts.length - 1];
          
          formData.append("avatar", {
            uri: avatar,
            name: `avatar-${user.uid}.${fileType}`,
            type: `image/${fileType}`,
          });
        } else if (avatar.uri) {
          const uriParts = avatar.uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
          
          formData.append("avatar", {
            uri: avatar.uri,
            name: `avatar-${user.uid}.${fileType}`,
            type: `image/${fileType}`,
          });
        }
      }
      
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${idToken}`
        },
      };
      
      const response = await api.post('/auth/register', formData, config);
      
      if (response.data.success) {
        await storeUserData(idToken, response.data.user);
        return {
          success: true,
          user: response.data.user
        };
      } else {
        throw new Error('Registration failed on server');
      }
    } catch (error) {
      console.log("Registration error:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Registration failed'
      };
    }
  },
  
  googleSignIn: async (idToken, confirmRegistration = false) => {
    try {
      if (!idToken) {
        throw new Error("No token provided");
      }
      
      const credential = GoogleAuthProvider.credential(idToken);
      
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      const fbToken = await user.getIdToken();
      
      try {
        console.log("Fetching user data...");
        console.log("User ID:", user.uid);
        const response = await api.post('/auth/get-user', { uid: user.uid });
        console.log("Response: ", response.data);
        if (response.data.success && response.data.user) {
          await storeUserData(fbToken, response.data.user);
          return {
            success: true,
            token: fbToken,
            user: response.data.user
          };
        } else {
          // If user exists but success is false, handle accordingly
          throw new Error('Failed to retrieve user data');
        }
      } catch (backendError) {
        console.log("Backend error during Google sign-in:", backendError);
        
        // Check if the error is 404 (User not found) - then handle registration
        if (backendError.response?.status === 404 && 
            backendError.response?.data?.error === 'User not found') {
          
          // User not found - check if we should proceed with registration
          if (!confirmRegistration) {
            // Return a special status to prompt for confirmation
            return {
              success: false,
              needsRegistration: true,
              userInfo: {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
              },
              message: 'New user detected. Confirmation needed for registration.'
            };
          }
          
          // User confirmed, proceed with registration
          console.log("User confirmed registration, proceeding...");
          
          const displayName = user.displayName || '';
          const nameParts = displayName.split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(" ") || '';
          
          const formData = new FormData();
          formData.append("uid", user.uid);
          formData.append("email", user.email);
          formData.append("firstName", firstName);
          formData.append("lastName", lastName);
          
          if (user.photoURL) {
            formData.append("photoURL", user.photoURL);
          }
          
          const config = {
            headers: {
              "Content-Type": "multipart/form-data",
              "Authorization": `Bearer ${fbToken}`
            },
          };
          
          try {
            const registerResponse = await api.post('/auth/register', formData, config);
            
            if (registerResponse.data.success) {
              await storeUserData(fbToken, registerResponse.data.user);
              return {
                success: true,
                token: fbToken,
                user: registerResponse.data.user,
                isNewUser: true
              };
            } else {
              return {
                success: false,
                error: 'Failed to register Google user'
              };
            }
          } catch (registerError) {
            console.log("Registration error:", registerError);
            return {
              success: false,
              error: registerError.response?.data?.error || 'Failed to register Google user'
            };
          }
        } else {
          // For other backend errors, return the error
          return {
            success: false,
            error: backendError.response?.data?.error || backendError.message || 'Google sign-in failed'
          };
        }
      }
    } catch (error) {
      console.log("Google sign-in error:", error);
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        return {
          success: false,
          error: 'An account already exists with the same email address but different sign-in credentials'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Google sign-in failed'
      };
    }
  },
  
  logout: async () => {
    try {
      // Delete FCM token from backend before signing out
      try {
        await api.deleteFCMToken();
      } catch (fcmError) {
        console.log('Warning: Failed to delete FCM token:', fcmError);
        // Continue with logout even if FCM deletion fails
      }
      
      // Sign out from Google Sign-in to clear the cached account
      try {
        await RNGoogleSignin.signOut();
        console.log('Signed out from Google Sign-in');
      } catch (googleError) {
        console.warn('Google Sign-out warning:', googleError);
        // Don't throw - continue with logout even if Google sign-out fails
      }
      await auth.signOut();
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('login_timestamp');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.log("Logout error:", error);
      throw error;
    }
  },
  
  generateOTP: async (email) => {
    try {
      const response = await api.post('/auth/generate-otp', { email });
      return response.data;
    } catch (error) {
      console.error('Generate OTP error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to generate OTP'
      };
    }
  },
  
  verifyOTP: async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to verify OTP'
      };
    }
  },
  
  isAuthenticated: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const user = await AsyncStorage.getItem('user');
      const expired = await isLoginExpired();
      
      // If login has expired, clear stored data
      if (expired && token) {
        console.log('Login session expired (3 months), clearing data');
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('login_timestamp');
        await AsyncStorage.removeItem('user');
        return false;
      }
      
      return !!token && !!user && !expired;
    } catch (error) {
      console.log("Auth check error:", error);
      return false;
    }
  },
  
  getCurrentUser: async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.log("Get user error:", error);
      return null;
    }
  },
};

// Nutrient Prediction APIs (Using Gemini AI)
const predictNutrientsOnly = async (imageUri, note = '') => {
  try {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'food_image.jpg',
    });
    
    // Add optional note for food description
    if (note && note.trim()) {
      formData.append('note', note.trim());
    }

    const response = await api.post('/gemini/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 30 seconds timeout for Gemini AI processing
    });

    return response.data;
  } catch (error) {
    console.error('Error predicting nutrients with Gemini:', error);
    throw error;
  }
};

const saveMeal = async (nutrients, mealName, foodType, notes = '', tempImagePublicId, servingSize = null, confidenceRate = null, recipes = []) => {
  try{
    const data = {
      nutrients,
      meal_name: mealName,
      food_type: foodType,
      notes,
      temp_image_public_id: tempImagePublicId,
      serving_size: servingSize,
      confidence_rate: confidenceRate,
      recipes: recipes
    };

    const response = await api.post('/gemini/save-meal', data, {
      timeout: 30000, // 30 seconds timeout for image processing
    });

    return response.data;
  } catch (error) {
    console.error('Error saving meal:', error);
    throw error;
  }
};

// Meal Management APIs
const getUserMeals = async (limit = 50, offset = 0, startDate = null, endDate = null) => {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await api.get(`/users/meals?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user meals:', error);
    throw error;
  }
};

const getMealById = async (mealId) => {
  try {
    const response = await api.get(`/users/meals/${mealId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting meal by id:', error);
    throw error;
  }
};

const updateMeal = async (mealId, mealName = null, notes = null, foodType = null, nutrients = null, servingSize = null) => {
  try {
    const updateData = {};
    if (mealName !== null) updateData.meal_name = mealName;
    if (notes !== null) updateData.notes = notes;
    if (foodType !== null) updateData.food_type = foodType;
    if (nutrients !== null) updateData.nutrients = nutrients;
    if (servingSize !== null) updateData.serving_size = servingSize;

    const response = await api.put(`/users/meals/${mealId}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Error updating meal:', error);
    throw error;
  }
};

const deleteMeal = async (mealId) => {
  try {
    const response = await api.delete(`/users/meals/${mealId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting meal:', error);
    throw error;
  }
};

const getNutritionSummary = async (startDate = null, endDate = null) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    const url = `/users/nutrition-summary${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error getting nutrition summary:', error);
    throw error;
  }
};

// Activity Tracking API (placeholder - backend endpoint not yet implemented)
const saveDailyActivity = async (activityData) => {
  try {
    console.log('📊 Activity data to be saved:', activityData);
    
    // ✅ CORRECTED: Changed from '/users/activity' to '/activity/daily'
    const response = await api.post('/activity/daily', activityData);
    return response.data;
  } catch (error) {
    console.error('Error saving daily activity:', error);
    throw error;
  }
};
// Physician Management APIs for Patients
const getAvailablePhysicians = async () => {
  try {
    const response = await api.get('/users/physicians/available');
    return response.data;
  } catch (error) {
    console.error('Error getting available physicians:', error);
    throw error;
  }
};

const sendPhysicianRequest = async (physicianId, reason = '', urgency = 'low') => {
  try {
    const response = await api.post('/users/physicians/request', {
      physician_id: physicianId,
      reason,
      urgency
    });
    return response.data;
  } catch (error) {
    console.error('Error sending physician request:', error);
    throw error;
  }
};

const getMyPhysician = async () => {
  try {
    const response = await api.get('/users/physicians/my-physician');
    return response.data;
  } catch (error) {
    console.error('Error getting my physician:', error);
    throw error;
  }
};

const getPhysicianAvailableSlots = async (physicianId, startDate = null, endDate = null) => {
  try {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await api.get(`/users/physicians/${physicianId}/available-slots`, { params });
    return response.data;
  } catch (error) {
    console.error('Error getting physician available slots:', error);
    throw error;
  }
};

const cancelPhysicianRequest = async (requestId) => {
  try {
    const response = await api.post(`/users/physicians/requests/${requestId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling physician request:', error);
    throw error;
  }
};

const disconnectPhysician = async (relationshipId) => {
  try {
    const response = await api.post(`/users/physicians/relationship/${relationshipId}/disconnect`);
    return response.data;
  } catch (error) {
    console.error('Error disconnecting from physician:', error);
    throw error;
  }
};

// ==================== Appointments Management ====================

/**
 * Create a new appointment with physician
 * @param {string} physicianId - Physician ID
 * @param {string} appointmentDate - ISO date string
 * @param {string} appointmentType - Type of appointment
 * @param {number} durationMinutes - Duration in minutes
 * @param {string} reason - Reason for appointment
 * @param {string} notes - Additional notes
 * @returns {Promise<Object>} Created appointment
 */
export const createAppointment = async (physicianId, appointmentDate, appointmentType = 'Follow-up', durationMinutes = 30, reason = '', notes = '') => {
  try {
    const response = await api.post('/users/appointments', {
      physician_id: physicianId,
      appointment_date: appointmentDate,
      appointment_type: appointmentType,
      duration_minutes: durationMinutes,
      reason,
      notes
    });
    return response.data;
  } catch (error) {
    console.error('Error creating appointment:', error);
    throw error;
  }
};

/**
 * Get patient's appointments
 * @param {string} status - Filter by status (optional)
 * @param {string} physicianId - Filter by physician (optional)
 * @returns {Promise<Object>} List of appointments
 */
export const getAppointments = async (status = null, physicianId = null) => {
  try {
    const params = {};
    if (status) params.status = status;
    if (physicianId) params.physician_id = physicianId;
    
    const response = await api.get('/users/appointments', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting appointments:', error);
    throw error;
  }
};

/**
 * Get specific appointment
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} Appointment details
 */
export const getAppointment = async (appointmentId) => {
  try {
    const response = await api.get(`/users/appointments/${appointmentId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting appointment:', error);
    throw error;
  }
};

/**
 * Cancel an appointment
 * @param {string} appointmentId - Appointment ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Updated appointment
 */
export const cancelAppointment = async (appointmentId, reason = '') => {
  try {
    const response = await api.post(`/users/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
};

/**
 * Reschedule an appointment
 * @param {string} appointmentId - Appointment ID
 * @param {string} newDate - New ISO date string
 * @param {number} durationMinutes - New duration (optional)
 * @returns {Promise<Object>} Updated appointment
 */
export const rescheduleAppointment = async (appointmentId, newDate, durationMinutes = null) => {
  try {
    const payload = { appointment_date: newDate };
    if (durationMinutes) payload.duration_minutes = durationMinutes;
    
    const response = await api.post(`/users/appointments/${appointmentId}/reschedule`, payload);
    return response.data;
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    throw error;
  }
};

// ==================== Prescriptions Management ====================

/**
 * Get patient's prescriptions
 * @param {string} status - Filter by status (optional)
 * @param {string} physicianId - Filter by physician (optional)
 * @returns {Promise<Object>} List of prescriptions
 */
export const getPrescriptions = async (status = null, physicianId = null) => {
  try {
    const params = {};
    if (status) params.status = status;
    if (physicianId) params.physician_id = physicianId;
    
    const response = await api.get('/users/prescriptions', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting prescriptions:', error);
    throw error;
  }
};

/**
 * Get specific prescription
 * @param {string} prescriptionId - Prescription ID
 * @returns {Promise<Object>} Prescription details
 */
export const getPrescription = async (prescriptionId) => {
  try {
    const response = await api.get(`/users/prescriptions/${prescriptionId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting prescription:', error);
    throw error;
  }
};

/**
 * Request prescription refill
 * @param {string} prescriptionId - Prescription ID
 * @returns {Promise<Object>} Updated prescription
 */
export const requestPrescriptionRefill = async (prescriptionId) => {
  try {
    const response = await api.post(`/users/prescriptions/${prescriptionId}/refill`);
    return response.data;
  } catch (error) {
    console.error('Error requesting refill:', error);
    throw error;
  }
};

// ==================== Consultations Management ====================

/**
 * Create a new consultation request
 * @param {string} physicianId - Physician ID
 * @param {string} scheduledDate - ISO date string
 * @param {string} consultationType - video, chat, or in-person
 * @param {number} durationMinutes - Duration in minutes
 * @param {string} reason - Reason for consultation
 * @param {string} notes - Additional notes
 * @returns {Promise<Object>} Created consultation
 */
export const createConsultation = async (physicianId, scheduledDate, consultationType = 'video', durationMinutes = 30, reason = '', notes = '') => {
  try {
    const response = await api.post('/users/consultations', {
      physician_id: physicianId,
      scheduled_date: scheduledDate,
      consultation_type: consultationType,
      duration_minutes: durationMinutes,
      reason,
      notes
    });
    return response.data;
  } catch (error) {
    console.error('Error creating consultation:', error);
    throw error;
  }
};

/**
 * Get patient's consultations
 * @param {string} status - Filter by status (optional)
 * @param {string} physicianId - Filter by physician (optional)
 * @returns {Promise<Object>} List of consultations
 */
export const getConsultations = async (status = null, physicianId = null) => {
  try {
    const params = {};
    if (status) params.status = status;
    if (physicianId) params.physician_id = physicianId;
    
    const response = await api.get('/users/consultations', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting consultations:', error);
    throw error;
  }
};

/**
 * Get specific consultation
 * @param {string} consultationId - Consultation ID
 * @returns {Promise<Object>} Consultation details
 */
export const getConsultation = async (consultationId) => {
  try {
    const response = await api.get(`/users/consultations/${consultationId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting consultation:', error);
    throw error;
  }
};

/**
 * Cancel a consultation
 * @param {string} consultationId - Consultation ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Updated consultation
 */
export const cancelConsultation = async (consultationId, reason = '') => {
  try {
    const response = await api.post(`/users/consultations/${consultationId}/cancel`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error cancelling consultation:', error);
    throw error;
  }
};

/**
 * Reschedule a consultation
 * @param {string} consultationId - Consultation ID
 * @param {string} newDate - New ISO date string
 * @param {number} durationMinutes - New duration (optional)
 * @returns {Promise<Object>} Updated consultation
 */
export const rescheduleConsultation = async (consultationId, newDate, durationMinutes = null) => {
  try {
    const payload = { scheduled_date: newDate };
    if (durationMinutes) payload.duration_minutes = durationMinutes;
    
    const response = await api.post(`/users/consultations/${consultationId}/reschedule`, payload);
    return response.data;
  } catch (error) {
    console.error('Error rescheduling consultation:', error);
    throw error;
  }
};

/**
 * Rate a completed consultation
 * @param {string} consultationId - Consultation ID
 * @param {number} rating - Rating (1-5)
 * @param {string} feedback - Optional feedback
 * @returns {Promise<Object>} Updated consultation
 */
export const rateConsultation = async (consultationId, rating, feedback = '') => {
  try {
    const response = await api.post(`/users/consultations/${consultationId}/rate`, {
      rating,
      feedback
    });
    return response.data;
  } catch (error) {
    console.error('Error rating consultation:', error);
    throw error;
  }
};

// ==================== Health Data Sync ====================

/**
 * Sync health data to backend
 * @param {Array} healthDataArray - Array of health data records
 * @returns {Promise<Object>} Sync result with counts
 */
export const syncHealthData = async (healthDataArray) => {
  try {
    const response = await api.post('/health-data/sync', {
      data: healthDataArray
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing health data:', error);
    throw error;
  }
};

/**
 * Get latest sync timestamps for each data type
 * @returns {Promise<Object>} Latest sync timestamps
 */
export const getLatestSyncTimestamps = async () => {
  try {
    const response = await api.get('/health-data/latest-sync');
    return response.data;
  } catch (error) {
    console.error('Error getting latest sync timestamps:', error);
    throw error;
  }
};

/**
 * Get health data from backend
 * @param {string} dataType - Type of data (heart_rate, exercise, active_calories)
 * @param {number} limit - Number of records to retrieve (optional)
 * @returns {Promise<Object>} Health data records
 */
export const getHealthData = async (dataType, limit = 10) => {
  try {
    const params = { data_type: dataType, limit };
    const response = await api.get('/health-data/', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting health data:', error);
    throw error;
  }
};

/**
 * Get daily statistics for a data type
 * @param {string} dataType - Type of data (heart_rate, exercise, active_calories)
 * @param {string} date - ISO date string (optional, defaults to today)
 * @returns {Promise<Object>} Daily statistics
 */
export const getDailyStatistics = async (dataType, date = null) => {
  try {
    const params = { data_type: dataType };
    if (date) params.date = date;
    const response = await api.get('/health-data/statistics/daily', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting daily statistics:', error);
    throw error;
  }
};

/**
 * Get weekly statistics for a data type
 * @param {string} dataType - Type of data
 * @param {string} startDate - Start date of week (optional)
 * @returns {Promise<Object>} Weekly statistics
 */
export const getWeeklyStatistics = async (dataType, startDate = null) => {
  try {
    const params = { data_type: dataType };
    if (startDate) params.start_date = startDate;
    const response = await api.get('/health-data/statistics/weekly', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting weekly statistics:', error);
    throw error;
  }
};

/**
 * Get monthly statistics for a data type
 * @param {string} dataType - Type of data
 * @param {number} year - Year (optional)
 * @param {number} month - Month 1-12 (optional)
 * @returns {Promise<Object>} Monthly statistics
 */
export const getMonthlyStatistics = async (dataType, year = null, month = null) => {
  try {
    const params = { data_type: dataType };
    if (year) params.year = year;
    if (month) params.month = month;
    const response = await api.get('/health-data/statistics/monthly', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting monthly statistics:', error);
    throw error;
  }
};

/**
 * Get statistics summary for all data types
 * @param {string} period - Period type ('day', 'week', 'month')
 * @param {string} date - Date for the period (optional)
 * @returns {Promise<Object>} Statistics summary
 */
export const getStatisticsSummary = async (period = 'day', date = null) => {
  try {
    const params = { period };
    if (date) params.date = date;
    const response = await api.get('/health-data/statistics/summary', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting statistics summary:', error);
    throw error;
  }
};

// Diabetes Assessment API
export const submitDiabetesAssessment = async (answers) => {
  try {
    const response = await api.post('/diabetes-assessment/submit', { answers });
    return response.data;
  } catch (error) {
    console.error('Error submitting diabetes assessment:', error);
    throw error;
  }
};

export const getMyAssessment = async () => {
  try {
    const response = await api.get('/diabetes-assessment/my');
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null; // No assessment found
    }
    console.error('Error fetching diabetes assessment:', error);
    throw error;
  }
};

export const updateAssessmentAnswers = async (answers) => {
  try {
    const response = await api.put('/diabetes-assessment/update', { answers });
    return response.data;
  } catch (error) {
    console.error('Error updating diabetes assessment:', error);
    throw error;
  }
};

// ========== CHAT ENDPOINTS ==========

// Get or create a conversation
const getOrCreateConversation = async (patientId, physicianId, relationshipId) => {
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
};

// Get all conversations for the user
const getConversations = async (role = 'patient') => {
  try {
    const response = await api.get('/chat/conversations', {
      params: { role }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
};

// Get messages for a conversation
const getMessages = async (conversationId, role = 'patient', limit = 50, skip = 0) => {
  try {
    const response = await api.get(`/chat/conversation/${conversationId}/messages`, {
      params: { role, limit, skip }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

// Send a message (HTTP fallback)
const sendChatMessage = async (conversationId, content, senderRole = 'patient', messageType = 'text') => {
  try {
    const response = await api.post('/chat/message', {
      conversation_id: conversationId,
      content,
      sender_role: senderRole,
      message_type: messageType
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Mark messages as read
const markMessagesAsRead = async (conversationId, role = 'patient') => {
  try {
    const response = await api.put(`/chat/conversation/${conversationId}/read`, null, {
      params: { role }
    });
    return response.data;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Send image message
const sendImageMessage = async (conversationId, imageUri, senderRole = 'patient') => {
  try {
    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    formData.append('sender_role', senderRole);
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
};

// FCM Token Management
export const saveFCMToken = async (fcmToken) => {
  try {
    const response = await api.post('/users/fcm-token', { fcmToken });
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

export const deleteFCMToken = async (fcmToken = null) => {
  try {
    // If no token provided, retrieve from secure storage
    let tokenToDelete = fcmToken;
    if (!tokenToDelete) {
      try {
        tokenToDelete = await SecureStore.getItemAsync('fcm_token');
      } catch (error) {
        console.warn('Failed to retrieve FCM token from storage:', error);
        // Continue without token - backend will clear all tokens
      }
    }

    const response = await api.delete('/users/fcm-token', {
      data: { fcmToken: tokenToDelete },
      headers: {
        'Content-Type': 'application/json'
      }
    });
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

// Health Metrics Management
export const getHealthMetrics = async () => {
  try {
    const response = await api.get('/users/health-metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching health metrics:', error.response?.data || error.message);
    throw error;
  }
};

export const updateHealthMetrics = async (age, sex, height, weight, diagnosis_status = null) => {
  try {
    const payload = { age, sex, height, weight };
    if (diagnosis_status !== null) {
      payload.diagnosis_status = diagnosis_status;
    }
    const response = await api.put('/users/health-metrics', payload);
    return response.data;
  } catch (error) {
    console.error('Error updating health metrics:', error.response?.data || error.message);
    throw error;
  }
};

// Disclaimer Management
export const updateDisclaimerStatus = async (accepted) => {
  try {
    const response = await api.put('/users/disclaimer', { accepted });
    return response.data;
  } catch (error) {
    console.error('Error updating disclaimer status:', error.response?.data || error.message);
    throw error;
  }
};

// Profile Management APIs
export const getProfile = async () => {
  try {
    const response = await api.get('/users/profile');
    return response.data;
  } catch (error) {
    console.error('Error getting profile:', error.response?.data || error.message);
    throw error;
  }
};

export const updateProfile = async (profileData) => {
  try {
    const formData = new FormData();
    
    // Add basic fields
    if (profileData.first_name) formData.append('first_name', profileData.first_name);
    if (profileData.last_name) formData.append('last_name', profileData.last_name);
    if (profileData.age !== undefined) formData.append('age', profileData.age);
    if (profileData.sex) formData.append('sex', profileData.sex);
    if (profileData.height !== undefined) formData.append('height', profileData.height);
    if (profileData.weight !== undefined) formData.append('weight', profileData.weight);
    if (profileData.diagnosis_status) formData.append('diagnosis_status', profileData.diagnosis_status);
    
    // Handle avatar upload if provided
    if (profileData.avatar && profileData.avatar.uri) {
      const uriParts = profileData.avatar.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      formData.append('avatar', {
        uri: profileData.avatar.uri,
        name: `avatar.${fileType}`,
        type: `image/${fileType}`,
      });
    }
    
    const response = await api.put('/users/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error.response?.data || error.message);
    throw error;
  }
};

export const sendChatbotMessage = async (message) => {
  try {
    const response = await api.post('/chatbot/message', { message });
    return response.data;
  } catch (error) {
    console.error('Error sending chatbot message:', error);
    throw error;
  }
};

export const getChatbotHistory = async (skip = 0, limit = 20) => {
  try {
    const response = await api.get('/chatbot/history', {
      params: {
        skip: skip,
        limit: limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching chatbot history:', error);
    throw error;
  }
};

// ==================== Smoking Intake Management ====================

/**
 * Save smoking intake record
 * @param {Object} smokingData - Smoking intake data
 * @returns {Promise<Object>} Saved smoking record
 */
export const saveSmokingIntake = async (smokingData) => {
  try {
    const response = await api.post('/smoking-intake', smokingData);
    return response;
  } catch (error) {
    console.error('Error saving smoking intake:', error);
    throw error;
  }
};

/**
 * Get smoking intake history
 * @param {number} limit - Number of records to retrieve (optional)
 * @returns {Promise<Object>} List of smoking intake records
 */
export const getSmokingIntakeHistory = async (limit = 50) => {
  try {
    const response = await api.get('/smoking-intake/history', {
      params: { limit },
    });
    return response;
  } catch (error) {
    console.error('Error fetching smoking history:', error);
    throw error;
  }
};

/**
 * Get latest smoking intake record
 * @returns {Promise<Object>} Latest smoking intake record
 */
/**
 * Delete a smoking session
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<Object>} Delete response
 */
export const deleteSmokingSession = async (sessionId) => {
  try {
    const response = await api.delete(`/smoking-intake/session/${sessionId}`);
    return response;
  } catch (error) {
    console.error('Error deleting smoking session:', error);
    throw error;
  }
};

export const getLatestSmokingIntake = async () => {
  try {
    const response = await api.get('/smoking-intake/latest');
    return response;
  } catch (error) {
    console.error('Error fetching latest smoking intake:', error);
    throw error;
  }
};

// ==================== Alcohol Intake Management ====================

/**
 * Save or update alcohol intake record
 * @param {Object} alcoholData - Alcohol intake data
 * @returns {Promise<Object>} Saved alcohol intake record with risk assessment
 */
export const saveAlcoholIntake = async (alcoholData) => {
  try {
    const response = await api.post('/alcohol-intake/', alcoholData);
    return response.data;
  } catch (error) {
    console.error('Error saving alcohol intake:', error);
    throw error;
  }
};

/**
 * Get current alcohol intake record
 * @returns {Promise<Object>} Current alcohol intake record
 */
export const getAlcoholIntake = async () => {
  try {
    const response = await api.get('/alcohol-intake/');
    return response.data;
  } catch (error) {
    console.error('Error fetching alcohol intake:', error);
    throw error;
  }
};

/**
 * Get alcohol intake history
 * @returns {Promise<Object>} Current and historical alcohol intake data
 */
export const getAlcoholIntakeHistory = async () => {
  try {
    const response = await api.get('/alcohol-intake/history');
    return response.data;
  } catch (error) {
    console.error('Error fetching alcohol intake history:', error);
    throw error;
  }
};

/**
 * Get comprehensive risk assessment based on alcohol intake
 * @returns {Promise<Object>} Risk assessment with recommendations and trend analysis
 */
export const getAlcoholRiskAssessment = async () => {
  try {
    const response = await api.get('/alcohol-intake/risk-assessment');
    return response.data;
  } catch (error) {
    console.error('Error fetching alcohol risk assessment:', error);
    throw error;
  }
};

/**
 * Delete alcohol intake record
 * @returns {Promise<Object>} Delete confirmation
 */
export const deleteAlcoholIntake = async () => {
  try {
    const response = await api.delete('/alcohol-intake/');
    return response.data;
  } catch (error) {
    console.error('Error deleting alcohol intake:', error);
    throw error;
  }
};

// ==================== SLEEP TRACKING API ====================

/**
 * Create sleep baseline (required at onboarding, can only be done once)
 * @param {number} baselineAvgSleepHours - Average hours of sleep (0-24)
 * @param {number} baselineNights6hPlusPerWeek - Nights with 6+ hours (0-7)
 * @param {number} baselineBedtimeConsistency - Consistency rating (1-5)
 * @param {string} usualBedtime - Typical bedtime (HH:MM, optional)
 * @param {string} usualWakeTime - Typical wake time (HH:MM, optional)
 * @returns {Promise<Object>} Created baseline
 */
export const createSleepBaseline = async (
  baselineAvgSleepHours,
  baselineNights6hPlusPerWeek,
  baselineBedtimeConsistency,
  usualBedtime = null,
  usualWakeTime = null
) => {
  try {
    const payload = {
      baseline_avg_sleep_hours: baselineAvgSleepHours,
      baseline_nights_6h_plus_per_week: baselineNights6hPlusPerWeek,
      baseline_bedtime_consistency: baselineBedtimeConsistency,
    };
    if (usualBedtime) payload.usual_bedtime = usualBedtime;
    if (usualWakeTime) payload.usual_wake_time = usualWakeTime;
    
    const response = await api.post('/sleep-tracking/baseline', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating sleep baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get user's sleep baseline
 * @returns {Promise<Object>} Baseline data
 */
export const getSleepBaseline = async () => {
  try {
    const response = await api.get('/sleep-tracking/baseline');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Check if user has completed sleep baseline
 * @returns {Promise<Object>} { has_baseline: boolean }
 */
export const checkSleepBaseline = async () => {
  try {
    const response = await api.get('/sleep-tracking/baseline/check');
    return response.data;
  } catch (error) {
    console.error('Error checking sleep baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update sleep baseline (retake questionnaire)
 * @param {number} baselineAvgSleepHours - Average hours of sleep (0-24)
 * @param {number} baselineNights6hPlusPerWeek - Nights with 6+ hours (0-7)
 * @param {number} baselineBedtimeConsistency - Consistency rating (1-5)
 * @param {string} usualBedtime - Typical bedtime (HH:MM, optional)
 * @param {string} usualWakeTime - Typical wake time (HH:MM, optional)
 * @returns {Promise<Object>} Updated baseline
 */
export const updateSleepBaseline = async (
  baselineAvgSleepHours,
  baselineNights6hPlusPerWeek,
  baselineBedtimeConsistency,
  usualBedtime = null,
  usualWakeTime = null
) => {
  try {
    const payload = {
      baseline_avg_sleep_hours: baselineAvgSleepHours,
      baseline_nights_6h_plus_per_week: baselineNights6hPlusPerWeek,
      baseline_bedtime_consistency: baselineBedtimeConsistency,
    };
    if (usualBedtime) payload.usual_bedtime = usualBedtime;
    if (usualWakeTime) payload.usual_wake_time = usualWakeTime;
    
    const response = await api.put('/sleep-tracking/baseline', payload);
    return response.data;
  } catch (error) {
    console.error('Error updating sleep baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Log manual daily sleep record
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} bedtime - Bedtime (HH:MM, 24-hour)
 * @param {number} sleepDurationHours - Sleep duration (0-24)
 * @param {string} wakeTime - Wake time (HH:MM, optional)
 * @param {number} sleepQuality - Quality rating 1-5 (optional)
 * @param {string} notes - Notes (optional)
 * @returns {Promise<Object>} Created/updated record
 */
export const logDailySleep = async (
  date,
  bedtime,
  sleepDurationHours,
  wakeTime = null,
  sleepQuality = null,
  notes = null
) => {
  try {
    const payload = {
      date,
      bedtime,
      sleep_duration_hours: sleepDurationHours,
    };
    if (wakeTime) payload.wake_time = wakeTime;
    if (sleepQuality) payload.sleep_quality = sleepQuality;
    if (notes) payload.notes = notes;
    
    const response = await api.post('/sleep-tracking/daily', payload);
    return response.data;
  } catch (error) {
    console.error('Error logging daily sleep:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get daily sleep records
 * @param {string} startDate - Start date (optional)
 * @param {string} endDate - End date (optional)
 * @param {number} days - Number of days (default: 30)
 * @param {string} source - Filter by source (manual, health_connect)
 * @returns {Promise<Object>} List of records
 */
export const getDailySleepRecords = async (startDate = null, endDate = null, days = 30, source = null) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (days) params.append('days', days);
    if (source) params.append('source', source);
    
    const response = await api.get(`/sleep-tracking/daily?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching daily sleep records:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete daily sleep record
 * @param {string} date - Date to delete (YYYY-MM-DD)
 * @param {string} source - Source filter (optional)
 * @returns {Promise<Object>} Delete result
 */
export const deleteDailySleepRecord = async (date, source = null) => {
  try {
    const params = source ? `?source=${source}` : '';
    const response = await api.delete(`/sleep-tracking/daily/${date}${params}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting daily sleep record:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Sync Health Connect sleep data
 * @param {Array} records - Array of sleep records from Health Connect
 * @returns {Promise<Object>} Sync result
 */
export const syncHealthConnectSleep = async (records) => {
  try {
    const response = await api.post('/sleep-tracking/health-connect/sync', { records });
    return response.data;
  } catch (error) {
    console.error('Error syncing Health Connect sleep:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get computed sleep metrics
 * @returns {Promise<Object>} Computed metrics
 */
export const getSleepMetrics = async () => {
  try {
    const response = await api.get('/sleep-tracking/metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep metrics:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Force refresh sleep metrics
 * @returns {Promise<Object>} Refreshed metrics
 */
export const refreshSleepMetrics = async () => {
  try {
    const response = await api.post('/sleep-tracking/metrics/refresh');
    return response.data;
  } catch (error) {
    console.error('Error refreshing sleep metrics:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get latest sleep risk assessment
 * @returns {Promise<Object>} Risk assessment
 */
export const getSleepRiskAssessment = async () => {
  try {
    const response = await api.get('/sleep-tracking/risk');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep risk assessment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get sleep risk assessment history
 * @param {number} limit - Maximum records (default: 30)
 * @returns {Promise<Object>} Risk history
 */
export const getSleepRiskHistory = async (limit = 30) => {
  try {
    const response = await api.get(`/sleep-tracking/risk/history?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep risk history:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get comprehensive sleep summary for dashboard
 * @returns {Promise<Object>} Complete sleep status
 */
export const getSleepSummary = async () => {
  try {
    const response = await api.get('/sleep-tracking/summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep summary:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Clean up duplicate sleep records
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupDuplicateSleepRecords = async () => {
  try {
    const response = await api.post('/sleep-tracking/cleanup-duplicates');
    return response.data;
  } catch (error) {
    console.error('Error cleaning up duplicates:', error.response?.data || error.message);
    throw error;
  }
};

// Add the functions to the api object
api.predictNutrientsOnly = predictNutrientsOnly;
api.saveMeal = saveMeal;
api.getUserMeals = getUserMeals;
api.getMealById = getMealById;
api.updateMeal = updateMeal;
api.deleteMeal = deleteMeal;
api.getNutritionSummary = getNutritionSummary;
api.saveDailyActivity = saveDailyActivity;
api.getAvailablePhysicians = getAvailablePhysicians;
api.sendPhysicianRequest = sendPhysicianRequest;
api.getMyPhysician = getMyPhysician;
api.getPhysicianAvailableSlots = getPhysicianAvailableSlots;
api.cancelPhysicianRequest = cancelPhysicianRequest;
api.disconnectPhysician = disconnectPhysician;
api.createAppointment = createAppointment;
api.getAppointments = getAppointments;
api.getAppointment = getAppointment;
api.cancelAppointment = cancelAppointment;
api.rescheduleAppointment = rescheduleAppointment;
api.getPrescriptions = getPrescriptions;
api.getPrescription = getPrescription;
api.requestPrescriptionRefill = requestPrescriptionRefill;
api.createConsultation = createConsultation;
api.getConsultations = getConsultations;
api.getConsultation = getConsultation;
api.cancelConsultation = cancelConsultation;
api.rescheduleConsultation = rescheduleConsultation;
api.rateConsultation = rateConsultation;
api.syncHealthData = syncHealthData;
api.getLatestSyncTimestamps = getLatestSyncTimestamps;
api.getHealthData = getHealthData;
api.getDailyStatistics = getDailyStatistics;
api.getWeeklyStatistics = getWeeklyStatistics;
api.getMonthlyStatistics = getMonthlyStatistics;
api.getStatisticsSummary = getStatisticsSummary;
api.submitDiabetesAssessment = submitDiabetesAssessment;
api.getMyAssessment = getMyAssessment;
api.updateAssessmentAnswers = updateAssessmentAnswers;

// Chat endpoints
api.getOrCreateConversation = getOrCreateConversation;
api.getConversations = getConversations;
api.getMessages = getMessages;
api.sendChatMessage = sendChatMessage;
api.markMessagesAsRead = markMessagesAsRead;
api.sendImageMessage = sendImageMessage;
api.saveFCMToken = saveFCMToken;
api.deleteFCMToken = deleteFCMToken;
api.getHealthMetrics = getHealthMetrics;
api.updateHealthMetrics = updateHealthMetrics;
api.getProfile = getProfile;
api.updateProfile = updateProfile;
api.sendChatbotMessage = sendChatbotMessage;
api.getChatbotHistory = getChatbotHistory;
api.saveSmokingIntake = saveSmokingIntake;
api.getSmokingIntakeHistory = getSmokingIntakeHistory;
api.getLatestSmokingIntake = getLatestSmokingIntake;
api.deleteSmokingSession = deleteSmokingSession;

// Sleep Tracking endpoints
api.createSleepBaseline = createSleepBaseline;
api.getSleepBaseline = getSleepBaseline;
api.checkSleepBaseline = checkSleepBaseline;
api.updateSleepBaseline = updateSleepBaseline;
api.logDailySleep = logDailySleep;
api.getDailySleepRecords = getDailySleepRecords;
api.deleteDailySleepRecord = deleteDailySleepRecord;
api.syncHealthConnectSleep = syncHealthConnectSleep;
api.getSleepMetrics = getSleepMetrics;
api.refreshSleepMetrics = refreshSleepMetrics;
api.getSleepRiskAssessment = getSleepRiskAssessment;
api.getSleepRiskHistory = getSleepRiskHistory;
api.getSleepSummary = getSleepSummary;
api.cleanupDuplicateSleepRecords = cleanupDuplicateSleepRecords;

export default api;