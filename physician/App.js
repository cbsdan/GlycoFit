import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import messaging, { getToken, onTokenRefresh, onMessage, getInitialNotification, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import api from './services/api';
import IntroductionScreen from './screens/IntroductionScreen';
import LoginScreen from './screens/LoginScreen';
import PatientChatScreen from './screens/PatientChatScreen';
import TabNavigator from './navigation/TabNavigator';

const Stack = createNativeStackNavigator();
const INTRO_SHOWN_KEY = '@intro_shown';

// Check if Firebase is initialized, if not it will auto-initialize from google-services.json
try {
  getApp();
  console.log('Firebase already initialized');
} catch (error) {
  console.log('Firebase will auto-initialize from google-services.json');
}

// Register background handler - must be outside of any component
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
});

function AppContent() {
  const [showIntro, setShowIntro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colors: theme, isDarkMode } = useTheme();

  useEffect(() => {
    checkIntroStatus();
  }, []);

  const checkIntroStatus = async () => {
    try {
      const introShown = await AsyncStorage.getItem(INTRO_SHOWN_KEY);
      setShowIntro(introShown === null); // Show intro only if it hasn't been shown before
    } catch (error) {
      console.log('Error checking intro status:', error);
      setShowIntro(true); // Default to showing intro on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem(INTRO_SHOWN_KEY, 'true');
      setShowIntro(false);
    } catch (error) {
      console.log('Error saving intro status:', error);
      setShowIntro(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Determine initial route based on auth state
  const getInitialRouteName = () => {
    if (showIntro) return 'Introduction';
    if (isAuthenticated) return 'Main';
    return 'Login';
  };

  return (
    <NavigationContainer
      theme={{
        dark: isDarkMode,
        colors: {
          primary: theme.primary,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          notification: theme.error,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      >
        {showIntro ? (
          <Stack.Screen name="Introduction">
            {(props) => <IntroductionScreen {...props} onGetStarted={handleGetStarted} />}
          </Stack.Screen>
        ) : null}
        
        {!isAuthenticated ? (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
          />
        ) : (
          <>
            <Stack.Screen 
              name="Main" 
              component={TabNavigator}
            />
            <Stack.Screen 
              name="PatientChat" 
              component={PatientChatScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Request notification permission
const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
  }
  
  return enabled;
};

// Setup FCM with authentication check
const setupFCMWithAuth = async (isAuthenticated) => {
  if (!isAuthenticated) {
    console.log('User not authenticated, skipping FCM setup');
    return null;
  }

  // Check if user has enabled notifications in settings
  try {
    const notificationsEnabled = await AsyncStorage.getItem('@notifications_enabled');
    if (notificationsEnabled === 'false') {
      console.log('Notifications disabled by user in settings');
      return null;
    }
  } catch (error) {
    console.log('Error checking notification preference:', error);
  }

  const hasPermission = await requestUserPermission();
  
  if (hasPermission) {
    try {
      const token = await getToken(messaging());
      console.log('FCM Token:', token);
      
      // Save token to backend
      await api.physicianAPI.saveFCMToken(token);
      console.log('FCM token saved to backend successfully');
      
      // Save preference that notifications are enabled
      await AsyncStorage.setItem('@notifications_enabled', 'true');
      return token;
    } catch (error) {
      console.error('Failed to get or save FCM token:', error);
      return null;
    }
  } else {
    console.log('Permission not granted');
    return null;
  }
};

function FCMHandler() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('User not authenticated, FCM handlers not active');
      return;
    }

    // Setup FCM when user is authenticated
    setupFCMWithAuth(isAuthenticated);

    // Listen for token refresh
    const unsubscribeTokenRefresh = onTokenRefresh(messaging(), async (token) => {
      console.log('FCM Token refreshed:', token);
      if (isAuthenticated) {
        try {
          await api.physicianAPI.saveFCMToken(token);
          console.log('Refreshed FCM token saved to backend successfully');
        } catch (error) {
          console.error('Failed to save refreshed FCM token to backend:', error);
        }
      }
    });

    // Handle notification that opened the app from quit state
    getInitialNotification(messaging()).then(async (remoteMessage) => {
      if (remoteMessage) {
        console.log(
          'Notification caused app to open from quit state:',
          remoteMessage.notification
        );
      }
    });

    // Handle notification that opened the app from background state
    const unsubscribeOnNotificationOpenedApp = onNotificationOpenedApp(messaging(), (remoteMessage) => {
      console.log(
        'Notification caused app to open from background state:',
        remoteMessage.notification
      );
    });

    // Handle foreground messages
    const unsubscribeOnMessage = onMessage(messaging(), async (remoteMessage) => {
      Alert.alert(
        'A new FCM message arrived!',
        JSON.stringify(remoteMessage)
      );
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeTokenRefresh();
      unsubscribeOnNotificationOpenedApp();
      unsubscribeOnMessage();
    };
  }, [isAuthenticated]);

  return null;
}

export default function App() {

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider position="top">
            <FCMHandler />
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
