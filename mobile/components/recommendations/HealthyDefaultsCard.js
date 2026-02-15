import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * HealthyDefaultsCard
 * 
 * Displays healthy default values when there's not enough user data.
 * Shows research-backed healthy targets for each lifestyle tracker.
 * 
 * Props:
 * - defaults: Object containing healthy default values
 * - trackerType: Type of tracker (food, sleep, activity, alcohol, smoking)
 * - title: Card title
 */
const HealthyDefaultsCard = ({
  defaults,
  trackerType,
  title = "Healthy Targets",
  subtitle = "Research-backed recommendations for optimal health",
  showMessage = true
}) => {
  const { colors } = useTheme();

  if (!defaults) {
    return null;
  }

  const getTrackerConfig = () => {
    switch (trackerType) {
      case 'food':
        return {
          iconName: 'food-apple',
          iconColor: '#27AE60',
          metrics: [
            { key: 'calories', label: 'Daily Calories', unit: 'kcal', icon: 'fire' },
            { key: 'carbohydrates', label: 'Carbohydrates', unit: 'g', icon: 'bread-slice' },
            { key: 'protein', label: 'Protein', unit: 'g', icon: 'food-steak' },
            { key: 'fat', label: 'Fat', unit: 'g', icon: 'water' },
            { key: 'fiber', label: 'Fiber', unit: 'g', icon: 'leaf' },
            { key: 'sodium', label: 'Sodium', unit: 'mg', icon: 'shaker' },
            { key: 'sugar', label: 'Added Sugar', unit: 'g', icon: 'cube-outline' },
          ]
        };
      case 'sleep':
        return {
          iconName: 'sleep',
          iconColor: '#9B59B6',
          metrics: [
            { key: 'duration_hours', label: 'Sleep Duration', unit: 'hours', icon: 'clock-outline' },
            { key: 'optimal_bedtime', label: 'Bedtime', unit: '', icon: 'weather-night' },
            { key: 'optimal_waketime', label: 'Wake Time', unit: '', icon: 'weather-sunny' },
            { key: 'sleep_efficiency', label: 'Sleep Efficiency', unit: '%', icon: 'percent' },
          ]
        };
      case 'activity':
      case 'steps':
        return {
          iconName: 'walk',
          iconColor: '#3498DB',
          metrics: [
            { key: 'daily_steps', label: 'Daily Steps', unit: 'steps', icon: 'shoe-print' },
            { key: 'moderate_activity', label: 'Moderate Activity', unit: 'min/week', icon: 'run' },
            { key: 'vigorous_activity', label: 'Vigorous Activity', unit: 'min/week', icon: 'run-fast' },
            { key: 'sedentary_breaks', label: 'Sedentary Breaks', unit: '/hour', icon: 'human-handsup' },
          ]
        };
      case 'alcohol':
        return {
          iconName: 'glass-wine',
          iconColor: '#E74C3C',
          metrics: [
            { key: 'max_drinks_per_day', label: 'Max Drinks/Day', unit: 'drinks', icon: 'glass-cocktail' },
            { key: 'max_drinks_per_week', label: 'Max Drinks/Week', unit: 'drinks', icon: 'calendar-week' },
            { key: 'alcohol_free_days', label: 'Alcohol-Free Days', unit: '/week', icon: 'calendar-check' },
            { key: 'optimal', label: 'Optimal Intake', unit: '', icon: 'star' },
          ]
        };
      case 'smoking':
        return {
          iconName: 'smoking-off',
          iconColor: '#E67E22',
          metrics: [
            { key: 'cigarettes_per_day', label: 'Target', unit: '', icon: 'cancel' },
            { key: 'nicotine_exposure', label: 'Nicotine', unit: '', icon: 'close-circle' },
            { key: 'optimal', label: 'Recommendation', unit: '', icon: 'heart' },
          ]
        };
      default:
        return {
          iconName: 'heart-pulse',
          iconColor: '#E74C3C',
          metrics: []
        };
    }
  };

  const config = getTrackerConfig();

  const formatValue = (key, value) => {
    if (value === undefined || value === null) return null;
    
    if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
      return `${value.min} - ${value.max}`;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    return value.toString();
  };

  const renderMetric = (metric) => {
    const value = defaults[metric.key];
    const formattedValue = formatValue(metric.key, value);
    
    if (!formattedValue) return null;

    return (
      <View key={metric.key} style={styles.metricItem}>
        <View style={[styles.metricIcon, { backgroundColor: `${config.iconColor}15` }]}>
          <Icon name={metric.icon} size={18} color={config.iconColor} />
        </View>
        <View style={styles.metricContent}>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            {metric.label}
          </Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {formattedValue} {metric.unit}
          </Text>
        </View>
      </View>
    );
  };

  // Memoize styles for performance
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      backgroundColor: `${config.iconColor}20`,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 2,
    },
    messageContainer: {
      backgroundColor: `${config.iconColor}10`,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    messageIcon: {
      marginRight: 10,
    },
    messageText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    metricItem: {
      width: '50%',
      paddingHorizontal: 8,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    metricIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    metricContent: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 11,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    researchNote: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    researchText: {
      fontSize: 11,
      color: colors.secondary,
      fontStyle: 'italic',
      lineHeight: 16,
    },
  }), [colors, config.iconColor]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name={config.iconName} size={24} color={config.iconColor} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {showMessage && (
        <View style={styles.messageContainer}>
          <Icon 
            name="information" 
            size={20} 
            color={config.iconColor}
            style={styles.messageIcon}
          />
          <Text style={styles.messageText}>
            Not enough data yet. Here are research-backed healthy targets to aim for.
          </Text>
        </View>
      )}

      <View style={styles.metricsGrid}>
        {config.metrics.map(metric => renderMetric(metric))}
      </View>

      {defaults.research && (
        <View style={styles.researchNote}>
          <Text style={styles.researchText}>
            📚 {defaults.research}
          </Text>
        </View>
      )}
    </View>
  );
};

export default HealthyDefaultsCard;
