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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    // Icon scale animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Slide up animation for content
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Subtle rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation for active indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Float animation for icons
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
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

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background Gradient */}
      <LinearGradient
        colors={['#FAFAFA', '#F0F0F0', '#FAFAFA']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating Decorative Elements */}
      <Animated.View 
        style={[
          styles.floatingCircle1,
          { 
            transform: [
              { translateY: floatAnim },
              { rotate: spin }
            ]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(33, 150, 243, 0.1)', 'rgba(33, 150, 243, 0.05)']}
          style={styles.circleGradient}
        />
      </Animated.View>

      <Animated.View 
        style={[
          styles.floatingCircle2,
          { 
            transform: [
              { translateY: Animated.multiply(floatAnim, -1) }
            ]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)']}
          style={styles.circleGradient}
        />
      </Animated.View>

      {/* Enhanced Header with Blur */}
      <View style={styles.headerWrapper}>
        <BlurView intensity={20} tint="light" style={styles.headerBlur}>
          <View style={styles.header}>
            {/* Header is now empty but maintains spacing */}
          </View>
        </BlurView>
      </View>

      {/* Scrollable Pages */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.mainScrollView}
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.pageWrapper}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pageScrollContent}
              bounces={true}
            >
              <Animated.View 
                style={[
                  styles.page,
                  {
                    opacity: currentPage === index ? 1 : 0.5,
                    transform: [
                      { scale: currentPage === index ? 1 : 0.95 }
                    ]
                  }
                ]}
              >
                {/* Animated Icon with Gradient and Float Effect */}
                <Animated.View 
                  style={{ 
                    transform: [
                      { scale: currentPage === index ? scaleAnim : 0.8 },
                      { translateY: currentPage === index ? floatAnim : 0 }
                    ]
                  }}
                >
                  <LinearGradient
                    colors={page.gradientColors}
                    style={styles.iconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={page.icon} size={60} color="#FFF" />
                    {/* Animated Ring Around Icon */}
                    <Animated.View 
                      style={[
                        styles.iconRing,
                        {
                          transform: [{ scale: pulseAnim }],
                          borderColor: page.gradientColors[0]
                        }
                      ]}
                    />
                  </LinearGradient>
                </Animated.View>

                {/* Enhanced Title & Description */}
                <Animated.Text 
                  style={[
                    styles.title,
                    { transform: [{ translateY: slideAnim }] }
                  ]}
                >
                  {page.title}
                </Animated.Text>
                <Animated.Text 
                  style={[
                    styles.description,
                    { transform: [{ translateY: slideAnim }] }
                  ]}
                >
                  {page.description}
                </Animated.Text>

                {/* Enhanced Details Container with Glassmorphism */}
                <Animated.View 
                  style={[
                    styles.detailsContainer,
                    { transform: [{ translateY: slideAnim }] }
                  ]}
                >
                  <BlurView intensity={10} tint="light" style={styles.detailsBlur}>
                    <Text style={styles.detailsText}>{page.details}</Text>
                  </BlurView>
                </Animated.View>

                {/* Enhanced Feature Pills with Stagger Animation */}
                <View style={styles.featuresContainer}>
                  {page.features.map((feature, idx) => (
                    <Animated.View
                      key={idx}
                      style={[
                        styles.featurePill,
                        {
                          transform: [
                            { 
                              translateY: Animated.add(
                                slideAnim,
                                new Animated.Value(idx * 20)
                              )
                            }
                          ]
                        }
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={page.gradientColors[0]} />
                      <Text style={[styles.featureText, { color: page.gradientColors[0] }]}>
                        {feature}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Enhanced Page Indicators with Animation */}
      <View style={styles.indicatorContainer}>
        {pages.map((page, index) => (
          <Animated.View
            key={index}
            style={[
              styles.indicator,
              currentPage === index && [
                styles.activeIndicator,
                { 
                  backgroundColor: page.gradientColors[0],
                  transform: [{ scale: currentPage === index ? pulseAnim : 1 }]
                },
              ],
            ]}
          />
        ))}
      </View>

      {/* Enhanced Navigation Buttons */}
      <View style={styles.bottomContainer}>
        {currentPage > 0 && (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={styles.prevButton}
              onPress={goToPreviousPage}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#2196F3" />
            </TouchableOpacity>
          </Animated.View>
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
              <Animated.View style={{ transform: [{ translateX: floatAnim }] }}>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </Animated.View>
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
              <Animated.View style={{ transform: [{ translateX: floatAnim }] }}>
                <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </Animated.View>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>

      {/* Enhanced Footer */}
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
  headerWrapper: {
    paddingTop: (StatusBar.currentHeight || 0) + 10,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerBlur: {
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  mainScrollView: {
    flex: 1,
  },
  pageWrapper: {
    width: width,
  },
  pageScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  page: {
    width: width,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 30,
    minHeight: height - 350,
  },
  iconContainer: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 35,
    marginTop: 20,
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
    paddingHorizontal: 10,
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
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
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
    paddingHorizontal: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 18,
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
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
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
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
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
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
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
  floatingCircle1: {
    position: 'absolute',
    top: 100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
  },
  floatingCircle2: {
    position: 'absolute',
    bottom: 150,
    left: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
  },
  circleGradient: {
    flex: 1,
  },
  iconRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  detailsBlur: {
    padding: 18,
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default WelcomeScreen;