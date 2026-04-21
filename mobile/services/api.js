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
import CacheService from './cacheService';

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
        // Persist a flag so App.js forces the full onboarding flow (disclaimer +
        // health metrics) on the very first login, regardless of any Firebase
        // onAuthStateChanged race conditions during registration.
        const newUid = response.data.user?.uid || '';
        if (newUid) {
          await AsyncStorage.setItem('@pending_onboarding_uid', newUid);
        }
        // Sign out from Firebase so the auth state is clean before the user
        // explicitly logs in.
        await auth.signOut();
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
      
      // Clear all cached data on logout
      await CacheService.clearAll();
      console.log('[Cache] All caches cleared on logout');
      
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

// ==================== CACHE CONFIGURATION ====================
/**
 * Cache configuration for different data types
 * maxAge: How long data is considered fresh (in milliseconds)
 */
const CACHE_CONFIG = {
  // User data - rarely changes
  user_profile: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  health_metrics: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  
  // Meals - today changes often, history rarely
  meals_today: { maxAge: 5 * 60 * 1000 }, // 5 minutes
  meals_history: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  nutrition_summary: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  
  // Physicians list - rarely changes
  physicians: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  physician_slots: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  my_physician: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  
  // Appointments - can change frequently
  appointments: { maxAge: 10 * 60 * 1000 }, // 10 minutes 
  
  // Health tracking summaries
  step_summary: { maxAge: 5 * 60 * 1000 }, // 5 minutes
  sleep_summary: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  alcohol_summary:{ maxAge: 10 * 60 * 1000 }, // 10 minutes
  smoking_summary: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  statistics_summary: { maxAge: 5 * 60 * 1000 }, // 5 minutes
  
  // Baselines (rarely change after creation)
  baseline: { maxAge: 60 * 60 * 1000 }, // 1 hour
  
  // Risk assessments
  risk_assessment: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  overall_risk: { maxAge: 15 * 60 * 1000 }, // 15 minutes
  
  // Activity data (historical)
  activities: { maxAge: 10 * 60 * 1000 }, // 10 minutes
  
  // Chatbot
  chatbot_history: { maxAge: 5 * 60 * 1000 }, // 5 minutes
  
  // Meal details
  meal_detail: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  
  // Daily records (sleep, alcohol, smoking)
  daily_records: { maxAge: 10 * 60 * 1000 }, // 10 minutes
};

/**
 * Helper to create a cached GET method
 * @param {string} cacheKey - Unique cache key
 * @param {function} fetchFunction - Original fetch function
 * @param {object} config - Cache configuration
 * @returns {function} Cached version of the function
 */
const withCache = (cacheKey, fetchFunction, config = {}) => {
  return async (...args) => {
    // Create dynamic cache key with arguments if needed
    const dynamicKey = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;
    const cacheOptions = { ...CACHE_CONFIG[config.configKey || 'default'], ...config };
    
    try {
      return await CacheService.getData(dynamicKey, () => fetchFunction(...args), cacheOptions);
    } catch (error) {
      // If cache fails, try direct call
      console.warn(`[API] Cache failed for ${dynamicKey}, calling directly`);
      return await fetchFunction(...args);
    }
  };
};

// ==================== NUTRIENT PREDICTION APIs ====================
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

// Predict nutrients from text description
const predictNutrientsFromText = async (foodDescription, mealDatetime = null) => {
  try {
    const data = {
      food_description: foodDescription,
      meal_datetime: mealDatetime
    };

    const response = await api.post('/gemini/predict-from-text', data, {
      timeout: 30000, // 30 seconds timeout for Gemini AI processing
    });

    return response.data;
  } catch (error) {
    console.error('Error predicting nutrients from text:', error);
    throw error;
  }
};

const saveMeal = async (nutrients, mealName, foodType, notes = '', tempImagePublicId, servingSize = null, confidenceRate = null, recipes = [], ingredientNutrients = [], ingredientProportions = {}, mealDatetime = null, confidenceExplanation = '', healthAssessment = '') => {
  try{
    const data = {
      nutrients,
      meal_name: mealName,
      food_type: foodType,
      notes,
      temp_image_public_id: tempImagePublicId,
      serving_size: servingSize,
      confidence_rate: confidenceRate,
      confidence_explanation: confidenceExplanation,
      health_assessment: healthAssessment,
      recipes: recipes,
      ingredient_nutrients: ingredientNutrients,
      ingredient_proportions: ingredientProportions,
      meal_datetime: mealDatetime  // Add meal datetime
    };

    const response = await api.post('/gemini/save-meal', data, {
      timeout: 30000, // 30 seconds timeout for image processing
    });

    // Invalidate meal caches
    await CacheService.invalidatePattern(/^meals_/);
    await CacheService.invalidatePattern(/^nutrition_summary_/);
    await CacheService.invalidatePattern(/^food_assessment_/);
    await CacheService.invalidatePattern(/^overall_risk_assessment/);

    return response.data;
  } catch (error) {
    console.error('Error saving meal:', error);
    throw error;
  }
};

// Save meal from text-based prediction
const saveMealFromText = async (nutrients, mealName, foodType, notes = '', servingSize = null, confidenceRate = null, ingredientNutrients = [], ingredientProportions = {}, mealDatetime = null, confidenceExplanation = '', healthAssessment = '') => {
  try {
    const data = {
      nutrients,
      meal_name: mealName,
      food_type: foodType,
      notes,
      serving_size: servingSize,
      confidence_rate: confidenceRate,
      confidence_explanation: confidenceExplanation,
      health_assessment: healthAssessment,
      ingredient_nutrients: ingredientNutrients,
      ingredient_proportions: ingredientProportions,
      meal_datetime: mealDatetime
    };

    const response = await api.post('/gemini/save-meal-from-text', data, {
      timeout: 30000,
    });

    // Invalidate meal caches
    await CacheService.invalidatePattern(/^meals_/);
    await CacheService.invalidatePattern(/^nutrition_summary_/);
    await CacheService.invalidatePattern(/^food_assessment_/);
    await CacheService.invalidatePattern(/^overall_risk_assessment/);

    return response.data;
  } catch (error) {
    console.error('Error saving text-based meal:', error);
    throw error;
  }
};


