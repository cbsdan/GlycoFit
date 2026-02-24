import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyAssessment, getOverallRiskAssessment, refreshOverallRiskAssessment, getOverallRiskPrediction } from '../services/api';

const { width } = Dimensions.get('window');

const PredictionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [assessment, setAssessment] = useState(null);
  const [overallRisk, setOverallRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendPrediction, setTrendPrediction] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);

  // Check if user is diagnosed with prediabetes or type 2 diabetes
  const isDiagnosed = user?.diagnosis_status === 'prediabetes' || user?.diagnosis_status === 'type2_diabetes';

  useFocusEffect(
    React.useCallback(() => {
      loadAssessment();
    }, [])
  );

  useEffect(() => {
    const fetchTrendPrediction = async () => {
      try {
        setTrendLoading(true);
        const result = await getOverallRiskPrediction();
        if (result && result.success && result.data) {
          setTrendPrediction(result.data);
        }
      } catch (error) {
        console.log('Trend prediction not available:', error);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrendPrediction();
  }, []);

  const loadAssessment = async () => {
    try {
      // Only show loading spinner if we don't have data yet (first load)
      if (!assessment && !overallRisk) {
        setLoading(true);
      }
      
      // Load initial diabetes assessment (uses cache if available)
      const result = await getMyAssessment();
      if (result && result.assessment) {
        setAssessment(result.assessment);
        
        // If initial assessment exists, try to load overall risk assessment
        try {
          const overallResult = await getOverallRiskAssessment();
          if (overallResult && overallResult.success && overallResult.data) {
            setOverallRisk(overallResult.data);
          }
        } catch (overallError) {
          console.log('Overall risk not available yet:', overallError);
          // Overall risk might not be available yet, that's okay
        }
      } else {
        setAssessment(null);
        setOverallRisk(null);
      }
    } catch (error) {
      console.log('Error loading assessment:', error);
      setAssessment(null);
      setOverallRisk(null);
    } finally {
      setLoading(false);
    }
  };

  const getTrendConfig = () => {
    if (!trendPrediction) return null;
    const { status } = trendPrediction;
    switch (status) {
      case 'improving':
        return {
          label: 'IMPROVING',
          icon: 'trending-up',
          color: '#27AE60',
          gradient: ['#27AE60', '#2ECC71'],
          badgeText: 'Status Improving',
        };
      case 'declining':
        return {
          label: 'DECLINING',
          icon: 'trending-down',
          color: '#E74C3C',
          gradient: ['#E74C3C', '#C0392B'],
          badgeText: 'Needs Attention',
        };
      default:
        return {
          label: 'STABLE',
          icon: 'trending-neutral',
          color: '#F39C12',
          gradient: ['#F39C12', '#F1C40F'],
          badgeText: 'Status Stable',
        };
    }
  };

  const getComponentTrendIcon = (direction) => {
    switch (direction) {
      case 'improving': return { icon: 'arrow-up-circle', color: '#27AE60' };
      case 'declining': return { icon: 'arrow-down-circle', color: '#E74C3C' };
      case 'stable':    return { icon: 'minus-circle', color: '#F39C12' };
      default:          return { icon: 'help-circle', color: colors.secondary };
    }
  };

  const getRiskConfig = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return {
          title: 'Low Risk',
          color: '#27AE60',
          icon: 'check-circle',
          message: 'Your diabetes risk is currently low',
        };
      case 'moderate':
        return {
          title: 'Moderate Risk',
          color: '#F39C12',
          icon: 'alert-circle',
          message: 'You have a moderate risk of diabetes',
        };
      case 'high':
        return {
          title: 'High Risk',
          color: '#E74C3C',
          icon: 'alert-octagon',
          message: 'Your diabetes risk is high',
        };
      case 'very_high':
        return {
          title: 'Very High Risk',
          color: '#C0392B',
          icon: 'alert',
          message: 'Your diabetes risk is very high',
        };
      default:
        return {
          title: 'Unknown',
          color: colors.secondary,
          icon: 'help-circle',
          message: 'Risk level unknown',
        };
    }
  };

  const handleRefreshOverallRisk = async () => {
    try {
      setLoading(true);
      const result = await refreshOverallRiskAssessment();
      if (result && result.success && result.data) {
        setOverallRisk(result.data);
        Alert.alert('Success', 'Your comprehensive risk assessment has been updated.');
      }
    } catch (error) {
      console.log('Error refreshing overall risk:', error);
      Alert.alert('Error', 'Failed to refresh comprehensive assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const predictionCards = [
    {
      id: 'diabetes-assessment',
      title: 'Diabetes Risk Assessment',
      subtitle: 'Evaluate your diabetes risk factors',
      icon: 'clipboard-text',
      color: '#E74C3C',
      prediction: 'Take a quick assessment to understand your risk level',
    },
  ];



  const handlePredictionTap = async (predictionId) => {
    if (predictionId === 'diabetes-assessment') {
      if (assessment) {
        // Navigate to results if assessment exists
        navigation.navigate('AssessmentResults', {
          prediction: assessment.prediction,
          isUpdate: true
        });
      } else {
        // Clear the skip flag so assessment can be shown again if needed
        try {
          await AsyncStorage.removeItem('@assessment_skipped');
        } catch (error) {
          console.log('Error clearing skip flag:', error);
        }
        navigation.navigate('DiabetesRiskAssessment');
      }
    }
  };

  const handleRiskFactorTap = (factor) => {
    // Check if this is the Initial Risk Assessment factor
    if (factor.component_name === 'Initial Risk Assessment' && assessment) {
      navigation.navigate('AssessmentResults', {
        prediction: assessment.prediction,
        isUpdate: true
      });
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
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.secondary,
      lineHeight: 22,
    },

    predictionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 32,
    },
    predictionCard: {
      width: '100%',
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
      marginBottom: 16,
    },
    predictionText: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      gap: 8,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    infoSection: {
      marginTop: 8,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    infoDescription: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    resultSection: {
      marginBottom: 24,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.15,
      shadowRadius: 4.65,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    resultIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    resultInfo: {
      flex: 1,
    },
    resultLabel: {
      fontSize: 13,
      color: colors.secondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    resultTitle: {
      fontSize: 22,
      fontWeight: '700',
    },
    resultMessage: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    resultStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    resultStat: {
      alignItems: 'center',
    },
    resultStatLabel: {
      fontSize: 12,
      marginBottom: 6,
    },
    resultStatValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    resultFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    resultFooterText: {
      fontSize: 16,
      fontWeight: '600',
    },
    retakeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
    },
    retakeButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    overallRiskCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.15,
      shadowRadius: 4.65,
    },
    overallRiskHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
    },
    overallRiskHeaderText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    overallRiskScoreSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 20,
    },
    overallRiskScoreCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    overallRiskScoreValue: {
      fontSize: 32,
      fontWeight: '700',
    },
    overallRiskScoreLabel: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: -4,
    },
    overallRiskScoreInfo: {
      flex: 1,
    },
    overallRiskBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      gap: 6,
      marginBottom: 8,
    },
    overallRiskBadgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    overallRiskProbability: {
      fontSize: 13,
      marginBottom: 4,
    },
    overallRiskMessage: {
      fontSize: 14,
      lineHeight: 20,
    },
    riskFactorsSection: {
      marginBottom: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    riskFactorsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    riskFactorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    riskFactorName: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    riskFactorScore: {
      fontSize: 14,
      fontWeight: '600',
    },
    recommendationsSection: {
      marginBottom: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    recommendationsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    recommendationText: {
      flex: 1,
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
    },
    refreshOverallButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}10`,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      gap: 8,
      marginTop: 8,
    },
    refreshOverallButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    explanationSection: {
      marginBottom: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    explanationTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    explanationText: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 22,
    },
    dataQualitySection: {
      marginBottom: 16,
      paddingTop: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: `${colors.secondary}10`,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dataQualityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    dataQualityTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
    },
    dataQualityText: {
      fontSize: 13,
      color: colors.secondary,
      lineHeight: 20,
    },
    // ---- Predictive Trend Card ----
    predictionSectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      marginTop: 8,
    },
    predictionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
    },
    predictionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    predictionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    predictionHeaderText: {
      flex: 1,
    },
    predictionLabel: {
      fontSize: 12,
      color: colors.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    predictionStatus: {
      fontSize: 20,
      fontWeight: '700',
    },
    predictionBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    predictionBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    predictionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    predictionMessage: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
      padding: 16,
    },
    forecastRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 10,
    },
    forecastItem: {
      flex: 1,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    forecastPeriod: {
      fontSize: 11,
      color: '#FFFFFF',
      opacity: 0.85,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    forecastScore: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    forecastCategory: {
      fontSize: 11,
      color: '#FFFFFF',
      opacity: 0.85,
      textAlign: 'center',
    },
    forecastChange: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    componentTrendsTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.secondary,
      paddingHorizontal: 16,
      paddingBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    componentTrendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    componentTrendName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      width: 80,
    },
    componentTrendDesc: {
      flex: 1,
      fontSize: 12,
      color: colors.secondary,
      lineHeight: 16,
    },
    drivingFactorsTitle: {
      fontSize: 13,
      color: colors.secondary,
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    drivingFactorItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 8,
    },
    drivingFactorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
    },
    drivingFactorText: {
      flex: 1,
      fontSize: 13,
      color: colors.secondary,
      lineHeight: 18,
    },
    confidenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    confidenceBadgeText: {
      fontSize: 11,
      color: colors.secondary,
    },
    trendLoadingBox: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    trendLoadingText: {
      fontSize: 13,
      color: colors.secondary,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Diabetes Risk Assessment</Text>
          <Text style={styles.subtitle}>
            Understand your diabetes risk and get personalized recommendations.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (assessment || overallRisk) ? (
          <View style={styles.resultSection}>
            {/* Overall Risk Assessment - Hide risk score and factors for diagnosed users */}
            {overallRisk && (
              <>
                <View style={styles.overallRiskCard}>
                  <View style={styles.overallRiskHeader}>
                    <Icon name="chart-line" size={20} color={colors.primary} />
                    <Text style={styles.overallRiskHeaderText}>
                      {isDiagnosed ? 'Health Summary' : 'Comprehensive Risk Assessment'}
                    </Text>
                  </View>
                  
                  {/* Risk Score Section - Only show for non-diagnosed users */}
                  {!isDiagnosed && (
                    <View style={styles.overallRiskScoreSection}>
                      <View style={[styles.overallRiskScoreCircle, { borderColor: overallRisk.category_info.color }]}>
                        <Text style={[styles.overallRiskScoreValue, { color: overallRisk.category_info.color }]}>
                          {overallRisk.overall_risk_score.toFixed(1)}
                        </Text>
                        <Text style={styles.overallRiskScoreLabel}>/ 100</Text>
                      </View>
                      <View style={styles.overallRiskScoreInfo}>
                        <View style={[styles.overallRiskBadge, { backgroundColor: overallRisk.category_info.color }]}>
                          <Icon name={overallRisk.category_info.icon} size={16} color="#FFFFFF" />
                          <Text style={styles.overallRiskBadgeText}>{overallRisk.category_info.title}</Text>
                        </View>
                        <Text style={[styles.overallRiskProbability, { color: colors.secondary }]}>
                          {overallRisk.category_info.probability}
                        </Text>
                        <Text style={[styles.overallRiskMessage, { color: colors.secondary }]}>
                          {overallRisk.category_info.message}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Risk Factors - Hide for diagnosed users */}
                  {!isDiagnosed && overallRisk.primary_risk_factors && overallRisk.primary_risk_factors.length > 0 && (
                    <View style={styles.riskFactorsSection}>
                      <Text style={styles.riskFactorsTitle}>Primary Risk Factors</Text>
                      {overallRisk.primary_risk_factors.map((factor, index) => {
                        const isInitialAssessment = factor.component_name === 'Initial Risk Assessment';
                        const Component = isInitialAssessment ? TouchableOpacity : View;
                        
                        return (
                          <Component 
                            key={index} 
                            style={styles.riskFactorItem}
                            onPress={isInitialAssessment ? () => handleRiskFactorTap(factor) : undefined}
                            activeOpacity={isInitialAssessment ? 0.7 : 1}
                          >
                            <Icon name="alert-circle" size={16} color="#E74C3C" />
                            <Text style={styles.riskFactorName}>{factor.component_name}</Text>
                            {isInitialAssessment && (
                              <Icon name="chevron-right" size={18} color={colors.primary} style={{ marginLeft: 'auto', marginRight: 4 }} />
                            )}
                            <Text style={[styles.riskFactorScore, { color: '#E74C3C' }]}>
                              {factor.weighted_score.toFixed(1)}
                            </Text>
                          </Component>
                        );
                      })}
                    </View>
                  )}

                  {/* Protective Factors - Hide for diagnosed users */}
                  {!isDiagnosed && overallRisk.protective_factors && overallRisk.protective_factors.length > 0 && (
                    <View style={styles.riskFactorsSection}>
                      <Text style={[styles.riskFactorsTitle, { color: '#27AE60' }]}>Protective Factors</Text>
                      {overallRisk.protective_factors.map((factor, index) => (
                        <View key={index} style={styles.riskFactorItem}>
                          <Icon name="check-circle" size={16} color="#27AE60" />
                          <Text style={styles.riskFactorName}>{factor.component_name}</Text>
                          <Text style={[styles.riskFactorScore, { color: '#27AE60' }]}>
                            {factor.weighted_score.toFixed(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {overallRisk.recommendations && overallRisk.recommendations.length > 0 && (
                    <View style={styles.recommendationsSection}>
                      <Text style={styles.recommendationsTitle}>Recommendations</Text>
                      {overallRisk.recommendations.slice(0, 3).map((rec, index) => (
                        <View key={index} style={styles.recommendationItem}>
                          <Icon name="lightbulb-outline" size={14} color={colors.primary} />
                          <Text style={styles.recommendationText}>{rec}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {overallRisk.data_quality_notes && (
                    <View style={styles.dataQualitySection}>
                      <View style={styles.dataQualityHeader}>
                        <Icon name="information-outline" size={18} color={colors.secondary} />
                        <Text style={styles.dataQualityTitle}>Data Quality Notes</Text>
                      </View>
                      <Text style={styles.dataQualityText}>{overallRisk.data_quality_notes}</Text>
                    </View>
                  )}

                  {/* ===== Health Trajectory Prediction ===== */}
                  <Text style={styles.predictionSectionTitle}>Health Trajectory Prediction</Text>

                  {trendLoading ? (
                    <View style={styles.trendLoadingBox}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.trendLoadingText}>Analysing your lifestyle trends…</Text>
                    </View>
                  ) : trendPrediction ? (() => {
                    const tc = getTrendConfig();
                    const forecast30 = trendPrediction.forecast?.days_30;
                    const forecast90 = trendPrediction.forecast?.days_90;
                    const componentTrends = trendPrediction.component_trends || {};
                    const drivingFactors = trendPrediction.driving_factors || [];
                    const componentKeys = ['sleep', 'steps', 'smoking', 'alcohol', 'food'];
                    const componentLabels = {
                      sleep: 'Sleep', steps: 'Activity', smoking: 'Smoking',
                      alcohol: 'Alcohol', food: 'Diet',
                    };

                    return (
                      <View style={[styles.predictionCard, { marginBottom: 16 }]}>
                        {/* Header */}
                        <View style={styles.predictionHeader}>
                          <View style={[styles.predictionIconCircle, { backgroundColor: `${tc.color}20` }]}>
                            <Icon name={tc.icon} size={26} color={tc.color} />
                          </View>
                          <View style={styles.predictionHeaderText}>
                            <Text style={styles.predictionLabel}>Status Outlook</Text>
                            <Text style={[styles.predictionStatus, { color: tc.color }]}>{tc.label}</Text>
                          <View style={[styles.predictionBadge, { backgroundColor: tc.color }]}>
                            <Text style={styles.predictionBadgeText}>{tc.badgeText}</Text>
                          </View>
                          </View>
                        </View>

                        <View style={styles.predictionDivider} />

                        {/* Trend message */}
                        <Text style={styles.predictionMessage}>{trendPrediction.trend_message}</Text>

                        {/* Forecast cards */}
                        {(forecast30 || forecast90) && (
                          <View style={styles.forecastRow}>
                            {forecast30 && (
                              <LinearGradient
                                colors={tc.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.forecastItem}
                              >
                                <Text style={styles.forecastPeriod}>30 Days</Text>
                                <Text style={styles.forecastScore}>{forecast30.predicted_score}</Text>
                                <Text style={styles.forecastCategory}>
                                  {forecast30.predicted_category?.replace('_', ' ').toUpperCase()}
                                </Text>
                                {forecast30.predicted_change !== 0 && (
                                  <Text style={styles.forecastChange}>
                                    {forecast30.predicted_change > 0 ? '+' : ''}{forecast30.predicted_change} pts
                                  </Text>
                                )}
                              </LinearGradient>
                            )}
                            {forecast90 && (
                              <LinearGradient
                                colors={[tc.gradient[1], tc.gradient[0]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.forecastItem}
                              >
                                <Text style={styles.forecastPeriod}>90 Days</Text>
                                <Text style={styles.forecastScore}>{forecast90.predicted_score}</Text>
                                <Text style={styles.forecastCategory}>
                                  {forecast90.predicted_category?.replace('_', ' ').toUpperCase()}
                                </Text>
                                {forecast90.predicted_change !== 0 && (
                                  <Text style={styles.forecastChange}>
                                    {forecast90.predicted_change > 0 ? '+' : ''}{forecast90.predicted_change} pts
                                  </Text>
                                )}
                              </LinearGradient>
                            )}
                          </View>
                        )}

                        {/* Component trends */}
                        <View style={styles.predictionDivider} />
                        <Text style={styles.componentTrendsTitle}>Lifestyle Factors</Text>
                        {componentKeys.map((key) => {
                          const t = componentTrends[key];
                          if (!t || t.direction === 'no_data') return null;
                          const tIcon = getComponentTrendIcon(t.direction);
                          return (
                            <View key={key} style={styles.componentTrendItem}>
                              <Icon name={tIcon.icon} size={18} color={tIcon.color} />
                              <Text style={styles.componentTrendName}>{componentLabels[key]}</Text>
                              <Text style={styles.componentTrendDesc}>{t.description}</Text>
                            </View>
                          );
                        })}

                        {/* Driving factors */}
                        {drivingFactors.length > 0 && (
                          <>
                            <View style={[styles.predictionDivider, { marginTop: 8 }]} />
                            <Text style={styles.drivingFactorsTitle}>Key Drivers</Text>
                            {drivingFactors.map((f, idx) => (
                              <View key={idx} style={styles.drivingFactorItem}>
                                <View style={[
                                  styles.drivingFactorDot,
                                  { backgroundColor: f.impact === 'positive' ? '#27AE60' : '#E74C3C' }
                                ]} />
                                <Text style={styles.drivingFactorText}>
                                  <Text style={{ fontWeight: '600' }}>{f.factor_name}: </Text>
                                  {f.description}
                                </Text>
                              </View>
                            ))}
                          </>
                        )}

                        {/* Confidence footer */}
                        <View style={[styles.predictionDivider, { marginTop: 4 }]} />
                        <View style={styles.confidenceBadge}>
                          <Icon name="information-outline" size={14} color={colors.secondary} />
                          <Text style={styles.confidenceBadgeText}>
                            Prediction confidence: {trendPrediction.confidence?.toUpperCase()} •
                            Based on lifetime tracker data
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <View style={styles.trendLoadingBox}>
                      <Icon name="chart-line" size={32} color={colors.secondary} />
                      <Text style={[styles.trendLoadingText, { textAlign: 'center' }]}>
                        Complete your initial assessment to unlock health trajectory predictions.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.refreshOverallButton}
                    onPress={handleRefreshOverallRisk}
                    activeOpacity={0.7}
                  >
                    <Icon name="refresh" size={18} color={colors.primary} />
                    <Text style={styles.refreshOverallButtonText}>Refresh Comprehensive Assessment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {!assessment && (
              <TouchableOpacity
                style={[styles.retakeButton, { borderColor: colors.border }]}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem('@assessment_skipped');
                  } catch (error) {
                    console.log('Error clearing skip flag:', error);
                  }
                  navigation.navigate('DiabetesRiskAssessment');
                }}
                activeOpacity={0.7}
              >
                <Icon name="clipboard-text" size={20} color={colors.primary} />
                <Text style={[styles.retakeButtonText, { color: colors.primary }]}>Take Initial Assessment</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
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

                  <View style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Start Assessment</Text>
                    <Icon name="arrow-right" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Icon name="information" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Why Take This Assessment?</Text>
              <Text style={styles.infoDescription}>
                This comprehensive assessment evaluates multiple risk factors including age, family history, lifestyle habits, and health metrics to provide you with personalized insights about your diabetes risk.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Icon name="clock-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Takes 5-10 Minutes</Text>
              <Text style={styles.infoDescription}>
                The assessment includes questions about your health history, daily activities, and lifestyle choices to give you the most accurate risk evaluation.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Icon name="shield-check" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Confidential & Secure</Text>
              <Text style={styles.infoDescription}>
                Your health information is kept private and secure. Results are only visible to you and can be shared with your healthcare provider if you choose.
              </Text>
            </View>
          </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PredictionScreen;
