import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FontAwesome } from '@expo/vector-icons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_SIGNIN_CONFIG } from '../../config/google-auth-config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authService } from '../../services/api';

GoogleSignin.configure(GOOGLE_SIGNIN_CONFIG);

const { width, height } = Dimensions.get('window');

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const ACCENT       = '#4D9FFF';
const ACCENT2      = '#1E6FFF';
const ACCENT_DIM   = 'rgba(77,159,255,0.12)';
const ACCENT_GLOW  = 'rgba(77,159,255,0.35)';
const BG_DARK      = '#060d1f';

// ─── Animated Glow Input ──────────────────────────────────────────────────────
function GlowInput({
  icon, placeholder, value, onChangeText,
  secureTextEntry, keyboardType, autoCapitalize,
  rightIcon, onRightIconPress, tv,
}) {
  const [focused, setFocused] = useState(false);
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  const animate = (toValue) => {
    Animated.parallel([
      Animated.timing(glowAnim,   { toValue, duration: 280, useNativeDriver: false }),
      Animated.timing(borderAnim, { toValue, duration: 280, useNativeDriver: false }),
    ]).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tv?.inputBorder || 'rgba(255,255,255,0.07)', ACCENT],
  });
  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tv?.inputBg || 'rgba(255,255,255,0.04)', 'rgba(77,159,255,0.07)'],
  });

  return (
    <Animated.View style={[inputStyles.wrapper, { borderColor, backgroundColor: bgColor }]}>
      <FontAwesome
        name={icon} size={16}
        color={focused ? ACCENT : (tv?.inputIcon || 'rgba(255,255,255,0.22)')}
        style={inputStyles.icon}
      />
      <TextInput
        style={[inputStyles.input, { color: tv?.inputText || '#fff' }]}
        placeholder={placeholder}
        placeholderTextColor={tv?.inputPlaceholder || 'rgba(255,255,255,0.18)'}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => { setFocused(true);  animate(1); }}
        onBlur= {() => { setFocused(false); animate(0); }}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'none'}
        selectionColor={ACCENT}
      />
      {rightIcon && (
        <TouchableOpacity onPress={onRightIconPress} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <FontAwesome name={rightIcon} size={16} color={tv?.inputRightIcon || 'rgba(255,255,255,0.28)'} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const inputStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  icon: { marginRight: 12, width: 18 },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    height: 54,
  },
});

