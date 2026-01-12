import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const FoodIntakeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [hasBaseline, setHasBaseline] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
      fetchRiskAssessment();
    }, [])
  );

  const fetchRiskAssessment = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);

      // Check if user has baseline assessment
      const baselineResponse = await api.getFoodBaseline();

      const hasBaselineData = baselineResponse.success && baselineResponse.data;
      setHasBaseline(hasBaselineData);

      if (!hasBaselineData) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch comprehensive risk assessment
      const assessmentResponse = await api.getFoodRiskAssessment(7);

      if (assessmentResponse.success) {
        setRiskAssessment(assessmentResponse.data);
      }

      // Fetch recommendations
      const recommendationsResponse = await api.getFoodRecommendations();

      if (recommendationsResponse.success) {
        setRecommendations(recommendationsResponse.data.recommendations || []);
      }
      
      // Trigger fade-in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error fetching risk assessment:', error);
      toast.show('Failed to load risk assessment', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRiskAssessment(true);
  };

  const getRiskColor = (score) => {
    if (score < 25) return '#4CAF50'; // Green - Low risk
    if (score < 50) return '#FF9800'; // Orange - Moderate risk
    if (score < 75) return '#FF5722'; // Deep Orange - High risk
    return '#D32F2F'; // Red - Very High risk
  };

  const getRiskGradient = (score) => {
    if (score < 25) return ['#11998e', '#38ef7d']; // Emerald gradient
    if (score < 50) return ['#f093fb', '#f5576c']; // Sunset gradient
    if (score < 75) return ['#fa709a', '#fee140']; // Warm gradient
    return ['#ff6b6b', '#ee5a6f']; // Ruby gradient
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
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading assessment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasBaseline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Food Intake Risk</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.emptyContainer}>
          <Icon name="clipboard-text-outline" size={80} color={colors.secondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Baseline Assessment</Text>
          <Text style={[styles.emptyMessage, { color: colors.secondary }]}>
            Complete the baseline assessment to see your prediabetes risk evaluation based on your eating habits.
          </Text>
          <TouchableOpacity
            style={[styles.baselineButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('FoodBaseline')}
          >
            <Icon name="clipboard-check" size={24} color="#FFF" />
            <Text style={styles.baselineButtonText}>Start Baseline Assessment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Food Intake Risk</Text>
        <TouchableOpacity onPress={() => navigation.navigate('FoodBaseline')} style={styles.editButton}>
          <Icon name="pencil" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {riskAssessment ? (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Risk Score Card */}
            <LinearGradient
              colors={getRiskGradient(riskAssessment.comprehensive_risk_score)}
              style={styles.riskCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.particlesBackground}>
                <View style={[styles.particle, styles.particle1]} />
                <View style={[styles.particle, styles.particle2]} />
                <View style={[styles.particle, styles.particle3]} />
              </View>
              
              <View style={styles.riskScoreContainer}>
                <Icon name="chart-donut" size={40} color="rgba(255,255,255,0.9)" style={{ marginBottom: 8 }} />
                <Text style={styles.riskScoreLabel}>Your Prediabetes Risk</Text>
                <Text style={styles.riskScore}>{riskAssessment.comprehensive_risk_score.toFixed(1)}%</Text>
                <View style={styles.riskCategoryBadge}>
                  <Icon name="shield-check" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.riskCategoryText}>{riskAssessment.risk_category} Risk</Text>
                </View>
              </View>
              
              <View style={styles.riskMessageContainer}>
                <View style={styles.riskMessageIconContainer}>
                  <Icon name="information" size={18} color="#FFF" />
                </View>
                <Text style={styles.riskMessage}>{riskAssessment.risk_message}</Text>
              </View>
            </LinearGradient>

            {/* Breakdown */}
            <View style={[styles.breakdownCard, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeaderRow}>
                <Icon name="chart-timeline-variant" size={24} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Risk Breakdown</Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Icon name="clipboard-text" size={20} color={colors.primary} />
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>Baseline Assessment (40%)</Text>
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
                <Text style={[styles.breakdownExplanation, { color: colors.secondary }]}>
                  Based on your eating habits, meal timing, and food preferences
                </Text>
              </View>

              <View style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Icon name="food-apple" size={20} color={colors.primary} />
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>Daily Log Analysis (60%)</Text>
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
                <Text style={[styles.breakdownExplanation, { color: colors.secondary }]}>
                  {riskAssessment.breakdown.daily_analysis 
                    ? `Based on ${riskAssessment.breakdown.daily_analysis.total_meals} meals logged over ${riskAssessment.breakdown.daily_analysis.days_analyzed} days`
                    : 'Start logging meals to get personalized analysis'}
                </Text>
              </View>

              {riskAssessment.breakdown.daily_analysis && (
                <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
                  <Icon name="lightbulb-outline" size={18} color="#FF9800" />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Daily logs carry more weight (60%) as they reflect your current eating patterns
                  </Text>
                </View>
              )}
            </View>

            {/* Daily Averages */}
            {riskAssessment.breakdown.daily_analysis?.daily_averages ? (
              <View style={[styles.nutrientsCard, { backgroundColor: colors.card }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.cardHeaderRow}>
                    <Icon name="nutrition" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Nutrient Averages</Text>
                  </View>
                  <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>
                    Last {riskAssessment.breakdown.daily_analysis.days_analyzed} days
                  </Text>
                </View>
                
                <View style={styles.nutrientsGrid}>
                  {Object.entries(riskAssessment.breakdown.daily_analysis.daily_averages).map(([key, value]) => (
                    <View key={key} style={[styles.nutrientItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
            ) : (
              <View style={[styles.noMealsCard, { backgroundColor: colors.card }]}>
                <Icon name="food-off" size={48} color={colors.secondary} />
                <Text style={[styles.noMealsTitle, { color: colors.text }]}>No Meals Logged Yet</Text>
                <Text style={[styles.noMealsMessage, { color: colors.secondary }]}>
                  Start logging your meals to see daily nutrient averages and get personalized recommendations based on your actual food intake.
                </Text>
                <TouchableOpacity
                  style={[styles.logMealButton, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('FoodScanner')}
                >
                  <Icon name="camera" size={20} color="#FFF" />
                  <Text style={styles.logMealButtonText}>Log Your First Meal</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View style={[styles.recommendationsCard, { backgroundColor: colors.card }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.cardHeaderRow}>
                    <Icon name="lightbulb-on" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Personalized Recommendations</Text>
                  </View>
                  <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>
                    Based on your risk factors
                  </Text>
                </View>
                
                {recommendations.map((rec, index) => (
                  <View
                    key={index}
                    style={[styles.recommendationItem, { backgroundColor: colors.background, borderLeftColor: getPriorityColor(rec.priority) }]}
                  >
                    <View style={styles.recommendationHeader}>
                      <View style={styles.recommendationTitleRow}>
                        <Icon 
                          name={rec.priority === 'High' ? 'alert-circle' : rec.priority === 'Medium' ? 'alert' : 'information'} 
                          size={18} 
                          color={getPriorityColor(rec.priority)} 
                        />
                        <Text style={[styles.recommendationCategory, { color: colors.text }]}>{rec.category}</Text>
                      </View>
                      <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(rec.priority) }]}>
                        <Text style={styles.priorityText}>{rec.priority}</Text>
                      </View>
                    </View>
                    <Text style={[styles.recommendationMessage, { color: colors.secondary }]}>{rec.message}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('FoodScanner')}
              >
                <Icon name="camera" size={24} color="#FFF" />
                <Text style={styles.primaryActionButtonText}>Log New Meal</Text>
                <Icon name="chevron-right" size={20} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => navigation.navigate('FoodBaseline')}
              >
                <Icon name="pencil" size={20} color={colors.text} />
                <Text style={[styles.secondaryActionButtonText, { color: colors.text }]}>Update Baseline Assessment</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          <View style={[styles.noDataCard, { backgroundColor: colors.card }]}>
            <Icon name="chart-box-outline" size={64} color={colors.secondary} />
            <Text style={[styles.noDataTitle, { color: colors.text }]}>Getting Started</Text>
            <Text style={[styles.noDataMessage, { color: colors.secondary }]}>
              Complete your baseline assessment and start logging meals to receive your personalized prediabetes risk evaluation.
            </Text>
            <TouchableOpacity
              style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('FoodScanner')}
            >
              <Text style={styles.getStartedButtonText}>Log Your First Meal</Text>
            </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  baselineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  baselineButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  riskCard: {
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  particlesBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
  },
  particle1: {
    width: 120,
    height: 120,
    top: -40,
    right: -30,
  },
  particle2: {
    width: 80,
    height: 80,
    bottom: -20,
    left: -20,
  },
  particle3: {
    width: 60,
    height: 60,
    top: '50%',
    right: 20,
    opacity: 0.5,
  },
  riskScoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 1,
  },
  riskScoreLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  riskScore: {
    color: '#FFF',
    fontSize: 64,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  riskCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  riskCategoryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  riskMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    zIndex: 1,
  },
  riskMessageIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskMessage: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  breakdownCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  breakdownItem: {
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 16,
    borderRadius: 14,
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
    flex: 1,
  },
  breakdownScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  breakdownBar: {
    height: 10,
    borderRadius: 6,
    minWidth: 10,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  breakdownScore: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  breakdownExplanation: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 28,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  nutrientsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  nutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutrientItem: {
    width: (width - 56) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  nutrientLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  nutrientValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  noMealsCard: {
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  noMealsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noMealsMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  logMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logMealButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recommendationsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  recommendationItem: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recommendationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  recommendationCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recommendationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  noDataCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  noDataTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  getStartedButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  getStartedButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  primaryActionButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default FoodIntakeScreen;
