import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MeasureScreen = ({ navigation }) => {
  const { colors } = useTheme();

  const measurementOptions = [
    {
      id: 'food-scanner',
      title: 'Food Scanner',
      subtitle: 'Scan and log your meals',
      icon: 'camera',
      color: '#27AE60',
      action: () => navigation.navigate('FoodScanner'),
    },
    {
      id: 'step-counter',
      title: 'Step Counter',
      subtitle: 'Track daily steps and activity',
      icon: 'walk',
      color: '#F39C12',
      action: () => navigation.navigate('StepCounter'),
    },
    {
      id: 'sleep-tracking',
      title: 'Sleep Tracking',
      subtitle: 'Track sleep patterns and duration',
      icon: 'moon-waning-crescent',
      color: '#3498DB',
      action: () => navigation.navigate('SleepTracking'),
    },
    {
      id: 'smoking-intake',
      title: 'Smoking Intake',
      subtitle: 'Track your smoking history',
      icon: 'smoking',
      color: '#E74C3C',
      action: () => navigation.navigate('SmokingIntake'),
    },
    {
      id: 'alcohol-intake',
      title: 'Alcohol Intake',
      subtitle: 'Track alcohol consumption patterns',
      icon: 'glass-wine',
      color: '#9B59B6',
      action: () => navigation.navigate('AlcoholIntake'),
    },
  ];

  const getIconBackgroundStyle = (color) => ({
    backgroundColor: `${color}15`
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.secondary,
      lineHeight: 22,
    },
    measurementGrid: {
      flexDirection: 'column',
    },
    measurementCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      flexDirection: 'row',
      alignItems: 'center',
    },
    measurementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    measurementInfo: {
      flex: 1,
    },
    measurementTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    measurementSubtitle: {
      fontSize: 12,
      color: colors.secondary,
      lineHeight: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Lifetsyle Tracker</Text>
          <Text style={styles.subtitle}>
            Track your lifestyle to get better insights into your well-being.
          </Text>
        </View>

        <View style={styles.measurementGrid}>
          {measurementOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.measurementCard}
              onPress={option.action}
              activeOpacity={0.7}
            >
              <View style={[styles.measurementIcon, getIconBackgroundStyle(option.color)]}>
                <Icon name={option.icon} size={24} color={option.color} />
              </View>
              <View style={styles.measurementInfo}>
                <Text style={styles.measurementTitle}>{option.title}</Text>
                <Text style={styles.measurementSubtitle}>{option.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MeasureScreen;
