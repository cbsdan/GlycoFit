import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const FoodTrackerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      checkBaselineAndFetchData();
    }, [])
  );

  const checkBaselineAndFetchData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);

      // Check if user has baseline assessment
      const baselineResponse = await api.getFoodBaseline();

      const hasBaselineData = baselineResponse.success && baselineResponse.data;
      setHasBaseline(hasBaselineData);

      if (hasBaselineData) {
        // Fetch comprehensive risk assessment
        try {
          const assessmentResponse = await api.getFoodRiskAssessment(7);

          if (assessmentResponse.success) {
            setRiskAssessment(assessmentResponse.data);
          }

          // Fetch recommendations
          const recommendationsResponse = await api.getFoodRecommendations();

          if (recommendationsResponse.success) {
            setRecommendations(recommendationsResponse.data.recommendations || []);
          }
        } catch (error) {
          console.error('Error fetching risk data:', error);
          // Don't show error toast here, as user might just not have enough data yet
        }
      }
    } catch (error) {
      console.error('Error checking baseline:', error);
      // Don't show error for missing baseline
      setHasBaseline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    checkBaselineAndFetchData(true);
  };

  const getRiskColor = (score) => {
    if (score < 25) return '#4CAF50';
    if (score < 50) return '#FF9800';
    if (score < 75) return '#FF5722';
    return '#D32F2F';
  };

  const getRiskGradient = (score) => {
    if (score < 25) return ['#66BB6A', '#4CAF50'];
    if (score < 50) return ['#FFA726', '#FF9800'];
    if (score < 75) return ['#FF7043', '#FF5722'];
    return ['#E57373', '#D32F2F'];
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return '#D32F2F';
      case 'Medium':
        return '#FF9800';
      default:
        return '#2196F3';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show baseline prompt if no baseline completed
  if (!hasBaseline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Food Tracker</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyContainer}>
            <Icon name="clipboard-text-outline" size={80} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Welcome to Food Tracker!</Text>
            <Text style={[styles.emptyMessage, { color: colors.secondary }]}>
              Before you start tracking your meals, please complete a quick baseline assessment. 
              This helps us evaluate your prediabetes risk based on your eating habits.
            </Text>
            
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('FoodBaseline')}
            >
              <Icon name="clipboard-check" size={24} color="#FFF" />
              <Text style={styles.primaryButtonText}>Start Baseline Assessment</Text>
            </TouchableOpacity>

            <View style={styles.infoCard}>
              <Icon name="information" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.secondary }]}>
                Takes only 2-3 minutes • 16 research-based questions • Edit anytime
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show risk assessment dashboard if baseline completed
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Food Tracker</Text>
        <TouchableOpacity onPress={() => navigation.navigate('FoodBaseline')} style={styles.editButton}>
          <Icon name="pencil" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Scan Food Button - Prominent */}
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('FoodScanner')}
        >
          <Icon name="camera" size={28} color="#FFF" />
          <Text style={styles.scanButtonText}>Scan & Log Food</Text>
          <Icon name="chevron-right" size={24} color="#FFF" />
        </TouchableOpacity>

        {riskAssessment ? (
          <>
            {/* Risk Score Card */}
            <LinearGradient
              colors={getRiskGradient(riskAssessment.comprehensive_risk_score)}
              style={styles.riskCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.riskScoreContainer}>
                <Text style={styles.riskScoreLabel}>Your Prediabetes Risk</Text>
                <Text style={styles.riskScore}>{riskAssessment.comprehensive_risk_score.toFixed(1)}%</Text>
                <View style={styles.riskCategoryBadge}>
                  <Text style={styles.riskCategoryText}>{riskAssessment.risk_category} Risk</Text>
                </View>
              </View>
              
              <View style={styles.riskMessageContainer}>
                <Icon name="information-outline" size={20} color="#FFF" />
                <Text style={styles.riskMessage}>{riskAssessment.risk_message}</Text>
              </View>
            </LinearGradient>

            {/* Breakdown */}
            <View style={[styles.breakdownCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Risk Breakdown</Text>
              
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Icon name="clipboard-text" size={20} color={colors.primary} />
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>Baseline Assessment</Text>
                </View>
                <View style={styles.breakdownScoreContainer}>
                  <View
                    style={[
                      styles.breakdownBar,
                      {
                        width: `${riskAssessment.breakdown.baseline_risk}%`,
                        backgroundColor: getRiskColor(riskAssessment.breakdown.baseline_risk),
                      }
                    ]}
                  />
                  <Text style={[styles.breakdownScore, { color: colors.text }]}>
                    {riskAssessment.breakdown.baseline_risk.toFixed(1)}%
                  </Text>
                </View>
              </View>

              <View style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Icon name="food-apple" size={20} color={colors.primary} />
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>Daily Log Analysis (7 days)</Text>
                </View>
                <View style={styles.breakdownScoreContainer}>
                  <View
                    style={[
                      styles.breakdownBar,
                      {
                        width: `${riskAssessment.breakdown.daily_log_risk}%`,
                        backgroundColor: getRiskColor(riskAssessment.breakdown.daily_log_risk),
                      }
                    ]}
                  />
                  <Text style={[styles.breakdownScore, { color: colors.text }]}>
                    {riskAssessment.breakdown.daily_log_risk.toFixed(1)}%
                  </Text>
                </View>
              </View>

              {riskAssessment.breakdown.daily_analysis && (
                <View style={styles.statsContainer}>
                  <Text style={[styles.statsTitle, { color: colors.secondary }]}>
                    Analysis of {riskAssessment.breakdown.daily_analysis.total_meals} meals over {riskAssessment.breakdown.daily_analysis.days_analyzed} days
                  </Text>
                </View>
              )}
            </View>

            {/* Daily Averages */}
            {riskAssessment.breakdown.daily_analysis?.daily_averages && (
              <View style={[styles.nutrientsCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Nutrient Averages</Text>
                
                <View style={styles.nutrientsGrid}>
                  {Object.entries(riskAssessment.breakdown.daily_analysis.daily_averages).map(([key, value]) => (
                    <View key={key} style={[styles.nutrientItem, { borderColor: colors.border }]}>
                      <Text style={[styles.nutrientLabel, { color: colors.secondary }]}>
                        {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                      </Text>
                      <Text style={[styles.nutrientValue, { color: colors.text }]}>
                        {value.toFixed(1)}
                        {key === 'calories' ? '' : key.includes('sodium') ? 'mg' : 'g'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View style={[styles.recommendationsCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personalized Recommendations</Text>
                
                {recommendations.map((rec, index) => (
                  <View
                    key={index}
                    style={[styles.recommendationItem, { backgroundColor: colors.background, borderLeftColor: getPriorityColor(rec.priority) }]}
                  >
                    <View style={styles.recommendationHeader}>
                      <Text style={[styles.recommendationCategory, { color: colors.text }]}>{rec.category}</Text>
                      <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(rec.priority) }]}>
                        <Text style={styles.priorityText}>{rec.priority}</Text>
                      </View>
                    </View>
                    <Text style={[styles.recommendationMessage, { color: colors.secondary }]}>{rec.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.noDataCard, { backgroundColor: colors.card }]}>
            <Icon name="chart-timeline-variant" size={48} color={colors.secondary} />
            <Text style={[styles.noDataTitle, { color: colors.text }]}>Start Logging Meals</Text>
            <Text style={[styles.noDataMessage, { color: colors.secondary }]}>
              Your risk assessment will appear here once you start logging your meals. Tap the button above to scan your first meal!
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  riskCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  riskScoreContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  riskScoreLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  riskScore: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: 'bold',
  },
  riskCategoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  riskCategoryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  riskMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  riskMessage: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    lineHeight: 22,
  },
  breakdownCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  breakdownScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownBar: {
    height: 8,
    borderRadius: 4,
    minWidth: 8,
  },
  breakdownScore: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statsTitle: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  nutrientsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  nutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutrientItem: {
    width: (width - 96) / 2,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  nutrientLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  nutrientValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  recommendationsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendationItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationCategory: {
    fontSize: 15,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  noDataCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default FoodTrackerScreen;
