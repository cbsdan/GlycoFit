import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

/**
 * SmokingTrackingScreen - Main dashboard for smoking tracking
 * 
 * Features:
 * - Shows current metrics and risk assessment
 * - Quick access to log daily smoking
 * - Educational content about smoking and diabetes
 * - Recent smoking history
 */
const SmokingTrackingScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);

  // Load data on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Check if baseline exists
      const baselineCheck = await api.checkSmokingBaseline();
      const hasBaselineValue = baselineCheck?.has_baseline || false;
      setHasBaseline(hasBaselineValue);

      if (hasBaselineValue) {
        // Load full summary if baseline exists
        try {
          const summaryResponse = await api.getSmokingSummary(30); // Get 30 days summary
          if (summaryResponse?.success && summaryResponse?.data) {
            setSummary(summaryResponse.data);
          }

          // Fetch recent records
          const recordsResponse = await api.getDailySmokingRecords(null, null, 30);
          if (recordsResponse?.success && recordsResponse?.data) {
            setRecentRecords(recordsResponse.data);
          } else {
            // Fallback to summary's recent_records if daily fetch fails
            setRecentRecords(summaryResponse?.data?.recent_records || []);
          }
        } catch (summaryError) {
          console.error('Error loading smoking summary:', summaryError);
          // Continue without summary data
        }
      }
    } catch (error) {
      console.error('Error loading smoking data:', error);
      setHasBaseline(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.refreshSmokingMetrics();
      await loadData();
    } catch (error) {
      console.error('Error refreshing:', error);
    }
    setIsRefreshing(false);
  };

  const handleStartBaseline = () => {
    navigation.navigate('SmokingBaseline');
  };

  const handleLogSmoking = () => {
    navigation.navigate('SmokingDailyLog');
  };

  const handleDeleteRecord = (record) => {
    Alert.alert(
      'Delete Smoking Log',
      `Are you sure you want to delete the smoking log for ${record.date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteDailySmokingRecord(record.date);
              Alert.alert('Deleted', 'Smoking log has been deleted.');
              await handleRefresh();
            } catch (error) {
              console.error('Error deleting record:', error);
              Alert.alert('Error', 'Failed to delete smoking log.');
            }
          },
        },
      ]
    );
  };

  const handleRecordPress = (record) => {
    // Navigate to edit the record
    navigation.navigate('SmokingDailyLog', {
      prefilledDate: record.date,
    });
  };

  const getRiskColor = (riskCategory) => {
    switch (riskCategory?.toLowerCase()) {
      case 'low': return '#27AE60';
      case 'moderate': return '#F39C12';
      case 'high': return '#E67E22';
      case 'very_high': return '#E74C3C';
      default: return colors.secondary;
    }
  };

  const getRiskLabel = (riskCategory) => {
    switch (riskCategory?.toLowerCase()) {
      case 'low': return 'Low Risk';
      case 'moderate': return 'Moderate Risk';
      case 'high': return 'High Risk';
      case 'very_high': return 'Very High Risk';
      default: return 'Unknown';
    }
  };

  const getRiskDescription = (riskCategory) => {
    switch (riskCategory?.toLowerCase()) {
      case 'low':
        return 'Great job! Continue maintaining a smoke-free lifestyle.';
      case 'moderate':
        return 'Light smoking still increases diabetes risk. Consider quitting to improve health outcomes.';
      case 'high':
        return 'Smoking significantly increases your diabetes risk. We recommend seeking cessation support.';
      case 'very_high':
        return 'Heavy smoking dramatically increases diabetes risk. Please consult healthcare provider for cessation programs.';
      default:
        return 'Log your smoking history to get personalized risk assessment.';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) return 'Today';
    if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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
      color: colors.text,
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
    // Baseline CTA
    baselineCTA: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    baselineIcon: {
      marginBottom: 16,
    },
    baselineTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    baselineDescription: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    baselineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    baselineButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    // Risk Card
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
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    riskBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    riskBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    riskLevel: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    riskDescription: {
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 20,
      opacity: 0.95,
    },
    // Metrics Grid
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
      marginBottom: 16,
    },
    metricCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      margin: '1%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricIcon: {
      marginBottom: 8,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.secondary,
      fontWeight: '600',
    },
    metricSubtext: {
      fontSize: 10,
      color: colors.secondary,
      marginTop: 2,
    },
    // Quick Actions
    quickActions: {
      flexDirection: 'row',
      marginBottom: 24,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    secondaryActionButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryActionButtonText: {
      color: colors.text,
    },
    // Records Section
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.secondary,
    },
    recordCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    recordDate: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    recordActions: {
      flexDirection: 'row',
      gap: 8,
    },
    recordActionButton: {
      padding: 6,
    },
    recordStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recordStat: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 20,
    },
    recordStatText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
      marginLeft: 6,
    },
    recordStatUnit: {
      fontSize: 12,
      color: colors.secondary,
      marginLeft: 4,
    },
    recordNotes: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    recordNotesText: {
      fontSize: 14,
      color: colors.secondary,
      fontStyle: 'italic',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyStateIcon: {
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptyStateDescription: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    // Info Box
    infoBox: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    infoBoxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    infoBoxTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 8,
    },
    infoBoxText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.secondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Baseline CTA if no baseline
  if (!hasBaseline) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={loadData} colors={[colors.primary]} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Smoking Tracking</Text>
          </View>

          {/* Baseline CTA */}
          <View style={styles.baselineCTA}>
            <Icon name="smoking-off" size={64} color={colors.primary} style={styles.baselineIcon} />
            <Text style={styles.baselineTitle}>Track Your Smoking</Text>
            <Text style={styles.baselineDescription}>
              Understanding your smoking history helps us assess diabetes risk and provide personalized support.
              {'\n\n'}
              Start by setting up your baseline smoking profile.
            </Text>
            <TouchableOpacity style={styles.baselineButton} onPress={handleStartBaseline}>
              <Icon name="chart-timeline-variant" size={20} color="#FFFFFF" />
              <Text style={styles.baselineButtonText}>Set Up Baseline</Text>
            </TouchableOpacity>
          </View>

          {/* Educational Info */}
          <View style={[styles.infoBox, { marginTop: 24 }]}>
            <View style={styles.infoBoxHeader}>
              <Icon name="information" size={20} color={colors.primary} />
              <Text style={styles.infoBoxTitle}>Why Track Smoking?</Text>
            </View>
            <Text style={styles.infoBoxText}>
              Smoking increases type 2 diabetes risk by 44% (Willi et al., JAMA 2007). 
              Regular tracking helps monitor risk and supports cessation efforts.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const baseline = summary?.baseline;
  const metrics = summary?.metrics;
  const risk = summary?.risk_assessment;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Smoking Tracking</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Icon name="refresh" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Risk Assessment Card */}
        {risk && (
          <View style={[styles.riskCard, { backgroundColor: getRiskColor(risk.risk_category) }]}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskTitle}>Risk Assessment</Text>
              <View style={styles.riskBadge}>
                <Text style={styles.riskBadgeText}>SCORE: {risk.risk_score}/5</Text>
              </View>
            </View>
            <Text style={styles.riskLevel}>{getRiskLabel(risk.risk_category)}</Text>
            <Text style={styles.riskDescription}>{getRiskDescription(risk.risk_category)}</Text>
          </View>
        )}

        {/* Metrics Grid */}
        {metrics && (
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Icon name="smoking" size={24} color={colors.primary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>
                {metrics.current_status === 'never' ? '0' : (metrics.avg_cigarettes_7d?.toFixed(1) || '0')}
              </Text>
              <Text style={styles.metricLabel}>Avg Daily (7d)</Text>
              <Text style={styles.metricSubtext}>cigarettes/day</Text>
            </View>

            <View style={styles.metricCard}>
              <Icon name="calendar-month" size={24} color={colors.primary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>
                {metrics.current_status === 'never' ? '0' : (metrics.avg_cigarettes_30d?.toFixed(1) || '0')}
              </Text>
              <Text style={styles.metricLabel}>Avg Daily (30d)</Text>
              <Text style={styles.metricSubtext}>cigarettes/day</Text>
            </View>

            <View style={styles.metricCard}>
              <Icon name="package-variant" size={24} color={colors.primary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>
                {metrics.pack_years?.toFixed(1) || '0'}
              </Text>
              <Text style={styles.metricLabel}>Pack-Years</Text>
              <Text style={styles.metricSubtext}>lifetime exposure</Text>
            </View>

            <View style={styles.metricCard}>
              <Icon name="account-check" size={24} color={colors.primary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>
                {metrics.current_status === 'never' ? 'Never' : 
                 metrics.current_status === 'former' ? 'Former' : 'Current'}
              </Text>
              <Text style={styles.metricLabel}>Status</Text>
              <Text style={styles.metricSubtext}>smoking status</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLogSmoking}>
            <Icon name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Log Today</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryActionButton]} 
            onPress={handleStartBaseline}
          >
            <Icon name="cog" size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, styles.secondaryActionButtonText]}>Baseline</Text>
          </TouchableOpacity>
        </View>

        {/* Educational Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoBoxHeader}>
            <Icon name="information" size={20} color={colors.primary} />
            <Text style={styles.infoBoxTitle}>Smoking & Diabetes</Text>
          </View>
          <Text style={styles.infoBoxText}>
            Smokers have 44% higher risk of developing type 2 diabetes. 
            Good news: Risk decreases significantly after quitting, approaching non-smoker levels after 10+ years.
          </Text>
        </View>

        {/* Recent Records */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <Text style={styles.sectionSubtitle}>{recentRecords.length} records</Text>
        </View>

        {recentRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="clipboard-text-outline" size={64} color={colors.secondary} style={styles.emptyStateIcon} />
            <Text style={styles.emptyStateTitle}>No Records Yet</Text>
            <Text style={styles.emptyStateDescription}>
              Start logging your daily smoking to track progress{'\n'}and monitor your diabetes risk.
            </Text>
          </View>
        ) : (
          recentRecords.map((record, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recordCard}
              onPress={() => handleRecordPress(record)}
              activeOpacity={0.7}
            >
              <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                <View style={styles.recordActions}>
                  <TouchableOpacity
                    style={styles.recordActionButton}
                    onPress={() => handleRecordPress(record)}
                  >
                    <Icon name="pencil" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recordActionButton}
                    onPress={() => handleDeleteRecord(record)}
                  >
                    <Icon name="delete" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.recordStats}>
                <View style={styles.recordStat}>
                  <Icon name="smoking" size={20} color={colors.primary} />
                  <Text style={styles.recordStatText}>{record.cigarettes_count}</Text>
                  <Text style={styles.recordStatUnit}>cigarettes</Text>
                </View>
              </View>

              {record.notes && (
                <View style={styles.recordNotes}>
                  <Text style={styles.recordNotesText}>"{record.notes}"</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SmokingTrackingScreen;
