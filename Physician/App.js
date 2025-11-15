import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initializeApp } from 'firebase/app';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        
        // Fetch Firebase config from backend
        const response = await fetch(`${backendUrl}/config/firebase`);
        if (!response.ok) {
          throw new Error('Failed to fetch Firebase config');
        }

        const firebaseConfig = await response.json();

        // Initialize Firebase
        initializeApp(firebaseConfig);
        setFirebaseInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        // Fallback: Try to initialize with local config
        try {
          const localConfig = require('./firebaseConfig.json');
          initializeApp(localConfig);
          setFirebaseInitialized(true);
        } catch (localError) {
          console.error('Failed to load local Firebase config:', localError);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  if (loading || !firebaseInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
