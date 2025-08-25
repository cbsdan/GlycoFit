import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import OTPScreen from './screens/auth/OTPScreen';
import TabNavigator from './navigation/TabNavigator';
import LoadingScreen from './components/LoadingScreen';

const Stack = createStackNavigator();

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
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDarkMode } = useTheme();

  if (isLoading) {
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
        ) : (
          <>
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
