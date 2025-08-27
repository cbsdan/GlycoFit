import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FontAwesome } from '@expo/vector-icons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { GOOGLE_SIGNIN_CONFIG } from '../../config/google-auth-config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authService } from '../../services/api';

GoogleSignin.configure(GOOGLE_SIGNIN_CONFIG);

const RegisterScreen = ({ navigation }) => {
  const { googleSignIn, setIsLoading } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const textInputStyle = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderColor: colors.border,
  };

  const handlePickAvatar = () => {
    setIsModalVisible(true);
  };
  
  const handleChooseFromLibrary = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        toast.warning('You need to allow access to your photos to upload an avatar.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType ? 
          ImagePicker.MediaType.Images : 
          ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          setAvatar(result.assets[0].uri);
          console.log("Image selected:", result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      toast.error('Failed to pick an image. Please try again.');
    } finally {
      setIsModalVisible(false);
    }
  };
  
  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        toast.warning('You need to allow camera access to take a photo.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          setAvatar(result.assets[0].uri);
          console.log("Image captured:", result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      toast.error('Failed to take a photo. Please try again.');
    } finally {
      setIsModalVisible(false);
    }
  };
  
  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      toast.warning('Please fill in all required fields');
      return;
    }
    
    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters long');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning('Please enter a valid email address');
      return;
    }
    
    try {
      setRegistrationInProgress(true);
      
      // Generate OTP for email verification
      const otpResult = await authService.generateOTP(email.trim());
      
      if (otpResult.success) {
        // Prepare registration data to pass to OTP screen
        const registrationData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: password,
          avatar: avatar
        };
        
        toast.success('Verification code sent to your email');
        
        // Navigate to OTP screen with registration data
        navigation.navigate('OTPVerification', {
          email: email.trim(),
          registrationData: registrationData
        });
      } else {
        toast.error(otpResult.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.log("OTP generation error:", error);
      toast.error('Failed to send verification code. Please try again.');
    } finally {
      setRegistrationInProgress(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setRegistrationInProgress(true);
      console.log('Starting Google Sign-in process...');
      
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('Google Play Services check passed');
      
      // Sign in with Google
      const signInResult = await GoogleSignin.signIn();
      console.log('Google sign-in result structure:', JSON.stringify(signInResult));
      
      // Extract token directly - we need this for Firebase authentication
      const idToken = signInResult.idToken || signInResult.data?.idToken;
      
      console.log('Successfully extracted token');
      
      setIsLoading(true);

      // Use our auth context's googleSignIn method
      const result = await googleSignIn(idToken);
      
      if (result && result.success) {
        const displayName = result.user?.first_name || 'User';
        toast.success(`Welcome ${displayName}!`);
        
        // Navigation will be handled by auth state change in App.js
      } else {
        throw new Error(result?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Google sign in error details:', error);
      
      let errorMessage = 'Google sign in failed. Please try again.';
      
      if (error.message) {
        errorMessage = `Google sign in error: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setRegistrationInProgress(false);
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 20,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 30,
      marginTop: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '600',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
    },
    avatarContainer: {
      alignItems: 'center',
      marginBottom: 30,
    },
    avatarPicker: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    avatarText: {
      fontSize: 14,
    },
    formContainer: {
      marginBottom: 30,
    },
    inputContainer: {
      marginBottom: 15,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 15,
      height: 50,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
    },
    eyeIcon: {
      padding: 5,
    },
    registerButton: {
      backgroundColor: '#007AFF',
      height: 50,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    registerButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    dividerText: {
      marginHorizontal: 15,
      fontSize: 14,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 50,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 30,
    },
    googleIcon: {
      marginRight: 10,
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    loginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginText: {
      fontSize: 14,
    },
    loginLink: {
      fontSize: 14,
      color: '#007AFF',
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#fff',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 40,
      paddingHorizontal: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 20,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
    },
    modalOptionText: {
      fontSize: 16,
      marginLeft: 15,
    },
    modalCancelButton: {
      marginTop: 10,
      paddingVertical: 15,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 16,
      color: '#007AFF',
      fontWeight: '600',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Sign up to get started
          </Text>
        </View>

        {/* Avatar Selection */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity 
            style={[styles.avatarPicker, { borderColor: colors.border }]}
            onPress={handlePickAvatar}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <MaterialCommunityIcons 
                name="camera-plus" 
                size={32} 
                color={colors.secondary} 
              />
            )}
          </TouchableOpacity>
          <Text style={[styles.avatarText, { color: colors.secondary }]}>
            Add Photo
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* First Name */}
          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { 
              borderColor: colors.border,
              backgroundColor: colors.surface 
            }]}>
              <MaterialCommunityIcons 
                name="account" 
                size={20} 
                color={colors.secondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="First Name"
                placeholderTextColor={colors.secondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Last Name */}
          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { 
              borderColor: colors.border,
              backgroundColor: colors.surface 
            }]}>
              <MaterialCommunityIcons 
                name="account" 
                size={20} 
                color={colors.secondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Last Name"
                placeholderTextColor={colors.secondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { 
              borderColor: colors.border,
              backgroundColor: colors.surface 
            }]}>
              <MaterialCommunityIcons 
                name="email" 
                size={20} 
                color={colors.secondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Email"
                placeholderTextColor={colors.secondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { 
              borderColor: colors.border,
              backgroundColor: colors.surface 
            }]}>
              <MaterialCommunityIcons 
                name="lock" 
                size={20} 
                color={colors.secondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.secondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          style={[styles.registerButton, { opacity: registrationInProgress ? 0.7 : 1 }]}
          onPress={handleRegister}
          disabled={registrationInProgress}
        >
          {registrationInProgress ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.registerButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.secondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Google Sign Up Button */}
        <TouchableOpacity
          style={[styles.googleButton, { 
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: registrationInProgress ? 0.7 : 1 
          }]}
          onPress={handleGoogleSignIn}
          disabled={registrationInProgress}
        >
          {registrationInProgress ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <>
              <FontAwesome name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
              <Text style={[styles.googleButtonText, { color: colors.text }]}>
                Sign up with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={[styles.loginText, { color: colors.secondary }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Avatar Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Avatar
            </Text>
            
            <TouchableOpacity
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={handleTakePhoto}
            >
              <MaterialCommunityIcons 
                name="camera" 
                size={24} 
                color={colors.text} 
              />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>
                Take Photo
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={handleChooseFromLibrary}
            >
              <MaterialCommunityIcons 
                name="image" 
                size={24} 
                color={colors.text} 
              />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RegisterScreen;