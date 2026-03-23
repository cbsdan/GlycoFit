import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { 
  saveAlcoholIntake,   // legacy, kept for reference
  getAlcoholIntake,
  getAlcoholRiskAssessment,
  getAlcoholIntakeHistory,
  deleteAlcoholIntake,
  createAlcoholBaseline,
  updateAlcoholBaseline,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LifestyleRecommendationsSection } from '../components/recommendations';

/**
 * Alcohol Intake Tracker Screen
 * 
 * WHO/ADA-aligned questionnaire for tracking alcohol consumption patterns
 * for diabetes risk assessment.
 * 
 * Standard Drink Definition (14g pure alcohol):
 * - 12 oz (355ml) Beer (5% ABV)
 * - 5 oz (148ml) Wine (12% ABV)
 * - 1.5 oz (44ml) Spirits (40% ABV)
 * 
 * Binge Drinking Thresholds (NIAAA):
 * - Women: ≥4 drinks per occasion
 * - Men: ≥5 drinks per occasion
 */

const AlcoholIntakeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form data
  const [averageDrinksPerDay, setAverageDrinksPerDay] = useState('');
  const [drinkingDaysPerWeek, setDrinkingDaysPerWeek] = useState('');
  const [bingeFrequency, setBingeFrequency] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showStandardDrinkInfo, setShowStandardDrinkInfo] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [hasDataToday, setHasDataToday] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // User gender for binge drinking threshold
  const userGender = user?.gender?.toLowerCase() || 'male';
  const bingeDrinkThreshold = userGender === 'female' ? 4 : 5;

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      setLoadingData(true);
      const response = await getAlcoholIntake();
      
      if (response.success && response.data) {
        const data = response.data;
        setCurrentData(data);
        setAverageDrinksPerDay(data.average_drinks_per_day?.toString() || '');
        setDrinkingDaysPerWeek(data.drinking_days_per_week?.toString() || '');
        setBingeFrequency(data.binge_frequency_per_month?.toString() || '');
        
        // Check if data was updated today
        if (data.last_updated) {
          const lastUpdate = new Date(data.last_updated);
          const today = new Date();
          const isToday = lastUpdate.toDateString() === today.toDateString();
          setHasDataToday(isToday);
          setLastUpdated(lastUpdate);
        }
      }
    } catch (error) {
      console.log('No existing alcohol intake data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Assessment',
      'Are you sure you want to delete your alcohol intake assessment? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await deleteAlcoholIntake();
              if (response.success) {
                setAverageDrinksPerDay('');
                setDrinkingDaysPerWeek('');
                setBingeFrequency('');
                setLastUpdated(null);
                setHasDataToday(false);
                setCurrentData(null);
                Alert.alert('Success', 'Your alcohol intake assessment has been deleted.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete assessment. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const steps = [
    {
      id: 'average_drinks',
      title: 'Average Drinks per Day',
      question: 'On average, how many standard alcoholic drinks do you consume on a typical drinking day?',
      subtitle: 'A standard drink contains 14g of pure alcohol',
      helpText: 'Tap the info icon to learn what counts as one standard drink',
      placeholder: 'Enter number (0-20)',
      value: averageDrinksPerDay,
      setValue: setAverageDrinksPerDay,
      keyboardType: 'decimal-pad',
      min: 0,
      max: 20,
      step: 0.5,
      accessibilityLabel: 'Average drinks per drinking day input',
      accessibilityHint: 'Enter the average number of standard drinks you consume on days when you drink alcohol',
    },
    {
      id: 'drinking_days',
      title: 'Drinking Frequency',
      question: 'How many days per week do you usually drink alcohol?',
      subtitle: 'Count only days when you consume any alcohol',
      placeholder: 'Enter number (0-7)',
      value: drinkingDaysPerWeek,
      setValue: setDrinkingDaysPerWeek,
      keyboardType: 'number-pad',
      min: 0,
      max: 7,
      step: 1,
      accessibilityLabel: 'Drinking days per week input',
      accessibilityHint: 'Enter the number of days per week you typically consume alcohol',
    },
    {
      id: 'binge_frequency',
      title: 'Binge Drinking Episodes',
      question: `In the past 30 days, how many times did you consume ${bingeDrinkThreshold}+ drinks on one occasion?`,
      subtitle: userGender === 'female' 
        ? 'For women: ≥4 drinks within ~2 hours' 
        : 'For men: ≥5 drinks within ~2 hours',
      helpText: 'Binge drinking is consuming multiple drinks in a short time period, leading to blood alcohol concentration ≥0.08%',
      placeholder: 'Enter number (0-31)',
      value: bingeFrequency,
      setValue: setBingeFrequency,
      keyboardType: 'number-pad',
      min: 0,
      max: 31,
      step: 1,
      accessibilityLabel: 'Binge drinking frequency input',
      accessibilityHint: `Enter how many times in the past month you consumed ${bingeDrinkThreshold} or more drinks in one sitting`,
    },
  ];

  const currentStepData = steps[currentStep];

  const validateInput = (value, step) => {
    const numValue = parseFloat(value);
    
    if (value === '') {
      return { valid: true, error: null };
    }
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'Please enter a valid number' };
    }
    
    if (numValue < step.min) {
      return { valid: false, error: `Value cannot be less than ${step.min}` };
    }
    
    if (numValue > step.max) {
      return { valid: false, error: `Value cannot exceed ${step.max}` };
    }
    
    return { valid: true, error: null };
  };

  const handleNext = () => {
    const validation = validateInput(currentStepData.value, currentStepData);
    
    if (!validation.valid) {
      Alert.alert('Invalid Input', validation.error);
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      // Skip this question, move to next
      currentStepData.setValue('0');
      setCurrentStep(currentStep + 1);
    } else {
      // Last question - skip and go back
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    // Check if user already has an assessment
    if (currentData) {
      Alert.alert(
        'Update Assessment?',
        'You already have an alcohol intake assessment. Updating will replace your previous assessment with this new one.\n\nLast updated: ' + (lastUpdated ? lastUpdated.toLocaleDateString() : 'Unknown'),
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Update',
            onPress: () => submitAssessment(),
          },
        ]
      );
      return;
    }
    
    submitAssessment();
  };

  const submitAssessment = async () => {
    try {
      setLoading(true);

      // Validate all inputs
      const avgDrinks = averageDrinksPerDay === '' ? 0 : parseFloat(averageDrinksPerDay);
      const drinkDays = drinkingDaysPerWeek === '' ? 0 : parseInt(drinkingDaysPerWeek);
      const bingeDays = bingeFrequency === '' ? 0 : parseInt(bingeFrequency);

      // Save to alcohol baseline using the correct API (upsert: try update first, create on 404)
      // Fields map: drinks_per_occasion ≈ average_drinks_per_day
      let saveResponse;
      try {
        saveResponse = await updateAlcoholBaseline(drinkDays, avgDrinks, bingeDays);
      } catch (updateError) {
        if (updateError?.response?.status === 404) {
          // No baseline yet — create it
          saveResponse = await createAlcoholBaseline(drinkDays, avgDrinks, bingeDays);
        } else {
          throw updateError;
        }
      }

      // Get risk assessment — returns raw assessment object (no .success/.data wrapper)
      const assessmentResponse = await getAlcoholRiskAssessment();

      if (assessmentResponse && assessmentResponse.risk_category !== undefined) {
        setRiskAssessment(assessmentResponse);
        setShowResults(true);
      } else {
        // Show success even if assessment fetch fails
        Alert.alert(
          'Success',
          'Your alcohol intake has been recorded successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error saving alcohol intake:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save your alcohol intake. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (category) => {
    const colors = {
      none: '#27AE60',
      low: '#3498DB',
      light: '#3498DB',
      moderate: '#F39C12',
      high: '#E67E22',
      heavy: '#E67E22',
      very_high: '#E74C3C',
      very_heavy: '#E74C3C',
      binge: '#E74C3C',
    };
    return colors[category?.toLowerCase()] || '#95A5A6';
  };

  const getRiskIcon = (category) => {
    const icons = {
      none: 'check-circle',
      low: 'information',
      light: 'information',
      moderate: 'alert',
      high: 'alert-circle',
      heavy: 'alert-circle',
      very_high: 'alert-octagon',
      very_heavy: 'alert-octagon',
      binge: 'alert-octagon',
    };
    return icons[category?.toLowerCase()] || 'help-circle';
  };

  // Define styles before any conditional returns
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      padding: 16,
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.secondary,
    },
    diagnosedMessageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      marginTop: 40,
    },
    diagnosedTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
      marginBottom: 16,
      textAlign: 'center',
    },
    diagnosedMessage: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    diagnosedBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    diagnosedBannerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    guidelinesCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
    },
    guidelinesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    guidelinesTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    guidelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    guidelineText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    actionButtonsContainer: {
      gap: 12,
      marginBottom: 16,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      padding: 8,
    },
    lastUpdatedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: `${colors.primary}10`,
    },
    lastUpdatedText: {
      fontSize: 12,
      color: colors.secondary,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    summaryContent: {
      marginTop: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginBottom: 4,
      textAlign: 'center',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    trendIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    trendText: {
      fontSize: 13,
      fontWeight: '600',
    },
    progressContainer: {
      padding: 16,
      backgroundColor: colors.card,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    progressText: {
      marginTop: 8,
      fontSize: 12,
      color: colors.secondary,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    stepQuestion: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      lineHeight: 26,
    },
    stepSubtitle: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 16,
    },
    helpTextContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: `${colors.primary}10`,
      borderRadius: 8,
      marginBottom: 24,
    },
    helpText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      marginLeft: 8,
    },
    infoButton: {
      padding: 4,
    },
    inputContainer: {
      marginBottom: 24,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
    },
    inputLabel: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 8,
      textAlign: 'center',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 'auto',
      paddingBottom: 20,
    },
    button: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonStyle: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextButton: {
      backgroundColor: colors.primary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    backButtonText: {
      color: colors.text,
    },
    skipButtonText: {
      color: colors.secondary,
    },
    nextButtonText: {
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    modalBody: {
      marginBottom: 20,
    },
    infoText: {
      fontSize: 15,
      color: colors.text,
      marginBottom: 20,
      lineHeight: 22,
    },
    drinkExample: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: 12,
    },
    drinkInfo: {
      marginLeft: 16,
      flex: 1,
    },
    drinkTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    drinkSubtitle: {
      fontSize: 13,
      color: colors.secondary,
    },
    warningBox: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      marginLeft: 8,
      lineHeight: 18,
    },
    closeButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    closeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultsModal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      padding: 20,
    },
    resultsHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    riskBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    resultsTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    riskLevel: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    summarySection: {
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.secondary,
      marginLeft: 8,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    trendSection: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    trendText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 12,
      lineHeight: 20,
    },
    recommendationsSection: {
      marginBottom: 16,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    recommendationText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 8,
      lineHeight: 20,
    },
    disclaimerBox: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      marginLeft: 8,
      lineHeight: 18,
    },
    doneButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    doneButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    historySection: {
      marginBottom: 24,
    },
    historyCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    historyCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    riskBadgeText: {
      fontSize: 14,
      fontWeight: '700',
    },
    historyDate: {
      fontSize: 13,
      color: colors.secondary,
    },
    historyStats: {
      gap: 6,
    },
    historyStat: {
      fontSize: 14,
      color: colors.text,
    },
    historyLabel: {
      color: colors.secondary,
    },
    historyValue: {
      fontWeight: '600',
      color: colors.text,
    },
    emptyHistory: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyHistoryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptyHistorySubtext: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 32,
    },
  });

  const renderStandardDrinkInfo = () => (
    <Modal
      visible={showStandardDrinkInfo}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowStandardDrinkInfo(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              What is a Standard Drink?
            </Text>
            <TouchableOpacity
              onPress={() => setShowStandardDrinkInfo(false)}
              accessibilityLabel="Close standard drink information"
            >
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              One standard drink contains approximately 14 grams of pure alcohol:
            </Text>

            <View style={styles.drinkExample}>
              <Icon name="beer" size={32} color="#F39C12" />
              <View style={styles.drinkInfo}>
                <Text style={[styles.drinkTitle, { color: colors.text }]}>
                  12 oz (355ml) Beer
                </Text>
                <Text style={[styles.drinkSubtitle, { color: colors.secondary }]}>
                  ~5% alcohol by volume
                </Text>
              </View>
            </View>

            <View style={styles.drinkExample}>
              <Icon name="glass-wine" size={32} color="#9B59B6" />
              <View style={styles.drinkInfo}>
                <Text style={[styles.drinkTitle, { color: colors.text }]}>
                  5 oz (148ml) Wine
                </Text>
                <Text style={[styles.drinkSubtitle, { color: colors.secondary }]}>
                  ~12% alcohol by volume
                </Text>
              </View>
            </View>

            <View style={styles.drinkExample}>
              <Icon name="glass-cocktail" size={32} color="#E74C3C" />
              <View style={styles.drinkInfo}>
                <Text style={[styles.drinkTitle, { color: colors.text }]}>
                  1.5 oz (44ml) Spirits
                </Text>
                <Text style={[styles.drinkSubtitle, { color: colors.secondary }]}>
                  ~40% alcohol by volume (80 proof)
                </Text>
              </View>
            </View>

            <View style={[styles.warningBox, { backgroundColor: `${colors.warning}15` }]}>
              <Icon name="alert" size={20} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.text }]}>
                Mixed drinks or cocktails may contain 2-3 standard drinks depending on size and strength.
              </Text>
            </View>

            <Text style={[styles.infoText, { color: colors.secondary, marginTop: 16 }]}>
              Source: NIAAA (National Institute on Alcohol Abuse and Alcoholism)
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowStandardDrinkInfo(false)}
            accessibilityLabel="Close and return to questionnaire"
          >
            <Text style={styles.closeButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderResults = () => {
    if (!riskAssessment) return null;

    const { current_consumption, risk_category: risk_level, recommendations, trend } = riskAssessment;

    // Check if user is diagnosed with prediabetes or type 2 diabetes
    const isDiagnosed = user?.diagnosis_status === 'prediabetes' || user?.diagnosis_status === 'type2_diabetes';

    return (
      <Modal
        visible={showResults}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowResults(false);
          navigation.goBack();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.resultsModal, { backgroundColor: colors.card }]}>
            <ScrollView>
              <View style={styles.resultsHeader}>
                {/* Risk Badge and Level - Only show for non-diagnosed users */}
                {!isDiagnosed && (
                  <>
                    <View style={[
                      styles.riskBadge,
                      { backgroundColor: `${getRiskColor(risk_level)}20` }
                    ]}>
                      <Icon 
                        name={getRiskIcon(risk_level)} 
                        size={48} 
                        color={getRiskColor(risk_level)} 
                      />
                    </View>
                    <Text style={[styles.resultsTitle, { color: colors.text }]}>
                      Your Alcohol Intake Assessment
                    </Text>
                    <Text style={[
                      styles.riskLevel,
                      { color: getRiskColor(risk_level) }
                    ]}>
                      {risk_level.charAt(0).toUpperCase() + risk_level.slice(1)} Risk
                    </Text>
                  </>
                )}
                {isDiagnosed && (
                  <Text style={[styles.resultsTitle, { color: colors.text }]}>
                    Your Alcohol Intake Summary
                  </Text>
                )}
              </View>

              <View style={styles.summarySection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Your Consumption Pattern
                </Text>
                
                <View style={styles.statRow}>
                  <Icon name="glass-mug-variant" size={20} color={colors.secondary} />
                  <Text style={[styles.statLabel, { color: colors.secondary }]}>
                    Drinks per week:
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {current_consumption.drinks_per_week.toFixed(1)}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Icon name="calendar-week" size={20} color={colors.secondary} />
                  <Text style={[styles.statLabel, { color: colors.secondary }]}>
                    Drinking days/week:
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {current_consumption.drinking_days_per_week}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Icon name="alert-circle-outline" size={20} color={colors.secondary} />
                  <Text style={[styles.statLabel, { color: colors.secondary }]}>
                    Binge episodes/month:
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {current_consumption.binge_frequency_per_month}
                  </Text>
                </View>
              </View>

              {trend && trend.status !== 'no_history' && (
                <View style={[
                  styles.trendSection,
                  { backgroundColor: trend.status === 'improving' ? '#27AE6015' : '#E74C3C15' }
                ]}>
                  <Icon 
                    name={trend.status === 'improving' ? 'trending-down' : 'trending-up'} 
                    size={24} 
                    color={trend.status === 'improving' ? '#27AE60' : '#E74C3C'} 
                  />
                  <Text style={[styles.trendText, { color: colors.text }]}>
                    {trend.message}
                  </Text>
                </View>
              )}

              <View style={styles.recommendationsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Recommendations
                </Text>
                {recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <Icon 
                      name="chevron-right" 
                      size={20} 
                      color={colors.primary} 
                    />
                    <Text style={[styles.recommendationText, { color: colors.text }]}>
                      {rec}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.disclaimerBox, { backgroundColor: `${colors.primary}10` }]}>
                <Icon name="information" size={20} color={colors.primary} />
                <Text style={[styles.disclaimerText, { color: colors.text }]}>
                  This assessment is for educational purposes. Please consult a healthcare provider for personalized advice.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowResults(false);
                navigation.goBack();
              }}
              accessibilityLabel="Close and return to measurements"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Loading your data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user is diagnosed - skip questionnaire
  const isDiagnosed = user?.diagnosis_status === 'prediabetes' || user?.diagnosis_status === 'type2_diabetes';
  
  if (isDiagnosed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alcohol Intake</Text>
          <View style={styles.headerActions} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Diagnosis Status Banner */}
          <View style={[styles.diagnosedBanner, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
            <Icon name="information" size={20} color={colors.primary} />
            <Text style={[styles.diagnosedBannerText, { color: colors.text }]}>
              Managing alcohol intake is an important part of controlling your{' '}
              <Text style={{ fontWeight: '700' }}>
                {user?.diagnosis_status === 'prediabetes' ? 'prediabetes' : 'type 2 diabetes'}
              </Text>.
            </Text>
          </View>

          {/* ADA Guidelines Card */}
          <View style={[styles.guidelinesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.guidelinesHeader}>
              <Icon name="shield-check" size={22} color={colors.primary} />
              <Text style={[styles.guidelinesTitle, { color: colors.text }]}>ADA Alcohol Guidelines</Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={18} color="#27AE60" />
              <Text style={[styles.guidelineText, { color: colors.text }]}>
                <Text style={{ fontWeight: '600' }}>Women:</Text> No more than 1 drink per day
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={18} color="#27AE60" />
              <Text style={[styles.guidelineText, { color: colors.text }]}>
                <Text style={{ fontWeight: '600' }}>Men:</Text> No more than 2 drinks per day
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={18} color="#27AE60" />
              <Text style={[styles.guidelineText, { color: colors.text }]}>
                Always drink with food to slow glucose absorption
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="alert" size={18} color="#E74C3C" />
              <Text style={[styles.guidelineText, { color: colors.text }]}>
                Never drink on an empty stomach — risk of dangerous hypoglycemia
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="alert" size={18} color="#E74C3C" />
              <Text style={[styles.guidelineText, { color: colors.text }]}>
                Avoid sugary mixers (juice, soda) — spike blood sugar significantly
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('AlcoholTracking')}
              accessibilityLabel="Go to alcohol tracking dashboard"
            >
              <Icon name="chart-line" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>View Tracking Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('AlcoholDailyLog')}
              accessibilityLabel="Log today's alcohol consumption"
            >
              <Icon name="plus" size={20} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Log Today's Consumption</Text>
            </TouchableOpacity>
          </View>

          {/* AI Recommendations */}
          <LifestyleRecommendationsSection trackerType="alcohol" isDiagnosed={isDiagnosed} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={currentStep > 0 ? handleBack : () => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel={currentStep > 0 ? "Go to previous question" : "Go back to measurements"}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alcohol Intake</Text>
        <View style={styles.headerActions}>
          {lastUpdated && (
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.iconButton}
              accessibilityLabel="Delete assessment"
            >
              <Icon name="delete-outline" size={24} color={colors.error || '#E74C3C'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Last Updated Info */}
      {lastUpdated && (
        <View style={styles.lastUpdatedBanner}>
          <Icon name="clock-outline" size={16} color={colors.secondary} />
          <Text style={styles.lastUpdatedText}>
            Last updated: {lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      {/* Cumulative Summary Card */}
      {currentData && (
        <View style={styles.summaryCard}>
          <TouchableOpacity 
            style={styles.summaryHeader}
            onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.summaryTitle}>Current Assessment Summary</Text>
            <Icon 
              name={isSummaryExpanded ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>
          
          {isSummaryExpanded && (
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Drinks per Week</Text>
                  <Text style={styles.summaryValue}>
                    {currentData.drinks_per_week || 0}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Risk Category</Text>
                  <Text style={[styles.summaryValue, { 
                    color: getRiskColor(currentData.alcohol_risk_category),
                    fontSize: 16 
                  }]}>
                    {currentData.alcohol_risk_category?.toUpperCase() || 'N/A'}
                  </Text>
                </View>
              </View>
              <View style={[styles.summaryRow, { marginTop: 12 }]}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Diabetes Risk Score</Text>
                  <Text style={[styles.summaryValue, { fontSize: 20 }]}>
                    {currentData.diabetes_risk_score ? `${currentData.diabetes_risk_score.toFixed(2)}x` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Binge Episodes/Mo</Text>
                  <Text style={styles.summaryValue}>
                    {currentData.binge_frequency_per_month || 0}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${((currentStep + 1) / steps.length) * 100}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Question {currentStep + 1} of {steps.length}
        </Text>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>{currentStepData.title}</Text>
        <Text style={styles.stepQuestion}>{currentStepData.question}</Text>
        <Text style={styles.stepSubtitle}>{currentStepData.subtitle}</Text>

        {currentStepData.helpText && (
          <TouchableOpacity
            style={styles.helpTextContainer}
            onPress={() => currentStepData.id === 'average_drinks' && setShowStandardDrinkInfo(true)}
            activeOpacity={currentStepData.id === 'average_drinks' ? 0.7 : 1}
            accessibilityLabel="Standard drink information"
            accessibilityHint="Tap to learn what counts as one standard drink"
          >
            <Icon name="information" size={20} color={colors.primary} />
            <Text style={styles.helpText}>{currentStepData.helpText}</Text>
            {currentStepData.id === 'average_drinks' && (
              <Icon name="chevron-right" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={currentStepData.value}
            onChangeText={currentStepData.setValue}
            placeholder={currentStepData.placeholder}
            placeholderTextColor={colors.secondary}
            keyboardType={currentStepData.keyboardType}
            returnKeyType={currentStep < steps.length - 1 ? 'next' : 'done'}
            onSubmitEditing={handleNext}
            accessible={true}
            accessibilityLabel={currentStepData.accessibilityLabel}
            accessibilityHint={currentStepData.accessibilityHint}
          />
          <Text style={styles.inputLabel}>
            Range: {currentStepData.min} - {currentStepData.max}
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.skipButton]}
          onPress={handleSkip}
          accessibilityLabel="Skip this question"
        >
          <Text style={[styles.buttonText, styles.skipButtonText]}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.nextButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={loading}
          accessibilityLabel={currentStep < steps.length - 1 ? "Next question" : "Submit alcohol intake"}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.buttonText, styles.nextButtonText]}>
              {currentStep < steps.length - 1 ? 'Next' : 'Submit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      {renderStandardDrinkInfo()}
      {renderResults()}
    </SafeAreaView>
  );
};

export default AlcoholIntakeScreen;
