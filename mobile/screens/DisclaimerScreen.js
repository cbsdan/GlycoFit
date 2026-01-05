import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { globalStyles } from '../styles/globalStyles';
import { buttonStyles } from '../styles/components/buttonStyles';
import { MaterialIcons } from '@expo/vector-icons';
import { updateDisclaimerStatus } from '../services/api';

const { width, height } = Dimensions.get('window');

const DisclaimerScreen = ({ navigation, onComplete, readOnly = false }) => {
  const [hasRead, setHasRead] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const { logout } = useAuth();

  const handleGoBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleScroll = (event) => {
    const paddingToBottom = 20;
    const isAtBottom =
      event.nativeEvent.layoutMeasurement.height +
      event.nativeEvent.contentOffset.y >=
      event.nativeEvent.contentSize.height - paddingToBottom;
    setIsScrolledToBottom(isAtBottom);
  };

  const handleAccept = async () => {
    if (!hasRead) {
      Alert.alert(
        'Confirmation Required',
        'Please confirm that you have read and understood the disclaimer.',
        [{ text: 'OK', onPress: () => {} }]
      );
      return;
    }

    try {
      setIsLoading(true);
      // Save acceptance to backend
      await updateDisclaimerStatus(true);
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving disclaimer acceptance:', error);
      Alert.alert('Error', 'Failed to save your acceptance. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Disclaimer Not Accepted',
      'You must accept the disclaimer to use this app. You will be logged out.',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: async () => {
            try {
              setIsLoading(true);
              // Save declined status to backend before logging out
              try {
                await updateDisclaimerStatus(false);
              } catch (apiError) {
                console.error('Error saving disclaimer decline:', apiError);
                // Continue with logout even if API call fails
              }
              await logout();
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

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
      justifyContent: 'space-between',
    },
    backButton: {
      padding: 4,
      width: 40,
    },
    headerContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    headerIcon: {
      marginRight: 10,
    },
    headerText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    disclaimerSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
      marginTop: 15,
    },
    disclaimerText: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    bulletPoint: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 10,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
      paddingVertical: 15,
      paddingHorizontal: 15,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: hasRead ? colors.primary : colors.border,
    },
    checkboxText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    buttonContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 10,
    },
    acceptButton: {
      ...buttonStyles.primary,
      opacity: hasRead && isScrolledToBottom ? 1 : 0.5,
    },
    primaryText: {
        color: colors.text
    },
    declineButton: {
      ...buttonStyles.outline,
      borderColor: colors.primary,
    },
    declineText: {
      color: colors.primary,
      fontWeight: '600',
    },
    warningBox: {
      backgroundColor: isDarkMode ? '#3E2723' : '#FFF3E0',
      borderLeftWidth: 4,
      borderLeftColor: '#FF9800',
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 15,
    },
    warningText: {
      color: isDarkMode ? '#FFAB91' : '#E65100',
      fontSize: 13,
      lineHeight: 19,
    },
    emphasisText: {
      fontWeight: '600',
      color: colors.primary,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {readOnly && (
          <TouchableOpacity 
            onPress={handleGoBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        )}
        <View style={styles.headerContent}>
          <MaterialIcons
            name="info"
            size={24}
            color="#FFFFFF"
            style={styles.headerIcon}
          />
          <Text style={styles.headerText}>Important Disclaimer</Text>
        </View>
        {readOnly && <View style={styles.headerSpacer} />}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* Warning Box */}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            <Text style={styles.emphasisText}>⚠️ Please Read Carefully: </Text>
            This application provides health information and tools for tracking purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.
          </Text>
        </View>

        {/* Main Disclaimer */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>1. Not Medical Advice</Text>
          <Text style={styles.disclaimerText}>
            The information, predictions, and recommendations provided by GlycoFit are for educational and informational purposes only. They are not intended as professional medical advice, and should not be relied upon as a substitute for professional medical advice, diagnosis, or treatment from a qualified healthcare provider.
          </Text>
          <Text style={styles.disclaimerText}>
            Always consult with your physician, nurse, or other qualified healthcare professional before starting any new health treatment or making any changes to your existing medical care.
          </Text>
        </View>

        {/* AI Predictions Disclaimer */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>2. Health Data and Analysis</Text>
          <Text style={styles.disclaimerText}>
            Information, analysis, and recommendations provided by this application are for educational and informational purposes only. They are based on artificial intelligence and machine learning applied to your personal health data.
          </Text>
          <Text style={styles.disclaimerText}>
            These analyses are not guaranteed to be accurate and should not be used as a substitute for professional medical diagnosis or treatment. Your actual health status can be affected by numerous factors not captured in this app, including stress, illness, medications, weather, and other physiological factors.
          </Text>
        </View>

        {/* Data Limitations */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>3. Data and Monitoring</Text>
          <Text style={styles.disclaimerText}>
            The data collected through this app (including steps, calories, meals, and other health metrics) are based on:
          </Text>
          <Text style={styles.bulletPoint}>• Data you manually enter</Text>
          <Text style={styles.bulletPoint}>• Health Connect integrations</Text>
          <Text style={styles.bulletPoint}>• Wearable device data synced through Health Connect</Text>
          <Text style={styles.disclaimerText}>
            The accuracy of this data depends on the accuracy of these sources and your proper use of devices and input.
          </Text>
        </View>

        {/* Personal Responsibility */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>4. Your Responsibility</Text>
          <Text style={styles.disclaimerText}>
            You are responsible for:
          </Text>
          <Text style={styles.bulletPoint}>• Providing accurate personal health information</Text>
          <Text style={styles.bulletPoint}>• Maintaining regular contact with your healthcare provider</Text>
          <Text style={styles.bulletPoint}>• Seeking immediate medical attention for health emergencies</Text>
          <Text style={styles.bulletPoint}>• Verifying all health information entered in the app</Text>
          <Text style={styles.bulletPoint}>• Using the app as a supplementary tool, not a replacement for professional care</Text>
        </View>

        {/* Medical Emergencies */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>5. Medical Emergencies</Text>
          <Text style={styles.disclaimerText}>
            If you experience any medical emergency, severe symptoms, chest pain, difficulty breathing, or any other life-threatening condition, immediately contact emergency services or go to the nearest hospital. Do not rely on this app for emergency medical advice.
          </Text>
        </View>

        {/* No Liability */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={styles.disclaimerText}>
            GlycoFit and its developers are not responsible for any health consequences, adverse effects, or damages resulting from the use or misuse of this application. Use this app at your own risk.
          </Text>
        </View>

        {/* Privacy Note */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>7. Privacy and Data Security</Text>
          <Text style={styles.disclaimerText}>
            Your health data is sensitive. Please review our privacy policy to understand how your data is collected, used, and protected. While we take security seriously, no system is completely secure.
          </Text>
        </View>

        {/* Physician Consultation */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>8. Professional Consultation</Text>
          <Text style={styles.disclaimerText}>
            This app includes a communication feature with healthcare professionals. However, messages through this app should not be treated as a substitute for in-person medical consultations or emergency medical care.
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.sectionTitle}>In Summary</Text>
          <Text style={styles.disclaimerText}>
            <Text style={styles.emphasisText}>GlycoFit is a health tracking and educational tool, not a medical device.</Text>
            {' '}It should be used as a supplement to, not a replacement for, professional medical care. Always consult with your healthcare provider about your health concerns, medications, and treatment plans.
          </Text>
        </View>
      </ScrollView>

      {/* Checkbox and Buttons - Only show when not in read-only mode */}
      {!readOnly && (
        <View style={styles.buttonContainer}>
          {/* Confirmation Checkbox */}
          <View style={styles.checkboxContainer}>
            <Switch
              value={hasRead}
              onValueChange={setHasRead}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={hasRead ? colors.primary : colors.surface}
              ios_backgroundColor={colors.border}
            />
            <Text style={styles.checkboxText}>
              I have read and understand this disclaimer
            </Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={[
              styles.acceptButton,
              {
                opacity: hasRead && isScrolledToBottom && !isLoading ? 1 : 0.5,
              },
            ]}
            onPress={handleAccept}
            disabled={!hasRead || !isScrolledToBottom || isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryText}>
              {isLoading ? 'Saving...' : 'I Accept & Understand'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.declineText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default DisclaimerScreen;
