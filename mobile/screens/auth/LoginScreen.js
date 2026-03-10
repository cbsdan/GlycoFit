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
  Animated,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_SIGNIN_CONFIG } from '../../config/google-auth-config';
import { auth } from '../../config/firebase-config';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Svg, { Line } from 'react-native-svg';
import 'expo-dev-client';

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

// ─── LoginScreen ──────────────────────────────────────────────────────────────
const LoginScreen = ({ navigation }) => {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);

  const { login, googleSignIn, setIsLoading } = useAuth();
  const { toggleTheme, isDarkMode }           = useTheme();
  const toast                                 = useToast();

  // ── Theme variables ──────────────────────────────────────────────────────
  const tv = isDarkMode ? {
    bgColors: ['#060d1f', '#080f24', '#050b18'],
    rootBg: BG_DARK,
    cardBg: 'rgba(77,159,255,0.03)',
    cardBorder: ACCENT + '18',
    cardTitle: '#fff',
    cardSubtitle: 'rgba(255,255,255,0.28)',
    fieldLabel: 'rgba(255,255,255,0.20)',
    orb1Bg: 'rgba(30,111,255,0.12)',
    orb2Bg: 'rgba(77,159,255,0.07)',
    orb3Bg: 'rgba(30,111,255,0.09)',
    orLine: 'rgba(255,255,255,0.06)',
    orText: 'rgba(255,255,255,0.18)',
    googleBtnBg: 'rgba(255,255,255,0.04)',
    googleBtnBorder: 'rgba(255,255,255,0.08)',
    googleBtnText: 'rgba(255,255,255,0.6)',
    registerText: 'rgba(255,255,255,0.22)',
    themeToggleText: 'rgba(255,255,255,0.18)',
    statusBarStyle: 'light-content',
    toggleLabel: 'Light',
    toggleIcon: '☀️',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.07)',
    inputText: '#fff',
    inputPlaceholder: 'rgba(255,255,255,0.18)',
    inputIcon: 'rgba(255,255,255,0.22)',
    inputRightIcon: 'rgba(255,255,255,0.28)',
    forgotText: ACCENT,
  } : {
    bgColors: ['#e8f0ff', '#eef2ff', '#f0f5ff'],
    rootBg: '#eef2ff',
    cardBg: 'rgba(255,255,255,0.92)',
    cardBorder: ACCENT + '30',
    cardTitle: '#0d1a3a',
    cardSubtitle: 'rgba(13,26,58,0.45)',
    fieldLabel: 'rgba(13,26,58,0.40)',
    orb1Bg: 'rgba(30,111,255,0.06)',
    orb2Bg: 'rgba(77,159,255,0.04)',
    orb3Bg: 'rgba(30,111,255,0.05)',
    orLine: 'rgba(0,0,0,0.07)',
    orText: 'rgba(13,26,58,0.35)',
    googleBtnBg: 'rgba(0,0,0,0.03)',
    googleBtnBorder: 'rgba(0,0,0,0.09)',
    googleBtnText: 'rgba(13,26,58,0.60)',
    registerText: 'rgba(13,26,58,0.45)',
    themeToggleText: 'rgba(13,26,58,0.38)',
    statusBarStyle: 'dark-content',
    toggleLabel: 'Dark',
    toggleIcon: '🌙',
    inputBg: 'rgba(13,26,58,0.03)',
    inputBorder: 'rgba(13,26,58,0.10)',
    inputText: '#0d1a3a',
    inputPlaceholder: 'rgba(13,26,58,0.35)',
    inputIcon: 'rgba(13,26,58,0.35)',
    inputRightIcon: 'rgba(13,26,58,0.35)',
    forgotText: ACCENT2,
  };

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

  // ── Google Sign-In ──
  const handleGoogleSignIn = async (confirmRegistration = false) => {
    try {
      setIsLoading(true);
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult  = await GoogleSignin.signIn();
      const idToken       = signInResult.data?.idToken || signInResult.idToken;
      if (!idToken) throw new Error('Failed to get ID token from Google Sign-in');
      const credential    = GoogleAuthProvider.credential(idToken);
      const userCred      = await signInWithCredential(auth, credential);
      const firebaseUser  = userCred.user;
      const result        = await googleSignIn(idToken, confirmRegistration);

      if (result?.success) {
        const name = result.user?.first_name || firebaseUser.displayName || 'User';
        toast.success(result.isNewUser ? `Welcome to GlycoFit, ${name}!` : `Welcome back, ${name}!`);
      } else if (result?.needsRegistration) {
        const info = result.userInfo;
        Alert.alert(
          'Create New Account',
          `Welcome! First time with Google.\n\nEmail: ${info.email}\n\nCreate a GlycoFit account?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => toast.info('Sign-in cancelled') },
            { text: 'Create Account', onPress: () => setTimeout(() => handleGoogleSignIn(true), 500) },
          ]
        );
      } else {
        toast.error(result?.error || 'Authentication failed');
      }
    } catch (error) {
      let msg = 'Google sign in failed. Please try again.';
      if (error?.code === 'CANCELED')                    msg = 'Sign in was canceled';
      else if (error?.code === 'PLAY_SERVICES_NOT_AVAILABLE') msg = 'Google Play Services not available';
      else if (error?.message)                           msg = error.message;
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
      setIsLoading(false);
    }
  };

  // ── Email Login ──
  const handleLogin = async () => {
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    try {
      setLoginInProgress(true);
      const result = await login(email, password);
      if (result.success) {
        toast.success(`Welcome back, ${result.user?.first_name || 'User'}!`);
      } else {
        toast.error(result.error || 'Please check your credentials and try again');
      }
    } catch (error) {
      toast.error(error.message || 'Please check your credentials and try again');
    } finally {
      setLoginInProgress(false);
    }
  };

  const isLoading = loginInProgress || googleLoading;

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
            {/* Dashed ring behind icon */}
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
{/* 
            <Text style={styles.logoText}>GlycoFit</Text> */}

            {/* <View style={[styles.logoBadge, { backgroundColor: ACCENT_DIM, borderColor: ACCENT + '45' }]}>
              <View style={[styles.badgeDot, { backgroundColor: ACCENT, shadowColor: ACCENT }]} />
              <Text style={[styles.logoBadgeText, { color: ACCENT }]}>HEALTH TRACKER</Text>
            </View> */}
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
            <Text style={[styles.cardTitle, { color: tv.cardTitle }]}>Welcome back</Text>
            <Text style={[styles.cardSubtitle, { color: tv.cardSubtitle }]}>Sign in to continue your health journey</Text>

            {/* Blue accent bar */}
            <View style={styles.accentBarRow}>
              <LinearGradient colors={[ACCENT2, ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
              <View style={[styles.accentDot, { backgroundColor: ACCENT, shadowColor: ACCENT }]} />
            </View>

            {/* Email input */}
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

            {/* Password input */}
            <Text style={[styles.fieldLabel, { color: tv.fieldLabel }]}>PASSWORD</Text>
            <GlowInput
              icon="lock"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-slash' : 'eye'}
              onRightIconPress={() => setShowPassword(!showPassword)}
              tv={tv}
            />

            {/* Forgot password */}
            {/* <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
              <Text style={[styles.forgotText, { color: tv.forgotText }]}>Forgot password?</Text>
            </TouchableOpacity> */}

            {/* Login CTA */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              style={[styles.loginBtnWrapper, { shadowColor: ACCENT2 }]}
            >
              <LinearGradient
                colors={[ACCENT2, ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginBtn}
              >
                {loginInProgress ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>SIGN IN  →</Text>
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
              onPress={() => handleGoogleSignIn()}
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
                  <Text style={[styles.googleBtnText, { color: tv.googleBtnText }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: tv.registerText }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                <Text style={[styles.registerLink, { color: ACCENT }]}>Register →</Text>
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
logoLetter: {
    color: '#fff', fontSize: 28, fontWeight: '900',
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  logoText: {
    color: '#fff', fontSize: 26, fontWeight: '900',
    letterSpacing: -0.5, marginBottom: 8,
  },
  logoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1,
  },
  badgeDot: {
    width: 5, height: 5, borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 5, elevation: 3,
  },
  logoBadgeText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 2.5, fontFamily: 'monospace',
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

  // Field labels
  fieldLabel: {
    color: 'rgba(255,255,255,0.20)', fontSize: 9,
    fontWeight: '700', letterSpacing: 2.5, fontFamily: 'monospace',
    marginBottom: 6,
  },

  // Forgot
  forgotRow: { alignItems: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, fontWeight: '600' },

  // Login button
  loginBtnWrapper: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 8,
  },
  loginBtn: {
    height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
  },
  loginBtnText: {
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

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { color: 'rgba(255,255,255,0.22)', fontSize: 13 },
  registerLink: { fontSize: 13, fontWeight: '700' },

  // Theme toggle
  themeToggle: { alignSelf: 'center', marginTop: 20, padding: 10 },
  themeToggleText: { color: 'rgba(255,255,255,0.18)', fontSize: 12, letterSpacing: 0.3 },
});

export default LoginScreen;