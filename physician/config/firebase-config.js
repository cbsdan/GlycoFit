import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required Firebase environment variables:', missingEnvVars);
  console.error('Please check your .env file and ensure all Firebase configuration variables are set.');
  throw new Error(`Missing Firebase environment variables: ${missingEnvVars.join(', ')}`);
}

console.log("Firebase config module loading...");
console.log("Current Firebase apps:", getApps().length);

// Initialize Firebase - use getApps() to check if already initialized
let app;
if (getApps().length === 0) {
  try {
    console.log("Initializing Firebase app for the first time");
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialization successful:", app.name);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error; // Critical error - can't proceed without Firebase
  }
} else {
  console.log("Firebase app already exists, retrieving instance");
  app = getApp(); // Get the already initialized app
  console.log("Retrieved existing Firebase app:", app.name);
}

// Initialize auth with proper initialization check
let auth;
try {
  console.log("Checking for existing Firebase auth instance");
  // First try to get the existing auth instance
  auth = getAuth(app);
  
  // If we get here, auth was successfully retrieved
  console.log("Existing Firebase auth instance found");
} catch (error) {
  console.log("No existing auth instance found, initializing with persistence");
  try {
    // Only initialize auth with persistence if it doesn't exist yet
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log("Firebase auth initialized with persistence");
  } catch (initError) {
    console.error("Error during auth initialization:", initError);
    // Last resort fallback
    auth = getAuth(app);
  }
}

// Export the app first, then other services
export default app;
export { auth, app };

// Simple function to check token expiration
export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const { exp } = JSON.parse(jsonPayload);
    return exp < (Date.now() / 1000);
  } catch (e) {
    console.error("Error checking token expiration:", e);
    return true;
  }
};

// Improved refresh token function that avoids recursive issues
export const refreshFirebaseToken = async () => {
  console.log("Refreshing Firebase token...");
  
  try {
    // Case 1: User is already signed in to Firebase
    if (auth?.currentUser) {
      console.log("User is logged in:", auth.currentUser.email);
      try {
        const newToken = await auth.currentUser.getIdToken(true); // Force refresh
        console.log("Token refreshed successfully");
        await SecureStore.setItemAsync('auth_token', newToken);
        return newToken;
      } catch (error) {
        console.error("Error refreshing token for logged in user:", error);
        throw error;
      }
    }
    
    // Case 2: Firebase auth is null but we have a stored token
    console.log("No Firebase auth session, checking for stored token");
    const storedToken = await SecureStore.getItemAsync('auth_token');
    const storedUser = await AsyncStorage.getItem('user');
    
    if (storedToken && storedUser) {
      console.log("Found stored token and user data");
      
      // Check if token is still valid
      if (!isTokenExpired(storedToken)) {
        console.log("Stored token is still valid");
        return storedToken;
      } else {
        console.log("Stored token is expired, user must re-authenticate");
        // We can't refresh without credentials, user needs to log in again
        return null;
      }
    }
    
    console.log("No stored session found");
    return null;
  } catch (error) {
    console.error("Error in refreshFirebaseToken:", error);
    return null;
  }
};

export const getAuthToken = async () => {
  try {
    // First check if user is logged in
    if (auth?.currentUser) {
      return await auth.currentUser.getIdToken(false);
    }
    
    // Otherwise return stored token if available
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.log("Error getting auth token:", error);
    return null;
  }
};
