import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Access environment variables from expo-constants for release builds
const expoConfig = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: expoConfig.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: expoConfig.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: expoConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: expoConfig.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: expoConfig.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: expoConfig.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required configuration values are present
const requiredConfigs = [
  { key: 'apiKey', name: 'EXPO_PUBLIC_FIREBASE_API_KEY' },
  { key: 'authDomain', name: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN' },
  { key: 'projectId', name: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID' },
  { key: 'storageBucket', name: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET' },
  { key: 'messagingSenderId', name: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID' },
  { key: 'appId', name: 'EXPO_PUBLIC_FIREBASE_APP_ID' }
];

const missingConfigs = requiredConfigs.filter(config => !firebaseConfig[config.key]);
if (missingConfigs.length > 0) {
  const missingNames = missingConfigs.map(c => c.name);
  console.error('Missing required Firebase configuration:', missingNames);
  console.error('Please check your .env file and app.json extra configuration.');
  throw new Error(`Missing Firebase configuration: ${missingNames.join(', ')}`);
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

// Initialize auth with AsyncStorage persistence
// Must use initializeAuth on first call, not getAuth, to set up persistence
let auth;
try {
  console.log("Initializing Firebase auth with AsyncStorage persistence");
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log("Firebase auth initialized successfully with persistence");
} catch (error) {
  // If already initialized, just get the existing instance
  if (error.code === 'auth/already-initialized') {
    console.log("Auth already initialized, getting existing instance");
    auth = getAuth(app);
  } else {
    console.error("Error during auth initialization:", error);
    throw error;
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
