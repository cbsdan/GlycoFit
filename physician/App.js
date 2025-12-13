import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import IntroductionScreen from './screens/IntroductionScreen';
import LoginScreen from './screens/LoginScreen';
import PatientChatScreen from './screens/PatientChatScreen';
import TabNavigator from './navigation/TabNavigator';

const Stack = createNativeStackNavigator();
const INTRO_SHOWN_KEY = '@intro_shown';

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
