import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// ─── Page Data ───────────────────────────────────────────────────────────────
const PAGES = [
  {
    id: 1,
    label: 'FEATURE 01',
    title: 'Track Your\nHealth Journey',
    description:
      'Real-time fitness metrics synced with Health Connect — steps, calories, and vitals in one living dashboard.',
    icon: '⚡',
    accent: '#00FF88',
    accentDim: 'rgba(0,255,136,0.18)',
    accentGlow: 'rgba(0,255,136,0.38)',
    bg: ['#0a1a0f', '#0d2015'],
    features: [
      { icon: '👟', label: 'Step Counter', val: '12,480' },
      { icon: '🔥', label: 'Calories', val: '2,140 kcal' },
      { icon: '📈', label: 'Weekly Streak', val: '7 days' },
    ],
    stat: { label: 'STEPS TODAY', value: '12,480', progress: 0.83, unit: '/ 15k goal' },
  },
  {
    id: 2,
    label: 'FEATURE 02',
    title: 'Complete\nMeal History',
    description:
      'Discover hidden links between what you eat and your glucose — patterns that transform your wellbeing.',
    icon: '🧬',
    accent: '#FF6B35',
    accentDim: 'rgba(255,107,53,0.18)',
    accentGlow: 'rgba(255,107,53,0.38)',
    bg: ['#1a0f08', '#200e05'],
    features: [
      { icon: '📸', label: 'Photo Log', val: "Today's meals" },
      { icon: '🥗', label: 'Macros', val: 'Balanced' },
      { icon: '📊', label: 'Glucose Impact', val: '+12 mg/dL' },
    ],
    stat: { label: 'GLUCOSE LEVEL', value: '98', progress: 0.54, unit: 'mg/dL' },
  },
  // ── NEW: Sleep Tracking ───────────────────────────────────────────────────
  {
    id: 3,
    label: 'FEATURE 03',
    title: 'Sleep\nTracking',
    description:
      'Quality sleep is the foundation of metabolic health. Monitor your sleep cycles and see how rest directly impacts your glucose levels.',
    icon: '🌙',
    accent: '#B06EFF',
    accentDim: 'rgba(176,110,255,0.18)',
    accentGlow: 'rgba(176,110,255,0.38)',
    bg: ['#100a1a', '#150d20'],
    features: [
      { icon: '😴', label: 'Sleep Duration', val: '7h 42m' },
      { icon: '🔄', label: 'Sleep Cycles', val: '5 cycles' },
      { icon: '📉', label: 'Glucose at Night', val: 'Stable' },
    ],
    stat: { label: 'SLEEP QUALITY', value: '82', progress: 0.82, unit: '/ 100' },
  },
  // ── NEW: Smoke Intake ─────────────────────────────────────────────────────
  {
    id: 4,
    label: 'FEATURE 04',
    title: 'Smoke\nIntake Log',
    description:
      'Track your smoking habits and understand how nicotine spikes your blood sugar and affects your long-term glycemic control.',
    icon: '🚭',
    accent: '#FF8C42',
    accentDim: 'rgba(255,140,66,0.18)',
    accentGlow: 'rgba(255,140,66,0.38)',
    bg: ['#1a0e06', '#200f05'],
    features: [
      { icon: '🗓️', label: 'Daily Log', val: '3 today' },
      { icon: '📊', label: 'Glucose Spike', val: '+18 mg/dL' },
      { icon: '📉', label: 'Weekly Trend', val: '↓ 12%' },
    ],
    stat: { label: 'SMOKE-FREE HOURS', value: '14', progress: 0.58, unit: '/ 24h' },
  },
  // ── NEW: Alcohol Intake ───────────────────────────────────────────────────
  {
    id: 5,
    label: 'FEATURE 05',
    title: 'Alcohol\nIntake Log',
    description:
      'Monitor your alcohol consumption and its delayed effect on blood sugar — preventing hidden glucose crashes and spikes.',
    icon: '🍷',
    accent: '#E05C8A',
    accentDim: 'rgba(224,92,138,0.18)',
    accentGlow: 'rgba(224,92,138,0.38)',
    bg: ['#180810', '#1e0812'],
    features: [
      { icon: '🥃', label: 'Units Logged', val: '2 units' },
      { icon: '⏱️', label: 'Time Since Last', val: '6 hrs ago' },
      { icon: '🩸', label: 'Glucose Effect', val: '-22 mg/dL' },
    ],
    stat: { label: 'WEEKLY UNITS', value: '4', progress: 0.27, unit: '/ 14 limit' },
  },
  // ── Original page 3 (now page 6) ─────────────────────────────────────────
  {
    id: 6,
    label: 'FEATURE 06',
    title: 'Personalized\nHealth Insights',
    description:
      'AI-powered recommendations tailored to your unique biology — your personal wellness intelligence.',
    icon: '✦',
    accent: '#B06EFF',
    accentDim: 'rgba(176,110,255,0.18)',
    accentGlow: 'rgba(176,110,255,0.38)',
    bg: ['#100a1a', '#150d20'],
    features: [
      { icon: '🧠', label: 'AI Insights', val: '12 new' },
      { icon: '📋', label: 'Health Score', val: '87 / 100' },
      { icon: '💡', label: 'Expert Tips', val: 'Personalized' },
    ],
    stat: { label: 'HEALTH SCORE', value: '87', progress: 0.87, unit: '/ 100' },
  },
];

