import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AssessmentResultsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { prediction, isUpdate } = route.params || {};

  if (!prediction) {
    navigation.goBack();
    return null;
  }

  const { risk_level, percentage, confidence } = prediction;

  const getRiskConfig = () => {
    switch (risk_level) {
      case 'low':
        return {
          title: 'Low Risk',
          color: '#27AE60',
          gradient: ['#27AE60', '#2ECC71'],
          icon: 'check-circle',
          message: 'Your diabetes risk is low based on the assessment.',
          recommendations: [
            'Maintain your healthy lifestyle habits',
            'Continue regular physical activity',
            'Keep a balanced diet rich in fruits and vegetables',
            'Schedule routine health checkups',
          ],
        };
      case 'moderate':
        return {
          title: 'Moderate Risk',
          color: '#F39C12',
          gradient: ['#F39C12', '#F1C40F'],
          icon: 'alert-circle',
          message: 'You have a moderate risk of developing diabetes.',
          recommendations: [
            'Consult with a healthcare provider',
            'Increase physical activity to 150 minutes per week',
            'Monitor your blood sugar levels regularly',
            'Consider dietary modifications to reduce sugar intake',
            'Manage stress through relaxation techniques',
          ],
        };
      case 'high':
        return {
          title: 'High Risk',
          color: '#E74C3C',
          gradient: ['#E74C3C', '#C0392B'],
          icon: 'alert-octagon',
          message: 'Your assessment indicates a high risk of diabetes.',
          recommendations: [
            'Schedule an appointment with a healthcare provider immediately',
            'Get a comprehensive blood glucose screening',
            'Work with a dietitian for a personalized meal plan',
            'Start a supervised exercise program',
            'Monitor blood pressure and cholesterol levels',
            'Consider joining a diabetes prevention program',
          ],
        };
      default:
        return {
          title: 'Unknown',
          color: colors.secondary,
          gradient: [colors.secondary, colors.secondary],
          icon: 'help-circle',
          message: 'Unable to determine risk level.',
          recommendations: [],
        };
    }
  };

  const riskConfig = getRiskConfig();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    resultCard: {
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 5,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    riskTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 12,
    },
    percentageText: {
      fontSize: 48,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    probabilityLabel: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 16,
    },
    confidenceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    confidenceText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    messageCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageText: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    recommendationCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
    },
    recommendationIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${riskConfig.color}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recommendationText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    actionsContainer: {
      marginTop: 8,
      gap: 12,
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    actionButtonSecondary: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    actionButtonTextSecondary: {
      color: colors.primary,
    },
    updateBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'center',
      marginBottom: 16,
    },
    updateBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assessment Results</Text>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => navigation.navigate('Main', { screen: 'Predictions' })}
        >
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {isUpdate && (
          <View style={styles.updateBadge}>
            <Text style={styles.updateBadgeText}>ASSESSMENT UPDATED</Text>
          </View>
        )}

        <LinearGradient
          colors={riskConfig.gradient}
          style={styles.resultCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.iconContainer}>
            <Icon name={riskConfig.icon} size={50} color="#FFFFFF" />
          </View>

          <Text style={styles.riskTitle}>{riskConfig.title}</Text>
          <Text style={styles.percentageText}>{percentage.toFixed(1)}%</Text>
          <Text style={styles.probabilityLabel}>Diabetes Probability</Text>

          <View style={styles.confidenceContainer}>
            <Icon name="check-decagram" size={16} color="#FFFFFF" />
            <Text style={styles.confidenceText}>
              {confidence.toFixed(0)}% Confidence
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>{riskConfig.message}</Text>
        </View>

        <Text style={styles.sectionTitle}>Recommendations</Text>

        {riskConfig.recommendations.map((recommendation, index) => (
          <View key={index} style={styles.recommendationCard}>
            <View style={styles.recommendationIcon}>
              <Icon name="check" size={16} color={riskConfig.color} />
            </View>
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}

        <View style={styles.actionsContainer}>
          {risk_level !== 'low' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('FindPhysician')}
            >
              <Icon name="doctor" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Find a Physician</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.goBack()}
          >
            <Icon name="pencil" size={20} color={colors.primary} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Review Answers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('Main', { screen: 'Predictions' })}
          >
            <Icon name="home" size={20} color={colors.primary} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AssessmentResultsScreen;
