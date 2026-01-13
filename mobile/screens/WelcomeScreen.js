import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation, onComplete }) => {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const pages = [
    {
      id: 1,
      title: 'Track Your Health Journey',
      description: 'Monitor your daily steps, calories, and activity levels with ease',
      details: 'Stay on top of your fitness goals with real-time tracking and comprehensive health metrics from Health Connect.',
      icon: 'fitness',
      gradientColors: ['#4CAF50', '#45A049'],
      features: ['Daily Step Counter', 'Calorie Tracking', 'Activity History'],
    },
    {
      id: 2,
      title: 'Complete Meal History',
      description: 'Keep track of your meals and see how they affect your glucose levels',
      details: 'Log your meals easily and discover patterns between your diet and blood sugar levels over time.',
      icon: 'restaurant',
      gradientColors: ['#FF9800', '#F57C00'],
      features: ['Photo Logging', 'Nutrition Info', 'Impact Analysis'],
    },
    {
      id: 3,
      title: 'Personalized Health Insights',
      description: 'View comprehensive health data and get personalized recommendations',
      details: 'Access all your health metrics in one place and receive tailored advice to improve your wellness journey.',
      icon: 'heart',
      gradientColors: ['#E91E63', '#C2185B'],
      features: ['Health Dashboard', 'Custom Reports', 'Expert Tips'],
    },
  ];

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [currentPage]);

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const page = Math.round(scrollPosition / width);
    if (page !== currentPage) {
      setCurrentPage(page);
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentPage + 1),
        animated: true,
      });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentPage - 1),
        animated: true,
      });
    }
  };

  const handleGetStarted = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onComplete) {
        onComplete();
      }
      navigation.navigate('Login');
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.logoContainer}>
          <Text style={[styles.logoText, { color: colors.primary }]}>GlycoFit</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.card }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.skipButton, { backgroundColor: colors.card }]}
          onPress={() => {
            if (onComplete) {
              onComplete();
            }
            navigation.navigate('Login');
          }}
          >
            <Text style={[styles.skipText, { color: colors.text }]}>Skip</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Pages */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            {/* Animated Icon with Gradient */}
            <Animated.View style={{ transform: [{ scale: currentPage === index ? scaleAnim : 0.8 }] }}>
              <LinearGradient
                colors={page.gradientColors}
                style={styles.iconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={page.icon} size={50} color="#FFF" />
              </LinearGradient>
            </Animated.View>

            {/* Title & Description */}
            <Text style={[styles.title, { color: colors.text }]}>{page.title}</Text>
            <Text style={[styles.description, { color: colors.secondary }]}>{page.description}</Text>

            {/* Detailed Explanation */}
            <View style={[styles.detailsContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.detailsText, { color: colors.text }]}>{page.details}</Text>
            </View>

            {/* Feature Pills */}
            <View style={styles.featuresContainer}>
              {page.features.map((feature, idx) => (
                <View key={idx} style={[styles.featurePill, { backgroundColor: colors.card }]}>
                  <Ionicons name="checkmark-circle" size={16} color={page.gradientColors[0]} />
                  <Text style={[styles.featureText, { color: page.gradientColors[0] }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modern Page Indicators */}
      <View style={styles.indicatorContainer}>
        {pages.map((page, index) => (
          <Animated.View
            key={index}
            style={[
              styles.indicator,
              currentPage === index && [
                styles.activeIndicator,
                { backgroundColor: page.gradientColors[0] }
              ],
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.bottomContainer}>
        {currentPage > 0 && (
          <TouchableOpacity
            style={styles.prevButton}
            onPress={goToPreviousPage}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#2196F3" />
          </TouchableOpacity>
        )}

        {currentPage < pages.length - 1 ? (
          <LinearGradient
            colors={pages[currentPage].gradientColors}
            style={[styles.nextButton, { marginLeft: currentPage === 0 ? 'auto' : 0 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity
              onPress={goToNextPage}
              style={styles.nextButtonInner}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={[styles.getStartedButton, { marginLeft: 'auto' }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity
              onPress={handleGetStarted}
              style={styles.getStartedButtonInner}
              activeOpacity={0.8}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>

      {/* Modern Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.secondary }]}>
          Already have an account?{' '}
        </Text>
        <TouchableOpacity onPress={() => {
          if (onComplete) {
            onComplete();
          }
          navigation.navigate('Login');
        }}>
          <Text style={[styles.loginLink, { color: colors.primary }]}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  page: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  detailsContainer: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  detailsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  indicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DDD',
    marginHorizontal: 4,
  },
  activeIndicator: {
    width: 24,
    height: 7,
    borderRadius: 3.5,
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  prevButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  nextButton: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  nextButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 6,
  },
  getStartedButton: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  getStartedButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  getStartedButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default WelcomeScreen;