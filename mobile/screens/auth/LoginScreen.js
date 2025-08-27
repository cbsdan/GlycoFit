import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { globalStyles } from '../../styles/globalStyles';
import { buttonStyles } from '../../styles/components/buttonStyles';
import { FontAwesome } from '@expo/vector-icons';
import { GOOGLE_SIGNIN_CONFIG } from '../../config/google-auth-config';
import { auth } from '../../config/firebase-config';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import 'expo-dev-client';

// Initialize Google Sign-in
GoogleSignin.configure(GOOGLE_SIGNIN_CONFIG);

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);

  const { login, googleSignIn, setIsLoading } = useAuth();
  const { colors, toggleTheme, isDarkMode } = useTheme();
  const toast = useToast();

  const textInputStyle = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderColor: colors.border,
  };

  const handleGoogleSignIn = async (confirmRegistration = false) => {
    try {
      setIsLoading(true);
      setLoginInProgress(true);
      console.log('Starting Google Sign-in process...');

      // Check if your device has Google Play Services installed
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('Google Play Services check passed');

      // Get the user ID token
      console.log('Requesting Google sign-in...');
      const signInResult = await GoogleSignin.signIn();
      console.log('Google sign-in successful, full result:', JSON.stringify(signInResult));

      // The idToken is nested inside the data property, not directly on the result
      const idToken = signInResult.data?.idToken || signInResult.idToken;

      if (!idToken) {
        throw new Error('Failed to get ID token from Google Sign-in');
      }

      console.log('Successfully retrieved idToken');

      // Create a Firebase credential with the token using the Web SDK
      console.log('Creating Firebase credential');
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign in with credential to Firebase using the Web SDK
      console.log('Signing in to Firebase');
      const userCredential = await signInWithCredential(auth, googleCredential);
      const firebaseUser = userCredential.user;

      console.log('Firebase User UID:', firebaseUser.uid);
      console.log('Firebase User Email:', firebaseUser.email);
      console.log('Firebase User DisplayName:', firebaseUser.displayName);

      // Use our auth context's googleSignIn method
      console.log('Calling auth context googleSignIn method');
      const result = await googleSignIn(idToken, confirmRegistration);
      console.log('Auth context googleSignIn completed:', result);

      if (result && result.success) {
        // Show success message with user's name
        const displayName = result.user?.first_name || firebaseUser.displayName || 'User';
        
        if (result.isNewUser) {
          toast.success(`Welcome to GlycoFit, ${displayName}! Your account has been created successfully.`);
        } else {
          toast.success(`Welcome back, ${displayName}!`);
        }

        // Navigation will be handled by auth state change in App.js
      } else if (result && result.needsRegistration) {
        // Show confirmation dialog for new user registration
        const userInfo = result.userInfo;
        Alert.alert(
          'Create New Account',
          `Welcome! It looks like this is your first time signing in with Google.\n\nEmail: ${userInfo.email}\nName: ${userInfo.displayName || 'Not provided'}\n\nWould you like to create a new GlycoFit account?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('User cancelled registration');
                toast.info('Sign-in cancelled');
              }
            },
            {
              text: 'Create Account',
              onPress: async () => {
                console.log('User confirmed registration');
                toast.info('Creating your account...');
                
                // Call handleGoogleSignIn again with confirmation
                setTimeout(() => {
                  handleGoogleSignIn(true);
                }, 500);
              }
            }
          ]
        );
      } else {
        const errorMsg = result?.error || 'Authentication failed';
        console.error('Authentication failed in auth context:', errorMsg);
        toast.error(errorMsg);
      }

    } catch (error) {
      console.error('Google sign in error details:', error);

      let errorMessage = 'Google sign in failed. Please try again.';

      if (error) {
        if (typeof error === 'object') {
          if (error.message) {
            errorMessage = `Google sign in error: ${error.message}`;
          }
          if ('code' in error) {
            if (error.code === 'CANCELED') {
              errorMessage = 'Sign in was canceled';
            } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
              errorMessage = 'Google Play Services is not available';
            } else {
              errorMessage = `Google sign in error (${error.code})`;
            }
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setLoginInProgress(true);
      const result = await login(email, password);

      if (result.success) {
        const user = result.user;
        toast.success(`Welcome back ${user?.first_name || "User"}!`);

        // Navigation will be handled by auth state change in App.js
      } else {
        toast.error(result.error || 'Please check your credentials and try again');
      }
    } catch (error) {
      toast.error(error.message || 'Please check your credentials and try again');
    } finally {
      setLoginInProgress(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 24,
    },
    logoContainer: {
      alignItems: 'center',
      marginVertical: 30,
    },
    title: {
      fontSize: 28,
      fontWeight: '600',
    },
    inputContainer: {
      width: '100%',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      height: 50,
      paddingHorizontal: 12,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      height: 50,
      paddingVertical: 8,
    },
    label: {
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    orContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    divider: {
      flex: 1,
      height: 1,
    },
    orText: {
      marginHorizontal: 10,
      fontWeight: '600',
    },
    googleButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    registerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    themeToggle: {
      ...buttonStyles.text,
      marginTop: 16,
      alignSelf: 'center',
    },
    themeToggleText: {
      fontSize: 14,
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={[styles.title, { color: colors.text }]}>GlycoFit</Text>
        </View>

        <Text style={[globalStyles.subtitle, { color: colors.text, alignSelf: 'center', marginBottom: 24 }]}>
          Log in to your account
        </Text>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.secondary }]}>Email</Text>
          <View style={[styles.inputWrapper, textInputStyle]}>
            <FontAwesome name="envelope" size={20} color={colors.secondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your email"
              placeholderTextColor={colors.secondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <Text style={[styles.label, { color: colors.secondary, marginTop: 16 }]}>Password</Text>
          <View style={[styles.inputWrapper, textInputStyle]}>
            <FontAwesome name="lock" size={20} color={colors.secondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.secondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <FontAwesome
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[buttonStyles.primary, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={handleLogin}
            disabled={loginInProgress}
          >
            {loginInProgress ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.orContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.secondary }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[buttonStyles.secondary, {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }]}
            onPress={handleGoogleSignIn}
            disabled={loginInProgress}
          >
            <View style={styles.googleButtonContent}>
              <FontAwesome name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                Continue with Google
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={{ color: colors.secondary }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Register</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.themeToggle}
            onPress={toggleTheme}
          >
            <Text style={[styles.themeToggleText, { color: colors.primary }]}>
              Switch to {isDarkMode ? 'Light' : 'Dark'} Mode
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;