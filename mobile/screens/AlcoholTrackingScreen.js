/**
 * Alcohol Tracking Dashboard Screen
 * 
 * Main dashboard showing comprehensive alcohol tracking status:
 * - Baseline pattern
 * - Recent consumption records
 * - Computed metrics (7d, 30d averages)
 * - Risk assessment with recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { 
  getAlcoholSummary, 
  checkAlcoholBaseline,
  deleteDailyAlcoholRecord 
} from '../services/api';

const AlcoholTrackingScreen = ({ navigation }) => {
  const { colors } = useTheme();

  // Data state
  const [baseline, setBaseline] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [risk, setRisk] = useState(null);
  const [records, setRecords] = useState([]);
  const [hasBaseline, setHasBaseline] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if baseline exists
      const baselineCheck = await checkAlcoholBaseline();
      setHasBaseline(baselineCheck.has_baseline);

      if (baselineCheck.has_baseline) {
        // Load full summary
        const summary = await getAlcoholSummary();
        setBaseline(summary.baseline);
        setMetrics(summary.metrics);
        setRisk(summary.risk_assessment);
        setRecords(summary.recent_records || []);
      }
    } catch (error) {
      console.error('Error loading alcohol data:', error);
      Alert.alert('Error', 'Failed to load alcohol tracking data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteRecord = (date) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDailyAlcoholRecord(date);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete record');
            }
          },
        },
      ]
    );
  };

  const getRiskColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'low':
        return '#4CAF50';
      case 'moderate':
        return '#FF9800';
      case 'high':
        return '#F44336';
      case 'very_high':
        return '#E91E63';
      default:
        return '#9E9E9E';
    }
  };

  const getRiskStyle = (category) => {
    const color = getRiskColor(category);
    return {
      backgroundColor: `${color}15`,
      borderColor: color,
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Alcohol Tracking
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Show baseline prompt if not completed
  if (!hasBaseline) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Alcohol Tracking
          </Text>
        </View>

        <View style={styles.emptyContainer}>
          <Icon name="glass-cocktail" size={80} color={colors.secondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Complete Your Baseline Assessment
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondary }]}>
            Before you can track daily alcohol consumption, please complete a brief questionnaire about your typical drinking pattern.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AlcoholBaseline')}
          >
            <Text style={styles.primaryButtonText}>Start Baseline Assessment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Alcohol Tracking</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Icon name="refresh" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Risk Assessment Card - Prominent style */}
        {risk && (
          <View style={[styles.riskCard, { backgroundColor: getRiskColor(risk.overall_risk_category || risk.risk_category) }]}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskTitle}>ALCOHOL-RELATED DIABETES RISK</Text>
            </View>
            <Text style={styles.riskScore}>
              {risk.risk_score !== undefined && risk.risk_score !== null 
                ? `${risk.risk_score > 0 ? '+' : ''}${risk.risk_score}` 
                : '0'}
            </Text>
            <Text style={styles.riskLabel}>
              {(risk.overall_risk_category || risk.risk_category)?.toUpperCase().replace('_', ' ') || 'UNKNOWN'} RISK
            </Text>

            {risk.risk_factors?.length > 0 && (
              <View style={styles.riskFactors}>
                {risk.risk_factors.slice(0, 3).map((factor, index) => (
                  <View key={index} style={styles.riskFactorItem}>
                    <Icon name="alert-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.riskFactorText}>{factor}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.riskBadge}>
              <Text style={styles.riskBadgeText}>
                {records.length} days tracked
              </Text>
            </View>
          </View>
        )}

        {/* Retake Baseline Button */}
        <TouchableOpacity
          style={styles.retakeBaselineButton}
          onPress={() => navigation.navigate('AlcoholBaseline', { isRetake: true })}
        >
          <Icon name="refresh" size={18} color={colors.secondary} />
          <Text style={[styles.retakeBaselineText, { color: colors.secondary }]}>
            Retake Baseline Questionnaire
          </Text>
        </TouchableOpacity>

        {/* Metrics Grid */}
        {(baseline || metrics) && (
          <View style={styles.metricsGrid}>
            {baseline && (
              <>
                <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="calendar-week" size={24} color={colors.primary} style={styles.metricIcon} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {baseline.baseline_drinking_days_per_week}
                    <Text style={[styles.metricUnit, { color: colors.secondary }]}> days</Text>
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.secondary }]}>Days/Week</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="glass-cocktail" size={24} color={colors.primary} style={styles.metricIcon} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {baseline.baseline_drinks_per_occasion}
                    <Text style={[styles.metricUnit, { color: colors.secondary }]}> drinks</Text>
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.secondary }]}>Per Occasion</Text>
                </View>
              </>
            )}

            {metrics && (
              <>
                <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="chart-line" size={24} color={colors.primary} style={styles.metricIcon} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {metrics.avg_drinks_per_week_7d?.toFixed(1) || '0'}
                    <Text style={[styles.metricUnit, { color: colors.secondary }]}>/wk</Text>
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.secondary }]}>7-Day Average</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="calendar-month" size={24} color={colors.primary} style={styles.metricIcon} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {metrics.avg_drinks_per_week_30d?.toFixed(1) || '0'}
                    <Text style={[styles.metricUnit, { color: colors.secondary }]}>/wk</Text>
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.secondary }]}>30-Day Average</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="alert-circle" size={24} color="#FF9800" style={styles.metricIcon} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {risk?.current_consumption?.binge_episodes_30d ?? metrics?.binge_episodes_30d ?? 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.secondary }]}>Binge Episodes</Text>
                </View>

                {baseline?.drinks_with_meals && (
                  <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Icon name="silverware-fork-knife" size={24} color="#4CAF50" style={styles.metricIcon} />
                    <Text style={[styles.metricValue, { color: colors.text }]}>✓</Text>
                    <Text style={[styles.metricLabel, { color: colors.secondary }]}>With Meals</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AlcoholDailyLog')}
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Log Today</Text>
          </TouchableOpacity>
        </View>

        {/* Recommendations Card */}
        {risk?.recommendations?.length > 0 && (
          <View style={[styles.recommendationsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Icon name="lightbulb-outline" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, marginLeft: 8 }]}>
                Recommendations
              </Text>
            </View>
            {risk.recommendations.slice(0, 3).map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={[styles.recommendationText, { color: colors.text }]}>
                  {rec}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Records */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Consumption
        </Text>

          {records.length === 0 ? (
            <View style={[styles.emptyRecords, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="calendar-blank" size={48} color={colors.secondary} />
              <Text style={[styles.emptyRecordsText, { color: colors.secondary }]}>
                No records yet. Start logging your daily consumption!
              </Text>
            </View>
          ) : (
            records.map((record) => (
              <View
                key={record.date}
                style={styles.recordCardContainer}
              >
                <View style={[styles.recordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.recordDate}>
                    <Text style={[styles.recordDateText, { color: colors.text }]}>
                      {new Date(record.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <View style={styles.recordContext}>
                      <Icon name="map-marker" size={12} color={colors.secondary} />
                      <Text style={[styles.recordContextText, { color: colors.secondary }]}>
                        {record.drinking_context} • {record.time_of_day}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.recordStats}>
                    <Text style={[styles.recordDuration, { color: colors.primary }]}>
                      {record.drinks_consumed} {record.drinks_consumed === 1 ? 'drink' : 'drinks'}
                    </Text>
                    {record.was_binge_episode && (
                      <View style={styles.bingeBadge}>
                        <Text style={styles.bingeText}>BINGE</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteRecordButton}
                  onPress={() => handleDeleteRecord(record.date)}
                >
                  <Icon name="delete" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))
          )}

        {/* Education Card */}
        <View style={[styles.educationCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
          <Text style={[styles.educationTitle, { color: colors.text }]}>
            📊 Understanding Your Alcohol Risk
          </Text>
          <Text style={[styles.educationText, { color: colors.secondary }]}>
            Your risk assessment is based on evidence-based research linking alcohol consumption to diabetes:
          </Text>
          <View style={styles.educationBullet}>
            <Icon name="numeric-1-circle" size={18} color={colors.primary} />
            <Text style={[styles.educationBulletText, { color: colors.text }]}>
              <Text style={{ fontWeight: '600' }}>Light drinking</Text> (≤7 drinks/week) may show slight protective effect
            </Text>
          </View>
          <View style={styles.educationBullet}>
            <Icon name="numeric-2-circle" size={18} color={colors.primary} />
            <Text style={[styles.educationBulletText, { color: colors.text }]}>
              <Text style={{ fontWeight: '600' }}>Heavy drinking</Text> <Text style={{ fontWeight: '600' }}>(14 drinks/week) increases diabetes risk by 40-50% </Text>
            </Text>
          </View>
          <View style={styles.educationBullet}>
            <Icon name="numeric-3-circle" size={18} color={colors.primary} />
            <Text style={[styles.educationBulletText, { color: colors.text }]}>
              <Text style={{ fontWeight: '600' }}>Binge drinking</Text> significantly increases metabolic dysregulation
            </Text>
          </View>
          <Text style={[styles.educationText, { color: colors.secondary, marginTop: 12, fontStyle: 'italic' }]}>
            💡 Tip: Drinking with meals and maintaining consistency helps minimize diabetes risk.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Risk Card - Prominent style
  riskCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  riskScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  riskLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  riskFactors: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  riskFactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskFactorText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 8,
    opacity: 0.9,
  },
  riskBadge: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  retakeBaselineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  retakeBaselineText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    margin: 6,
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 12,
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  // Action Buttons
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  // Recommendations Card
  recommendationsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recommendationText: {
    fontSize: 13,
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  // Records
  recordCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordDate: {
    flex: 1,
  },
  recordDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  recordContextText: {
    fontSize: 11,
    marginLeft: 4,
  },
  recordStats: {
    alignItems: 'flex-end',
  },
  recordDuration: {
    fontSize: 16,
    fontWeight: '700',
  },
  bingeBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  bingeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteRecordButton: {
    paddingLeft: 8,
    marginLeft: 2,
  },
  emptyRecords: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyRecordsText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  // Education Card
  educationCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
  },
  educationTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  educationText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  educationBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  educationBulletText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 20,
  },
});

export default AlcoholTrackingScreen;
