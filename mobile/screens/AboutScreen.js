import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const AboutScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();

  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error('Failed to open link:', err));
  };

  const features = [
    {
      icon: 'heart-pulse',
      title: 'Diabetes Risk Assessment',
      description: 'AI-powered risk prediction using machine learning to evaluate your diabetes risk factors',
    },
    {
      icon: 'food-apple',
      title: 'Meal Tracking & Analysis',
      description: 'Log your meals with photo recognition and get detailed nutritional insights',
    },
    {
      icon: 'chart-line',
      title: 'Health Data Monitoring',
      description: 'Track steps, calories, heart rate, and other vital health metrics through Health Connect',
    },
    {
      icon: 'doctor',
      title: 'Physician Communication',
      description: 'Connect directly with healthcare professionals through secure messaging and consultations',
    },
    {
      icon: 'brain',
      title: 'AI Health Assistant',
      description: 'Get personalized health insights and recommendations powered by advanced AI',
    },
    {
      icon: 'calendar-clock',
      title: 'Appointment Management',
      description: 'Schedule and manage appointments with your healthcare providers',
    },
  ];

  const techStack = [
    { name: 'React Native', icon: 'react' },
    { name: 'Firebase', icon: 'firebase' },
    { name: 'MongoDB', icon: 'database' },
    { name: 'AI/ML Models', icon: 'brain' },
    { name: 'Health Connect', icon: 'google-fit' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.primary,
      paddingVertical: 20,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      padding: 4,
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    scrollContent: {
      padding: 20,
    },
    logoSection: {
      alignItems: 'center',
      paddingVertical: 30,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 30,
    },
    logoIcon: {
      marginBottom: 15,
    },
    appName: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    tagline: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    version: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 8,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 15,
    },
    description: {
      fontSize: 15,
      color: colors.secondary,
      lineHeight: 24,
      marginBottom: 10,
    },
    featuresList: {
      marginTop: 10,
    },
    featureItem: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    featureIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 13,
      color: colors.secondary,
      lineHeight: 19,
    },
    techStack: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    techChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    techIcon: {
      marginRight: 8,
    },
    techName: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    infoBox: {
      backgroundColor: isDarkMode ? `${colors.primary}20` : `${colors.primary}10`,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      marginBottom: 20,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 22,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linkIcon: {
      marginRight: 16,
    },
    linkContent: {
      flex: 1,
    },
    linkTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    linkSubtitle: {
      fontSize: 13,
      color: colors.secondary,
    },
    footer: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 13,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    copyright: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 10,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About GlycoFit</Text>
      </View>

      <ScrollView style={styles.scrollContent}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Icon 
            name="heart-pulse" 
            size={80} 
            color={colors.primary} 
            style={styles.logoIcon}
          />
          <Text style={styles.appName}>GlycoFit</Text>
          <Text style={styles.tagline}>
            Pre-Diabetes Lifestyle Prediction with
          </Text>
          <Text style={styles.tagline}>
            Ongoing Management and Monitoring
          </Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About the App</Text>
          <Text style={styles.description}>
            GlycoFit is a comprehensive diabetes management application designed to help you take control of your health through intelligent tracking, AI-powered insights, and seamless communication with healthcare professionals.
          </Text>
          <Text style={styles.description}>
            Our mission is to empower individuals with pre-diabetes and diabetes to make informed decisions about their lifestyle, diet, and health through cutting-edge technology and personalized care.
          </Text>
        </View>

        {/* Important Notice */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Icon name="information" size={16} color={colors.primary} /> GlycoFit is a health tracking and educational tool, not a medical device. Always consult with your healthcare provider for medical advice.
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Icon name={feature.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Technology Stack */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built With</Text>
          <View style={styles.techStack}>
            {techStack.map((tech, index) => (
              <View key={index} style={styles.techChip}>
                <Icon 
                  name={tech.icon} 
                  size={18} 
                  color={colors.primary} 
                  style={styles.techIcon}
                />
                <Text style={styles.techName}>{tech.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            GlycoFit helps you manage your health with confidence through intelligent tracking and personalized insights.
          </Text>
          <Text style={styles.copyright}>
            © 2026 GlycoFit. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AboutScreen;
