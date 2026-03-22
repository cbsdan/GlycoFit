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
import { getMyAssessment, getOverallRiskAssessment, refreshOverallRiskAssessment, getOverallRiskPrediction, getLifestyleRecommendations, getProfile } from '../services/api';

const { width } = Dimensions.get('window');
const SHOW_MOCK_PRESET_PREVIEW = false;

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
  const [resolvedDiagnosisStatus, setResolvedDiagnosisStatus] = useState((user?.diagnosis_status || '').toLowerCase());
  const [isMockPreview, setIsMockPreview] = useState(false);
  const [activeMockPreset, setActiveMockPreset] = useState(null);

  // Use resolved diagnosis status (fresh profile) to avoid stale auth-state gating.
  const isDiagnosed = resolvedDiagnosisStatus === 'prediabetes' || resolvedDiagnosisStatus === 'type2_diabetes';
  const isType2User = resolvedDiagnosisStatus === 'type2_diabetes';

  useEffect(() => {
    setResolvedDiagnosisStatus((user?.diagnosis_status || '').toLowerCase());
  }, [user?.diagnosis_status]);

  useFocusEffect(
    React.useCallback(() => {
      loadAssessment();
    }, [user?.diagnosis_status])
  );

  useEffect(() => {
    const fetchTrendPrediction = async () => {
      try {
        if (isType2User) {
          // Trend prediction is not applicable in this assessment view for diagnosed Type 2 users.
          setTrendPrediction(null);
          return;
        }
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
  }, [isType2User]);

  const loadAssessment = async () => {
    try {
      // Resolve latest diagnosis from profile to avoid stale UI after profile edits.
      let effectiveDiagnosisStatus = (user?.diagnosis_status || '').toLowerCase();
      try {
        const profileRes = await getProfile(true);
        const latestDiagnosis = (
          profileRes?.profile?.diagnosis_status ||
          profileRes?.data?.diagnosis_status ||
          profileRes?.user?.diagnosis_status ||
          ''
        ).toLowerCase();
        if (latestDiagnosis) {
          effectiveDiagnosisStatus = latestDiagnosis;
        }
      } catch (profileError) {
        console.log('Could not refresh profile diagnosis for assessment view:', profileError);
      }

      setResolvedDiagnosisStatus(effectiveDiagnosisStatus);
      const effectiveIsType2User = effectiveDiagnosisStatus === 'type2_diabetes';

      // Only show loading spinner if we don't have data yet (first load)
      if (!assessment && !overallRisk) {
        setLoading(true);
      }

      // Load initial diabetes assessment (uses cache if available)
      const result = await getMyAssessment();
      if (result && result.assessment) {
        setAssessment(result.assessment);

        if (effectiveIsType2User) {
          setOverallRisk({
            overall_risk_score: 0,
            overall_risk_category: 'maintenance',
            category_info: {
              title: 'Maintenance Mode',
              color: '#7F8C8D',
              icon: 'shield-heart-outline',
              probability: 'Risk scoring is disabled in this view for Type 2 Diabetes',
              message: 'Focus on daily diabetes management behaviors and clinical follow-up.'
            },
            model_used: false,
            model_eligibility: {
              should_use_model: false,
              diagnosis_status: 'type2_diabetes'
            }
          });
          return;
        }

        // Prefer lifestyle model risk output for the Assessment tab.
        try {
          const lifestyleResult = await getLifestyleRecommendations(30, false);
          if (lifestyleResult && lifestyleResult.success && lifestyleResult.data) {
            setOverallRisk(lifestyleResult.data);
            setIsMockPreview(false);
            setActiveMockPreset(null);
          } else {
            // Fallback to comprehensive risk endpoint if lifestyle endpoint is unavailable.
            const overallResult = await getOverallRiskAssessment();
            if (overallResult && overallResult.success && overallResult.data) {
              setOverallRisk(overallResult.data);
            }
          }
        } catch (overallError) {
          console.log('Lifestyle risk not available, trying comprehensive endpoint:', overallError);
          try {
            const overallResult = await getOverallRiskAssessment();
            if (overallResult && overallResult.success && overallResult.data) {
              setOverallRisk(overallResult.data);
            }
          } catch (fallbackError) {
            console.log('Overall risk not available yet:', fallbackError);
          }
        }
      } else {
        setAssessment(null);

        if (effectiveIsType2User) {
          setOverallRisk({
            overall_risk_score: 0,
            overall_risk_category: 'maintenance',
            category_info: {
              title: 'Maintenance Mode',
              color: '#7F8C8D',
              icon: 'shield-heart-outline',
              probability: 'Risk scoring is disabled in this view for Type 2 Diabetes',
              message: 'Focus on daily diabetes management behaviors and clinical follow-up.'
            },
            model_used: false,
            model_eligibility: {
              should_use_model: false,
              diagnosis_status: 'type2_diabetes'
            }
          });
          return;
        }

        // Still try to load lifestyle risk output even if initial assessment is missing.
        try {
          const lifestyleResult = await getLifestyleRecommendations(30, false);
          if (lifestyleResult && lifestyleResult.success && lifestyleResult.data) {
            setOverallRisk(lifestyleResult.data);
            setIsMockPreview(false);
            setActiveMockPreset(null);
          } else {
            setOverallRisk(null);
          }
        } catch (e) {
          setOverallRisk(null);
        }
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
      case 'no_data':
        return {
          label: 'NO DATA',
          icon: 'chart-line-variant',
          color: '#7F8C8D',
          gradient: ['#95A5A6', '#7F8C8D'],
          badgeText: 'Add Logs to Start',
        };
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
      setIsMockPreview(false);
      setActiveMockPreset(null);
      // Refresh by re-fetching lifestyle recommendations first.
      let updated = false;

      try {
        const lifestyleResult = await getLifestyleRecommendations(30, false);
        if (lifestyleResult && lifestyleResult.success && lifestyleResult.data) {
          setOverallRisk(lifestyleResult.data);
          updated = true;
        }
      } catch (lifestyleError) {
        console.log('Lifestyle refresh failed, trying comprehensive refresh:', lifestyleError);
      }

      if (!updated) {
        const result = await refreshOverallRiskAssessment();
        if (result && result.success && result.data) {
          setOverallRisk(result.data);
          updated = true;
        }
      }

      if (updated) {
        Alert.alert('Success', 'Your risk assessment has been updated.');
      } else {
        Alert.alert('Notice', 'No updated risk data is available yet.');
      }
    } catch (error) {
      console.log('Error refreshing overall risk:', error);
      Alert.alert('Error', 'Failed to refresh risk assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTryMockPreview = async (preset = 'moderate') => {
    try {
      setLoading(true);
      const lifestyleResult = await getLifestyleRecommendations(30, true, preset);
      const presetLabels = {
        conservative: 'Good BMI/Age + Bad Lifestyle',
        moderate: 'Older/High BMI + Good Lifestyle',
        aggressive: 'Random Mix',
      };
      if (lifestyleResult && lifestyleResult.success && lifestyleResult.data) {
        setOverallRisk(lifestyleResult.data);
        setIsMockPreview(true);
        const resolvedPreset = lifestyleResult?.data?.mock_info?.preset || preset;
        setActiveMockPreset(resolvedPreset);
        Alert.alert(
          'Mock Preview Enabled',
          `Using ${presetLabels[resolvedPreset] || resolvedPreset} temporary inputs for preview. No database records were created.`
        );
      } else {
        Alert.alert('Notice', 'Unable to load mock preview right now.');
      }
    } catch (error) {
      console.log('Error loading mock preview:', error);
      Alert.alert('Error', 'Failed to load mock preview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseRealData = async () => {
    setIsMockPreview(false);
    setActiveMockPreset(null);
    await loadAssessment();
  };

  const handleOpenMockPresetPicker = () => {
    Alert.alert(
      'Choose Mock Preset',
      'Select a mock scenario to preview possible risk changes without saving data.',
      [
        { text: 'Good BMI/Age + Bad Lifestyle', onPress: () => handleTryMockPreview('conservative') },
        { text: 'Older/High BMI + Good Lifestyle', onPress: () => handleTryMockPreview('moderate') },
        { text: 'Random Mix', onPress: () => handleTryMockPreview('aggressive') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const mockPresetLabels = {
    conservative: 'Good BMI/Age + Bad Lifestyle',
    moderate: 'Older/High BMI + Good Lifestyle',
    aggressive: 'Random Mix',
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
    mockPreviewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2C3E50',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      gap: 8,
      marginBottom: 10,
    },
    mockPreviewButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    mockBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFF8E1',
      borderWidth: 1,
      borderColor: '#F1C40F',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 10,
      gap: 10,
    },
    mockBannerText: {
      flex: 1,
      fontSize: 12,
      color: '#7D6608',
      lineHeight: 16,
    },
    mockBannerAction: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textDecorationLine: 'underline',
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
    qualityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 8,
    },
    qualityRowLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      minWidth: 72,
      marginTop: 1,
    },
    qualityRowValue: {
      flex: 1,
      fontSize: 12,
      color: colors.secondary,
      lineHeight: 18,
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

  const trackerLabelMap = {
    food: 'Food',
    activity: 'Physical Activity',
    alcohol: 'Alcohol',
    sleep: 'Sleep',
    smoking: 'Smoking',
  };

  const includedTrackerLabels = (overallRisk?.trackers_analyzed || [])
    .map((key) => trackerLabelMap[key] || key)
    .filter(Boolean);

  const missingTrackerLabels = (overallRisk?.trackers_missing || [])
    .map((key) => trackerLabelMap[key] || key)
    .filter(Boolean);

  const profileInputs = overallRisk?.model_inputs?.profile || {};
  const hasAgeInput = profileInputs.age !== undefined && profileInputs.age !== null;
  const hasBmiInput = profileInputs.bmi !== undefined && profileInputs.bmi !== null;

  const includedProfileLabels = [
    hasAgeInput ? `Age (${Number(profileInputs.age).toFixed(0)})` : null,
    hasBmiInput ? `BMI (${Number(profileInputs.bmi).toFixed(1)})` : null,
  ].filter(Boolean);

  const missingProfileLabels = [
    hasAgeInput ? null : 'Age',
    hasBmiInput ? null : 'BMI',
  ].filter(Boolean);

  const diagnosisStatus = resolvedDiagnosisStatus;
  const modelUsed = overallRisk?.model_used;
  const modelEligible = overallRisk?.model_eligibility?.should_use_model;
  const hideLifestyleModelOutput = isType2User && (modelUsed === false || modelEligible === false);
  const hasMissingModelTrackers = (overallRisk?.trackers_missing || []).some((k) => ['food', 'activity', 'alcohol'].includes(k));
  const categoryInfo = overallRisk?.category_info || {
    title: 'Unknown',
    color: colors.secondary,
    icon: 'help-circle',
    probability: '',
    message: '',
  };
  const overallRiskScoreValue = Number.isFinite(Number(overallRisk?.overall_risk_score))
    ? Number(overallRisk.overall_risk_score)
    : 0;

  const formulaRowMeta = {
    bmi: {
      label: 'BMI / Obesity',
      note: 'Strongest predictor in this Health Summary path; uses WHO Asian cutoffs (>=23 = overweight for Filipinos).',
      url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
      fallbackWeight: '40.01%',
    },
    age: {
      label: 'Age',
      note: 'Risk rises with age and is treated as a major non-modifiable predictor in this trained-model path.',
      url: 'https://doi.org/10.1371/journal.pone.0194127',
      fallbackWeight: '36.54%',
    },
    food: {
      label: 'Food Intake Quality',
      note: 'Food pattern contribution from glycemic load, fiber, added sugar, and calorie patterns.',
      url: 'https://doi.org/10.2337/dc10-1079',
      fallbackWeight: '11.75%',
    },
    activity: {
      label: 'Physical Activity (Steps)',
      note: 'Physical inactivity is a key modifiable diabetes risk factor.',
      url: 'https://doi.org/10.1007/s10654-015-0056-z',
      fallbackWeight: '5.98%',
    },
    alcohol: {
      label: 'Alcohol Consumption',
      note: 'Alcohol contributes with a smaller but meaningful weighted impact in this model path.',
      url: 'https://doi.org/10.2337/dc09-0227',
      fallbackWeight: '5.72%',
    },
  };

  const formulaDisplayOrder = ['bmi', 'age', 'food', 'activity', 'alcohol'];
  const formulaRows = formulaDisplayOrder.map((componentKey) => {
    const meta = formulaRowMeta[componentKey];
    const weightValue = Number(overallRisk?.component_scores?.[componentKey]?.weight);
    const weight = Number.isFinite(weightValue) && weightValue > 0
      ? `${(weightValue * 100).toFixed(2)}%`
      : meta.fallbackWeight;

    return {
      label: meta.label,
      weight,
      note: meta.note,
      url: meta.url,
    };
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
                      {hideLifestyleModelOutput ? 'Maintenance Summary' : (isDiagnosed ? 'Health Summary' : 'Risk Assessment')}
                    </Text>
                  </View>
                  {!hideLifestyleModelOutput ? (
                    <View style={styles.overallRiskScoreSection}>
                      <View style={[styles.overallRiskScoreCircle, { borderColor: categoryInfo.color }]}>
                        <Text style={[styles.overallRiskScoreValue, { color: categoryInfo.color }]}>
                          {overallRiskScoreValue.toFixed(1)}
                        </Text>
                        <Text style={styles.overallRiskScoreLabel}>/ 100</Text>
                      </View>
                      <View style={styles.overallRiskScoreInfo}>
                        <View style={[styles.overallRiskBadge, { backgroundColor: categoryInfo.color }]}>
                          <Icon name={categoryInfo.icon} size={16} color="#FFFFFF" />
                          <Text style={styles.overallRiskBadgeText}>{categoryInfo.title}</Text>
                        </View>
                        <Text style={[styles.overallRiskProbability, { color: colors.secondary }]}>
                          {categoryInfo.probability}
                        </Text>
                        <Text style={[styles.overallRiskMessage, { color: colors.secondary }]}>
                          {categoryInfo.message}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.dataQualitySection}>
                      <View style={styles.dataQualityHeader}>
                        <Icon name="shield-heart-outline" size={18} color={colors.secondary} />
                        <Text style={styles.dataQualityTitle}>Maintenance Mode</Text>
                      </View>
                      <Text style={styles.dataQualityText}>
                        Because your profile is set to Type 2 Diabetes, the lifestyle ML risk score is disabled for this view. Focus on keeping your daily lifestyle factors as controlled as possible.
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.refreshOverallButton}
                    onPress={handleRefreshOverallRisk}
                    activeOpacity={0.7}
                  >
                    <Icon name="refresh" size={18} color={colors.primary} />
                    <Text style={styles.refreshOverallButtonText}>Refresh Assessment</Text>
                  </TouchableOpacity>

                  {SHOW_MOCK_PRESET_PREVIEW && !hideLifestyleModelOutput && hasMissingModelTrackers && !isMockPreview && (
                    <TouchableOpacity
                      style={styles.mockPreviewButton}
                      onPress={handleOpenMockPresetPicker}
                      activeOpacity={0.7}
                    >
                      <Icon name="test-tube" size={18} color="#FFFFFF" />
                      <Text style={styles.mockPreviewButtonText}>Try Mock Presets Preview</Text>
                    </TouchableOpacity>
                  )}

                  {!hideLifestyleModelOutput && isMockPreview && (
                    <View style={styles.mockBanner}>
                      <Text style={styles.mockBannerText}>
                        Mock preview is active ({mockPresetLabels[activeMockPreset || 'moderate'] || 'Custom'} preset, no data saved).
                      </Text>
                      <TouchableOpacity onPress={handleUseRealData} activeOpacity={0.7}>
                        <Text style={styles.mockBannerAction}>Use Real Data</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Risk Factor Breakdown - all tracked components, color-coded */}
                  {!hideLifestyleModelOutput && overallRisk.primary_risk_factors && overallRisk.primary_risk_factors.length > 0 && (
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

                  {!hideLifestyleModelOutput && overallRisk.recommendations && overallRisk.recommendations.length > 0 && (
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

                  {!hideLifestyleModelOutput && overallRisk.data_quality_notes && (
                    <View style={styles.dataQualitySection}>
                      <View style={styles.dataQualityHeader}>
                        <Icon name="information-outline" size={18} color={colors.secondary} />
                        <Text style={styles.dataQualityTitle}>Data Quality Notes</Text>
                      </View>
                      <Text style={styles.dataQualityText}>{overallRisk.data_quality_notes}</Text>

                      <View style={styles.qualityRow}>
                        <Text style={styles.qualityRowLabel}>Included</Text>
                        <Text style={styles.qualityRowValue}>
                          {[
                            includedTrackerLabels.length ? `Trackers: ${includedTrackerLabels.join(', ')}` : null,
                            includedProfileLabels.length ? `Profile: ${includedProfileLabels.join(', ')}` : null,
                          ].filter(Boolean).join(' | ') || 'None'}
                        </Text>
                      </View>

                      <View style={styles.qualityRow}>
                        <Text style={styles.qualityRowLabel}>Missing</Text>
                        <Text style={styles.qualityRowValue}>
                          {[
                            missingTrackerLabels.length ? `Trackers: ${missingTrackerLabels.join(', ')}` : null,
                            missingProfileLabels.length ? `Profile: ${missingProfileLabels.join(', ')}` : null,
                          ].filter(Boolean).join(' | ') || 'None'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ===== Health Trajectory Prediction ===== */}
                  {!hideLifestyleModelOutput && (
                    <Text style={styles.predictionSectionTitle}>Health Trajectory Prediction</Text>
                  )}

                  {!hideLifestyleModelOutput && (trendLoading ? (
                    <View style={styles.trendLoadingBox}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.trendLoadingText}>Analysing your lifestyle trends…</Text>
                    </View>
                  ) : trendPrediction ? (() => {
                    if (trendPrediction.status === 'no_data') {
                      return (
                        <View style={styles.trendLoadingBox}>
                          <Icon name="chart-line-variant" size={32} color={colors.secondary} />
                          <Text style={[styles.trendLoadingText, { textAlign: 'center' }]}>
                            No trajectory output yet. Log activity, alcohol, and diet entries to unlock trend analysis.
                          </Text>
                        </View>
                      );
                    }

                    const tc = getTrendConfig();
                    const forecast30 = trendPrediction.forecast?.days_30;
                    const forecast90 = trendPrediction.forecast?.days_90;
                    const componentTrends = trendPrediction.component_trends || {};
                    const drivingFactors = trendPrediction.driving_factors || [];
                    const aiRecommendations = trendPrediction.ai_recommendations || [];
                    const componentKeys = ['steps', 'alcohol', 'food'];
                    const componentLabels = {
                      steps: 'Activity',
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

                        {aiRecommendations.length > 0 && (
                          <>
                            <View style={[styles.predictionDivider, { marginTop: 4 }]} />
                            <Text style={styles.drivingFactorsTitle}>Personalized Recommendations (AHA)</Text>
                            {aiRecommendations.map((rec, idx) => (
                              <View key={idx} style={styles.drivingFactorItem}>
                                <View style={[styles.drivingFactorDot, { backgroundColor: colors.primary }]} />
                                <Text style={styles.drivingFactorText}>
                                  <Text style={{ fontWeight: '600', color: colors.text }}>
                                    {rec.recommendation}
                                  </Text>
                                  {'\n'}{rec.rationale}
                                  {'\n'}
                                  <Text style={{ fontStyle: 'italic' }}>
                                    Source: {rec.reference_title}
                                  </Text>
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
                  ))}
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

        {/* ===== Pre-Diabetes Risk Computation Table ===== */}
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
                  In this Health Summary view, weighted contributions are aligned with the trained
                  model components: BMI, Age, Food Intake, Physical Activity, and Alcohol.
                </Text>
              </View>

              <Text style={styles.computationSectionLabel}>Model Validation Snapshot</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2.1 }]}>Metric</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.1 }]}>Baseline</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.2 }]}>Enhanced</Text>
                </View>
                {[
                  { metric: 'Accuracy', baseline: '70.43%', enhanced: '72.48%' },
                  { metric: 'Healthy Precision', baseline: '0.72', enhanced: '0.74' },
                  { metric: 'Healthy Recall', baseline: '0.68', enhanced: '0.70' },
                  { metric: 'At-Risk Precision', baseline: '0.69', enhanced: '0.71' },
                  { metric: 'At-Risk Recall', baseline: '0.73', enhanced: '0.75' },
                ].map((row, idx) => (
                  <View
                    key={row.metric}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                    ]}
                  >
                    <Text style={[styles.tableCell, { flex: 2.1 }]}>{row.metric}</Text>
                    <Text style={[styles.tableCell, { flex: 1.1 }]}>{row.baseline}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '700', color: '#1F618D' }]}>{row.enhanced}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                Balanced dataset: 438,842 rows (219,421 Healthy, 219,421 At-Risk). Enhanced confusion matrix: 30,762 true healthy, 32,851 true at-risk, 13,123 false positives, 11,033 false negatives.
              </Text>

              <Text style={styles.computationSectionLabel}>Dataset Risk Profiles (Observed)</Text>
              <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>Segment</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.3 }]}>At-Risk Rate</Text>
                </View>
                {[
                  { segment: 'Age: Under 30', rate: '14.3%' },
                  { segment: 'Age: 30-44', rate: '21.1%' },
                  { segment: 'Age: 45-59', rate: '35.2%' },
                  { segment: 'Age: 60+', rate: '42.3%' },
                  { segment: 'BMI: Normal (<25)', rate: '12.4%' },
                  { segment: 'BMI: Overweight (25-29.9)', rate: '28.4%' },
                  { segment: 'BMI: Obese I (30-34.9)', rate: '36.9%' },
                  { segment: 'BMI: Obese II+ (35+)', rate: '46.6%' },
                  { segment: 'Activity: Active (Level 1)', rate: '30.0%' },
                  { segment: 'Activity: Sedentary (Level 2)', rate: '23.9%' },
                ].map((row, idx) => (
                  <View
                    key={row.segment}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                    ]}
                  >
                    <Text style={[styles.tableCell, { flex: 2 }]}>{row.segment}</Text>
                    <Text style={[styles.tableCell, { flex: 1.3, fontWeight: '700' }]}>{row.rate}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.secondary, marginTop: 5, marginBottom: 2, fontStyle: 'italic' }}>
                These are observed cohort rates used for transparency and context; they are not direct per-user probability outputs.
              </Text>

              {/* ── Formula ── */}
              <Text style={styles.computationSectionLabel}>Weighted Risk Formula</Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaTitle}>Overall Risk Score (0 – 100)</Text>
                <View style={styles.formulaDivider} />
                {formulaRows.map((row, idx) => (
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
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PredictionScreen;
