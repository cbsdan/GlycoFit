import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import messaging from '@react-native-firebase/messaging';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { getMyAssessment } from './services/api';
import api from './services/api';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import OTPScreen from './screens/auth/OTPScreen';
import MealDetailScreen from './screens/MealDetailScreen';
import MealHistoryScreen from './screens/MealHistoryScreen';
import DiabetesRiskAssessmentScreen from './screens/DiabetesRiskAssessmentScreen';
import AssessmentResultsScreen from './screens/AssessmentResultsScreen';
import PhysicianCommunicationScreen from './screens/PhysicianCommunicationScreen';
import PhysicianMessagesScreen from './screens/PhysicianMessagesScreen';
import ChatBotScreen from './screens/ChatBotScreen';
import HealthMetricsSetupScreen from './screens/HealthMetricsSetupScreen';
import AlcoholIntakeScreen from './screens/AlcoholIntakeScreen';
import AlcoholTrackingScreen from './screens/AlcoholTrackingScreen';
import AlcoholBaselineScreen from './screens/AlcoholBaselineScreen';
import AlcoholDailyLogScreen from './screens/AlcoholDailyLogScreen';
import TabNavigator from './navigation/TabNavigator';
import LoadingScreen from './components/LoadingScreen';
import StepCounterScreen from './screens/StepCounterScreen';
import StepBaselineScreen from './screens/StepBaselineScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import DisclaimerScreen from './screens/DisclaimerScreen';
import AboutScreen from './screens/AboutScreen';

const Stack = createStackNavigator();
const WELCOME_SHOWN_KEY = '@welcome_shown';
const ASSESSMENT_SKIPPED_KEY = '@assessment_skipped';
const HEALTH_METRICS_SKIPPED_KEY = '@health_metrics_skipped';

// Register background handler - must be outside of any component
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
});

// Universal Screen Wrapper that handles safe areas for all screens
const UniversalScreenWrapper = ({ children }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
    }}>
      {children}
    </View>
  );
};

