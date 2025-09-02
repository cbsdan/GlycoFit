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
      await auth.signOut();
      await SecureStore.deleteItemAsync('auth_token');
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
      return !!token && !!user;
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

// Nutrient Prediction APIs
const predictNutrientsOnly = async (imageUri) => {
  try {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'food_image.jpg',
    });

    const response = await api.post('/nutrients/predict-only', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000, // 30 seconds timeout for ML processing
    });

    return response.data;
  } catch (error) {
    console.error('Error predicting nutrients only:', error);
    throw error;
  }
};

const saveMeal = async (nutrients, mealName, foodType, notes = '', tempImagePublicId) => {
  try {
    const data = {
      nutrients,
      meal_name: mealName,
      food_type: foodType,
      notes,
      temp_image_public_id: tempImagePublicId
    };

    const response = await api.post('/nutrients/save-meal', data, {
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

const updateMeal = async (mealId, mealName = null, notes = null) => {
  try {
    const updateData = {};
    if (mealName !== null) updateData.meal_name = mealName;
    if (notes !== null) updateData.notes = notes;

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

// Add the functions to the api object
api.predictNutrientsOnly = predictNutrientsOnly;
api.saveMeal = saveMeal;
api.getUserMeals = getUserMeals;
api.getMealById = getMealById;
api.updateMeal = updateMeal;
api.deleteMeal = deleteMeal;
api.getNutritionSummary = getNutritionSummary;

export default api;
