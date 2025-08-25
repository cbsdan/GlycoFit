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
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MeasureScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const measurementOptions = [
    {
      id: 'heart-rate',
      title: 'Heart Rate',
      subtitle: 'Monitor your heart rate',
      icon: 'heart-pulse',
      color: '#E74C3C',
      action: () => handleMeasurement('Heart Rate'),
    },
    {
      id: 'sleep-track',
      title: 'Sleep Tracker',
      subtitle: 'Track your sleep patterns',
      icon: 'sleep',
      color: '#3498DB',
      action: () => handleMeasurement('Sleep Tracker'),
    },
    {
      id: 'food-scanner',
      title: 'Food Scanner',
      subtitle: 'Scan and log your meals',
      icon: 'camera',
      color: '#27AE60',
      action: () => handleMeasurement('Food Scanner'),
    },
    {
      id: 'alcohol-intake',
      title: 'Alcohol Intake',
      subtitle: 'Track alcohol consumption',
      icon: 'glass-wine',
      color: '#8E44AD',
      action: () => handleMeasurement('Alcohol Intake'),
    },
    {
      id: 'smoke-intake',
      title: 'Smoke Intake',
      subtitle: 'Monitor smoking habits',
      icon: 'smoking',
      color: '#95A5A6',
      action: () => handleMeasurement('Smoke Intake'),
    },
    {
      id: 'step-counter',
      title: 'Step Counter',
      subtitle: 'Track daily steps and activity',
      icon: 'walk',
      color: '#F39C12',
      action: () => handleMeasurement('Step Counter'),
    },
  ];

  const handleMeasurement = (measurementType) => {
    toast.info(`${measurementType} feature coming soon!`);
    // TODO: Navigate to specific measurement screen
    // navigation.navigate(`${measurementType}Screen`);
  };

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
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    measurementCard: {
      width: '48%',
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
    },
    measurementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
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
    recentSection: {
      marginTop: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    recentCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    recentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    recentTime: {
      fontSize: 12,
      color: colors.secondary,
    },
    recentValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    recentUnit: {
      fontSize: 14,
      color: colors.secondary,
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Measurements</Text>
          <Text style={styles.subtitle}>
            Track your vital signs and health metrics to get better insights into your well-being.
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
              <View style={[styles.measurementIcon, { backgroundColor: `${option.color}15` }]}>
                <Icon name={option.icon} size={24} color={option.color} />
              </View>
              <Text style={styles.measurementTitle}>{option.title}</Text>
              <Text style={styles.measurementSubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Measurements</Text>
          
          {/* Empty state for now */}
          <View style={styles.emptyState}>
            <Icon name="chart-line" size={48} color={colors.secondary} />
            <Text style={styles.emptyText}>
              No recent measurements.{'\n'}Start tracking your health metrics above!
            </Text>
          </View>

          {/* Example of how recent measurements would look */}
          {/* 
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Heart Rate</Text>
              <Text style={styles.recentTime}>2 hours ago</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.recentValue}>72</Text>
              <Text style={styles.recentUnit}>bpm</Text>
            </View>
          </View>
          */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MeasureScreen;