// Navigation component that handles auth state
function AppNavigator() {
  const { isAuthenticated, isLoading, user, refreshUserData } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigationRef = React.useRef();
  const [showWelcome, setShowWelcome] = useState(false);
  const [isCheckingWelcome, setIsCheckingWelcome] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isCheckingDisclaimer, setIsCheckingDisclaimer] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [isCheckingAssessment, setIsCheckingAssessment] = useState(false);
  const [showHealthMetrics, setShowHealthMetrics] = useState(false);
  const [isCheckingHealthMetrics, setIsCheckingHealthMetrics] = useState(false);
  const lastCheckedUserId = React.useRef(null);

  useEffect(() => {
    checkWelcomeStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Only check disclaimer status once per user login session
      // This prevents re-checking when user data is refreshed after disclaimer acceptance
      if (lastCheckedUserId.current !== user.uid) {
        checkDisclaimerStatus();
      }
    } else {
      // Reset when user logs out
      lastCheckedUserId.current = null;
    }
  }, [isAuthenticated, user]);

  const checkWelcomeStatus = async () => {
    try {
      const welcomeShown = await AsyncStorage.getItem(WELCOME_SHOWN_KEY);
      setShowWelcome(welcomeShown === null);
    } catch (error) {
      console.log('Error checking welcome status:', error);
      setShowWelcome(true);
    } finally {
      setIsCheckingWelcome(false);
    }
  };

  const handleWelcomeComplete = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      setShowWelcome(false);
    } catch (error) {
      console.log('Error saving welcome status:', error);
      setShowWelcome(false);
    }
  };

  const checkDisclaimerStatus = async () => {
    try {
      setIsCheckingDisclaimer(true);
      
      // Check from user object if disclaimer has been accepted
      const disclaimerAccepted = user?.disclaimer_accepted;
      
      // Show disclaimer if not accepted (null or false)
      const shouldShowDisclaimer = disclaimerAccepted !== true;
      
      setShowDisclaimer(shouldShowDisclaimer);
      
      // Mark this user as checked after we've determined the status
      lastCheckedUserId.current = user?.uid;
      
      // If disclaimer already accepted, proceed to check health metrics
      if (!shouldShowDisclaimer) {
        await checkHealthMetricsStatus();
      }
    } catch (error) {
      console.log('Error checking disclaimer status:', error);
      setShowDisclaimer(true);
      // Still mark as checked even on error to prevent infinite loops
      lastCheckedUserId.current = user?.uid;
    } finally {
      setIsCheckingDisclaimer(false);
    }
  };

  const handleDisclaimerComplete = async () => {
    // First hide the disclaimer screen
    setShowDisclaimer(false);
    
    // Refresh user data to get updated disclaimer_accepted status
    try {
      await refreshUserData();
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
    
    // After disclaimer is accepted, check health metrics
    await checkHealthMetricsStatus();
  };

  const checkAssessmentStatus = async () => {
    try {
      setIsCheckingAssessment(true);
      const skipped = await AsyncStorage.getItem(ASSESSMENT_SKIPPED_KEY);
      
      if (skipped === 'true') {
        setShowAssessment(false);
        return;
      }

      const assessment = await getMyAssessment();
      setShowAssessment(!assessment);
    } catch (error) {
      console.log('Error checking assessment status:', error);
      setShowAssessment(false);
    } finally {
      setIsCheckingAssessment(false);
    }
  };

  const checkHealthMetricsStatus = async () => {
    try {
      setIsCheckingHealthMetrics(true);
      const skipped = await AsyncStorage.getItem(HEALTH_METRICS_SKIPPED_KEY);
      
      if (skipped === 'true') {
        setShowHealthMetrics(false);
        // Check assessment after health metrics check
        await checkAssessmentStatus();
        return;
      }

      const response = await api.getHealthMetrics();
      const metrics = response?.health_metrics;
      
      // Check if all required metrics are set
      const hasAllMetrics = metrics && 
        metrics.age !== null && metrics.age !== undefined &&
        metrics.sex !== null && metrics.sex !== undefined &&
        metrics.height !== null && metrics.height !== undefined &&
        metrics.weight !== null && metrics.weight !== undefined;
      
      setShowHealthMetrics(!hasAllMetrics);
      
      // Only check assessment if health metrics are complete
      if (hasAllMetrics) {
        await checkAssessmentStatus();
      }
    } catch (error) {
      console.log('Error checking health metrics status:', error);
      // If there's an error (like 404), assume metrics need to be set
      setShowHealthMetrics(true);
    } finally {
      setIsCheckingHealthMetrics(false);
    }
  };

  const handleAssessmentSkip = async () => {
    try {
      await AsyncStorage.setItem(ASSESSMENT_SKIPPED_KEY, 'true');
      setShowAssessment(false);
    } catch (error) {
      console.log('Error saving assessment skip:', error);
      setShowAssessment(false);
    }
  };

  const handleAssessmentComplete = () => {
    setShowAssessment(false);
  };

  const handleHealthMetricsSkip = async () => {
    try {
      await AsyncStorage.setItem(HEALTH_METRICS_SKIPPED_KEY, 'true');
      setShowHealthMetrics(false);
      // Check if assessment needs to be shown after skipping health metrics
      await checkAssessmentStatus();
    } catch (error) {
      console.log('Error saving health metrics skip:', error);
      setShowHealthMetrics(false);
    }
  };

  const handleHealthMetricsComplete = async () => {
    setShowHealthMetrics(false);
    // Check if assessment needs to be shown after completing health metrics
    await checkAssessmentStatus();
  };

  if (isLoading || isCheckingWelcome || isCheckingDisclaimer || isCheckingAssessment || isCheckingHealthMetrics) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: {
            fontFamily: 'System',
            fontWeight: '400',
          },
          medium: {
            fontFamily: 'System',
            fontWeight: '500',
          },
          bold: {
            fontFamily: 'System',
            fontWeight: '700',
          },
          heavy: {
            fontFamily: 'System',
            fontWeight: '800',
          },
        },
      }}
    >
      <FCMHandler navigationRef={navigationRef} />
      <StatusBar 
        style={isDarkMode ? 'light' : 'dark'} 
      />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.headerBackground,
          },
          headerTintColor: colors.headerText,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        {isAuthenticated ? (
          <>
            {showDisclaimer ? (
              <Stack.Screen 
                name="Disclaimer" 
                options={{ headerShown: false }}
              >
                {(props) => (
                  <UniversalScreenWrapper>
                    <DisclaimerScreen 
                      {...props}
                      onComplete={handleDisclaimerComplete}
                    />
                  </UniversalScreenWrapper>
                )}
              </Stack.Screen>
            ) : showHealthMetrics ? (
              <Stack.Screen 
                name="HealthMetricsSetup" 
                options={{ headerShown: false }}
              >
                {(props) => (
                  <UniversalScreenWrapper>
                    <HealthMetricsSetupScreen 
                      {...props}
                      onSkip={handleHealthMetricsSkip}
                      onComplete={handleHealthMetricsComplete}
                    />
                  </UniversalScreenWrapper>
                )}
              </Stack.Screen>
            ) : showAssessment ? (
              <Stack.Screen 
                name="InitialAssessment" 
                options={{ headerShown: false }}
              >
                {(props) => (
                  <UniversalScreenWrapper>
                    <DiabetesRiskAssessmentScreen 
                      {...props} 
                      isInitial={true}
                      onSkip={handleAssessmentSkip}
                      onComplete={handleAssessmentComplete}
                    />
                  </UniversalScreenWrapper>
                )}
              </Stack.Screen>
            ) : null}
            <Stack.Screen 
              name="Main" 
              options={{ headerShown: false }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <TabNavigator {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="StepCounter" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <StepCounterScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="StepBaseline" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <StepBaselineScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="MealHistory" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <MealHistoryScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="MealDetail" 
              options={{ 
                headerShown: false,
                presentation: 'modal'
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <MealDetailScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="DiabetesRiskAssessment" 
              options={{ 
                headerShown: false,
                presentation: 'modal'
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <DiabetesRiskAssessmentScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="AssessmentResults" 
              options={{ 
                headerShown: false,
                presentation: 'modal'
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AssessmentResultsScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="PhysicianCommunication" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <PhysicianCommunicationScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="PhysicianMessages" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <PhysicianMessagesScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="ChatBot" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <ChatBotScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="DisclaimerView" 
              options={{ 
                headerShown: false,
                presentation: 'modal'
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <DisclaimerScreen 
                    {...props}
                    readOnly={true}
                  />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="About" 
              options={{ 
                headerShown: false,
                presentation: 'modal'
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AboutScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="AlcoholIntake" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AlcoholIntakeScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="AlcoholTracking" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AlcoholTrackingScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="AlcoholBaseline" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AlcoholBaselineScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="AlcoholDailyLog" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <AlcoholDailyLogScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
          </>
        ) : (
          <>
            {showWelcome && (
              <Stack.Screen 
                name="Welcome" 
                options={{ headerShown: false }}
              >
                {(props) => (
                  <WelcomeScreen 
                    {...props} 
                    onComplete={handleWelcomeComplete}
                  />
                )}
              </Stack.Screen>
            )}
            <Stack.Screen 
              name="Login" 
              options={{ headerShown: false }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <LoginScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="Register" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <RegisterScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="OTPVerification" 
              options={{ 
                headerShown: false
              }} 
            >
              {(props) => (
                <UniversalScreenWrapper>
                  <OTPScreen {...props} />
                </UniversalScreenWrapper>
              )}
            </Stack.Screen>
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
    authStatus === 1 || // AuthorizationStatus.AUTHORIZED
    authStatus === 2;   // AuthorizationStatus.PROVISIONAL

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
      const token = await messaging().getToken();
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
        // Navigate to chat screen
        if (data.conversation_id) {
          const relationshipId = data.relationship_id;
          const physicianUserId = data.physician_id; // This is the user_id from users collection
          const physicianName = data.physician_name || 'Physician';
          const physicianAvatarUrl = data.physician_avatar_url; // Avatar URL from notification
          
          // Parse physician name (handle "Dr. FirstName LastName" format)
          let firstName = 'Physician';
          let lastName = '';
          
          if (physicianName) {
            // Remove "Dr." prefix if present and trim
            const cleanName = physicianName.replace(/^Dr\.\s*/i, '').trim();
            const nameParts = cleanName.split(' ');
            if (nameParts.length > 0) {
              firstName = nameParts[0];
              lastName = nameParts.slice(1).join(' ');
            }
          }
          
          // Construct avatar object if URL exists
          const avatar = physicianAvatarUrl ? { url: physicianAvatarUrl } : null;
          
          // Construct relationship object matching the structure from getMyPhysician API
          const relationship = {
            id: relationshipId,
            _id: relationshipId,
            relationship: {
              id: relationshipId,
              _id: relationshipId
            },
            physician: {
              _id: physicianUserId, // Physician document ID (for display)
              id: physicianUserId,
              user_id: physicianUserId, // User ID (needed for conversation)
              first_name: firstName,
              last_name: lastName,
              full_name: physicianName,
              user: {
                _id: physicianUserId,
                first_name: firstName,
                last_name: lastName,
                avatar: avatar // Avatar from notification or null (screen has fallback to initials)
              }
            }
          };
          
          navigationRef.current.navigate('PhysicianMessages', { relationship });
        }
        break;

      case 'appointment':
        // Navigate to physician communication (where appointments are managed)
        navigationRef.current.navigate('PhysicianCommunication');
        break;

      case 'prescription':
        // Navigate to physician communication to view prescriptions
        navigationRef.current.navigate('PhysicianCommunication');
        break;

      case 'assessment_reminder':
        // Navigate to diabetes risk assessment
        navigationRef.current.navigate('DiabetesRiskAssessment');
        break;

      case 'health_metrics':
        // Navigate to health data screen via Settings tab
        navigationRef.current.navigate('Main', {
          screen: 'Settings',
          params: {
            screen: 'HealthData'
          }
        });
        break;

      case 'meal_log':
        // Navigate to meal history
        navigationRef.current.navigate('MealHistory');
        break;

      case 'chatbot':
        // Navigate to chatbot screen
        navigationRef.current.navigate('ChatBot');
        break;

      case 'general':
      default:
        // For general notifications or if screen is specified in data
        if (data.screen) {
          const params = data.params ? JSON.parse(data.params) : {};
          navigationRef.current.navigate(data.screen, params);
        } else {
          // Default to home screen
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
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
      console.log('FCM Token refreshed:', token);
      if (isAuthenticated) {
        try {
          await api.saveFCMToken(token);
          console.log('Refreshed FCM token saved to backend successfully');
        } catch (error) {
          console.error('Failed to save refreshed FCM token to backend:', error);
        }
      }
    });

    // Handle notification that opened the app from quit state
    messaging().getInitialNotification().then(async (remoteMessage) => {
      if (remoteMessage) {
        console.log('Notification caused app to open from quit state:', remoteMessage.notification);
        // Delay to ensure navigation is ready
        setTimeout(() => handleNotificationNavigation(remoteMessage), 1000);
      }
    });

    // Handle notification that opened the app from background state
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      handleNotificationNavigation(remoteMessage);
    });

    // Handle foreground messages
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
      console.log('A new FCM message arrived in foreground!', remoteMessage);
      // For foreground messages, show a toast or alert, but don't auto-navigate
      // User can tap the in-app notification to navigate
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView >
  );
}
