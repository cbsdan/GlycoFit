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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getMyAssessment } from '../services/api';

const { width } = Dimensions.get('window');

const PredictionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadAssessment();
    }, [])
  );

  const loadAssessment = async () => {
    try {
      setLoading(true);
      const result = await getMyAssessment();
      if (result && result.assessment) {
        setAssessment(result.assessment);
      } else {
        setAssessment(null);
      }
    } catch (error) {
      console.log('Error loading assessment:', error);
      setAssessment(null);
    } finally {
      setLoading(false);
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
      default:
        return {
          title: 'Unknown',
          color: colors.secondary,
          icon: 'help-circle',
          message: 'Risk level unknown',
        };
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
        ) : assessment ? (
          <View style={styles.resultSection}>
            <TouchableOpacity
              style={styles.resultCard}
              onPress={() => handlePredictionTap('diabetes-assessment')}
              activeOpacity={0.7}
            >
              <View style={styles.resultHeader}>
                <View style={[styles.resultIconContainer, { backgroundColor: `${getRiskConfig(assessment.prediction.risk_level).color}15` }]}>
                  <Icon name={getRiskConfig(assessment.prediction.risk_level).icon} size={32} color={getRiskConfig(assessment.prediction.risk_level).color} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultLabel}>Your Assessment Result</Text>
                  <Text style={[styles.resultTitle, { color: getRiskConfig(assessment.prediction.risk_level).color }]}>
                    {getRiskConfig(assessment.prediction.risk_level).title}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.resultMessage, { color: colors.secondary }]}>
                {getRiskConfig(assessment.prediction.risk_level).message}
              </Text>
              
              <View style={styles.resultStats}>
                <View style={styles.resultStat}>
                  <Text style={[styles.resultStatLabel, { color: colors.secondary }]}>Risk Percentage</Text>
                  <Text style={[styles.resultStatValue, { color: colors.text }]}>
                    {(assessment.prediction.percentage).toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.resultStat}>
                  <Text style={[styles.resultStatLabel, { color: colors.secondary }]}>Confidence</Text>
                  <Text style={[styles.resultStatValue, { color: colors.text }]}>
                    {(assessment.prediction.confidence).toFixed(2)}%
                  </Text>
                </View>
              </View>
              
              <View style={styles.resultFooter}>
                <Text style={[styles.resultFooterText, { color: colors.primary }]}>View Full Report</Text>
                <Icon name="arrow-right" size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
            
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
              <Icon name="refresh" size={20} color={colors.text} />
              <Text style={[styles.retakeButtonText, { color: colors.text }]}>Retake Assessment</Text>
            </TouchableOpacity>
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
