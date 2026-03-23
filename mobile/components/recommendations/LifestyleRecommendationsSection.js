import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import TimelinePredictionCard from './TimelinePredictionCard';
import RecommendationCard from './RecommendationCard';
import HealthyDefaultsCard from './HealthyDefaultsCard';
import api from '../../services/api';

/**
 * LifestyleRecommendationsSection
 * 
 * A unified component that fetches and displays lifestyle recommendations
 * for any tracker type. Handles loading states, errors, and empty states.
 * 
 * Props:
 * - trackerType: 'food' | 'sleep' | 'activity' | 'alcohol' | 'smoking'
 * - onError: Optional callback for error handling
 * - hideRecommendations: Optional flag to hide the recommendations section (useful when shown elsewhere)
 */
const LifestyleRecommendationsSection = ({
  trackerType,
  onError,
  containerStyle,
  hideRecommendations = false,
  isDiagnosed = false,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [expandedRecommendations, setExpandedRecommendations] = useState(true);

  const trackerConfig = useMemo(() => ({
    food: {
      title: 'Diet Predictions',
      icon: 'food-apple',
      color: '#27AE60',
      fetchFn: api.getFoodPredictions,
    },
    sleep: {
      title: 'Sleep Predictions',
      icon: 'sleep',
      color: '#9B59B6',
      fetchFn: api.getSleepPredictions,
    },
    activity: {
      title: 'Activity Predictions',
      icon: 'walk',
      color: '#3498DB',
      fetchFn: api.getActivityPredictions,
    },
    alcohol: {
      title: 'Alcohol Impact',
      icon: 'glass-wine',
      color: '#E74C3C',
      fetchFn: api.getAlcoholPredictions,
    },
    smoking: {
      title: 'Smoking Impact',
      icon: 'smoking',
      color: '#E67E22',
      fetchFn: api.getSmokingPredictions,
    },
  }), []);

  const config = trackerConfig[trackerType] || trackerConfig.food;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await config.fetchFn();
      
      // Handle both response formats: { status: 'success', data } or { success: true, ... }
      const isSuccess = response.status === 'success' || response.success === true;
      
      if (isSuccess) {
        // Extract data - handle nested or flat structure
        const predictions = response.predictions || response.data?.predictions || {};
        const responseData = response.data || {
          has_data: response.has_data,
          sufficient_data: response.has_data !== false,
          healthy_defaults: response.healthy_defaults,
          predictions: predictions,
          risk_assessment: response.current_risk || { 
            current_risk_level: response.risk_category,
            risk_score: response.current_risk_score 
          },
          timeline_predictions: predictions.timeline_predictions || {},
          recommendations: predictions.recommendations || [],
          research_references: predictions.research_references || [],
          message: response.message,
        };
        setData(responseData);
      } else {
        throw new Error(response.message || 'Failed to fetch recommendations');
      }
    } catch (err) {
      console.error(`Error fetching ${trackerType} recommendations:`, err);
      setError(err.message || 'Failed to load recommendations');
      if (onError) onError(err);
      
      // Try to fetch healthy defaults as fallback
      try {
        const defaultsResponse = await api.getHealthyDefaults();
        const isDefaultsSuccess = defaultsResponse.status === 'success' || defaultsResponse.success === true;
        const defaultsData = defaultsResponse.data || defaultsResponse;
        
        if (isDefaultsSuccess && defaultsData?.guidelines?.[trackerType]) {
          setData({
            sufficient_data: false,
            healthy_defaults: defaultsData.guidelines[trackerType],
            recommendations: [],
          });
          setError(null);
        }
      } catch (defaultsErr) {
        console.error('Failed to fetch defaults:', defaultsErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.fetchFn, trackerType, onError]);

  useEffect(() => {
    fetchData();
  }, [trackerType, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${config.color}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    refreshButton: {
      padding: 8,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.secondary,
    },
    errorContainer: {
      backgroundColor: '#E74C3C15',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorIcon: {
      marginRight: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: '#E74C3C',
    },
    retryButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: '#E74C3C20',
      borderRadius: 8,
    },
    retryText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#E74C3C',
    },
    riskOverview: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    riskIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    riskContent: {
      flex: 1,
    },
    riskLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginBottom: 4,
    },
    riskLevel: {
      fontSize: 20,
      fontWeight: '700',
    },
    riskScore: {
      fontSize: 13,
      color: colors.secondary,
      marginTop: 2,
    },
    dataStatus: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    dataStatusIcon: {
      marginRight: 10,
    },
    dataStatusText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },
  }), [colors, config.color]);

  if (loading) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={config.color} />
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={24} color="#E74C3C" style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low':
      case 'none':
      case 'healthy':
      case 'optimal':
      case 'non-smoker':
        return '#27AE60';
      case 'moderate':
      case 'approaching':
      case 'light':
        return '#F39C12';
      case 'high':
      case 'elevated':
      case 'heavy':
        return '#E74C3C';
      case 'very_high':
      case 'very_heavy':
      case 'binge':
        return '#C0392B';
      default:
        return config.color;
    }
  };

  const riskLevel = data?.risk_assessment?.current_risk_level ||
                    data?.risk_assessment?.risk_category ||
                    data?.current_status?.pattern || 
                    data?.current_assessment?.risk_level;
  const riskScore = data?.risk_assessment?.risk_score || 
                    data?.current_status?.risk_score;
  const riskColor = getRiskColor(riskLevel);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name={config.icon} size={18} color={config.color} />
        </View>
        <Text style={styles.headerTitle}>Insights & Predictions</Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh predictions"
          accessibilityState={{ disabled: refreshing }}
        >
          <Icon 
            name={refreshing ? "loading" : "refresh"} 
            size={20} 
            color={colors.secondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Data Status Message */}
      {data?.sufficient_data === false && (
        <View style={styles.dataStatus}>
          <Icon 
            name="information" 
            size={20} 
            color={config.color}
            style={styles.dataStatusIcon}
          />
          <Text style={styles.dataStatusText}>
            {data.message || "Not enough data for predictions yet. Keep tracking!"}
          </Text>
        </View>
      )}

      {/* Risk Overview */}
      {!isDiagnosed && riskLevel && data?.sufficient_data !== false && (
        <View style={styles.riskOverview}>
          <View style={[styles.riskIconContainer, { backgroundColor: `${riskColor}20` }]}>
            <Icon 
              name={
                riskLevel.toLowerCase().includes('low') || riskLevel.toLowerCase().includes('healthy') 
                  ? 'check-circle' 
                  : riskLevel.toLowerCase().includes('high') 
                    ? 'alert-circle' 
                    : 'alert'
              } 
              size={28} 
              color={riskColor} 
            />
          </View>
          <View style={styles.riskContent}>
            <Text style={styles.riskLabel}>Current Risk Level</Text>
            <Text style={[styles.riskLevel, { color: riskColor }]}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).replace(/_/g, ' ')}
            </Text>
            {riskScore !== undefined && (
              <Text style={styles.riskScore}>
                Risk Score: {riskScore.toFixed ? riskScore.toFixed(1) : riskScore}/100
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Healthy Defaults (when insufficient data) */}
      {data?.healthy_defaults && data?.sufficient_data === false && (
        <HealthyDefaultsCard
          defaults={data.healthy_defaults}
          trackerType={trackerType}
        />
      )}

      {/* Timeline Predictions */}
      {data?.timeline_predictions && Object.keys(data.timeline_predictions).length > 0 && (
        <TimelinePredictionCard
          predictions={data.timeline_predictions}
          title={`${config.title}`}
          subtitle="If current pattern continues"
          iconName="timeline-clock"
          iconColor={config.color}
          expanded={expandedTimeline}
          onToggleExpand={() => setExpandedTimeline(!expandedTimeline)}
        />
      )}

      {/* Recommendations */}
      {!hideRecommendations && data?.recommendations && data.recommendations.length > 0 && (
        <RecommendationCard
          recommendations={data.recommendations}
          title="Personalized Recommendations"
          subtitle="Based on your tracking data"
          iconName="lightbulb-outline"
          iconColor={config.color}
          riskLevel={riskLevel}
          researchReferences={data.research_references}
          expanded={expandedRecommendations}
          onToggleExpand={() => setExpandedRecommendations(!expandedRecommendations)}
        />
      )}
    </View>
  );
};

export default LifestyleRecommendationsSection;
