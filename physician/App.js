import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import IntroductionScreen from './screens/IntroductionScreen';
import LoginScreen from './screens/LoginScreen';
import TabNavigator from './navigation/TabNavigator';

const INTRO_SHOWN_KEY = '@intro_shown';

function AppContent() {
  const [showIntro, setShowIntro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {showIntro ? (
        <IntroductionScreen onGetStarted={handleGetStarted} />
      ) : isAuthenticated ? (
        <NavigationContainer>
          <TabNavigator />
        </NavigationContainer>
      ) : (
        <LoginScreen />
      )}
    </View>
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