// Meal Management APIs
const getUserMealsUncached = async (limit = 50, offset = 0, startDate = null, endDate = null) => {
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

// Cached version with dynamic key based on date range
const getUserMeals = async (limit = 50, offset = 0, startDate = null, endDate = null, forceRefresh = false) => {
  // Determine if this is today's data or historical
  const isToday = startDate && startDate === new Date().toISOString().split('T')[0];
  const cacheKey = isToday 
    ? 'meals_today' 
    : `meals_${startDate || 'all'}_${endDate || 'all'}_${offset}`;
  
  const configKey = isToday ? 'meals_today' : 'meals_history';
  
  return await CacheService.getData(
    cacheKey,
    () => getUserMealsUncached(limit, offset, startDate, endDate),
    { ...CACHE_CONFIG[configKey], forceRefresh }
  );
};

const getMealByIdUncached = async (mealId) => {
  try {
    const response = await api.get(`/users/meals/${mealId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting meal by id:', error);
    throw error;
  }
};

const getMealById = async (mealId, forceRefresh = false) => {
  return await CacheService.getData(
    `meal_detail_${mealId}`,
    () => getMealByIdUncached(mealId),
    { ...CACHE_CONFIG.meal_detail, forceRefresh }
  );
};

const updateMeal = async (mealId, mealName = null, notes = null, foodType = null, nutrients = null, servingSize = null, ingredientNutrients = null, ingredientProportions = null) => {
  try {
    const updateData = {};
    if (mealName !== null) updateData.meal_name = mealName;
    if (notes !== null) updateData.notes = notes;
    if (foodType !== null) updateData.food_type = foodType;
    if (nutrients !== null) updateData.nutrients = nutrients;
    if (servingSize !== null) updateData.serving_size = servingSize;
    if (ingredientNutrients !== null) updateData.ingredient_nutrients = ingredientNutrients;
    if (ingredientProportions !== null) updateData.ingredient_proportions = ingredientProportions;

    const response = await api.put(`/users/meals/${mealId}`, updateData);
    
    // Invalidate meal caches
    await CacheService.invalidatePattern(/^meals_/);
    await CacheService.invalidatePattern(/^meal_detail_/);
    await CacheService.invalidatePattern(/^nutrition_summary_/);
    await CacheService.invalidatePattern(/^food_assessment_/);
    await CacheService.invalidatePattern(/^overall_risk_assessment/);
    
    return response.data;
  } catch (error) {
    console.error('Error updating meal:', error);
    throw error;
  }
};

const deleteMeal = async (mealId) => {
  try {
    const response = await api.delete(`/users/meals/${mealId}`);
    
    // Invalidate meal caches
    await CacheService.invalidatePattern(/^meals_/);
    await CacheService.invalidatePattern(/^meal_detail_/);
    await CacheService.invalidatePattern(/^nutrition_summary_/);
    await CacheService.invalidatePattern(/^food_assessment_/);
    await CacheService.invalidatePattern(/^overall_risk_assessment/);
    
    return response.data;
  } catch (error) {
    console.error('Error deleting meal:', error);
    throw error;
  }
};

const getNutritionSummaryUncached = async (startDate = null, endDate = null) => {
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

const getNutritionSummary = async (startDate = null, endDate = null, forceRefresh = false) => {
  const cacheKey = `nutrition_summary_${startDate || 'all'}_${endDate || 'all'}`;
  return await CacheService.getData(
    cacheKey,
    () => getNutritionSummaryUncached(startDate, endDate),
    { ...CACHE_CONFIG.nutrition_summary, forceRefresh }
  );
};

// Activity Tracking API
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

/**
 * Get recent synced daily activities (most recent first)
 * @param {number} limit - number of days to return (default: 7)
 */
const getRecentActivitiesUncached = async (limit = 7) => {
  try {
    const response = await api.get(`/activity/activities?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    throw error;
  }
};

const getRecentActivities = async (limit = 7, forceRefresh = false) => {
  return await CacheService.getData(
    `activities_${limit}`,
    () => getRecentActivitiesUncached(limit),
    { ...CACHE_CONFIG.activities, forceRefresh }
  );
};
// Physician Management APIs for Patients
const getAvailablePhysiciansUncached = async () => {
  try {
    const response = await api.get('/users/physicians/available');
    return response.data;
  } catch (error) {
    console.error('Error getting available physicians:', error);
    throw error;
  }
};

const getAvailablePhysicians = async (forceRefresh = false) => {
  return await CacheService.getData(
    'physicians',
    getAvailablePhysiciansUncached,
    { ...CACHE_CONFIG.physicians, forceRefresh }
  );
};

const sendPhysicianRequest = async (physicianId, reason = '', urgency = 'low') => {
  try {
    const response = await api.post('/users/physicians/request', {
      physician_id: physicianId,
      reason,
      urgency
    });
    // Invalidate my_physician cache since request status may change
    await CacheService.invalidate('my_physician');
    return response.data;
  } catch (error) {
    console.error('Error sending physician request:', error);
    throw error;
  }
};

const getMyPhysicianUncached = async () => {
  try {
    const response = await api.get('/users/physicians/my-physician');
    return response.data;
  } catch (error) {
    console.error('Error getting my physician:', error);
    throw error;
  }
};

const getMyPhysician = async (forceRefresh = false) => {
  return await CacheService.getData(
    'my_physician',
    getMyPhysicianUncached,
    { ...CACHE_CONFIG.my_physician, forceRefresh }
  );
};

const getPhysicianAvailableSlotsUncached = async (physicianId, startDate = null, endDate = null) => {
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

const getPhysicianAvailableSlots = async (physicianId, startDate = null, endDate = null, forceRefresh = false) => {
  const cacheKey = `physician_slots_${physicianId}_${startDate || 'all'}_${endDate || 'all'}`;
  return await CacheService.getData(
    cacheKey,
    () => getPhysicianAvailableSlotsUncached(physicianId, startDate, endDate),
    { ...CACHE_CONFIG.physician_slots, forceRefresh }
  );
};

const cancelPhysicianRequest = async (requestId) => {
  try {
    const response = await api.post(`/users/physicians/requests/${requestId}/cancel`);
    // Invalidate my_physician cache since request status changed
    await CacheService.invalidate('my_physician');
    return response.data;
  } catch (error) {
    console.error('Error cancelling physician request:', error);
    throw error;
  }
};

const disconnectPhysician = async (relationshipId) => {
  try {
    const response = await api.post(`/users/physicians/relationship/${relationshipId}/disconnect`);
    // Invalidate my_physician cache since relationship ended
    await CacheService.invalidate('my_physician');
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
 * @param {string} scheduledTime - Time string e.g. "14:00"
 * @param {string} consultationType - video, chat, or in-person
 * @param {number} durationMinutes - Duration in minutes
 * @param {string} reason - Reason for consultation
 * @param {string} notes - Additional notes
 * @returns {Promise<Object>} Created consultation
 */
export const createConsultation = async (physicianId, scheduledDate, scheduledTime = null, consultationType = 'video', durationMinutes = 30, reason = '', notes = '') => {
  try {
    const response = await api.post('/users/consultations', {
      physician_id: physicianId,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
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
    // Invalidate all statistics caches after syncing new health data
    await CacheService.invalidatePattern(/^statistics_/);
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
const getStatisticsSummaryUncached = async (period = 'day', date = null) => {
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

export const getStatisticsSummary = async (period = 'day', date = null, forceRefresh = false) => {
  // Create unique cache key for each period and date combination
  const cacheKey = `statistics_${period}_${date || 'current'}`;
  return await CacheService.getData(
    cacheKey,
    () => getStatisticsSummaryUncached(period, date),
    { ...CACHE_CONFIG.statistics_summary, forceRefresh }
  );
};

// Diabetes Assessment API
export const submitDiabetesAssessment = async (answers) => {
  try {
    const response = await api.post('/diabetes-assessment/submit', { answers });
    // Invalidate assessment cache after submission
    await CacheService.invalidatePattern(/^diabetes_assessment/);
    return response.data;
  } catch (error) {
    console.error('Error submitting diabetes assessment:', error);
    throw error;
  }
};

const getMyAssessmentUncached = async () => {
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

export const getMyAssessment = async (forceRefresh = false) => {
  return await CacheService.getData(
    'diabetes_assessment_my',
    () => getMyAssessmentUncached(),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

export const updateAssessmentAnswers = async (answers) => {
  try {
    const response = await api.put('/diabetes-assessment/update', { answers });
    // Invalidate assessment cache after update
    await CacheService.invalidatePattern(/^diabetes_assessment/);
    return response.data;
  } catch (error) {
    console.error('Error updating diabetes assessment:', error);
    throw error;
  }
};

// Overall Risk Assessment API
const getOverallRiskAssessmentUncached = async () => {
  try {
    const response = await api.get('/risk-assessment/overall');
    return response.data;
  } catch (error) {
    console.error('Error fetching overall risk assessment:', error);
    throw error;
  }
};

export const getOverallRiskAssessment = async (forceRefresh = false) => {
  return await CacheService.getData(
    'overall_risk_assessment',
    () => getOverallRiskAssessmentUncached(),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

export const refreshOverallRiskAssessment = async () => {
  try {
    const response = await api.post('/risk-assessment/overall/refresh');
    // Invalidate risk assessment cache after refresh
    await CacheService.invalidatePattern(/^overall_risk_assessment/);
    await CacheService.invalidatePattern(/^diabetes_assessment/);
    return response.data;
  } catch (error) {
    console.error('Error refreshing overall risk assessment:', error);
    throw error;
  }
};

export const getOverallRiskHistory = async (limit = 30) => {
  try {
    const response = await api.get('/risk-assessment/overall/history', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching risk assessment history:', error);
    throw error;
  }
};

export const getOverallRiskPrediction = async () => {
  try {
    const response = await api.get('/risk-assessment/overall/prediction');
    return response.data;
  } catch (error) {
    console.error('Error fetching overall risk prediction:', error);
    throw error;
  }
};

export const getComponentScores = async () => {
  try {
    const response = await api.get('/risk-assessment/overall/components');
    return response.data;
  } catch (error) {
    console.error('Error fetching component scores:', error);
    throw error;
  }
};

export const getRiskFactors = async () => {
  try {
    const response = await api.get('/risk-assessment/overall/factors');
    return response.data;
  } catch (error) {
    console.error('Error fetching risk factors:', error);
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
const getHealthMetricsUncached = async () => {
  try {
    const response = await api.get('/users/health-metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching health metrics:', error.response?.data || error.message);
    throw error;
  }
};

export const getHealthMetrics = async (forceRefresh = false) => {
  return await CacheService.getData(
    'health_metrics',
    getHealthMetricsUncached,
    { ...CACHE_CONFIG.health_metrics, forceRefresh }
  );
};

export const updateHealthMetrics = async (age, sex, height, weight, waist, diagnosis_status = null) => {
  try {
    const payload = { age, sex, height, weight, waist };
    if (diagnosis_status !== null) {
      payload.diagnosis_status = diagnosis_status;
    }
    const response = await api.put('/users/health-metrics', payload);
    
    // Invalidate caches
    await CacheService.invalidate('health_metrics');
    await CacheService.invalidate('user_profile');
    
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
const getProfileUncached = async () => {
  try {
    const response = await api.get('/users/profile');
    return response.data;
  } catch (error) {
    console.error('Error getting profile:', error.response?.data || error.message);
    throw error;
  }
};

export const getProfile = async (forceRefresh = false) => {
  return await CacheService.getData(
    'user_profile',
    getProfileUncached,
    { ...CACHE_CONFIG.user_profile, forceRefresh }
  );
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
    if (profileData.waist !== undefined) formData.append('waist', profileData.waist);
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
    
    // Invalidate caches
    await CacheService.invalidate('user_profile');
    await CacheService.invalidate('health_metrics');
    
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error.response?.data || error.message);
    throw error;
  }
};

export const sendChatbotMessage = async (message) => {
  try {
    const response = await api.post('/chatbot/message', { message });
    // Invalidate chatbot history cache after sending new message
    await CacheService.invalidatePattern(/^chatbot_history_/);
    return response.data;
  } catch (error) {
    console.error('Error sending chatbot message:', error);
    throw error;
  }
};

const getChatbotHistoryUncached = async (skip = 0, limit = 20) => {
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

export const getChatbotHistory = async (skip = 0, limit = 20, forceRefresh = false) => {
  // Create unique cache key for each pagination offset
  const cacheKey = `chatbot_history_${skip}_${limit}`;
  return await CacheService.getData(
    cacheKey,
    () => getChatbotHistoryUncached(skip, limit),
    { ...CACHE_CONFIG.chatbot_history, forceRefresh }
  );
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

// ==================== Smoking Tracking Management (New Pattern) ====================

/**
 * Create smoking baseline (required at onboarding)
 * @param {string} smoking_status - Status: never/current/former
 * @param {number} years_smoked - Years smoked (if not never)
 * @param {number} typical_cigarettes_per_day - Typical daily cigarettes (if not never)
 * @param {string} quit_date - Date quit smoking (if former, YYYY-MM-DD)
 * @param {number} start_age - Age started smoking (optional)
 */
const createSmokingBaseline = async (baselineData) => {
  try {
    const response = await api.post('/smoking-tracking/baseline', baselineData);
    // Invalidate all smoking-related caches
    await CacheService.invalidatePattern(/^smoking_/);
    return response.data;
  } catch (error) {
    console.error('Error creating smoking baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get user's smoking baseline
 */
const getSmokingBaseline = async () => {
  try {
    const response = await api.get('/smoking-tracking/baseline');
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Check if user has baseline (quick check without full data)
 */
const checkSmokingBaselineUncached = async () => {
  try {
    const response = await api.get('/smoking-tracking/baseline/check');
    return response.data;
  } catch (error) {
    console.error('Error checking smoking baseline:', error.response?.data || error.message);
    throw error;
  }
};

const checkSmokingBaseline = async (forceRefresh = false) => {
  return await CacheService.getData(
    'smoking_baseline_check',
    () => checkSmokingBaselineUncached(),
    { ...CACHE_CONFIG.baseline, forceRefresh }
  );
};

/**
 * Update smoking baseline (only allowed if not locked)
 * @param {object} updates - Fields to update
 */
const updateSmokingBaseline = async (updates) => {
  try {
    const response = await api.put('/smoking-tracking/baseline', updates);
    // Invalidate all smoking-related caches
    await CacheService.invalidatePattern(/^smoking_/);
    return response.data;
  } catch (error) {
    console.error('Error updating smoking baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Log daily smoking record
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {number} cigarettes_count - Number of cigarettes smoked
 * @param {string} notes - Optional notes
 */
const logDailySmoking = async (recordData) => {
  try {
    const response = await api.post('/smoking-tracking/daily', recordData);
    // Invalidate all smoking-related caches
    await CacheService.invalidatePattern(/^smoking_/);
    return response.data;
  } catch (error) {
    console.error('Error logging daily smoking:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get daily smoking records for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {number} limit - Max records to return
 */
const getDailySmokingRecordsUncached = async (startDate = null, endDate = null, limit = 30) => {
  try {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (limit) params.limit = limit;
    
    const response = await api.get('/smoking-tracking/daily', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching daily smoking records:', error.response?.data || error.message);
    throw error;
  }
};

const getDailySmokingRecords = async (startDate = null, endDate = null, limit = 30, forceRefresh = false) => {
  const cacheKey = `smoking_records_${startDate || 'all'}_${endDate || 'all'}_${limit}`;
  return await CacheService.getData(
    cacheKey,
    () => getDailySmokingRecordsUncached(startDate, endDate, limit),
    { ...CACHE_CONFIG.daily_records, forceRefresh }
  );
};

/**
 * Delete a daily smoking record
 * @param {string} date - Date to delete (YYYY-MM-DD)
 */
const deleteDailySmokingRecord = async (date) => {
  try {
    const response = await api.delete(`/smoking-tracking/daily/${date}`);
    // Invalidate all smoking-related caches
    await CacheService.invalidatePattern(/^smoking_/);
    return response.data;
  } catch (error) {
    console.error('Error deleting daily smoking record:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get smoking metrics (computed averages, pack-years, etc.)
 */
const getSmokingMetrics = async () => {
  try {
    const response = await api.get('/smoking-tracking/metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking metrics:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Refresh smoking metrics (force recalculation)
 */
const refreshSmokingMetrics = async () => {
  try {
    const response = await api.post('/smoking-tracking/metrics/refresh');
    // Invalidate all smoking-related caches
    await CacheService.invalidatePattern(/^smoking_/);
    return response.data;
  } catch (error) {
    console.error('Error refreshing smoking metrics:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get current smoking risk assessment
 */
const getSmokingRiskAssessment = async () => {
  try {
    const response = await api.get('/smoking-tracking/risk');
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking risk assessment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get smoking risk assessment history
 * @param {number} limit - Number of historical records
 */
const getSmokingRiskHistory = async (limit = 10) => {
  try {
    const response = await api.get('/smoking-tracking/risk/history', { params: { limit } });
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking risk history:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get smoking tracking summary (dashboard data)
 * @param {number} days - Days of history to include
 */
const getSmokingSummaryUncached = async (days = 7) => {
  try {
    const response = await api.get('/smoking-tracking/summary', { params: { days } });
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking summary:', error.response?.data || error.message);
    throw error;
  }
};

export const getSmokingSummary = async (days = 7, forceRefresh = false) => {
  return await CacheService.getData(
    `smoking_summary_${days}d`,
    () => getSmokingSummaryUncached(days),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

// ==================== Alcohol Intake Management ====================

/**
 * Create alcohol baseline (required at onboarding)
 * @param {number} baselineDrinkingDaysPerWeek - Typical drinking days per week (0-7)
 * @param {number} baselineDrinksPerOccasion - Average drinks per drinking day (0-20)
 * @param {number} baselineBingeFrequencyPerMonth - Binge episodes per month (0-31)
 * @param {string} drinkingPattern - Pattern: none/occasional/weekends/regular/daily
 * @param {number} yearsAtCurrentPattern - Years at this consumption level (0-50)
 * @param {boolean} drinksWithMeals - Whether drinks are typically with food
 * @returns {Promise<Object>} Created baseline
 */
export const createAlcoholBaseline = async (
  baselineDrinkingDaysPerWeek,
  baselineDrinksPerOccasion,
  baselineBingeFrequencyPerMonth,
  drinkingPattern = 'none',
  yearsAtCurrentPattern = 0,
  drinksWithMeals = false
) => {
  try {
    const response = await api.post('/alcohol-intake/baseline', {
      baseline_drinking_days_per_week: baselineDrinkingDaysPerWeek,
      baseline_drinks_per_occasion: baselineDrinksPerOccasion,
      baseline_binge_frequency_per_month: baselineBingeFrequencyPerMonth,
      drinking_pattern: drinkingPattern,
      years_at_current_pattern: yearsAtCurrentPattern,
      drinks_with_meals: drinksWithMeals
    });
    // Invalidate all alcohol-related caches
    await CacheService.invalidatePattern(/^alcohol_/);
    return response.data;
  } catch (error) {
    console.error('Error creating alcohol baseline:', error);
    throw error;
  }
};

/**
 * Get user's alcohol baseline
 * @returns {Promise<Object>} Baseline data
 */
export const getAlcoholBaseline = async () => {
  try {
    const response = await api.get('/alcohol-intake/baseline');
    return response.data.data; // Extract the nested data object
  } catch (error) {
    console.error('Error fetching alcohol baseline:', error);
    throw error;
  }
};

/**
 * Check if user has completed alcohol baseline
 * @returns {Promise<Object>} { has_baseline: boolean }
 */
export const checkAlcoholBaseline = async () => {
  try {
    const response = await api.get('/alcohol-intake/baseline/check');
    return response.data;
  } catch (error) {
    console.error('Error checking alcohol baseline:', error);
    throw error;
  }
};

/**
 * Update alcohol baseline (retake questionnaire)
 * @param {number} baselineDrinkingDaysPerWeek - Typical drinking days per week (0-7)
 * @param {number} baselineDrinksPerOccasion - Average drinks per drinking day (0-20)
 * @param {number} baselineBingeFrequencyPerMonth - Binge episodes per month (0-31)
 * @param {string} drinkingPattern - Pattern: none/occasional/weekends/regular/daily
 * @param {number} yearsAtCurrentPattern - Years at this consumption level (0-50)
 * @param {boolean} drinksWithMeals - Whether drinks are typically with food
 * @returns {Promise<Object>} Updated baseline
 */
export const updateAlcoholBaseline = async (
  baselineDrinkingDaysPerWeek,
  baselineDrinksPerOccasion,
  baselineBingeFrequencyPerMonth,
  drinkingPattern = null,
  yearsAtCurrentPattern = null,
  drinksWithMeals = null
) => {
  try {
    const payload = {
      baseline_drinking_days_per_week: baselineDrinkingDaysPerWeek,
      baseline_drinks_per_occasion: baselineDrinksPerOccasion,
      baseline_binge_frequency_per_month: baselineBingeFrequencyPerMonth,
    };
    if (drinkingPattern !== null) payload.drinking_pattern = drinkingPattern;
    if (yearsAtCurrentPattern !== null) payload.years_at_current_pattern = yearsAtCurrentPattern;
    if (drinksWithMeals !== null) payload.drinks_with_meals = drinksWithMeals;
    
    const response = await api.put('/alcohol-intake/baseline', payload);
    // Invalidate all alcohol-related caches
    await CacheService.invalidatePattern(/^alcohol_/);
    return response.data;
  } catch (error) {
    console.error('Error updating alcohol baseline:', error);
    throw error;
  }
};

/**
 * Log daily alcohol consumption
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {number} drinksConsumed - Number of standard drinks (0-20)
 * @param {boolean} wasBingeEpisode - Whether it was a binge episode (optional)
 * @param {string} drinkingContext - Context: meal/social/stress/celebration/other/none
 * @param {string} timeOfDay - Time: morning/afternoon/evening/night
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Created/updated record
 */
export const logDailyAlcohol = async (
  date,
  drinksConsumed,
  wasBingeEpisode = null,
  drinkingContext = 'other',
  timeOfDay = 'evening',
  notes = null
) => {
  try {
    const payload = {
      date,
      drinks_consumed: drinksConsumed,
      drinking_context: drinkingContext,
      time_of_day: timeOfDay,
    };
    if (wasBingeEpisode !== null) payload.was_binge_episode = wasBingeEpisode;
    if (notes) payload.notes = notes;
    
    const response = await api.post('/alcohol-intake/daily', payload);
    // Invalidate all alcohol-related caches
    await CacheService.invalidatePattern(/^alcohol_/);
    return response.data;
  } catch (error) {
    console.error('Error logging daily alcohol:', error);
    throw error;
  }
};

/**
 * Get daily alcohol records
 * @param {string} startDate - Start date (optional)
 * @param {string} endDate - End date (optional)
 * @param {number} days - Number of days (default: 30)
 * @returns {Promise<Object>} List of records
 */
const getDailyAlcoholRecordsUncached = async (startDate = null, endDate = null, days = 30) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (days) params.append('days', days);
    
    const response = await api.get(`/alcohol-intake/daily?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching daily alcohol records:', error);
    throw error;
  }
};

export const getDailyAlcoholRecords = async (startDate = null, endDate = null, days = 30, forceRefresh = false) => {
  const cacheKey = `alcohol_records_${startDate || 'all'}_${endDate || 'all'}_${days}`;
  return await CacheService.getData(
    cacheKey,
    () => getDailyAlcoholRecordsUncached(startDate, endDate, days),
    { ...CACHE_CONFIG.daily_records, forceRefresh }
  );
};

/**
 * Delete daily alcohol record
 * @param {string} date - Date to delete (YYYY-MM-DD)
 * @returns {Promise<Object>} Delete result
 */
export const deleteDailyAlcoholRecord = async (date) => {
  try {
    const response = await api.delete(`/alcohol-intake/daily/${date}`);
    // Invalidate all alcohol-related caches
    await CacheService.invalidatePattern(/^alcohol_/);
    return response.data;
  } catch (error) {
    console.error('Error deleting daily alcohol record:', error);
    throw error;
  }
};

/**
 * Get computed alcohol metrics
 * @param {boolean} refresh - Force refresh metrics
 * @returns {Promise<Object>} Computed metrics
 */
export const getAlcoholMetrics = async (refresh = false) => {
  try {
    const params = refresh ? '?refresh=true' : '';
    const response = await api.get(`/alcohol-intake/metrics${params}`);
    return response.data.data; // Extract the nested data object
  } catch (error) {
    console.error('Error fetching alcohol metrics:', error);
    throw error;
  }
};

/**
 * Force refresh alcohol metrics
 * @returns {Promise<Object>} Refreshed metrics
 */
export const refreshAlcoholMetrics = async () => {
  try {
    const response = await api.post('/alcohol-intake/metrics/refresh');
    return response.data.data; // Extract the nested data object
  } catch (error) {
    console.error('Error refreshing alcohol metrics:', error);
    throw error;
  }
};

/**
 * Get comprehensive alcohol risk assessment
 * @returns {Promise<Object>} Risk assessment with recommendations
 */
export const getAlcoholRiskAssessment = async () => {
  try {
    const response = await api.get('/alcohol-intake/risk');
    return response.data.data; // Extract the nested data object
  } catch (error) {
    console.error('Error fetching alcohol risk assessment:', error);
    throw error;
  }
};

/**
 * Get comprehensive alcohol summary for dashboard
 * @returns {Promise<Object>} Complete alcohol status (baseline + metrics + risk + records)
 */
const getAlcoholSummaryUncached = async () => {
  try {
    const response = await api.get('/alcohol-intake/summary');
    return response.data.data; // Extract the nested data object
  } catch (error) {
    console.error('Error fetching alcohol summary:', error);
    throw error;
  }
};

export const getAlcoholSummary = async (forceRefresh = false) => {
  return await CacheService.getData(
    'alcohol_summary',
    () => getAlcoholSummaryUncached(),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

// ==================== LEGACY ALCOHOL INTAKE (DEPRECATED) ====================

/**
 * @deprecated Use createAlcoholBaseline() and logDailyAlcohol() instead
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
 * @deprecated Use getAlcoholSummary() instead
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
 * @deprecated Use getDailyAlcoholRecords() instead
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
 * @deprecated Functionality removed - delete individual daily records instead
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
    // Invalidate all sleep-related caches
    await CacheService.invalidatePattern(/^sleep_/);
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
    // Invalidate all sleep-related caches
    await CacheService.invalidatePattern(/^sleep_/);
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
    // Invalidate all sleep-related caches
    await CacheService.invalidatePattern(/^sleep_/);
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
const getDailySleepRecordsUncached = async (startDate = null, endDate = null, days = 30, source = null) => {
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

export const getDailySleepRecords = async (startDate = null, endDate = null, days = 30, source = null, forceRefresh = false) => {
  const cacheKey = `sleep_records_${startDate || 'all'}_${endDate || 'all'}_${days}_${source || 'all'}`;
  return await CacheService.getData(
    cacheKey,
    () => getDailySleepRecordsUncached(startDate, endDate, days, source),
    { ...CACHE_CONFIG.daily_records, forceRefresh }
  );
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
    // Invalidate all sleep-related caches
    await CacheService.invalidatePattern(/^sleep_/);
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
const getSleepSummaryUncached = async () => {
  try {
    const response = await api.get('/sleep-tracking/summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep summary:', error.response?.data || error.message);
    throw error;
  }
};

export const getSleepSummary = async (forceRefresh = false) => {
  return await CacheService.getData(
    'sleep_summary',
    () => getSleepSummaryUncached(),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
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

// ==================== FOOD RISK ASSESSMENT API ====================

/**
 * Get baseline assessment questions
 * @returns {Promise<Object>} List of baseline questions
 */
export const getFoodBaselineQuestions = async () => {
  try {
    const response = await api.get('/food-risk/baseline/questions');
    return response.data;
  } catch (error) {
    console.error('Error fetching baseline questions:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Submit baseline assessment
 * @param {Object} responses - User responses to baseline questions
 * @returns {Promise<Object>} Created baseline assessment
 */
export const submitFoodBaseline = async (responses) => {
  try {
    const response = await api.post('/food-risk/baseline/submit', { responses });
    // Invalidate cached baseline and assessment data so the next read reflects the new submission
    await CacheService.invalidateMultiple(['food_baseline', 'food_assessment_7d']);
    return response.data;
  } catch (error) {
    console.error('Error submitting baseline:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get user's food baseline assessment
 * @returns {Promise<Object>} Baseline assessment data
 */
const getFoodBaselineUncached = async () => {
  try {
    const response = await api.get('/food-risk/baseline');
    return response.data;
  } catch (error) {
    console.error('Error fetching baseline:', error.response?.data || error.message);
    throw error;
  }
};

export const getFoodBaseline = async (forceRefresh = false) => {
  return await CacheService.getData(
    'food_baseline',
    getFoodBaselineUncached,
    { ...CACHE_CONFIG.baseline, forceRefresh }
  )};


/**
 * Get comprehensive food risk assessment
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {Promise<Object>} Risk assessment with scores and breakdown
 */
export const getFoodRiskAssessment = async (days = 7) => {
  try {
    const response = await api.get(`/food-risk/assessment?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching risk assessment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get personalized food recommendations
 * @returns {Promise<Object>} Recommendations based on risk assessment
 */
export const getFoodRecommendations = async () => {
  try {
    const response = await api.get('/food-risk/recommendations');
    return response.data;
  } catch (error) {
    console.error('Error fetching recommendations:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get detailed risk assessment with explanations for frontend display
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {Promise<Object>} Comprehensive assessment with detailed explanations
 */
const getDetailedFoodAssessmentUncached = async (days = 7) => {
  try {
    const response = await api.get(`/food-risk/detailed-assessment?days=${days}`);
    console.log('Detailed Food Assessment Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed assessment:', error.response?.data || error.message);
    throw error;
  }
};

export const getDetailedFoodAssessment = async (days = 7, forceRefresh = false) => {
  return await CacheService.getData(
    `food_assessment_${days}d`,
    () => getDetailedFoodAssessmentUncached(days),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

/**
 * Get daily log analysis
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {Promise<Object>} Daily log analysis
 */
export const getFoodDailyLogAnalysis = async (days = 7) => {
  try {
    const response = await api.get(`/food-risk/daily-log-analysis?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching daily log analysis:', error.response?.data || error.message);
    throw error;
  }
};

// ==================== LIFESTYLE RECOMMENDATIONS API ====================

/**
 * Get unified lifestyle recommendations for all trackers
 * Returns recommendations from food, sleep, activity, alcohol, and smoking trackers
 * @param {number} days - Number of days to analyze (default: 30)
 * @param {boolean} useMock - When true, backend injects temporary mock tracker inputs for preview (not persisted)
 * @param {string} mockPreset - Mock preset name: conservative | moderate | aggressive
 * @returns {Promise<Object>} Unified recommendations with timeline predictions
 */
export const getLifestyleRecommendations = async (days = 30, useMock = false, mockPreset = 'moderate') => {
  try {
    const safePreset = (mockPreset || 'moderate').toLowerCase();
    const response = await api.get(`/lifestyle/recommendations?days=${days}&mock=${useMock ? 'true' : 'false'}&mock_preset=${encodeURIComponent(safePreset)}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching lifestyle recommendations:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get healthy default recommendations
 * Returns evidence-based guidelines when insufficient tracking data
 * @returns {Promise<Object>} Healthy default guidelines
 */
export const getHealthyDefaults = async () => {
  try {
    const response = await api.get('/lifestyle/defaults');
    return response.data;
  } catch (error) {
    console.error('Error fetching healthy defaults:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get food-specific timeline predictions
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {Promise<Object>} Food timeline predictions
 */
const getFoodPredictionsUncached = async (days = 7) => {
  try {
    const response = await api.get(`/lifestyle/food/predictions?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching food predictions:', error.response?.data || error.message);
    throw error;
  }
};

export const getFoodPredictions = async (days = 7, forceRefresh = false) => {
  return await CacheService.getData(
    `food_predictions_${days}d`,
    () => getFoodPredictionsUncached(days),
    { ...CACHE_CONFIG.risk_assessment, forceRefresh }
  );
};

/**
 * Get sleep-specific timeline predictions
 * @returns {Promise<Object>} Sleep timeline predictions
 */
export const getSleepPredictions = async () => {
  try {
    const response = await api.get('/lifestyle/sleep/predictions');
    return response.data;
  } catch (error) {
    console.error('Error fetching sleep predictions:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get activity/step-specific timeline predictions
 * @returns {Promise<Object>} Activity timeline predictions
 */
export const getActivityPredictions = async () => {
  try {
    const response = await api.get('/lifestyle/activity/predictions');
    return response.data;
  } catch (error) {
    console.error('Error fetching activity predictions:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get alcohol-specific timeline predictions
 * @returns {Promise<Object>} Alcohol timeline predictions
 */
export const getAlcoholPredictions = async () => {
  try {
    const response = await api.get('/lifestyle/alcohol/predictions');
    return response.data;
  } catch (error) {
    console.error('Error fetching alcohol predictions:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get smoking-specific timeline predictions
 * @returns {Promise<Object>} Smoking timeline predictions
 */
export const getSmokingPredictions = async () => {
  try {
    const response = await api.get('/lifestyle/smoking/predictions');
    return response.data;
  } catch (error) {
    console.error('Error fetching smoking predictions:', error.response?.data || error.message);
    throw error;
  }
};

// ==================== STEP TRACKING API ====================

/**
 * Create step baseline (required at onboarding)
 */
export const createStepBaseline = async (
  avgDailySteps,
  activityLevel,
  daysActive,
  exerciseMinutes,
  workType
) => {
  try {
    const response = await api.post('/step-tracking/baseline', {
      baseline_avg_daily_steps: avgDailySteps,
      baseline_activity_level: activityLevel,
      baseline_days_active_per_week: daysActive,
      baseline_exercise_minutes_per_week: exerciseMinutes,
      baseline_work_type: workType,
    });
    // Invalidate all step-related caches
    await CacheService.invalidatePattern(/^step_/);
    return response.data;
  } catch (error) {
    console.error('Error creating step baseline:', error.response?.data || error.message);
    throw error;
  }
};


/**
 * Get user's step baseline
 */
const getStepBaselineUncached = async () => {
  try {
    const response = await api.get('/step-tracking/baseline');
    return response.data;
  } catch (error) {
    console.error('Error fetching step baseline:', error.response?.data || error.message);
    throw error;
  }
};

export const getStepBaseline = async (forceRefresh = false) => {
  return await CacheService.getData(
    'step_baseline',
    () => getStepBaselineUncached(),
    { ...CACHE_CONFIG.baseline, forceRefresh }
  );
};
/**
 * Check if user has completed step baseline
 */
const checkStepBaselineUncached = async () => {
  try {
    const response = await api.get('/step-tracking/baseline/check');
    return response.data;
  } catch (error) {
    console.error('Error checking step baseline:', error.response?.data || error.message);
    throw error;
  }
};

export const checkStepBaseline = async (forceRefresh = false) => {
  return await CacheService.getData(
    'step_baseline_check',
    () => checkStepBaselineUncached(),
    { ...CACHE_CONFIG.meals_today, forceRefresh }
  );
};
/**
 * Update step baseline (retake questionnaire)
 */
export const updateStepBaseline = async (
  avgDailySteps,
  activityLevel,
  daysActive,
  exerciseMinutes,
  workType
) => {
  try {
    const response = await api.put('/step-tracking/baseline', {
      baseline_avg_daily_steps: avgDailySteps,
      baseline_activity_level: activityLevel,
      baseline_days_active_per_week: daysActive,
      baseline_exercise_minutes_per_week: exerciseMinutes,
      baseline_work_type: workType,
    });
    // Invalidate all step-related caches
    await CacheService.invalidatePattern(/^step_/);
    return response.data;
  } catch (error) {
    console.error('Error updating step baseline:', error.response?.data || error.message);
    throw error;
  }
};
/**
 * Get computed step metrics
 */
export const getStepMetrics = async () => { // ← ADD export here
  try {
    const response = await api.get('/step-tracking/metrics');
    return response.data;
  } catch (error) {
    console.error('Error getting step metrics:', error);
    throw error;
  }
};

/**
 * Get comprehensive step summary for dashboard
 */
const getStepSummaryUncached = async (days = 7) => {
  try {
    const response = await api.get(`/step-tracking/summary?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error getting step summary:', error);
    throw error;
  }
};

export const getStepSummary = async (days = 7, forceRefresh = false) => {
  return await CacheService.getData(
    `step_summary_${days}d`,
    () => getStepSummaryUncached(days),
    { ...CACHE_CONFIG.step_summary, forceRefresh }
  );
};

// Add the functions to the api object
api.predictNutrientsOnly = predictNutrientsOnly;
api.predictNutrientsFromText = predictNutrientsFromText;
api.saveMeal = saveMeal;
api.saveMealFromText = saveMealFromText;
api.getUserMeals = getUserMeals;
api.getMealById = getMealById;
api.updateMeal = updateMeal;
api.deleteMeal = deleteMeal;
api.getNutritionSummary = getNutritionSummary;
api.saveDailyActivity = saveDailyActivity;
api.getRecentActivities = getRecentActivities;
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
api.getOverallRiskAssessment = getOverallRiskAssessment;
api.refreshOverallRiskAssessment = refreshOverallRiskAssessment;
api.getOverallRiskHistory = getOverallRiskHistory;
api.getOverallRiskPrediction = getOverallRiskPrediction;
api.getComponentScores = getComponentScores;
api.getRiskFactors = getRiskFactors;

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

// Smoking Tracking endpoints (new pattern)
api.createSmokingBaseline = createSmokingBaseline;
api.getSmokingBaseline = getSmokingBaseline;
api.checkSmokingBaseline = checkSmokingBaseline;
api.updateSmokingBaseline = updateSmokingBaseline;
api.logDailySmoking = logDailySmoking;
api.getDailySmokingRecords = getDailySmokingRecords;
api.deleteDailySmokingRecord = deleteDailySmokingRecord;
api.getSmokingMetrics = getSmokingMetrics;
api.refreshSmokingMetrics = refreshSmokingMetrics;
api.getSmokingRiskAssessment = getSmokingRiskAssessment;
api.getSmokingRiskHistory = getSmokingRiskHistory;
api.getSmokingSummary = getSmokingSummary;

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

// Food Risk Assessment endpoints
api.getFoodBaselineQuestions = getFoodBaselineQuestions;
api.submitFoodBaseline = submitFoodBaseline;
api.getFoodBaseline = getFoodBaseline;
api.getFoodRiskAssessment = getFoodRiskAssessment;
api.getDetailedFoodAssessment = getDetailedFoodAssessment;
api.getFoodRecommendations = getFoodRecommendations;
api.getFoodDailyLogAnalysis = getFoodDailyLogAnalysis;

// Lifestyle Recommendations endpoints
api.getLifestyleRecommendations = getLifestyleRecommendations;
api.getHealthyDefaults = getHealthyDefaults;
api.getFoodPredictions = getFoodPredictions;
api.getSleepPredictions = getSleepPredictions;
api.getActivityPredictions = getActivityPredictions;
api.getAlcoholPredictions = getAlcoholPredictions;
api.getSmokingPredictions = getSmokingPredictions;

// Make sure these lines exist at the bottom, BEFORE export default api;
// Vitals endpoints
const logVitals = async (data, isMultipart = false) => {
  try {
    const config = isMultipart ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : {};
    const response = await api.post('/users/vitals', data, config);
    return response.data;
  } catch (error) {
    console.error('Error logging vitals:', error);
    throw error;
  }
};

const getVitals = async () => {
  try {
    const response = await api.get('/users/vitals');
    return response.data;
  } catch (error) {
    console.error('Error getting vitals:', error);
    throw error;
  }
};

const updateVital = async (id, data, isMultipart = false) => {
  try {
    const config = isMultipart ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : {};
    const response = await api.put(`/users/vitals/${id}`, data, config);
    return response.data;
  } catch (error) {
    console.error('Error updating vital:', error);
    throw error;
  }
};

const deleteVital = async (id) => {
  try {
    const response = await api.delete(`/users/vitals/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting vital:', error);
    throw error;
  }
};

api.logVitals = logVitals;
api.getVitals = getVitals;
api.updateVital = updateVital;
api.deleteVital = deleteVital;

api.createStepBaseline = createStepBaseline;
api.getStepBaseline = getStepBaseline;
api.checkStepBaseline = checkStepBaseline;
api.updateStepBaseline = updateStepBaseline;

// Physician SOAP notes (read-only for patients)
const getPhysicianSoapNotes = async (physicianId) => {
  try {
    const response = await api.get(`/users/physician-soap-notes?physician_id=${physicianId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching physician soap notes:', error);
    throw error;
  }
};
api.getPhysicianSoapNotes = getPhysicianSoapNotes;

export default api;