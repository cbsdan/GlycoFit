import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function IntroductionScreen({ onGetStarted }) {
  const { colors: theme, isDarkMode, toggleTheme } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef(null);

  const slides = [
    {
      id: 1,
      icon: 'medical',
      title: 'Welcome to GlycoFit',
      subtitle: 'Physician Portal',
      description: 'Connect with your patients anywhere, anytime',
      features: [
        'Seamless patient communication',
        'Comprehensive health tracking',
        'Efficient appointment management',
      ],
    },
    {
      id: 2,
      icon: 'videocam',
      title: 'TELEHEALTH',
      subtitle: 'Virtual Care Excellence',
      description: 'Online Consultations, chats, Prescription and Follow Up Appointments with a Physician',
      color: '#4CAF50',
    },
    {
      id: 3,
      icon: 'notifications',
      title: 'SCHEDULING/NOTIFICATION',
      subtitle: 'Stay Connected',
      description: 'Automated medicine reminders and appointment scheduling to keep patients on track',
      color: '#FF9800',
    },
    {
      id: 4,
      icon: 'fitness',
      title: 'LIFESTYLE MONITORING',
      subtitle: 'Real-Time Insights',
      description: 'Real-time monitoring based on user lifestyle, activities, and health metrics',
      color: '#2196F3',
    },
  ];

  const handleScroll = (event) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slideIndex);
  };

  const goToNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentSlide + 1,
        animated: true,
      });
    }
  };

  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentSlide - 1,
        animated: true,
      });
    }
  };

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { width }]}>
      <ScrollView
        contentContainerStyle={styles.slideContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.slideInner}>
          <View style={[styles.iconContainer, { backgroundColor: item.color || theme.primary }]}>
            <Ionicons name={item.icon} size={60} color="#FFFFFF" />
          </View>

          <Text style={[styles.slideTitle, { color: theme.text }]}>
            {item.title}
          </Text>

          <Text style={[styles.slideSubtitle, { color: item.color || theme.primary }]}>
            {item.subtitle}
          </Text>

          <Text style={[styles.slideDescription, { color: theme.secondary }]}>
            {item.description}
          </Text>

          {item.features && (
            <View style={styles.featuresContainer}>
              {item.features.map((feature, index) => (
                <View key={index} style={[styles.featureItem, { borderLeftColor: theme.primary }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  <Text style={[styles.featureText, { color: theme.text }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.statusBar} />

      {/* Theme Toggle Button */}
      <TouchableOpacity
        style={[styles.themeToggle, { backgroundColor: theme.card, ...theme.shadow }]}
        onPress={toggleTheme}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isDarkMode ? 'sunny' : 'moon'}
          size={24}
          color={theme.primary}
        />
      </TouchableOpacity>

      {/* Slideshow */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              {
                backgroundColor: currentSlide === index ? theme.primary : theme.border,
                width: currentSlide === index ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        {currentSlide > 0 && (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.card, ...theme.shadow }]}
            onPress={goToPrevSlide}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {currentSlide < slides.length - 1 ? (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.primary }]}
            onPress={goToNextSlide}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.getStartedButton, { backgroundColor: theme.primary }]}
            onPress={onGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      <Text style={[styles.footer, { color: theme.secondary }]}>
        Empowering physicians to provide better care
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  themeToggle: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  slideInner: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  slideDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
    marginBottom: 30,
  },
  featuresContainer: {
    width: '100%',
    marginTop: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 15,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingBottom: 20,
  },
});
