import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

/**
 * SmokingBaselineScreen - Mandatory onboarding questionnaire for smoking tracking
 * 
 * This screen collects the user's baseline smoking history which:
 * - Is required before daily tracking can begin
 * - Can only be submitted once (immutable)
 * - Provides initial risk assessment before daily data accumulates
 */
const SmokingBaselineScreen = ({ navigation, route }) => {
  const { colors, isDarkMode } = useTheme();
  
  // Check if editing existing baseline
  const existingBaseline = route.params?.baseline;
  const isEditMode = !!existingBaseline;
  
  // Form state - pre-fill if editing
  const [currentStep, setCurrentStep] = useState(0);
  const [smokingStatus, setSmokingStatus] = useState(
    existingBaseline?.smoking_status || 'never'
  );
  const [yearsSmoked, setYearsSmoked] = useState(
    existingBaseline?.years_smoked?.toString() || ''
  );
  const [typicalCigarettesPerDay, setTypicalCigarettesPerDay] = useState(
    existingBaseline?.typical_cigarettes_per_day || 0
  );
  const [quitDate, setQuitDate] = useState(
    existingBaseline?.quit_date ? new Date(existingBaseline.quit_date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startSmokingAge, setStartSmokingAge] = useState(
    existingBaseline?.start_smoking_age?.toString() || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBaseline, setIsLoadingBaseline] = useState(true);
  const [hasExistingBaseline, setHasExistingBaseline] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Check if baseline exists on mount (only if not explicitly passed as param)
  useEffect(() => {
    const checkAndLoadBaseline = async () => {
      // If baseline was passed as route param, we're in edit mode - skip check
      if (existingBaseline) {
        setIsLoadingBaseline(false);
        setHasExistingBaseline(true);
        return;
      }

      try {
        // Check if user already has a baseline
        const baselineResponse = await api.getSmokingBaseline();
        
        if (baselineResponse.success && baselineResponse.data) {
          // Baseline exists - show option to update or go back
          setHasExistingBaseline(true);
          Alert.alert(
            'Baseline Already Exists',
            'You have already set up your smoking baseline. Would you like to update it or go back?',
            [
              {
                text: 'Go Back',
                onPress: () => navigation.goBack(),
                style: 'cancel'
              },
              {
                text: 'Update Baseline',
                onPress: () => {
                  // Pre-fill form with existing data
                  const baseline = baselineResponse.data;
                  setSmokingStatus(baseline.smoking_status || 'never');
                  setYearsSmoked(baseline.years_smoked?.toString() || '');
                  setTypicalCigarettesPerDay(baseline.typical_cigarettes_per_day || 0);
                  if (baseline.quit_date) {
                    setQuitDate(new Date(baseline.quit_date));
                  }
                  setStartSmokingAge(baseline.start_smoking_age?.toString() || '');
                }
              }
            ],
            { cancelable: false }
          );
        }
      } catch (error) {
        // If 404, baseline doesn't exist - this is fine for first-time setup
        if (error.response?.status === 404 || error.response?.data?.error?.includes('not found')) {
          console.log('No existing baseline - first time setup');
          setHasExistingBaseline(false);
        } else {
          console.error('Error checking baseline:', error);
        }
      } finally {
        setIsLoadingBaseline(false);
      }
    };

    checkAndLoadBaseline();
  }, []);

  const questions = [
    {
      id: 'smoking_status',
      title: 'Smoking History',
      question: 'What is your smoking history?',
      description: 'Select the option that best describes your smoking status.',
      helpText: 'Research shows smoking significantly increases diabetes risk (Willi et al., 2007).',
      accessibilityHint: 'Select your smoking status: never, former, or current smoker',
    },
    {
      id: 'years_smoked',
      title: 'Years of Smoking',
      question: 'For how many years did you (or have you) smoke?',
      description: 'Estimate the total number of years you smoked.',
      helpText: 'Cumulative exposure (pack-years) is a strong predictor of diabetes risk.',
      accessibilityHint: 'Enter the number of years you smoked',
      showIf: () => smokingStatus !== 'never',
    },
    {
      id: 'cigarettes_per_day',
      title: 'Typical Cigarettes Per Day',
      question: 'On average, how many cigarettes did you smoke per day?',
      description: 'Think about your typical smoking pattern during your smoking years.',
      helpText: 'Heavy smoking (>20/day) increases diabetes risk by >60% (Pan et al., 2015).',
      accessibilityHint: 'Select typical number of cigarettes per day',
      showIf: () => smokingStatus !== 'never',
    },
    {
      id: 'quit_date',
      title: 'Quit Date',
      question: 'When did you quit smoking?',
      description: 'Select the date when you stopped smoking.',
      helpText: 'Risk decreases over time after quitting (Akter et al., 2017).',
      accessibilityHint: 'Select the date you quit smoking',
      showIf: () => smokingStatus === 'former',
    },
    {
      id: 'start_age',
      title: 'Age Started (Optional)',
      question: 'At what age did you start smoking?',
      description: 'This helps us better understand your smoking history.',
      helpText: 'Earlier onset may affect long-term health risks.',
      accessibilityHint: 'Enter the age you started smoking',
      showIf: () => smokingStatus !== 'never',
    },
  ];

  const smokingStatusOptions = [
    { 
      value: 'never', 
      label: 'Never Smoked', 
      icon: 'smoking-off',
      description: 'I have never been a regular smoker',
      color: '#27AE60'
    },
    { 
      value: 'former', 
      label: 'Former Smoker', 
      icon: 'history',
      description: 'I used to smoke but have quit',
      color: '#F39C12'
    },
    { 
      value: 'current', 
      label: 'Current Smoker', 
      icon: 'smoking',
      description: 'I currently smoke',
      color: '#E74C3C'
    },
  ];

  const cigarettesPerDayOptions = [
    { value: 0, label: '0', range: 'None' },
    { value: 3, label: '1-5', range: 'Light' },
    { value: 8, label: '6-10', range: 'Moderate' },
    { value: 15, label: '11-20', range: 'Heavy' },
    { value: 25, label: '>20', range: 'Very Heavy' },
  ];

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const animateTransition = (direction) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: direction === 'next' ? 0 : 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const getVisibleQuestions = () => {
    return questions.filter(q => !q.showIf || q.showIf());
  };

  const goToNextStep = () => {
    const visibleQuestions = getVisibleQuestions();
    if (currentStep < visibleQuestions.length - 1) {
      animateTransition('next');
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      animateTransition('prev');
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const requestData = {
        smoking_status: smokingStatus,
        years_smoked: smokingStatus !== 'never' ? parseFloat(yearsSmoked) || 0 : 0,
        typical_cigarettes_per_day: smokingStatus !== 'never' ? typicalCigarettesPerDay : 0,
        quit_date: smokingStatus === 'former' ? formatDateForAPI(quitDate) : null,
        start_smoking_age: startSmokingAge ? parseInt(startSmokingAge) : null,
      };

      console.log('Submitting baseline data:', requestData);

      // Use update if baseline exists, otherwise create
      const shouldUpdate = isEditMode || hasExistingBaseline;
      const response = shouldUpdate
        ? await api.updateSmokingBaseline(requestData)
        : await api.createSmokingBaseline(requestData);

      console.log('Baseline response:', response);

      if (response.success || response.data?.success) {
        Alert.alert(
          'Success',
          shouldUpdate ? 'Baseline updated successfully!' : 'Baseline created successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error submitting baseline:', error);
      console.error('Error response:', error.response?.data);
      Alert.alert(
        'Error',
        error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to submit baseline. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProgressBar = () => {
    const visibleQuestions = getVisibleQuestions();
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: colors.primary,
                width: `${((currentStep + 1) / visibleQuestions.length) * 100}%` 
              }
            ]} 
          />
        </View>
        <Text 
          style={[styles.progressText, { color: colors.secondary }]}
          accessibilityLabel={`Question ${currentStep + 1} of ${visibleQuestions.length}`}
        >
          {currentStep + 1} of {visibleQuestions.length}
        </Text>
      </View>
    );
  };

  const renderSmokingStatusQuestion = () => (
    <View style={styles.questionContent}>
      {smokingStatusOptions.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.statusOption,
            {
              backgroundColor: smokingStatus === option.value ? `${option.color}15` : colors.card,
              borderColor: smokingStatus === option.value ? option.color : colors.border,
            }
          ]}
          onPress={() => setSmokingStatus(option.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: smokingStatus === option.value }}
          accessibilityLabel={option.label}
        >
          <Icon 
            name={option.icon} 
            size={40} 
            color={smokingStatus === option.value ? option.color : colors.secondary} 
          />
          <View style={styles.statusTextContainer}>
            <Text style={[
              styles.statusLabel,
              { color: smokingStatus === option.value ? option.color : colors.text }
            ]}>
              {option.label}
            </Text>
            <Text style={[styles.statusDescription, { color: colors.secondary }]}>
              {option.description}
            </Text>
          </View>
          {smokingStatus === option.value && (
            <Icon name="check-circle" size={24} color={option.color} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderYearsSmokedQuestion = () => (
    <View style={styles.questionContent}>
      <TextInput
        style={[styles.numberInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        value={yearsSmoked}
        onChangeText={setYearsSmoked}
        keyboardType="decimal-pad"
        placeholder="e.g., 10.5"
        placeholderTextColor={colors.secondary}
        accessibilityLabel="Years smoked input"
        accessibilityHint="Enter the number of years you smoked"
      />
      
      {yearsSmoked && parseFloat(yearsSmoked) >= 20 && (
        <View style={[styles.warningCard, { backgroundColor: '#FFF3CD', borderColor: '#F39C12' }]}>
          <Icon name="alert" size={20} color="#F39C12" />
          <Text style={[styles.warningText, { color: '#856404' }]}>
            Long-term smoking significantly increases diabetes risk.
          </Text>
        </View>
      )}
    </View>
  );

  const renderCigarettesPerDayQuestion = () => (
    <View style={styles.questionContent}>
      <View style={styles.cigarettesGrid}>
        {cigarettesPerDayOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.cigaretteButton,
              {
                backgroundColor: typicalCigarettesPerDay === option.value ? colors.primary : colors.card,
                borderColor: typicalCigarettesPerDay === option.value ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setTypicalCigarettesPerDay(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: typicalCigarettesPerDay === option.value }}
            accessibilityLabel={`${option.label} cigarettes per day`}
          >
            <Text style={[
              styles.cigaretteButtonLabel,
              { color: typicalCigarettesPerDay === option.value ? '#FFFFFF' : colors.text }
            ]}>
              {option.label}
            </Text>
            <Text style={[
              styles.cigaretteButtonRange,
              { color: typicalCigarettesPerDay === option.value ? '#FFFFFF' : colors.secondary }
            ]}>
              {option.range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {typicalCigarettesPerDay >= 20 && (
        <View style={[styles.warningCard, { backgroundColor: '#FFEBEE', borderColor: '#E74C3C' }]}>
          <Icon name="alert-circle" size={20} color="#E74C3C" />
          <Text style={[styles.warningText, { color: '#C62828' }]}>
            Heavy smoking (&gt;20/day) increases diabetes risk by more than 60%.
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuitDateQuestion = () => (
    <View style={styles.questionContent}>
      <TouchableOpacity
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel="Select quit date"
      >
        <Icon name="calendar" size={24} color={colors.primary} />
        <Text style={[styles.dateButtonText, { color: colors.text }]}>
          {formatDate(quitDate)}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={quitDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setQuitDate(selectedDate);
            }
          }}
          maximumDate={new Date()}
        />
      )}

      {quitDate && (
        <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
          <Icon name="information" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Risk decreases over time after quitting. Keep up the great work!
          </Text>
        </View>
      )}
    </View>
  );

  const renderStartAgeQuestion = () => (
    <View style={styles.questionContent}>
      <TextInput
        style={[styles.numberInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        value={startSmokingAge}
        onChangeText={setStartSmokingAge}
        keyboardType="number-pad"
        placeholder="e.g., 18"
        placeholderTextColor={colors.secondary}
        accessibilityLabel="Starting age input"
        accessibilityHint="Enter the age you started smoking"
      />
      
      <Text style={[styles.optionalText, { color: colors.secondary }]}>
        This field is optional but helps improve risk assessment
      </Text>
    </View>
  );

  const renderCurrentQuestion = () => {
    const visibleQuestions = getVisibleQuestions();
    const currentQuestion = visibleQuestions[currentStep];

    return (
      <Animated.View
        style={[
          styles.questionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.questionHeader}>
          <Text style={[styles.questionTitle, { color: colors.text }]}>
            {currentQuestion.title}
          </Text>
          <Text style={[styles.question, { color: colors.text }]}>
            {currentQuestion.question}
          </Text>
          <Text style={[styles.questionDescription, { color: colors.secondary }]}>
            {currentQuestion.description}
          </Text>
        </View>

        {currentQuestion.id === 'smoking_status' && renderSmokingStatusQuestion()}
        {currentQuestion.id === 'years_smoked' && renderYearsSmokedQuestion()}
        {currentQuestion.id === 'cigarettes_per_day' && renderCigarettesPerDayQuestion()}
        {currentQuestion.id === 'quit_date' && renderQuitDateQuestion()}
        {currentQuestion.id === 'start_age' && renderStartAgeQuestion()}

        <View style={[styles.helpCard, { backgroundColor: `${colors.primary}10` }]}>
          <Icon name="lightbulb-outline" size={20} color={colors.primary} />
          <Text style={[styles.helpText, { color: colors.secondary }]}>
            {currentQuestion.helpText}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const isStepValid = () => {
    const visibleQuestions = getVisibleQuestions();
    const currentQuestion = visibleQuestions[currentStep];

    switch (currentQuestion.id) {
      case 'smoking_status':
        return smokingStatus !== null;
      case 'years_smoked':
        return yearsSmoked && parseFloat(yearsSmoked) >= 0;
      case 'cigarettes_per_day':
        return typicalCigarettesPerDay >= 0;
      case 'quit_date':
        return quitDate !== null;
      case 'start_age':
        return true; // Optional field
      default:
        return true;
    }
  };

  const visibleQuestions = getVisibleQuestions();
  const isLastStep = currentStep === visibleQuestions.length - 1;

  // Show loading screen while checking for existing baseline
  if (isLoadingBaseline) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.secondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderProgressBar()}
        {renderCurrentQuestion()}
      </ScrollView>

      <View style={[styles.navigationContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.backButton,
            { borderColor: colors.border },
            currentStep === 0 && styles.navButtonDisabled,
          ]}
          onPress={goToPrevStep}
          disabled={currentStep === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous question"
        >
          <Icon
            name="chevron-left"
            size={24}
            color={currentStep === 0 ? colors.secondary : colors.text}
          />
          <Text
            style={[
              styles.navButtonText,
              { color: currentStep === 0 ? colors.secondary : colors.text },
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>

        {isLastStep ? (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.submitButton,
              { backgroundColor: colors.primary },
              (!isStepValid() || isSubmitting) && styles.navButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isStepValid() || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Submit baseline"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Update' : 'Submit'}
                </Text>
                <Icon name="check" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.nextButton,
              { backgroundColor: colors.primary },
              !isStepValid() && styles.navButtonDisabled,
            ]}
            onPress={goToNextStep}
            disabled={!isStepValid()}
            accessibilityRole="button"
            accessibilityLabel="Next question"
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Icon name="chevron-right" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionHeader: {
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  questionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  questionContent: {
    marginBottom: 20,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 12,
  },
  numberInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  cigarettesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cigaretteButton: {
    width: '30%',
    margin: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  cigaretteButtonLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  cigaretteButtonRange: {
    fontSize: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  warningCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 18,
  },
  helpCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    marginLeft: 8,
    lineHeight: 18,
  },
  optionalText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  backButton: {
    marginRight: 8,
    borderWidth: 1,
  },
  nextButton: {
    marginLeft: 8,
  },
  submitButton: {
    marginLeft: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
});

export default SmokingBaselineScreen;