// ─── RegisterScreen ───────────────────────────────────────────────────────────
const RegisterScreen = ({ navigation }) => {
  const { googleSignIn, setIsLoading } = useAuth();
  const { colors, toggleTheme, isDarkMode } = useTheme();
  const toast = useToast();

  // ── Theme variables ──────────────────────────────────────────────────────
  const tv = isDarkMode ? {
    bgColors: ['#060d1f', '#080f24', '#050b18'],
    rootBg: BG_DARK,
    cardBg: 'rgba(77,159,255,0.03)',
    cardBorder: ACCENT + '18',
    cardTitle: '#fff',
    cardSubtitle: 'rgba(255,255,255,0.28)',
    fieldLabel: 'rgba(255,255,255,0.20)',
    avatarText: 'rgba(255,255,255,0.28)',
    orb1Bg: 'rgba(30,111,255,0.12)',
    orb2Bg: 'rgba(77,159,255,0.07)',
    orb3Bg: 'rgba(30,111,255,0.09)',
    orLine: 'rgba(255,255,255,0.06)',
    orText: 'rgba(255,255,255,0.18)',
    googleBtnBg: 'rgba(255,255,255,0.04)',
    googleBtnBorder: 'rgba(255,255,255,0.08)',
    googleBtnText: 'rgba(255,255,255,0.6)',
    loginText: 'rgba(255,255,255,0.22)',
    themeToggleText: 'rgba(255,255,255,0.18)',
    toggleLabel: 'Light',
    toggleIcon: '☀️',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.07)',
    inputText: '#fff',
    inputPlaceholder: 'rgba(255,255,255,0.18)',
    inputIcon: 'rgba(255,255,255,0.22)',
    inputRightIcon: 'rgba(255,255,255,0.28)',
    modalBg: 'rgba(12,20,40,0.98)',
    modalBorder: ACCENT + '25',
    modalTitle: '#fff',
    modalOptionBg: 'rgba(77,159,255,0.05)',
    modalOptionBorder: 'rgba(255,255,255,0.08)',
    modalOptionText: 'rgba(255,255,255,0.75)',
    modalIconBg: 'rgba(77,159,255,0.12)',
    modalCancelBg: 'rgba(255,255,255,0.03)',
  } : {
    bgColors: ['#e8f0ff', '#eef2ff', '#f0f5ff'],
    rootBg: '#eef2ff',
    cardBg: 'rgba(255,255,255,0.92)',
    cardBorder: ACCENT + '30',
    cardTitle: '#0d1a3a',
    cardSubtitle: 'rgba(13,26,58,0.45)',
    fieldLabel: 'rgba(13,26,58,0.40)',
    avatarText: 'rgba(13,26,58,0.40)',
    orb1Bg: 'rgba(30,111,255,0.06)',
    orb2Bg: 'rgba(77,159,255,0.04)',
    orb3Bg: 'rgba(30,111,255,0.05)',
    orLine: 'rgba(0,0,0,0.07)',
    orText: 'rgba(13,26,58,0.35)',
    googleBtnBg: 'rgba(0,0,0,0.03)',
    googleBtnBorder: 'rgba(0,0,0,0.09)',
    googleBtnText: 'rgba(13,26,58,0.60)',
    loginText: 'rgba(13,26,58,0.45)',
    themeToggleText: 'rgba(13,26,58,0.38)',
    toggleLabel: 'Dark',
    toggleIcon: '🌙',
    inputBg: 'rgba(13,26,58,0.03)',
    inputBorder: 'rgba(13,26,58,0.10)',
    inputText: '#0d1a3a',
    inputPlaceholder: 'rgba(13,26,58,0.35)',
    inputIcon: 'rgba(13,26,58,0.35)',
    inputRightIcon: 'rgba(13,26,58,0.35)',
    modalBg: 'rgba(230,236,255,0.99)',
    modalBorder: ACCENT + '30',
    modalTitle: '#0d1a3a',
    modalOptionBg: 'rgba(77,159,255,0.04)',
    modalOptionBorder: 'rgba(0,0,0,0.08)',
    modalOptionText: 'rgba(13,26,58,0.75)',
    modalIconBg: 'rgba(77,159,255,0.10)',
    modalCancelBg: 'rgba(0,0,0,0.03)',
  };
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Entry animations
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.7)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(36)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity,   { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(cardTranslate, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

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
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning('Please enter a valid email address');
      return;
    }
    
    try {
      setRegistrationInProgress(true);
      
      const otpResult = await authService.generateOTP(email.trim());
      
      if (otpResult.success) {
        const registrationData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: password,
          avatar: avatar
        };
        
        toast.success('Verification code sent to your email');
        
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
      setGoogleLoading(true);
      
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.idToken || signInResult.data?.idToken;
      
      setIsLoading(true);

      const result = await googleSignIn(idToken);
      
      if (result && result.success) {
        const displayName = result.user?.first_name || 'User';
        toast.success(`Welcome ${displayName}!`);
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
      setGoogleLoading(false);
      setIsLoading(false);
    }
  };

  const isLoading = registrationInProgress || googleLoading;

  return (
    <View style={[styles.root, { backgroundColor: tv.rootBg }]}>
      {/* ── Background gradient ── */}
      <LinearGradient
        colors={tv.bgColors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Ambient orbs ── */}
      <View style={[styles.orb1, { backgroundColor: tv.orb1Bg }]} />
      <View style={[styles.orb2, { backgroundColor: tv.orb2Bg }]} />
      <View style={[styles.orb3, { backgroundColor: tv.orb3Bg }]} />

      {/* ── Corner accents ── */}
      <View style={[styles.cornerTL, { borderColor: ACCENT + '40' }]} />
      <View style={[styles.cornerTR, { borderColor: ACCENT + '30' }]} />
      <View style={[styles.cornerBL, { borderColor: ACCENT + '20' }]} />
      <View style={[styles.cornerBR, { borderColor: ACCENT + '20' }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Logo Block ── */}
          <Animated.View style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <View style={styles.ringWrapper}>
              <View style={[styles.dashedRing, { borderColor: ACCENT + '35' }]} />
              <LinearGradient
                colors={[ACCENT2, ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoIconBox}
              >
                <Image 
                  source={require('../../assets/splash-icon.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </LinearGradient>
            </View>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslate }],
              backgroundColor: tv.cardBg,
              borderColor: tv.cardBorder,
            },
          ]}>

            {/* Card header */}
            <Text style={[styles.cardTitle, { color: tv.cardTitle }]}>Create Account</Text>
            <Text style={[styles.cardSubtitle, { color: tv.cardSubtitle }]}>Sign up to start your health journey</Text>

            {/* Blue accent bar */}
            <View style={styles.accentBarRow}>
              <LinearGradient colors={[ACCENT2, ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
              <View style={[styles.accentDot, { backgroundColor: ACCENT, shadowColor: ACCENT }]} />
            </View>

            {/* Avatar Selection */}
            <View style={styles.avatarContainer}>
              <TouchableOpacity 
                style={styles.avatarPicker}
                onPress={handlePickAvatar}
                activeOpacity={0.8}
              >
                <View style={[styles.avatarRing, { borderColor: ACCENT + '35' }]} />
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} />
                ) : (
                  <LinearGradient
                    colors={[ACCENT2, ACCENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarPlaceholder}
                  >
                    <MaterialCommunityIcons 
                      name="camera-plus" 
                      size={28} 
                      color="#fff" 
                    />
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <Text style={[styles.avatarText, { color: tv.avatarText }]}>Add Profile Photo</Text>
            </View>

            {/* First Name */}
            <Text style={[styles.fieldLabel, { color: tv.fieldLabel }]}>FIRST NAME</Text>
            <GlowInput
              icon="user"
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              tv={tv}
            />

            {/* Last Name */}
            <Text style={[styles.fieldLabel, { color: tv.fieldLabel }]}>LAST NAME</Text>
            <GlowInput
              icon="user"
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              tv={tv}
            />

            {/* Email */}
            <Text style={[styles.fieldLabel, { color: tv.fieldLabel }]}>EMAIL ADDRESS</Text>
            <GlowInput
              icon="envelope"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              tv={tv}
            />

            {/* Password */}
            <Text style={[styles.fieldLabel, { color: tv.fieldLabel }]}>PASSWORD</Text>
            <GlowInput
              icon="lock"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-slash' : 'eye'}
              onRightIconPress={() => setShowPassword(!showPassword)}
              tv={tv}
            />

            {/* Register CTA */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
              style={[styles.registerBtnWrapper, { shadowColor: ACCENT2 }]}
            >
              <LinearGradient
                colors={[ACCENT2, ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerBtn}
              >
                {registrationInProgress ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.registerBtnText}>CREATE ACCOUNT  →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* OR divider */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: tv.orLine }]} />
              <Text style={[styles.orText, { color: tv.orText }]}>OR</Text>
              <View style={[styles.orLine, { backgroundColor: tv.orLine }]} />
            </View>

            {/* Google button */}
            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: tv.googleBtnBg, borderColor: tv.googleBtnBorder }]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color={tv.googleBtnText} size="small" />
              ) : (
                <>
                  <View style={styles.googleIconBox}>
                    <FontAwesome name="google" size={15} color="#DB4437" />
                  </View>
                  <Text style={[styles.googleBtnText, { color: tv.googleBtnText }]}>Sign up with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: tv.loginText }]}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={[styles.loginLink, { color: ACCENT }]}>Sign In →</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Theme toggle */}
          <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme} activeOpacity={0.7}>
            <Text style={[styles.themeToggleText, { color: tv.themeToggleText }]}>
              {tv.toggleIcon}  Switch to {tv.toggleLabel} Mode
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: tv.modalBg, borderColor: tv.modalBorder }]}>
            <Text style={[styles.modalTitle, { color: tv.modalTitle }]}>Select Avatar</Text>
            
            <TouchableOpacity
              style={[styles.modalOption, { backgroundColor: tv.modalOptionBg, borderColor: tv.modalOptionBorder }]}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.modalIconBox, { backgroundColor: tv.modalIconBg }]}>
                <MaterialCommunityIcons 
                  name="camera" 
                  size={20} 
                  color={ACCENT} 
                />
              </View>
              <Text style={[styles.modalOptionText, { color: tv.modalOptionText }]}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, { backgroundColor: tv.modalOptionBg, borderColor: tv.modalOptionBorder }]}
              onPress={handleChooseFromLibrary}
              activeOpacity={0.7}
            >
              <View style={[styles.modalIconBox, { backgroundColor: tv.modalIconBg }]}>
                <MaterialCommunityIcons 
                  name="image" 
                  size={20} 
                  color={ACCENT} 
                />
              </View>
              <Text style={[styles.modalOptionText, { color: tv.modalOptionText }]}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: tv.modalCancelBg }]}
              onPress={() => setIsModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },

  // Orbs
  orb1: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(30,111,255,0.12)',
  },
  orb2: {
    position: 'absolute', top: '30%', left: -120,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(77,159,255,0.07)',
  },
  orb3: {
    position: 'absolute', bottom: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(30,111,255,0.09)',
  },

  // Corner accents
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 60, height: 60, borderTopWidth: 2, borderLeftWidth: 2, borderRadius: 2 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderTopWidth: 2, borderRightWidth: 2, borderRadius: 2 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, borderBottomWidth: 2, borderLeftWidth: 2, borderRadius: 2 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 60, height: 60, borderBottomWidth: 2, borderRightWidth: 2, borderRadius: 2 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 40,
  },

  // Logo
  logoBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  ringWrapper: {
    width: 80, height: 80,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  dashedRing: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1, borderStyle: 'dashed',
  },
  logoIconBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  logoImage: {
    width: 200,
    height: 200,
  },

  // Card
  card: {
    backgroundColor: 'rgba(77,159,255,0.03)',
    borderWidth: 1, borderRadius: 24, padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45, shadowRadius: 40, elevation: 12,
  },
  cardTitle: {
    color: '#fff', fontSize: 22, fontWeight: '900',
    letterSpacing: -0.5, marginBottom: 4,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.28)', fontSize: 13,
    lineHeight: 19, marginBottom: 16,
  },
  accentBarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22,
  },
  accentBar: {
    width: 36, height: 2, borderRadius: 1,
  },
  accentDot: {
    width: 6, height: 6, borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6, elevation: 3,
  },

  // Avatar
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPicker: {
    width: 90, height: 90,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarRing: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1, borderStyle: 'dashed',
  },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
  },
  avatarText: {
    color: 'rgba(255,255,255,0.28)', fontSize: 11, fontWeight: '600',
  },

  // Field labels
  fieldLabel: {
    color: 'rgba(255,255,255,0.20)', fontSize: 9,
    fontWeight: '700', letterSpacing: 2.5, fontFamily: 'monospace',
    marginBottom: 6,
  },

  // Register button
  registerBtnWrapper: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 20, marginTop: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 8,
  },
  registerBtn: {
    height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
  },
  registerBtnText: {
    color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1,
  },

  // OR
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  orText: {
    color: 'rgba(255,255,255,0.18)', fontSize: 10,
    fontWeight: '700', marginHorizontal: 12, letterSpacing: 1.5, fontFamily: 'monospace',
  },

  // Google
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 14, gap: 12, marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  googleIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  googleBtnText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600',
  },

  // Login link
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { color: 'rgba(255,255,255,0.22)', fontSize: 13 },
  loginLink: { fontSize: 13, fontWeight: '700' },

  // Theme toggle
  themeToggle: { alignSelf: 'center', marginTop: 20, padding: 10 },
  themeToggleText: { color: 'rgba(255,255,255,0.18)', fontSize: 12, letterSpacing: 0.3 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(12,20,40,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: ACCENT + '25',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
    color: '#fff',
    letterSpacing: -0.5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(77,159,255,0.05)',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(77,159,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  modalCancelButton: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalCancelText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: '700',
  },
});

export default RegisterScreen;