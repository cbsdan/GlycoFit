import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const PredictionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const predictionCards = [
    {
      id: 'glucose-trend',
      title: 'Glucose Trend',
      subtitle: 'Predicted blood sugar levels',
      icon: 'trending-up',
      color: '#E74C3C',
      status: 'stable',
      prediction: 'Normal range expected',
      confidence: 85,
    },
    {
      id: 'risk-assessment',
      title: 'Risk Assessment',
      subtitle: 'Diabetes complication risk',
      icon: 'shield-check',
      color: '#27AE60',
      status: 'low',
      prediction: 'Low risk detected',
      confidence: 92,
    },
    {
      id: 'lifestyle-impact',
      title: 'Lifestyle Impact',
      subtitle: 'Diet and exercise effects',
      icon: 'heart-pulse',
      color: '#3498DB',
      status: 'positive',
      prediction: 'Positive trend',
      confidence: 78,
    },
    {
      id: 'medication-timing',
      title: 'Medication Timing',
      subtitle: 'Optimal dosage schedule',
      icon: 'pill',
      color: '#9B59B6',
      status: 'optimized',
      prediction: 'Schedule optimized',
      confidence: 88,
    },
  ];

  const insights = [
    {
      id: 1,
      title: 'Morning glucose levels',
      description: 'Your morning readings have been consistently within target range',
      type: 'positive',
      time: '2 hours ago',
    },
    {
      id: 2,
      title: 'Exercise correlation',
      description: 'Evening workouts show 15% better glucose control next day',
      type: 'insight',
      time: '5 hours ago',
    },
    {
      id: 3,
      title: 'Sleep quality impact',
      description: 'Poor sleep nights correlate with higher morning glucose',
      type: 'warning',
      time: '1 day ago',
    },
  ];

  const timePeriods = [
    { key: 'day', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  const handlePredictionTap = (predictionId) => {
    toast.info('Detailed prediction view coming soon!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'stable':
      case 'low':
      case 'optimized':
        return '#27AE60';
      case 'positive':
        return '#3498DB';
      case 'warning':
        return '#F39C12';
      case 'high':
        return '#E74C3C';
      default:
        return colors.secondary;
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'positive':
        return { name: 'trending-up', color: '#27AE60' };
      case 'warning':
        return { name: 'alert', color: '#F39C12' };
      case 'insight':
        return { name: 'lightbulb-outline', color: '#3498DB' };
      default:
        return { name: 'information-outline', color: colors.secondary };
    }
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
    periodSelector: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 4,
      marginBottom: 24,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
    },
    periodText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.secondary,
    },
    periodTextActive: {
      color: '#FFFFFF',
    },
    predictionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 32,
    },
    predictionCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
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
    predictionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    predictionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    predictionInfo: {
      flex: 1,
    },
    predictionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    predictionSubtitle: {
      fontSize: 11,
      color: colors.secondary,
    },
    predictionContent: {
      marginBottom: 12,
    },
    predictionText: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    confidenceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#FFFFFF',
      textTransform: 'uppercase',
    },
    confidenceText: {
      fontSize: 12,
      color: colors.secondary,
    },
    insightsSection: {
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    insightCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    insightIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    insightContent: {
      flex: 1,
    },
    insightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    insightTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    insightTime: {
      fontSize: 12,
      color: colors.secondary,
    },
    insightDescription: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Predictions</Text>
          <Text style={styles.subtitle}>
            AI-powered insights based on your health data and patterns.
          </Text>
        </View>

        <View style={styles.periodSelector}>
          {timePeriods.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodButton,
                selectedPeriod === period.key && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period.key && styles.periodTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.predictionsGrid}>
          {predictionCards.map((prediction) => (
            <TouchableOpacity
              key={prediction.id}
              style={styles.predictionCard}
              onPress={() => handlePredictionTap(prediction.id)}
              activeOpacity={0.7}
            >
              <View style={styles.predictionHeader}>
                <View style={[styles.predictionIcon, { backgroundColor: `${prediction.color}15` }]}>
                  <Icon name={prediction.icon} size={20} color={prediction.color} />
                </View>
                <View style={styles.predictionInfo}>
                  <Text style={styles.predictionTitle}>{prediction.title}</Text>
                  <Text style={styles.predictionSubtitle}>{prediction.subtitle}</Text>
                </View>
              </View>
              
              <View style={styles.predictionContent}>
                <Text style={styles.predictionText}>{prediction.prediction}</Text>
              </View>

              <View style={styles.confidenceContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(prediction.status) }]}>
                  <Text style={styles.statusText}>{prediction.status}</Text>
                </View>
                <Text style={styles.confidenceText}>{prediction.confidence}% confidence</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Recent Insights</Text>
          
          {insights.map((insight) => {
            const insightIcon = getInsightIcon(insight.type);
            return (
              <TouchableOpacity
                key={insight.id}
                style={styles.insightCard}
                onPress={() => toast.info('Detailed insight coming soon!')}
                activeOpacity={0.7}
              >
                <View style={[styles.insightIconContainer, { backgroundColor: `${insightIcon.color}15` }]}>
                  <Icon name={insightIcon.name} size={16} color={insightIcon.color} />
                </View>
                
                <View style={styles.insightContent}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightTime}>{insight.time}</Text>
                  </View>
                  <Text style={styles.insightDescription}>{insight.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PredictionScreen;
