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
  Linking,
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
  const [computationVisible, setComputationVisible] = useState(false);
  const [refsVisible, setRefsVisible] = useState(false);

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
      case 'stable': return { icon: 'minus-circle', color: '#F39C12' };
      default: return { icon: 'help-circle', color: colors.secondary };
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
          icon: 'alert',
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
      padding: 10,
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
      padding: 10,
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
      width: 120,
      height: 120,
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
      marginVertical: 8,
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
    forecastExplanation: {
      fontSize: 9,
      color: '#FFFFFF',
      opacity: 0.82,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 5,
      lineHeight: 13,
      paddingHorizontal: 4,
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

    // ── Pre-Diabetes Risk Computation Table ──
    computationSection: {
      marginTop: 20,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    computationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    computationHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    computationHeaderText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    computationBody: {
      paddingHorizontal: 14,
      paddingBottom: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    computationDisclaimer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: `${colors.primary}12`,
      borderRadius: 10,
      padding: 12,
      marginTop: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}25`,
    },
    computationDisclaimerText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
    },
    computationSectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 18,
      marginBottom: 8,
    },
    formulaBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    formulaTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    formulaDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    formulaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 10,
      gap: 8,
    },
    formulaRowEven: {
      backgroundColor: `${colors.primary}07`,
    },
    formulaRowOdd: {
      backgroundColor: 'transparent',
    },
    formulaComponent: {
      flex: 2,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    formulaWeightBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    formulaWeightText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    formulaNote: {
      flex: 2.2,
      fontSize: 11,
      color: colors.secondary,
      lineHeight: 16,
      alignSelf: 'center',
    },
    tableContainer: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 6,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    tableHeaderRow: {
      backgroundColor: colors.primary,
    },
    tableRowEven: {
      backgroundColor: `${colors.primary}07`,
    },
    tableRowOdd: {
      backgroundColor: 'transparent',
    },
    tableCell: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
      paddingRight: 4,
    },
    tableCellHeader: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    componentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 14,
      marginBottom: 6,
    },
    refsToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 2,
    },
    referencesContainer: {
      gap: 12,
      marginTop: 8,
    },
    referenceItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    referenceNum: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      minWidth: 26,
      paddingTop: 1,
    },
    referenceTextBlock: {
      flex: 1,
      gap: 3,
    },
    referenceText: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 16,
    },
    referenceJournal: {
      fontStyle: 'italic',
      color: colors.secondary,
    },
    referenceUrl: {
      fontSize: 11,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isDiagnosed ? 'Diabetes Management' : 'Diabetes Risk Assessment'}
          </Text>
          <Text style={styles.subtitle}>
            {isDiagnosed
              ? 'Monitor your health trends and lifestyle habits to manage your diabetes effectively.'
              : 'Understand your diabetes risk and get personalized recommendations.'}
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
                      {isDiagnosed ? 'Health Summary' : 'Risk Assessment'}
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
                  {!isDiagnosed && (
                    <TouchableOpacity
                      style={styles.refreshOverallButton}
                      onPress={handleRefreshOverallRisk}
                      activeOpacity={0.7}
                    >
                      <Icon name="refresh" size={18} color={colors.primary} />
                      <Text style={styles.refreshOverallButtonText}>Refresh Assessment</Text>
                    </TouchableOpacity>
                  )}
                  {/* Risk Factor Breakdown - all tracked components, color-coded */}
                  {!isDiagnosed && overallRisk.primary_risk_factors && overallRisk.primary_risk_factors.length > 0 && (
                    <View style={styles.riskFactorsSection}>
                      <Text style={styles.riskFactorsTitle}>Risk Factor Breakdown</Text>
                      {overallRisk.primary_risk_factors.map((factor, index) => {
                        const ws = factor.weighted_score;
                        const isPositive = ws > 0;
                        const isNegative = ws < 0;
                        const isNeutral = ws === 0;
                        const iconName = isNegative ? 'check-circle' : isNeutral ? 'minus-circle-outline' : 'alert-circle';
                        const dotColor = isNegative ? '#27AE60' : isNeutral ? colors.secondary : '#E74C3C';
                        const isInitialAssessment = factor.component_name === 'Initial Risk Assessment';
                        const Component = isInitialAssessment ? TouchableOpacity : View;

                        return (
                          <Component
                            key={index}
                            style={styles.riskFactorItem}
                            onPress={isInitialAssessment ? () => handleRiskFactorTap(factor) : undefined}
                            activeOpacity={isInitialAssessment ? 0.7 : 1}
                          >
                            <Icon name={iconName} size={16} color={dotColor} />
                            <Text style={[styles.riskFactorName, isNeutral && { color: colors.secondary }]}>{factor.component_name}</Text>
                            {isInitialAssessment && (
                              <Icon name="chevron-right" size={18} color={colors.primary} style={{ marginLeft: 'auto', marginRight: 4 }} />
                            )}
                            <Text style={[styles.riskFactorScore, { color: dotColor }]}>
                              {isNeutral ? '±0.00' : (isNegative ? '−' : '+') + Math.abs(ws).toFixed(2)}
                            </Text>
                          </Component>
                        );
                      })}
                    </View>
                  )}

                  {overallRisk.recommendations && overallRisk.recommendations.length > 0 && (
                    <View style={styles.recommendationsSection}>
                      <Text style={styles.recommendationsTitle}>Recommendations</Text>
                      {overallRisk.recommendations.map((rec, index) => (
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

                        {/* Forecast cards — hide raw risk scores for diagnosed users */}
                        {!isDiagnosed && (forecast30 || forecast90) && (
                          <View style={styles.forecastRow}>
                            {forecast30 && (
                              <LinearGradient
                                colors={tc.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.forecastItem}
                              >
                                <Text style={styles.forecastPeriod}>30 Days</Text>
                                <Text style={styles.forecastScore}>
                                  {parseFloat(Math.max(0, Math.min(100, (overallRisk?.overall_risk_score ?? trendPrediction.current_risk_score ?? 0) + (forecast30.predicted_change ?? 0))).toFixed(1))}
                                </Text>
                                <Text style={styles.forecastCategory}>
                                  {forecast30.predicted_category?.replace('_', ' ').toUpperCase()}
                                </Text>
                                {forecast30.predicted_change != null && forecast30.predicted_change !== 0 ? (
                                  <Text style={styles.forecastChange}>
                                    {forecast30.predicted_change > 0 ? '+' : ''}{parseFloat(forecast30.predicted_change.toFixed(1))} pts
                                  </Text>
                                ) : null}
                                {forecast30.explanation ? (
                                  <Text style={styles.forecastExplanation}>{forecast30.explanation}</Text>
                                ) : null}
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
                                <Text style={styles.forecastScore}>
                                  {parseFloat(Math.max(0, Math.min(100, (overallRisk?.overall_risk_score ?? trendPrediction.current_risk_score ?? 0) + (forecast90.predicted_change ?? 0))).toFixed(1))}
                                </Text>
                                <Text style={styles.forecastCategory}>
                                  {forecast90.predicted_category?.replace('_', ' ').toUpperCase()}
                                </Text>
                                {forecast90.predicted_change != null && forecast90.predicted_change !== 0 ? (
                                  <Text style={styles.forecastChange}>
                                    {forecast90.predicted_change > 0 ? '+' : ''}{parseFloat(forecast90.predicted_change.toFixed(1))} pts
                                  </Text>
                                ) : null}
                                {forecast90.explanation ? (
                                  <Text style={styles.forecastExplanation}>{forecast90.explanation}</Text>
                                ) : null}
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
                </View>
              </>
            )}

            {!assessment && !isDiagnosed && (
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
        ) : isDiagnosed ? (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Icon name="check-decagram" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Managing Your Diabetes</Text>
                <Text style={styles.infoDescription}>
                  As someone diagnosed with {user?.diagnosis_status === 'type2_diabetes' ? 'Type 2 Diabetes' : 'Prediabetes'}, focus on tracking your
                  daily lifestyle habits — steps, sleep, diet, smoking, and alcohol — to keep your blood sugar in a healthy range.
                  Visit each tracker to see your personalized management recommendations.
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Icon name="heart-pulse" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Health Trajectory</Text>
                <Text style={styles.infoDescription}>
                  Keep logging your lifestyle data. Once enough data is collected, your health trend
                  analysis will appear above, showing whether your habits are improving, stable, or need attention.
                </Text>
              </View>
            </View>
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

        {/* ===== Pre-Diabetes Risk Computation Table — only for non-diagnosed users ===== */}
        {!isDiagnosed && (
        <View style={styles.computationSection}>
          <TouchableOpacity
            style={styles.computationHeader}
            onPress={() => setComputationVisible(!computationVisible)}
            activeOpacity={0.7}
          >
            <View style={styles.computationHeaderLeft}>
              <Icon name="calculator-variant" size={20} color={colors.primary} />
              <Text style={styles.computationHeaderText}>How Is Your Pre-Diabetes Risk Computed?</Text>
            </View>
            <Icon
              name={computationVisible ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.secondary}
            />
          </TouchableOpacity>

          {computationVisible && (
            <View style={styles.computationBody}>
              {/* Disclaimer */}
              <View style={styles.computationDisclaimer}>
                <Icon name="information-outline" size={16} color={colors.primary} />
                <Text style={styles.computationDisclaimerText}>
                  This computation estimates the risk of developing{' '}
                  <Text style={{ fontWeight: '700' }}>pre-diabetes or Type 2 diabetes</Text>.
                  Scores are derived from validated, peer-reviewed research and a machine learning
                  model trained on the BRFSS dataset.
                </Text>
              </View>

              {/* ── Formula ── */}
              <Text style={styles.computationSectionLabel}>Weighted Risk Formula</Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaTitle}>Overall Risk Score (0 – 100)</Text>
                <View style={styles.formulaDivider} />
                {[
                  { label: 'BMI / Obesity', weight: '25%', note: 'Strongest Diabetes predictor; uses WHO Asian cutoffs (≥23 = overweight for Filipinos)', url: 'https://doi.org/10.1016/S0140-6736(03)15268-3' },
                  { label: 'ML Initial Assessment', weight: '20%', note: 'Validated clinical model trained on BRFSS dataset', url: 'https://doi.org/10.1056/NEJMoa012512' },
                  { label: 'Age', weight: '15%', note: 'Risk rises sharply after 45; strong non-modifiable predictor', url: 'https://doi.org/10.1371/journal.pone.0194127' },
                  { label: 'Food Intake Quality', weight: '12%', note: 'Primary modifiable Diabetes risk factor; reflects daily dietary habits', url: 'https://doi.org/10.2337/dc10-1079' },
                  { label: 'Physical Activity (Steps)', weight: '10%', note: 'Physical inactivity is a key modifiable risk factor', url: 'https://doi.org/10.1007/s10654-015-0056-z' },
                  { label: 'Smoking Status', weight: '7%', note: '44% increased Diabetes risk for active smokers', url: 'https://doi.org/10.1001/jama.298.22.2654' },
                  { label: 'Sleep Duration & Quality', weight: '6%', note: 'Disrupts insulin sensitivity and glucose metabolism', url: 'https://doi.org/10.2337/dc09-1124' },
                  { label: 'Alcohol Consumption', weight: '4%', note: 'J-shaped relationship with Diabetes risk', url: 'https://doi.org/10.2337/dc09-0227' },
                  { label: 'Biological Sex', weight: '1%', note: 'Hormonal & metabolic differences', url: 'https://doi.org/10.1210/er.2015-1137' },
                ].map((row, idx) => (
                  <View
                    key={row.label}
                    style={[
                      styles.formulaRow,
                      idx % 2 === 0 ? styles.formulaRowEven : styles.formulaRowOdd,
                    ]}
                  >
                    <Text style={styles.formulaComponent}>{row.label}</Text>
                    <View style={styles.formulaWeightBadge}>
                      <Text style={styles.formulaWeightText}>{row.weight}</Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() => Linking.openURL(row.url)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.formulaNote, { flex: 1 }]}>{row.note}</Text>
                      <Icon name="open-in-new" size={11} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* ── Risk Categories ── */}
              <Text style={styles.computationSectionLabel}>Risk Categories</Text>
              <View style={styles.tableContainer}>
                {/* Header */}
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.2 }]}>Score</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.5 }]}>Category</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>10-yr Probability</Text>
                </View>
                {[
                  { score: '0 – 25', category: 'Low', prob: '< 10 %', color: '#27AE60' },
                  { score: '26 – 50', category: 'Moderate', prob: '10 – 30 %', color: '#F39C12' },
                  { score: '51 – 75', category: 'High', prob: '30 – 60 %', color: '#E67E22' },
                  { score: '76 – 100', category: 'Very High', prob: '> 60 %', color: '#E74C3C' },
                ].map((row, idx) => (
                  <View
                    key={row.score}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                    ]}
                  >
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{row.score}</Text>
                    <Text style={[styles.tableCell, { flex: 1.5, color: row.color, fontWeight: '700' }]}>
                      {row.category}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{row.prob}</Text>
                  </View>
                ))}
              </View>

              {/* ── Component Scoring Detail ── */}
              <Text style={styles.computationSectionLabel}>Component Scoring Detail</Text>

              {/* Legend */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E74C3C' }} />
                  <Text style={{ fontSize: 12, color: colors.secondary }}><Text style={{ fontWeight: '700', color: '#E74C3C' }}>+</Text> Increases risk score</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#27AE60' }} />
                  <Text style={{ fontSize: 12, color: colors.secondary }}><Text style={{ fontWeight: '700', color: '#27AE60' }}>−</Text> Decreases risk score</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary }} />
                  <Text style={{ fontSize: 12, color: colors.secondary }}><Text style={{ fontWeight: '700' }}>0</Text> No impact on score</Text>
                </View>
              </View>

              {/* Physical Activity */}
              <Text style={styles.componentLabel}>Physical Activity (Step Count)</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Daily step count is a key indicator of cardiovascular and metabolic health. Consistent movement lowers insulin resistance and reduces diabetes risk.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.5 }]}>Condition</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: '< 3,000 steps / day (very sedentary)', pts: '~36–46', pos: true },
                  { cond: '3,000 – 4,999 steps / day (sedentary)', pts: '~22–32', pos: true },
                  { cond: '5,000 – 6,999 steps / day (below target)', pts: '~9–19', pos: true },
                  { cond: '7,000 – 9,999 steps / day (near target)', pts: '~0–10', neutral: true },
                  { cond: '≥ 10,000 steps / day (meets goal)', pts: '0', neutral: true },
                  { cond: 'Inconsistent activity (< 3 active days / wk)', pts: '+10 added', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.pos ? '#E74C3C' : '#27AE60' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 10% → steps service scores are normalized to 0-100 for risk weighting; max contribution = +10.0 pts to overall score. Score blends baseline daily steps with logged data (confidence-weighted).
              </Text>

              {/* Sleep */}
              <Text style={styles.componentLabel}>Sleep</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Poor or irregular sleep disrupts glucose regulation and hormones that control appetite, directly elevating diabetes risk.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.5 }]}>Condition</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Added to Score</Text>
                </View>
                {[
                  { cond: '< 6 h / night (short sleep)', pts: '+ 20–30', pos: true },
                  { cond: '7 – 8 h / night (optimal)', pts: '0', neutral: true },
                  { cond: '> 9 h / night (long sleep)', pts: '+ 15–25', pos: true },
                  { cond: 'High sleep-duration variability', pts: '+ 10–20', pos: true },
                  { cond: 'Irregular bedtime pattern', pts: '+ 10–15', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.pos ? '#E74C3C' : '#27AE60' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 6% → sleep service scores are normalized to 0-100 for risk weighting; max contribution = +6.0 pts to overall score. Baseline typical sleep hours are blended with daily logged data (confidence-weighted).
              </Text>

              {/* Smoking */}
              <Text style={styles.componentLabel}>Smoking</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Smoking impairs insulin sensitivity and promotes inflammation. Active smokers have up to 44% higher risk of developing Type 2 diabetes.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.5 }]}>Condition</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: 'Never smoked', pts: '0', prot: true },
                  { cond: 'Former — quit > 10 yrs (light history)', pts: '~10', pos: true },
                  { cond: 'Former — quit > 10 yrs (heavy history)', pts: '~25', pos: true },
                  { cond: 'Former — quit 5–10 yrs', pts: '~25–50', pos: true },
                  { cond: 'Former — quit < 5 yrs', pts: '~50–75', pos: true },
                  { cond: 'Current — light (< 10 cigs / day)', pts: '~50', pos: true },
                  { cond: 'Current — moderate (10–19 cigs / day)', pts: '~75', pos: true },
                  { cond: 'Current — heavy (≥ 20 cigs / day)', pts: '100 (max)', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.prot ? '#27AE60' : '#E74C3C' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 7% → max contribution = +7.0 pts to overall score. Baseline smoking history (status, cigarettes/day, pack-years, quit date) is used to calculate risk; daily logs refine it over time.
              </Text>

              {/* Alcohol */}
              <Text style={styles.componentLabel}>Alcohol Intake</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Alcohol has a J-shaped relationship with diabetes risk — light drinking may be neutral or mildly protective, while heavy or binge drinking raises risk significantly.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.5 }]}>Condition</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: 'No consumption', pts: '0', neutral: true },
                  { cond: 'Light ≤ 7 drinks / week', pts: '−25 (protective)', prot: true },
                  { cond: 'Moderate 7–14 drinks / week', pts: '+25', pos: true },
                  { cond: 'Heavy > 14–21 drinks / week', pts: '+75', pos: true },
                  { cond: 'Binge / very high (≥ 4–5 per occasion)', pts: '+100 (max)', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.prot ? '#27AE60' : r.pos ? '#E74C3C' : colors.text }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 4% → max contribution = +4.0 pts / min = −1.0 pts (protective) to overall score. Your baseline questionnaire answers (drinks/week, drinks per occasion, binge frequency) are used if daily logs are absent or fewer than 7 days exist.
              </Text>

              {/* BMI */}
              <Text style={styles.componentLabel}>Body Mass Index (BMI)</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Excess body weight, especially abdominal fat, increases insulin resistance. This app uses WHO-recommended Asian BMI cutoffs, which are lower than standard Western cutoffs — important for Filipino users whose cardiometabolic risk rises at a lower BMI.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.5 }]}>BMI Range (Asian / Filipino Standard)</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: 'Underweight  < 18.5', pts: '12', pos: true },
                  { cond: 'Normal  18.5 – 22.9', pts: '0', prot: true },
                  { cond: 'At Risk (overweight)  23.0 – 27.4', pts: '25', pos: true },
                  { cond: 'Obese Class I  27.5 – 32.4', pts: '60', pos: true },
                  { cond: 'Obese Class II  ≥ 32.5', pts: '100 (max)', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.prot ? '#27AE60' : '#E74C3C' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 25% → max contribution = +25.0 pts to overall score. WHO Asian cutoffs used (WHO Expert Consultation, 2004): overweight ≥23, obese ≥27.5. This is the most impactful single factor. Calculated from your profile height and weight.
              </Text>

              {/* Age & Sex */}
              <Text style={styles.componentLabel}>Age</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Diabetes risk increases with age due to declining pancreatic beta-cell function and reduced physical activity over time. This factor is non-modifiable.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>Age Range</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: '< 30 years', pts: '0', prot: true },
                  { cond: '30 – 39 years', pts: '13', pos: true },
                  { cond: '40 – 49 years', pts: '33', pos: true },
                  { cond: '50 – 59 years', pts: '53', pos: true },
                  { cond: '60 – 69 years', pts: '80', pos: true },
                  { cond: '≥ 70 years', pts: '100 (max)', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.prot ? '#27AE60' : '#E74C3C' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 15% → max contribution = +15.0 pts to overall score. Non-modifiable; taken from your profile date of birth.
              </Text>

              <Text style={styles.componentLabel}>Biological Sex</Text>
              <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 8, lineHeight: 17 }}>Hormonal and metabolic differences between sexes contribute a small, non-modifiable influence on overall diabetes risk.</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>Sex</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.4 }]}>Score (0–100)</Text>
                </View>
                {[
                  { cond: 'Female', pts: '0', prot: true },
                  { cond: 'Male', pts: '100 (max)', pos: true },
                ].map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{r.cond}</Text>
                    <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '700',
                      color: r.prot ? '#27AE60' : '#E74C3C' }]}>
                      {r.pts}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Weight 1% → max contribution = +1.0 pt to overall score (males). Non-modifiable; taken from your profile.
              </Text>

              {/* ── Scientific References ── */}
              <TouchableOpacity
                style={styles.refsToggleRow}
                onPress={() => setRefsVisible(!refsVisible)}
                activeOpacity={0.7}
              >
                <Text style={[styles.computationSectionLabel, { marginTop: 0, marginBottom: 0 }]}>Scientific References (APA)</Text>
                <Icon
                  name={refsVisible ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {refsVisible && <View style={styles.referencesContainer}>
                {[
                  {
                    num: 1,
                    authors: 'American Diabetes Association.',
                    year: '2023',
                    title: 'Standards of medical care in diabetes — 2023',
                    journal: 'Diabetes Care, 46(Supplement_1)',
                    url: 'https://doi.org/10.2337/dc23-Sint',
                  },
                  {
                    num: 2,
                    authors: 'Bellou, V., Belbasis, L., Tzoulaki, I., & Evangelou, E.',
                    year: '2018',
                    title: 'Risk factors for type 2 diabetes mellitus: An exposure-wide umbrella review of meta-analyses',
                    journal: 'PLOS ONE, 13(3), e0194127',
                    url: 'https://doi.org/10.1371/journal.pone.0194127',
                  },
                  {
                    num: 3,
                    authors: 'Knutson, K. L., Spiegel, K., Penev, P., & Van Cauter, E.',
                    year: '2007',
                    title: 'The metabolic consequences of sleep deprivation',
                    journal: 'Sleep Medicine Reviews, 11(3), 163–178',
                    url: 'https://doi.org/10.1016/j.smrv.2007.01.002',
                  },
                  {
                    num: 4,
                    authors: 'Cappuccio, F. P., D\'Elia, L., Strazzullo, P., & Miller, M. A.',
                    year: '2010',
                    title: 'Quantity and quality of sleep and incidence of type 2 diabetes: A systematic review and meta-analysis',
                    journal: 'Diabetes Care, 33(2), 414–420',
                    url: 'https://doi.org/10.2337/dc09-1124',
                  },
                  {
                    num: 5,
                    authors: 'Shan, Z., Ma, H., Xie, M., Yan, P., Guo, Y., Bao, W., Rong, Y., Jackson, C. L., Hu, F. B., & Liu, L.',
                    year: '2015',
                    title: 'Sleep duration and risk of type 2 diabetes: A meta-analysis of prospective studies',
                    journal: 'Diabetes Care, 38(3), 529–537',
                    url: 'https://doi.org/10.2337/dc14-2073',
                  },
                  {
                    num: 6,
                    authors: 'Aune, D., Norat, T., Leitzmann, M., Tonstad, S., & Vatten, L. J.',
                    year: '2015',
                    title: 'Physical activity and the risk of type 2 diabetes: A systematic review and dose-response meta-analysis',
                    journal: 'European Journal of Epidemiology, 30(7), 529–542',
                    url: 'https://doi.org/10.1007/s10654-015-0056-z',
                  },
                  {
                    num: 7,
                    authors: 'Tudor-Locke, C., Craig, C. L., Brown, W. J., Clemes, S. A., De Cocker, K., Giles-Corti, B., Hatano, Y., Inoue, S., Matsudo, S. M., Mutrie, N., Oppert, J.-M., Rowe, D. A., Schmidt, M. D., Schofield, G. M., Spence, J. C., Teixeira, P. J., Tully, M. A., & Blair, S. N.',
                    year: '2011',
                    title: 'How many steps/day are enough? For adults',
                    journal: 'International Journal of Behavioral Nutrition and Physical Activity, 8, 79',
                    url: 'https://doi.org/10.1186/1479-5868-8-79',
                  },
                  {
                    num: 8,
                    authors: 'Colberg, S. R., Sigal, R. J., Yardley, J. E., Riddell, M. C., Dunstan, D. W., Dempsey, P. C., Horton, E. S., Castorino, K., & Tate, D. F.',
                    year: '2016',
                    title: 'Physical activity/exercise and diabetes: A position statement of the American Diabetes Association',
                    journal: 'Diabetes Care, 39(11), 2065–2079',
                    url: 'https://doi.org/10.2337/dc16-1728',
                  },
                  {
                    num: 9,
                    authors: 'Willi, C., Bodenmann, P., Ghali, W. A., Faris, P. D., & Cornuz, J.',
                    year: '2007',
                    title: 'Active smoking and the risk of type 2 diabetes: A systematic review and meta-analysis',
                    journal: 'JAMA, 298(22), 2654–2664',
                    url: 'https://doi.org/10.1001/jama.298.22.2654',
                  },
                  {
                    num: 10,
                    authors: 'Pan, A., Wang, Y., Talaei, M., Hu, F. B., & Wu, T.',
                    year: '2015',
                    title: 'Relation of active, passive, and quitting smoking with incident type 2 diabetes: A systematic review and meta-analysis',
                    journal: 'The Lancet Diabetes & Endocrinology, 3(12), 958–967',
                    url: 'https://doi.org/10.1016/S2213-8587(15)00316-2',
                  },
                  {
                    num: 11,
                    authors: 'Baliunas, D. O., Taylor, B. J., Irving, H., Roerecke, M., Patra, J., Mohapatra, S., & Rehm, J.',
                    year: '2009',
                    title: 'Alcohol as a risk factor for type 2 diabetes: A systematic review and meta-analysis',
                    journal: 'Diabetes Care, 32(11), 2123–2132',
                    url: 'https://doi.org/10.2337/dc09-0227',
                  },
                  {
                    num: 12,
                    authors: 'Holst, C., Becker, U., Jørgensen, M. E., Grønbæk, M., & Tolstrup, J. S.',
                    year: '2017',
                    title: 'Alcohol drinking patterns and risk of diabetes: A cohort study of 70,551 men and women from the general Danish population',
                    journal: 'Diabetologia, 60(10), 1941–1950',
                    url: 'https://doi.org/10.1007/s00125-017-4359-3',
                  },
                  {
                    num: 13,
                    authors: 'Malik, V. S., Popkin, B. M., Bray, G. A., Després, J.-P., Willett, W. C., & Hu, F. B.',
                    year: '2010',
                    title: 'Sugar-sweetened beverages and risk of metabolic syndrome and type 2 diabetes: A meta-analysis',
                    journal: 'Diabetes Care, 33(11), 2477–2483',
                    url: 'https://doi.org/10.2337/dc10-1079',
                  },
                  {
                    num: 14,
                    authors: 'Yao, B., Fang, H., Xu, W., Yan, Y., Xu, H., Liu, Y., Mo, M., Zhang, H., & Zhao, Y.',
                    year: '2014',
                    title: 'Dietary fiber intake and risk of type 2 diabetes: A dose-response analysis of prospective studies',
                    journal: 'European Journal of Nutrition, 53(2), 489–498',
                    url: 'https://doi.org/10.1007/s00394-013-0567-7',
                  },
                  {
                    num: 15,
                    authors: 'Abdullah, A., Peeters, A., de Courten, M., & Stoelwinder, J.',
                    year: '2010',
                    title: 'The magnitude of association between overweight and obesity and the risk of diabetes: A meta-analysis of prospective cohort studies',
                    journal: 'Diabetes Research and Clinical Practice, 89(3), 309–319',
                    url: 'https://doi.org/10.1016/j.diabres.2010.04.012',
                  },
                  {
                    num: 16,
                    authors: 'Kautzky-Willer, A., Harreiter, J., & Pacini, G.',
                    year: '2016',
                    title: 'Sex and gender differences in risk, pathophysiology and complications of type 2 diabetes mellitus',
                    journal: 'Endocrine Reviews, 37(3), 278–316',
                    url: 'https://doi.org/10.1210/er.2015-1137',
                  },
                  {
                    num: 17,
                    authors: 'Knowler, W. C., Barrett-Connor, E., Fowler, S. E., Hamman, R. F., Lachin, J. M., Walker, E. A., & Nathan, D. M.',
                    year: '2002',
                    title: 'Reduction in the incidence of type 2 diabetes with lifestyle intervention or metformin',
                    journal: 'New England Journal of Medicine, 346(6), 393–403',
                    url: 'https://doi.org/10.1056/NEJMoa012512',
                  },
                  {
                    num: 18,
                    authors: 'Centers for Disease Control and Prevention.',
                    year: '2020',
                    title: 'National Diabetes Statistics Report, 2020',
                    journal: 'U.S. Department of Health and Human Services',
                    url: 'https://www.cdc.gov/diabetes/data/statistics-report/index.html',
                  },
                  {
                    num: 19,
                    authors: 'World Health Organization Expert Consultation.',
                    year: '2004',
                    title: 'Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies',
                    journal: 'The Lancet, 363(9403), 157–163',
                    url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
                  },
                  {
                    num: 20,
                    authors: 'Yoon, K. H., Lee, J. H., Kim, J. W., Cho, J. H., Choi, Y. H., Ko, S. H., Zimmet, P., & Son, H. Y.',
                    year: '2006',
                    title: 'Epidemic obesity and type 2 diabetes in Asia',
                    journal: 'The Lancet, 368(9548), 1681–1688',
                    url: 'https://doi.org/10.1016/S0140-6736(06)69703-1',
                  },
                  {
                    num: 21,
                    authors: 'International Diabetes Federation.',
                    year: '2021',
                    title: 'IDF Diabetes Atlas (10th ed.)',
                    journal: 'International Diabetes Federation',
                    url: 'https://www.diabetesatlas.org',
                  },
                  {
                    num: 22,
                    authors: 'Food and Nutrition Research Institute – Department of Science and Technology (FNRI-DOST).',
                    year: '2019',
                    title: '2018 Expanded National Nutrition Survey (ENNS): Highlights',
                    journal: 'Taguig City: FNRI-DOST, Republic of the Philippines',
                    url: 'https://www.fnri.dost.gov.ph',
                  },
                ].map((ref) => (
                  <View key={ref.num} style={styles.referenceItem}>
                    <Text style={styles.referenceNum}>[{ref.num}]</Text>
                    <View style={styles.referenceTextBlock}>
                      <Text style={styles.referenceText}>
                        {ref.authors} ({ref.year}). {ref.title}. <Text style={styles.referenceJournal}>{ref.journal}.</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(ref.url)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.referenceUrl}>{ref.url}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>}
            </View>
          )}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PredictionScreen;
