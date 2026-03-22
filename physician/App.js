import React, { useEffect } from 'react';
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
import LoginScreen from './screens/LoginScreen';
import PatientChatScreen from './screens/PatientChatScreen';
import PatientDetailScreen from './screens/PatientDetailScreen';
import TabNavigator from './navigation/TabNavigator';

const Stack = createNativeStackNavigator();

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
  const navigationRef = React.useRef();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colors: theme, isDarkMode } = useTheme();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Determine initial route based on auth state
  const getInitialRouteName = () => {
    if (isAuthenticated) return 'Main';
    return 'Login';
  };

  return (
    <>
      <FCMHandler navigationRef={navigationRef} />
      <NavigationContainer
        ref={navigationRef}
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
            <Stack.Screen 
              name="PatientDetail" 
              component={PatientDetailScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </>
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

  // Only proceed if user has explicitly enabled notifications
  try {
    const notificationsEnabled = await AsyncStorage.getItem('@notifications_enabled');
    if (notificationsEnabled !== 'true') {
      console.log('Notifications not explicitly enabled by user, skipping FCM setup');
      return null;
    }
  } catch (error) {
    console.log('Error checking notification preference:', error);
    return null;
  }

  const hasPermission = await requestUserPermission();
  
  if (hasPermission) {
    try {
      const token = await getToken(messaging());
      console.log('FCM Token:', token);
      
      // Save token to backend
      await api.saveFCMToken(token);
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

function FCMHandler({ navigationRef }) {
  const { isAuthenticated } = useAuth();

  const handleNotificationNavigation = (remoteMessage) => {
    if (!remoteMessage || !navigationRef?.current || !isAuthenticated) {
      console.log('Cannot navigate - navigation not ready or not authenticated');
      return;
    }

    const data = remoteMessage.data;
    console.log('Handling notification navigation:', data);

    // Handle different notification types
    switch (data?.type) {
      case 'chat_message':
        // Navigate to chat screen with patient
        if (data.conversation_id) {
          const patientId = data.patient_id;
          const patientName = data.patient_name || 'Patient';
          const relationshipId = data.relationship_id;
          const patientAvatarUrl = data.patient_avatar_url; // Avatar URL from notification
          
          // Parse patient name
          const nameParts = patientName.split(' ');
          const firstName = nameParts[0] || 'Patient';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Construct avatar object if URL exists
          const avatar = patientAvatarUrl ? { url: patientAvatarUrl } : null;
          
          const patient = {
            _id: patientId,
            id: patientId,
            first_name: firstName,
            last_name: lastName,
            avatar: avatar, // Avatar from notification or null (screen has fallback to initials)
          };
          
          const relationship = {
            id: relationshipId,
            _id: relationshipId,
            patient: patient
          };
          
          navigationRef.current.navigate('PatientChat', { patient, relationship });
        }
        break;

      case 'appointment':
        // Navigate to schedule/appointments screen
        navigationRef.current.navigate('Main', {
          screen: 'Schedule'
        });
        break;

      case 'consultation':
        // Navigate to consultations/telehealth screen
        navigationRef.current.navigate('Main', {
          screen: 'Consultations'
        });
        break;

      case 'patient_alert':
        // Navigate to patients list or specific patient
        if (data.patient_id) {
          navigationRef.current.navigate('Main', {
            screen: 'Patients'
          });
        } else {
          navigationRef.current.navigate('Main', {
            screen: 'Patients'
          });
        }
        break;

      case 'prescription':
        // Navigate to patients screen to manage prescriptions
        navigationRef.current.navigate('Main', {
          screen: 'Patients'
        });
        break;

      case 'general':
      default:
        // For general notifications or if screen is specified in data
        if (data.screen) {
          const params = data.params ? JSON.parse(data.params) : {};
          navigationRef.current.navigate(data.screen, params);
        } else {
          // Default to home/dashboard
          navigationRef.current.navigate('Main');
        }
        break;
    }
  };

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
        console.log('Notification caused app to open from quit state:', remoteMessage.notification);
        // Delay to ensure navigation is ready
        setTimeout(() => handleNotificationNavigation(remoteMessage), 1000);
      }
    });

    // Handle notification that opened the app from background state
    const unsubscribeOnNotificationOpenedApp = onNotificationOpenedApp(messaging(), (remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      handleNotificationNavigation(remoteMessage);
    });

    // Handle foreground messages
    const unsubscribeOnMessage = onMessage(messaging(), async (remoteMessage) => {
      console.log('A new FCM message arrived in foreground!', remoteMessage);
      // For foreground messages, show a toast or alert, but don't auto-navigate
      // User can tap the in-app notification to navigate if needed
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeTokenRefresh();
      unsubscribeOnNotificationOpenedApp();
      unsubscribeOnMessage();
    };
  }, [isAuthenticated, navigationRef]);

  return null;
}

export default function App() {

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider position="top">
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
