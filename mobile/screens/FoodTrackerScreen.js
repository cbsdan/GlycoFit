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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { TimelinePredictionCard } from '../components/recommendations';

const { width } = Dimensions.get('window');

const FoodTrackerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [timelinePredictions, setTimelinePredictions] = useState(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    explanation: false,
    contributors: false,
    nutrients: false,
    breakdown: false,
    nutrition: false, // Add nutrition section
    recommendations: false, // Add recommendations section
    predictions: false, // Add predictions section
  });
  const [nutrientModalVisible, setNutrientModalVisible] = useState(false);
  const [selectedNutrient, setSelectedNutrient] = useState(null);

  // Nutrient descriptions with diabetes context
  const nutrientDescriptions = {
    'Glycemic Load': 'Measures how much a food raises blood sugar. Lower GL foods cause gradual sugar spikes, helping maintain stable glucose levels and reducing diabetes risk.',
    'Calories': 'Total energy from food. Excess calories lead to weight gain, a major diabetes risk factor. Maintaining healthy calorie intake helps manage blood sugar and weight.',
    'Carbohydrates': 'Primary nutrient affecting blood sugar. Complex carbs digest slowly, providing steady energy. Monitoring carb intake is crucial for diabetes prevention.',
    'Fiber': 'Slows sugar absorption and improves insulin sensitivity. High-fiber diets reduce diabetes risk by stabilizing blood glucose and supporting healthy weight.',
    'Sugar': 'Quickly raises blood glucose. Excessive sugar intake strains insulin production and promotes weight gain, increasing diabetes risk.',
    'Protein': 'Helps stabilize blood sugar and maintains muscle mass. Adequate protein supports metabolism and satiety, aiding weight management.',
    'Fat': 'Provides energy and supports hormone function. Choose healthy fats (unsaturated) over saturated fats to reduce inflammation and improve insulin sensitivity.',
    'Saturated Fat': 'Linked to insulin resistance. High intake increases diabetes risk by promoting inflammation and affecting cell insulin receptors.',
    'Sodium': 'Excess sodium raises blood pressure, often co-occurring with diabetes. Monitoring sodium helps reduce cardiovascular complications.',
    'Potassium': 'Supports insulin function and blood pressure regulation. Adequate levels improve glucose metabolism and reduce diabetes complications.',
    'Magnesium': 'Essential for insulin function. Low magnesium is linked to insulin resistance. Sufficient intake improves blood sugar control.',
    'Calcium': 'Supports metabolic health and insulin secretion. Adequate calcium may reduce diabetes risk by improving insulin sensitivity.',
    'Iron': 'Required for oxygen transport and energy. Both deficiency and excess can affect glucose metabolism and diabetes risk.',
    'Vitamin D': 'Regulates insulin secretion. Low levels are associated with increased diabetes risk. Adequate vitamin D supports pancreatic function.',
    'Vitamin C': 'Antioxidant that reduces oxidative stress from high blood sugar. Helps protect cells from glucose-related damage.',
    'Vitamin A': 'Supports immune function and cell health. Adequate levels may help reduce inflammation associated with insulin resistance.',
    'B Vitamins': 'Support energy metabolism and nerve function. Important for glucose utilization and preventing diabetes-related complications.',
  };

  const getNutrientDescription = (nutrientName) => {
    // Try exact match first
    if (nutrientDescriptions[nutrientName]) {
      return nutrientDescriptions[nutrientName];
    }
    // Try partial match
    const key = Object.keys(nutrientDescriptions).find(k => 
      nutrientName.toLowerCase().includes(k.toLowerCase()) || 
      k.toLowerCase().includes(nutrientName.toLowerCase())
    );
    return key ? nutrientDescriptions[key] : 'This nutrient plays a role in your overall metabolic health and can impact your diabetes risk profile.';
  };

  useFocusEffect(
    React.useCallback(() => {
      checkBaselineAndFetchData();
      fetchFoodPredictions();
    }, [])
  );

  const fetchFoodPredictions = async () => {
    try {
      setPredictionsLoading(true);
      const response = await api.getFoodPredictions();
      
      const isSuccess = response.status === 'success' || response.success === true;
      
      if (isSuccess) {
        const predictions = response.predictions || response.data?.predictions || {};
        const timelineData = predictions.timeline_predictions || {};
        
        if (Object.keys(timelineData).length > 0) {
          setTimelinePredictions(timelineData);
        }
      }
    } catch (error) {
      console.error('Error fetching food predictions:', error);
    } finally {
      setPredictionsLoading(false);
    }
  };

  const checkBaselineAndFetchData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);

      // Check if user has baseline assessment
      const baselineResponse = await api.getFoodBaseline();

      const hasBaselineData = baselineResponse.success && baselineResponse.data;
      setHasBaseline(hasBaselineData);

      if (hasBaselineData) {
        // Fetch comprehensive risk assessment with detailed explanations
        try {
          const assessmentResponse = await api.getDetailedFoodAssessment(7);
          console.log('Detailed Food Assessment Response:', JSON.stringify(assessmentResponse, null, 2));

          if (assessmentResponse.success) {
            setRiskAssessment(assessmentResponse.data);
            
            // Extract recommendations from detailed assessment
            if (assessmentResponse.data.recommendations) {
              setRecommendations(assessmentResponse.data.recommendations);
            }
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
    fetchFoodPredictions();
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('MealHistory')} style={styles.historyButton}>
            <Icon name="history" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('FoodBaseline')} style={styles.editButton}>
            <Icon name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
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
          <Icon name="camera" size={32} color="#FFF" />
          <Text style={styles.scanButtonText}>Scan & Log Food</Text>
          <Icon name="chevron-right" size={28} color="#FFF" />
        </TouchableOpacity>

        {riskAssessment ? (
          <>
            {/* Risk Score Card - Enhanced */}
            <LinearGradient
              colors={getRiskGradient(riskAssessment.overall_risk.score)}
              style={styles.riskCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.riskScoreContainer}>
                <Text style={styles.riskScoreLabel}>YOUR PREDIABETES RISK</Text>
                <Text style={styles.riskScore}>{riskAssessment.overall_risk.score.toFixed(1)}%</Text>
                <View style={styles.riskCategoryBadge}>
                  <Text style={styles.riskCategoryText}>{riskAssessment.overall_risk.category.toUpperCase()} RISK</Text>
                </View>
              </View>
              
              <View style={styles.riskMessageContainer}>
                <Icon name="information-outline" size={22} color="#FFF" />
                <Text style={styles.riskMessage}>{riskAssessment.overall_risk.message}</Text>
              </View>
            </LinearGradient>

            {/* Nutrient Analysis - Collapsible Section with Full-Width Cards */}
            {riskAssessment.daily_log_assessment.nutrient_analysis && riskAssessment.daily_log_assessment.nutrient_analysis.length > 0 && (
              <TouchableOpacity
                style={[styles.expandableCard, { backgroundColor: colors.card }]}
                onPress={() => toggleSection('nutrition')}
                activeOpacity={0.7}
              >
                <View style={styles.expandableHeader}>
                  <View style={styles.expandableTitle}>
                    <Icon name="nutrition" size={24} color="#4CAF50" />
                    <View style={styles.expandableHeaderTextContainer}>
                      <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                        Nutrition Dashboard
                      </Text>
                      <Text style={[styles.expandableSubtitle, { color: colors.secondary }]}>
                        Today's intake • {riskAssessment.daily_log_assessment.today_meal_count || 0} meals logged
                      </Text>
                    </View>
                  </View>
                  <Icon 
                    name={expandedSections.nutrition ? "chevron-up" : "chevron-down"} 
                    size={26} 
                    color={colors.secondary} 
                  />
                </View>
                
                {expandedSections.nutrition && (
                  <View style={styles.expandableContent}>
                    {riskAssessment.daily_log_assessment.nutrient_analysis.map((nutrient, index) => {
                      const getStatusColor = (status) => {
                        if (status === 'optimal') return '#4CAF50';
                        if (status === 'low') return '#FF9800';
                        return '#F44336';
                      };
                      
                      const getStatusBgColor = (status) => {
                        if (status === 'optimal') return '#E8F5E920';
                        if (status === 'low') return '#FFF3E020';
                        return '#FFEBEE20';
                      };
                      
                      const statusColor = getStatusColor(nutrient.status);
                      const statusBgColor = getStatusBgColor(nutrient.status);
                      
                      return (
                        <View key={index} style={[styles.nutrientFullCard, { backgroundColor: colors.card }]}>
                          {/* Status Badge - Top Right */}
                          <View style={[styles.statusBadgeTopRight, { backgroundColor: statusBgColor, borderColor: statusColor }]}>
                            <Icon 
                              name={nutrient.status === 'optimal' ? 'check-circle' : nutrient.status === 'low' ? 'alert-circle' : 'close-circle'} 
                              size={16} 
                              color={statusColor} 
                            />
                            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                              {nutrient.status?.toUpperCase() || 'N/A'}
                            </Text>
                          </View>

                          {/* Nutrient Name & Info */}
                          <View style={styles.nutrientHeaderRow}>
                            <TouchableOpacity 
                              onPress={() => {
                                setSelectedNutrient(nutrient);
                                setNutrientModalVisible(true);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={styles.infoButton}
                            >
                              <Icon name="information-outline" size={22} color={colors.primary} />
                            </TouchableOpacity>
                            <Text style={[styles.nutrientName, { color: colors.text }]}>
                              {nutrient.nutrient || 'Nutrient'}
                            </Text>
                          </View>

                          {/* Values Grid */}
                          <View style={styles.nutrientValuesGrid}>
                            <View style={[styles.valueCard, { backgroundColor: colors.background }]}>
                              <Text style={[styles.valueCardLabel, { color: colors.secondary }]}>Today's Intake</Text>
                              <Text style={[styles.valueCardValue, { color: statusColor }]}>
                                {nutrient.current_intake?.toFixed(1)}
                              </Text>
                              <Text style={[styles.valueCardUnit, { color: colors.secondary }]}>
                                {nutrient.unit || ''}
                              </Text>
                            </View>
                            
                            {nutrient.optimal_range && (
                              <View style={[styles.valueCard, { backgroundColor: colors.background }]}>
                                <Text style={[styles.valueCardLabel, { color: colors.secondary }]}>Target Range</Text>
                                <Text style={[styles.valueCardValue, { color: colors.text }]} numberOfLines={2}>
                                  {nutrient.optimal_range}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Interpretation */}
                          {nutrient.interpretation && (
                            <View style={[styles.interpretationBox, { backgroundColor: statusBgColor, borderLeftColor: statusColor }]}>
                              <Icon name="lightbulb-outline" size={16} color={statusColor} style={{ marginTop: 2 }} />
                              <Text style={[styles.interpretationText, { color: colors.text }]}>
                                {nutrient.interpretation}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Personalized Recommendations - Enhanced Display */}
            {recommendations.length > 0 && (
              <TouchableOpacity
                style={[styles.expandableCard, { backgroundColor: colors.card }]}
                onPress={() => toggleSection('recommendations')}
                activeOpacity={0.7}
              >
                <View style={styles.expandableHeader}>
                  <View style={styles.expandableTitle}>
                    <Icon name="clipboard-check" size={24} color={colors.primary} />
                    <View style={styles.expandableHeaderTextContainer}>
                      <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                        Your Action Plan
                      </Text>
                      <Text style={[styles.expandableSubtitle, { color: colors.secondary }]}>
                        {recommendations.length} personalized {recommendations.length === 1 ? 'recommendation' : 'recommendations'}
                      </Text>
                    </View>
                  </View>
                  <Icon 
                    name={expandedSections.recommendations ? "chevron-up" : "chevron-down"} 
                    size={26} 
                    color={colors.secondary} 
                  />
                </View>
                
                {expandedSections.recommendations && (
                  <View style={styles.expandableContent}>
                    {recommendations.map((rec, index) => {
                  const priorityColor = getPriorityColor(rec.priority);
                  const categoryIcons = {
                    'Diet': 'food-apple',
                    'Nutrition': 'nutrition',
                    'Meal Timing': 'clock-outline',
                    'Hydration': 'water',
                    'General': 'information-outline',
                  };
                  
                  return (
                    <View
                      key={index}
                      style={[styles.recommendationItem, { backgroundColor: colors.background, borderLeftColor: priorityColor }]}
                    >
                      <View style={styles.recommendationTop}>
                        <View style={styles.recommendationLeft}>
                          <View style={[styles.categoryIcon, { backgroundColor: `${priorityColor}15` }]}>
                            <Icon 
                              name={categoryIcons[rec.category] || 'lightbulb'} 
                              size={20} 
                              color={priorityColor} 
                            />
                          </View>
                          <View style={styles.categoryInfo}>
                            <Text style={[styles.recommendationCategory, { color: colors.text }]}>
                              {rec.category}
                            </Text>
                            {rec.priority && (
                              <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                                <Text style={styles.priorityText}>{rec.priority}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      
                      <Text style={[styles.recommendationMessage, { color: colors.secondary }]}>
                        {rec.message}
                      </Text>
                      
                      {/* Additional details if available */}
                      {rec.actionable_tips && rec.actionable_tips.length > 0 && (
                        <View style={styles.actionTipsContainer}>
                          <Text style={[styles.actionTipsTitle, { color: colors.text }]}>
                            💡 Quick Actions:
                          </Text>
                          {rec.actionable_tips.slice(0, 2).map((tip, tipIndex) => (
                            <View key={tipIndex} style={styles.actionTipItem}>
                              <Icon name="chevron-right" size={14} color={colors.primary} />
                              <Text style={[styles.actionTipText, { color: colors.text }]}>
                                {tip}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Risk Explanation - Expandable */}
            {riskAssessment.overall_risk.explanation && (
              <TouchableOpacity
                style={[styles.expandableCard, { backgroundColor: colors.card }]}
                onPress={() => toggleSection('explanation')}
                activeOpacity={0.7}
              >
                <View style={styles.expandableHeader}>
                  <View style={styles.expandableTitle}>
                    <Icon name="lightbulb-on-outline" size={24} color={colors.primary} />
                    <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                      Understanding Your Risk
                    </Text>
                  </View>
                  <Icon 
                    name={expandedSections.explanation ? "chevron-up" : "chevron-down"} 
                    size={26} 
                    color={colors.secondary} 
                  />
                </View>
                
                {expandedSections.explanation && (
                  <View style={styles.expandableContent}>
                    {riskAssessment.overall_risk.explanation?.detailed_explanation && (
                      <Text style={[styles.explanationText, { color: colors.secondary }]}>
                        {riskAssessment.overall_risk.explanation.detailed_explanation}
                      </Text>
                    )}
                    {riskAssessment.overall_risk.explanation?.focus_areas && (
                      <Text style={[styles.explanationText, { color: colors.secondary, marginTop: 14 }]}>
                        {riskAssessment.overall_risk.explanation.focus_areas}
                      </Text>
                    )}
                    {riskAssessment.overall_risk.explanation?.prognosis && (
                      <View style={styles.tipContainer}>
                        <Icon name="star-outline" size={20} color={colors.primary} />
                        <Text style={[styles.tipText, { color: colors.primary }]}>
                          {riskAssessment.overall_risk.explanation.prognosis}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Risk Breakdown - Expandable */}
            <TouchableOpacity
              style={[styles.expandableCard, { backgroundColor: colors.card }]}
              onPress={() => toggleSection('breakdown')}
              activeOpacity={0.7}
            >
              <View style={styles.expandableHeader}>
                <View style={styles.expandableTitle}>
                  <Icon name="chart-bar" size={24} color="#2196F3" />
                  <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                    Risk Breakdown
                  </Text>
                </View>
                <Icon 
                  name={expandedSections.breakdown ? "chevron-up" : "chevron-down"} 
                  size={26} 
                  color={colors.secondary} 
                />
              </View>
              
              {expandedSections.breakdown && (
                <View style={styles.expandableContent}>
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownHeader}>
                      <Icon name="clipboard-text" size={22} color={colors.primary} />
                      <Text style={[styles.breakdownLabel, { color: colors.text }]}>Baseline Assessment</Text>
                    </View>
                    <View style={styles.breakdownScoreContainer}>
                      <View style={styles.breakdownBarContainer}>
                        <View
                          style={[
                            styles.breakdownBar,
                            {
                              width: `${riskAssessment.baseline_assessment.score}%`,
                              backgroundColor: getRiskColor(riskAssessment.baseline_assessment.score),
                            }
                          ]}
                        />
                      </View>
                      <Text style={[styles.breakdownScore, { color: colors.text }]}>
                        {riskAssessment.baseline_assessment.score.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownHeader}>
                      <Icon name="food-apple" size={22} color={colors.primary} />
                      <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                        Daily Log Analysis ({riskAssessment.daily_log_assessment.days_analyzed} days)
                      </Text>
                    </View>
                    <View style={styles.breakdownScoreContainer}>
                      <View style={styles.breakdownBarContainer}>
                        <View
                          style={[
                            styles.breakdownBar,
                            {
                              width: `${riskAssessment.daily_log_assessment.score}%`,
                              backgroundColor: getRiskColor(riskAssessment.daily_log_assessment.score),
                            }
                          ]}
                        />
                      </View>
                      <Text style={[styles.breakdownScore, { color: colors.text }]}>
                        {riskAssessment.daily_log_assessment.score.toFixed(1)}%
                      </Text>
                    </View>
                    {riskAssessment.daily_log_assessment.data_quality !== 'good' && (
                      <View style={styles.warningContainer}>
                        <Icon name="alert" size={18} color="#FF9800" />
                        <Text style={styles.warningText}>
                          {riskAssessment.daily_log_assessment.data_quality === 'partial' 
                            ? 'Limited data - log more meals for accurate assessment' 
                            : 'Insufficient data - please log at least 2 meals per day'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {riskAssessment.daily_log_assessment.total_meals > 0 && (
                    <View style={styles.statsContainer}>
                      <Text style={[styles.statsTitle, { color: colors.secondary }]}>
                        Analysis of {riskAssessment.daily_log_assessment.total_meals} meals over {riskAssessment.daily_log_assessment.days_analyzed} days
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Top Risk Contributors - Expandable */}
            {riskAssessment.baseline_assessment.top_contributors && riskAssessment.baseline_assessment.top_contributors.length > 0 && (
              <TouchableOpacity
                style={[styles.expandableCard, { backgroundColor: colors.card }]}
                onPress={() => toggleSection('contributors')}
                activeOpacity={0.7}
              >
                <View style={styles.expandableHeader}>
                  <View style={styles.expandableTitle}>
                    <Icon name="alert-circle-outline" size={24} color="#FF5722" />
                    <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                      Top Risk Factors ({riskAssessment.baseline_assessment.top_contributors.length})
                    </Text>
                  </View>
                  <Icon 
                    name={expandedSections.contributors ? "chevron-up" : "chevron-down"} 
                    size={26} 
                    color={colors.secondary} 
                  />
                </View>
                
                {expandedSections.contributors && (
                  <View style={styles.expandableContent}>
                    {riskAssessment.baseline_assessment.top_contributors.map((contributor, index) => (
                      <View key={index} style={styles.contributorItem}>
                        <View style={styles.contributorHeader}>
                          <Text style={[styles.contributorTitle, { color: colors.text }]}>
                            {index + 1}. {contributor.question_key?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dietary Factor'}
                          </Text>
                          {contributor.risk_contribution != null && (
                            <View style={styles.contributorScore}>
                              <Text style={[styles.contributorScoreText, { color: getRiskColor(contributor.risk_contribution) }]}>
                                +{contributor.risk_contribution.toFixed(1)}%
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.contributorAnswer, { color: colors.secondary }]}>
                          Your answer: {contributor.user_response}
                        </Text>
                        {contributor.why_it_matters && (
                          <Text style={[styles.contributorExplanation, { color: colors.secondary }]}>
                            {contributor.why_it_matters}
                          </Text>
                        )}
                        {contributor.risk_explanation && (
                          <Text style={[styles.contributorExplanation, { color: colors.secondary, marginTop: 8 }]}>
                            {contributor.risk_explanation}
                          </Text>
                        )}
                        {contributor.actionable_tip && (
                          <View style={styles.contributorTip}>
                            <Icon name="lightbulb" size={18} color={colors.primary} />
                            <Text style={[styles.contributorTipText, { color: colors.primary }]}>
                              {contributor.actionable_tip}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

              </TouchableOpacity>
            )}
            
            {/* Diet Timeline Predictions */}
            {timelinePredictions && Object.keys(timelinePredictions).length > 0 && (
              <TimelinePredictionCard
                predictions={timelinePredictions}
                title="Diet Predictions"
                subtitle="If current eating pattern continues"
                iconName="food-apple"
                iconColor="#27AE60"
                expanded={expandedSections.predictions}
                onToggleExpand={() => setExpandedSections(prev => ({ ...prev, predictions: !prev.predictions }))}
              />
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

      {/* Nutrient Info Modal */}
      <Modal
        visible={nutrientModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNutrientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Icon name="information" size={24} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedNutrient?.nutrient || 'Nutrient Info'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setNutrientModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalDescription, { color: colors.secondary }]}>
                {selectedNutrient && getNutrientDescription(selectedNutrient.nutrient)}
              </Text>
              
              {selectedNutrient && (
                <View style={styles.modalStats}>
                  <View style={[styles.modalStatItem, { backgroundColor: colors.background }]}>
                    <Text style={[styles.modalStatLabel, { color: colors.secondary }]}>Today's Intake</Text>
                    <Text style={[styles.modalStatValue, { color: colors.text }]}>
                      {selectedNutrient.current_intake?.toFixed(1)} {selectedNutrient.unit || ''}
                    </Text>
                  </View>
                  <View style={[styles.modalStatItem, { backgroundColor: colors.background }]}>
                    <Text style={[styles.modalStatLabel, { color: colors.secondary }]}>Target Range</Text>
                    <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                      {selectedNutrient.optimal_range || 'N/A'}
                    </Text>
                  </View>
                </View>
              )}
              
              {selectedNutrient?.interpretation && (
                <View style={[styles.modalTip, { backgroundColor: colors.background }]}>
                  <Icon name="lightbulb-outline" size={18} color={colors.primary} />
                  <Text style={[styles.modalTipText, { color: colors.text }]}>
                    {selectedNutrient.interpretation}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyButton: {
    padding: 8,
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
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 24,
    gap: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.5,
  },
  riskCard: {
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  riskScoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  riskScoreLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  riskScore: {
    color: '#FFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
  },
  riskCategoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    marginTop: 12,
  },
  riskCategoryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  riskMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  riskMessage: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },

  // FULL-WIDTH NUTRIENT CARDS (One Per Row) - Clean Design
  nutrientFullCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0E0E030',
  },
  statusBadgeTopRight: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nutrientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingRight: 80,
  },
  nutrientName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  infoButton: {
    padding: 4,
  },
  nutrientValuesGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  valueCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  valueCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  valueCardValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  valueCardUnit: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  interpretationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  interpretationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  // NUTRIENT SECTION STYLES - Two Cards Per Row
  nutrientSectionCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nutrientSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  nutrientSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  nutrientSectionSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  nutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutrientGridCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: 14,
    position: 'relative',
  },
  nutrientGridStatusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nutrientGridStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nutrientGridTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  nutrientGridName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
  },
  nutrientGridValuesContainer: {
    marginBottom: 12,
  },
  nutrientGridValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nutrientGridLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  nutrientGridValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  nutrientGridTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  nutrientGridTipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },

  // RECOMMENDATIONS SECTION - Enhanced
  recommendationsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  recommendationsHeaderText: {
    flex: 1,
  },
  recommendationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recommendationsCount: {
    fontSize: 12,
    marginTop: 2,
  },
  recommendationItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 5,
  },
  recommendationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recommendationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendationCategory: {
    fontSize: 15,
    fontWeight: '700',
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
  },
  recommendationMessage: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  actionTipsContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E080',
  },
  actionTipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
  },
  actionTipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  // EXPANDABLE CARDS - Enhanced
  expandableCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  expandableTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  expandableHeaderTextContainer: {
    flex: 1,
  },
  expandableHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },
  expandableSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  expandableContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 24,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    padding: 14,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },

  // BREAKDOWN SECTION
  breakdownItem: {
    marginBottom: 20,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  breakdownLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 5,
  },
  breakdownScore: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  statsContainer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statsTitle: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
  },

  // CONTRIBUTORS SECTION
  contributorItem: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contributorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  contributorTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginRight: 10,
  },
  contributorScore: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  contributorScoreText: {
    fontSize: 15,
    fontWeight: '800',
  },
  contributorAnswer: {
    fontSize: 15,
    marginTop: 6,
    fontStyle: 'italic',
  },
  contributorExplanation: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  contributorTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  contributorTipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },

  // NO DATA CARD
  noDataCard: {
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    marginBottom: 20,
  },
  noDataTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  noDataMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // NUTRIENT INFO MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 18,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modalStatItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
  },
  modalStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  modalTipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
export default FoodTrackerScreen;