// ─── Animated SVG Ring ────────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({ accent, accentGlow, targetProgress }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animVal.setValue(0);
    Animated.timing(animVal, {
      toValue: targetProgress,
      duration: 1100,
      useNativeDriver: false,
    }).start();
  }, [targetProgress]);

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, 0],
  });

  return (
    <View style={{ width: 130, height: 130 }}>
      <Svg width={130} height={130} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        {/* Progress — we simulate with a plain Circle + dasharray trick via JS */}
      </Svg>
      {/* Since Animated SVG strokeDashoffset is tricky on RN, we use a JS-driven approach */}
      <_AnimatedRing accent={accent} accentGlow={accentGlow} targetProgress={targetProgress} />
    </View>
  );
}

// Helper: drives progress via state to re-render SVG dasharray
function _AnimatedRing({ accent, accentGlow, targetProgress }) {
  const [progress, setProgress] = useState(0);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const frameRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    setProgress(0);
    cancelAnimationFrame(frameRef.current);
    const duration = 1100;
    const startProg = 0;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(startProg + (targetProgress - startProg) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    startRef.current = null;
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [targetProgress]);

  const dash = circ * progress;

  return (
    <Svg width={130} height={130} style={StyleSheet.absoluteFill}>
      <Circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <Circle
        cx={65} cy={65} r={r}
        fill="none"
        stroke={accent}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        rotation={-90}
        origin="65, 65"
      />
    </Svg>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, accent, accentDim, delay, themeVars }) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.featureCard, {
      opacity,
      transform: [{ translateY }],
      backgroundColor: themeVars?.cardBg || 'rgba(255,255,255,0.04)',
      borderColor: themeVars?.cardBorder || 'rgba(255,255,255,0.06)',
    }]}>
      <View style={[styles.featureIconBox, { backgroundColor: accentDim, borderColor: accent + '50' }]}>
        <Text style={styles.featureIconEmoji}>{feature.icon}</Text>
      </View>
      <View style={styles.featureTextBlock}>
        <Text style={[styles.featureLabel, { color: themeVars?.featureLabelColor || 'rgba(255,255,255,0.25)' }]}>{feature.label.toUpperCase()}</Text>
        <Text style={[styles.featureVal, { color: themeVars?.featureValColor || '#fff' }]}>{feature.val}</Text>
      </View>
      <Animated.View
        style={[
          styles.pulseDot,
          { backgroundColor: accent, shadowColor: accent, opacity: pulseAnim },
        ]}
      />
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
const WelcomeScreen = ({ navigation, onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [entered, setEntered] = useState(false);
  const [themeMode, setThemeMode] = useState('dark'); // 'dark' | 'night' | 'light'
  const scrollRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const page = PAGES[currentPage];

  const cycleTheme = () => {
    setThemeMode(prev => prev === 'dark' ? 'night' : prev === 'night' ? 'light' : 'dark');
  };

  // ── Theme variables ──────────────────────────────────────────────────────
  const tv = (() => {
    if (themeMode === 'light') return {
      bgColors: [page.accent + '22', page.accent + '0F'],
      nightOverlay: false,
      lightOverlay: true,
      textColor: '#0d1a12',
      subTextColor: 'rgba(10,26,15,0.52)',
      cardBg: 'rgba(0,0,0,0.04)',
      cardBorder: 'rgba(0,0,0,0.08)',
      featureLabelColor: 'rgba(10,26,15,0.38)',
      featureValColor: '#0d1a12',
      statLabelColor: 'rgba(10,26,15,0.45)',
      statUnitColor: 'rgba(10,26,15,0.3)',
      statTrackColor: 'rgba(0,0,0,0.09)',
      footerTextColor: 'rgba(0,0,0,0.38)',
      dotInactiveColor: 'rgba(0,0,0,0.18)',
      prevBtnBg: 'rgba(0,0,0,0.06)',
      prevBtnBorder: 'rgba(0,0,0,0.12)',
      skipBtnBg: 'rgba(0,0,0,0.07)',
      skipBtnBorder: 'rgba(0,0,0,0.12)',
      statusBarStyle: 'dark-content',
      themeIcon: '☀️',
    };
    if (themeMode === 'night') return {
      bgColors: page.bg,
      nightOverlay: true,
      lightOverlay: false,
      textColor: '#ffe8d0',
      subTextColor: 'rgba(255,218,176,0.42)',
      cardBg: 'rgba(255,180,80,0.05)',
      cardBorder: 'rgba(255,180,80,0.10)',
      featureLabelColor: 'rgba(255,218,176,0.30)',
      featureValColor: '#ffe8d0',
      statLabelColor: 'rgba(255,218,176,0.44)',
      statUnitColor: 'rgba(255,218,176,0.24)',
      statTrackColor: 'rgba(255,180,80,0.10)',
      footerTextColor: 'rgba(255,218,176,0.30)',
      dotInactiveColor: 'rgba(255,218,176,0.20)',
      prevBtnBg: 'rgba(255,200,100,0.07)',
      prevBtnBorder: 'rgba(255,200,100,0.14)',
      skipBtnBg: 'rgba(255,200,100,0.09)',
      skipBtnBorder: 'rgba(255,200,100,0.14)',
      statusBarStyle: 'light-content',
      themeIcon: '🌑',
    };
    return {
      bgColors: page.bg,
      nightOverlay: false,
      lightOverlay: false,
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.45)',
      cardBg: 'rgba(255,255,255,0.04)',
      cardBorder: 'rgba(255,255,255,0.06)',
      featureLabelColor: 'rgba(255,255,255,0.25)',
      featureValColor: '#ffffff',
      statLabelColor: 'rgba(255,255,255,0.40)',
      statUnitColor: 'rgba(255,255,255,0.20)',
      statTrackColor: 'rgba(255,255,255,0.07)',
      footerTextColor: 'rgba(255,255,255,0.20)',
      dotInactiveColor: 'rgba(255,255,255,0.15)',
      prevBtnBg: 'rgba(255,255,255,0.06)',
      prevBtnBorder: 'rgba(255,255,255,0.12)',
      skipBtnBg: 'rgba(255,255,255,0.08)',
      skipBtnBorder: 'rgba(255,255,255,0.12)',
      statusBarStyle: 'light-content',
      themeIcon: '🌙',
    };
  })();

  // Stat bar animation
  useEffect(() => {
    barWidth.setValue(0);
    Animated.timing(barWidth, {
      toValue: page.stat.progress,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [currentPage]);

  const animateTo = (newPage) => {
    if (newPage === currentPage) return;
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(contentTranslate, {
        toValue: newPage > currentPage ? -30 : 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentPage(newPage);
      contentTranslate.setValue(newPage > currentPage ? 30 : -30);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(contentTranslate, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleGetStarted = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      if (onComplete) onComplete();
      navigation.navigate('Login');
    });
  };

  const handleSkip = () => {
    if (onComplete) onComplete();
    navigation.navigate('Login');
  };

  // ── Entered screen ──
  if (entered) {
    return (
      <View style={styles.enteredScreen}>
        <Text style={styles.enteredEmoji}>🌿</Text>
        <Text style={[styles.enteredTitle, { color: '#00FF88' }]}>You're in.</Text>
        <Text style={styles.enteredSub}>Taking you to Login…</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setEntered(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>← Back to Onboarding</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const barWidthInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle={tv.statusBarStyle} />

      {/* Background gradient */}
      <LinearGradient colors={tv.bgColors} style={StyleSheet.absoluteFill} />

      {/* Night mode warm overlay */}
      {tv.nightOverlay && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(50,18,0,0.46)' }]} pointerEvents="none" />
      )}
      {/* Light mode white overlay */}
      {tv.lightOverlay && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.83)' }]} pointerEvents="none" />
      )}

      {/* Ambient orbs */}
      <View style={[styles.orb1, { backgroundColor: page.accent + '18' }]} />
      <View style={[styles.orb2, { backgroundColor: page.accent + '10' }]} />

      {/* Status bar mock */}
      {/* <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <View style={styles.statusRight}>
          {[3, 2, 1].map((i) => (
            <View key={i} style={[styles.signalBar, { height: 4 + i * 3 }]} />
          ))}
          <View style={styles.battery}>
            <View style={[styles.batteryFill, { backgroundColor: page.accent }]} />
          </View>
        </View>
      </View> */}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.logoRow}>
          <Text style={[styles.logoText, { color: tv.textColor }]}>GlycoFit</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: tv.skipBtnBg, borderColor: tv.skipBtnBorder }]}
            onPress={cycleTheme}
            activeOpacity={0.7}
          >
            <Text style={styles.themeToggleText}>{tv.themeIcon}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.skipBtn, { backgroundColor: tv.skipBtnBg, borderColor: tv.skipBtnBorder }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: themeMode === 'light' ? 'rgba(10,26,15,0.5)' : 'rgba(255,255,255,0.5)' }]}>SKIP →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Page counter */}
      <View style={styles.pageCounterRow}>
        <Text style={[styles.pageCounter, { color: page.accent }]}>
          0{currentPage + 1} / 0{PAGES.length}
        </Text>
      </View>

      {/* Main animated content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] },
        ]}
      >
        {/* Hero row: ring + title */}
        <View style={styles.heroRow}>
          <View style={styles.ringWrapper}>
            <_AnimatedRing
              accent={page.accent}
              accentGlow={page.accentGlow}
              targetProgress={page.stat.progress}
            />
            <View
              style={[
                styles.ringInner,
                {
                  backgroundColor: page.accentDim,
                  borderColor: page.accent + '40',
                  shadowColor: page.accent,
                },
              ]}
            >
              <Text style={styles.ringEmoji}>{page.icon}</Text>
            </View>
          </View>

          <View style={styles.titleBlock}>
            <View style={[styles.featureBadge, { backgroundColor: page.accentDim, borderColor: page.accent + '60' }]}>
              <Text style={[styles.featureBadgeText, { color: page.accent }]}>{page.label}</Text>
            </View>
            <Text style={[styles.title, { color: tv.textColor }]}>{page.title}</Text>
          </View>
        </View>

        {/* Stat bar card */}
        <View style={[styles.statCard, { backgroundColor: tv.cardBg, borderColor: tv.cardBorder }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: tv.statLabelColor }]}>{page.stat.label}</Text>
            <Text style={[styles.statValue, { color: page.accent }]}>
              {page.stat.value}{' '}
              <Text style={[styles.statUnit, { color: tv.statUnitColor }]}>{page.stat.unit}</Text>
            </Text>
          </View>
          <View style={[styles.statTrack, { backgroundColor: tv.statTrackColor }]}>
            <Animated.View
              style={[
                styles.statFill,
                {
                  width: barWidthInterpolated,
                  backgroundColor: page.accent,
                  shadowColor: page.accent,
                },
              ]}
            />
          </View>
        </View>

        {/* Description */}
        <Text style={[styles.description, { color: tv.subTextColor }]}>{page.description}</Text>

        {/* Feature cards */}
        <View style={styles.featureList}>
          {page.features.map((f, i) => (
            <FeatureCard
              key={`${currentPage}-${i}`}
              feature={f}
              accent={page.accent}
              accentDim={page.accentDim}
              delay={i * 80}
              themeVars={tv}
            />
          ))}
        </View>
      </Animated.View>

      {/* Bottom nav */}
      <LinearGradient
        colors={['transparent', tv.bgColors[1]]}
        style={[styles.bottomNav, { paddingBottom: Math.max(36, insets.bottom + 20) }]}
      >
        {/* Dot indicators */}
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <TouchableOpacity key={i} onPress={() => animateTo(i)} activeOpacity={0.7}>
              <View
                style={[
                  styles.dot,
                  i === currentPage
                    ? [styles.dotActive, { backgroundColor: p.accent, shadowColor: p.accent }]
                    : [styles.dotInactive, { backgroundColor: tv.dotInactiveColor }],
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          {currentPage > 0 && (
            <TouchableOpacity
              style={[styles.prevBtn, { backgroundColor: tv.prevBtnBg, borderColor: tv.prevBtnBorder }]}
              onPress={() => animateTo(currentPage - 1)}
              activeOpacity={0.8}
            >
              <Text style={[styles.prevBtnText, { color: tv.textColor }]}>←</Text>
            </TouchableOpacity>
          )}

          {currentPage < PAGES.length - 1 ? (
            <LinearGradient
              colors={[page.accent, page.accent + 'BB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaBtn, { shadowColor: page.accent }]}
            >
              <TouchableOpacity
                style={styles.ctaBtnInner}
                onPress={() => animateTo(currentPage + 1)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnText}>NEXT FEATURE  →</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={[page.accent, page.accent + 'BB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaBtn, { shadowColor: page.accent }]}
            >
              <TouchableOpacity
                style={styles.ctaBtnInner}
                onPress={handleGetStarted}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnText}>GET STARTED  ✦</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tv.footerTextColor }]}>Already have an account? </Text>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={[styles.signInText, { color: page.accent }]}>Sign In →</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a1a0f',
  },

  // Ambient orbs
  orb1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  orb2: {
    position: 'absolute',
    bottom: 60,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 4,
  },
  statusTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  signalBar: {
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
  },
  battery: {
    width: 22,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginLeft: 4,
    padding: 1.5,
    justifyContent: 'center',
  },
  batteryFill: {
    height: '100%',
    width: '70%',
    borderRadius: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleText: {
    fontSize: 16,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },

  // Page counter
  pageCounterRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  pageCounter: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.7,
    fontFamily: 'monospace',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  // Hero row
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  ringWrapper: {
    width: 130,
    height: 130,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  ringEmoji: {
    fontSize: 30,
  },
  titleBlock: {
    flex: 1,
  },
  featureBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  featureBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 30,
    letterSpacing: -0.8,
  },

  // Stat card
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
  statValue: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statUnit: {
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '400',
  },
  statTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  // Description
  description: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 14,
    letterSpacing: 0.1,
  },

  // Feature list
  featureList: {
    gap: 8,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureIconEmoji: {
    fontSize: 18,
  },
  featureTextBlock: {
    flex: 1,
  },
  featureLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
  featureVal: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  // Bottom nav
  bottomNav: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 28,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  prevBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  prevBtnText: {
    color: '#fff',
    fontSize: 18,
  },
  ctaBtn: {
    flex: 1,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  ctaBtnInner: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  footerText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
  },
  signInText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Entered screen
  enteredScreen: {
    flex: 1,
    backgroundColor: '#050a08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enteredEmoji: {
    fontSize: 56,
    marginBottom: 24,
  },
  enteredTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  enteredSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    marginTop: 8,
  },
  backBtn: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
  },
  backBtnText: {
    color: '#00FF88',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen;