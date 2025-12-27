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
import messaging, { getToken, onTokenRefresh, onMessage, getInitialNotification, onNotificationOpenedApp } from '@react-native-firebase/messaging';
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
import HealthMetricsSetupScreen from './screens/HealthMetricsSetupScreen';
import TabNavigator from './navigation/TabNavigator';
import LoadingScreen from './components/LoadingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import DisclaimerScreen, { DISCLAIMER_ACCEPTED_KEY } from './screens/DisclaimerScreen';

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
  const { isAuthenticated, isLoading, user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const [showWelcome, setShowWelcome] = useState(false);
  const [isCheckingWelcome, setIsCheckingWelcome] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isCheckingDisclaimer, setIsCheckingDisclaimer] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [isCheckingAssessment, setIsCheckingAssessment] = useState(false);
  const [showHealthMetrics, setShowHealthMetrics] = useState(false);
  const [isCheckingHealthMetrics, setIsCheckingHealthMetrics] = useState(false);

  useEffect(() => {
    checkWelcomeStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      checkDisclaimerStatus();
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
      const disclaimerAccepted = await AsyncStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
      const shouldShowDisclaimer = disclaimerAccepted !== 'true';
      
      setShowDisclaimer(shouldShowDisclaimer);
      
      // If disclaimer already accepted, proceed to check health metrics
      if (!shouldShowDisclaimer) {
        await checkHealthMetricsStatus();
      }
    } catch (error) {
      console.log('Error checking disclaimer status:', error);
      setShowDisclaimer(true);
    } finally {
      setIsCheckingDisclaimer(false);
    }
  };

  const handleDisclaimerComplete = async () => {
    setShowDisclaimer(false);
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
          await api.saveFCMToken(token);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <FCMHandler />
              <AppNavigator />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView >
  );
}
