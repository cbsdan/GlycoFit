import React, { useState, useEffect, useRef } from 'react';
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
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { buttonStyles } from '../../styles/components/buttonStyles';
import { FontAwesome } from '@expo/vector-icons';
import { authService } from '../../services/api';

const OTPScreen = ({ navigation, route }) => {
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  
  const { colors } = useTheme();
  const toast = useToast();
  const { register } = useAuth();
  
  // Get email from navigation params
  const { email, registrationData } = route.params || {};
  
  // Refs for OTP inputs
  const otpRefs = useRef([]);
  
  // Countdown timer for resend button
  useEffect(() => {
    let timer;
    if (countdown > 0 && !canResend) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown, canResend]);

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all digits are entered
    if (text && index === 5 && newOtp.every(digit => digit !== '')) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace to move to previous input
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (otpCode = null) => {
    const otpToVerify = otpCode || otp.join('');
    
    if (otpToVerify.length !== 5) {
      toast.error('Please enter all 5 digits');
      return;
    }

    if (!email) {
      toast.error('Email address not found. Please try again.');
      navigation.goBack();
      return;
    }

    try {
      setIsVerifying(true);
      
      const result = await authService.verifyOTP(email, otpToVerify);
      
      if (result.success) {
        toast.success('Email verified successfully!');
        
        // If we have registration data, proceed with registration
        if (registrationData) {
          try {
            // Use the register method from AuthContext which will handle Firebase auth and backend registration
            const registerResult = await register(registrationData);
            
            if (registerResult.success) {
              toast.success('Registration completed successfully!');
              // Navigation will be handled by auth state change
            } else {
              toast.error(registerResult.error || 'Registration failed');
            }
          } catch (registerError) {
            console.error('Registration error:', registerError);
            toast.error('Registration failed. Please try again.');
          }
        } else {
          // Just email verification, go back to previous screen
          navigation.goBack();
        }
      } else {
        toast.error(result.error || 'Invalid OTP. Please try again.');
        // Clear OTP inputs
        setOtp(['', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;

    try {
      setIsResending(true);
      
      const result = await authService.generateOTP(email);
      
      if (result.success) {
        toast.success('New OTP sent to your email');
        setCountdown(30);
        setCanResend(false);
        // Clear current OTP
        setOtp(['', '', '', '', '']);
        otpRefs.current[0]?.focus();
      } else {
        toast.error(result.error || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      'Cancel Verification',
      'Are you sure you want to go back? You will need to start the registration process again.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Go Back', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    icon: {
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    emailText: {
      fontWeight: '600',
      color: colors.primary,
    },
    otpContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 32,
      paddingHorizontal: 8,
    },
    otpInput: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 56,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 8,
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.surface,
    },
    otpInputFocused: {
      borderColor: colors.primary,
    },
    otpInputFilled: {
      borderColor: colors.success || colors.primary,
      backgroundColor: colors.primaryLight || colors.surface,
    },
    verifyButton: {
      ...buttonStyles.primary,
      backgroundColor: colors.primary,
      marginBottom: 16,
    },
    disabledButton: {
      opacity: 0.6,
    },
    resendContainer: {
      alignItems: 'center',
      marginTop: 16,
    },
    resendText: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 8,
    },
    resendButton: {
      padding: 8,
    },
    resendButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    disabledResendText: {
      color: colors.secondary,
    },
    countdownText: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 4,
    },
    backButton: {
      marginTop: 24,
      alignSelf: 'center',
    },
    backButtonText: {
      fontSize: 16,
      color: colors.secondary,
      textDecorationLine: 'underline',
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <FontAwesome 
            name="envelope-o" 
            size={64} 
            color={colors.primary} 
            style={styles.icon}
          />
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 5-digit verification code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => otpRefs.current[index] = ref}
              style={[
                styles.otpInput,
                digit !== '' && styles.otpInputFilled,
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus={true}
              autoFocus={index === 0}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.verifyButton,
            (isVerifying || otp.join('').length !== 5) && styles.disabledButton
          ]}
          onPress={() => handleVerifyOtp()}
          disabled={isVerifying || otp.join('').length !== 5}
        >
          {isVerifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
              Verify Email
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive the code?
          </Text>
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendOtp}
            disabled={!canResend || isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[
                styles.resendButtonText,
                !canResend && styles.disabledResendText
              ]}>
                {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Text style={styles.backButtonText}>
            Back to Registration
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OTPScreen;
