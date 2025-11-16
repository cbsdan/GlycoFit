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

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
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
      title: 'Smart Blood Sugar Predictions',
      description: 'Get accurate blood glucose predictions based on your meals and activity',
      details: 'Our AI-powered system analyzes your food intake and physical activity to provide personalized glucose level forecasts.',
      icon: 'analytics',
      gradientColors: ['#2196F3', '#1976D2'],
      features: ['AI Predictions', 'Meal Analysis', 'Real-time Insights'],
    },
    {
      id: 3,
      title: 'Complete Meal History',
      description: 'Keep track of your meals and see how they affect your glucose levels',
      details: 'Log your meals easily and discover patterns between your diet and blood sugar levels over time.',
      icon: 'restaurant',
      gradientColors: ['#FF9800', '#F57C00'],
      features: ['Photo Logging', 'Nutrition Info', 'Impact Analysis'],
    },
    {
      id: 4,
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
      navigation.navigate('Login');
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>GlycoFit</Text>
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color="#666" />
        </TouchableOpacity>
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
                <Ionicons name={page.icon} size={70} color="#FFF" />
              </LinearGradient>
            </Animated.View>

            {/* Title & Description */}
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.description}>{page.description}</Text>

            {/* Detailed Explanation */}
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsText}>{page.details}</Text>
            </View>

            {/* Feature Pills */}
            <View style={styles.featuresContainer}>
              {page.features.map((feature, idx) => (
                <View key={idx} style={styles.featurePill}>
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
        <Text style={styles.footerText}>
          Already have an account?{' '}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    letterSpacing: 0.5,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  skipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginRight: 4,
  },
  page: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  detailsContainer: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
    marginHorizontal: 5,
  },
  activeIndicator: {
    width: 32,
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  prevButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButton: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  getStartedButton: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  getStartedButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  getStartedButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '700',
  },
});

export default WelcomeScreen;