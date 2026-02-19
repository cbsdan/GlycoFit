import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getMyAssessment, submitDiabetesAssessment } from '../services/api';
import api from '../services/api';
import HealthMetricsSetupScreen from './HealthMetricsSetupScreen';

const DiabetesRiskAssessmentScreen = ({ navigation, isInitial = false, onSkip, onComplete }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingAssessment, setExistingAssessment] = useState(null);
  const [showIntroModal, setShowIntroModal] = useState(true);
  const [healthMetrics, setHealthMetrics] = useState(null);
  const [bmiAutoFilled, setBmiAutoFilled] = useState(false);
  const [sexAutoFilled, setSexAutoFilled] = useState(false);
  const [ageAutoFilled, setAgeAutoFilled] = useState(false);
  const [healthMetricsChecked, setHealthMetricsChecked] = useState(false);
  const [hasHealthMetrics, setHasHealthMetrics] = useState(false);
  const [showHealthMetricsModal, setShowHealthMetricsModal] = useState(false);

  const questions = [
    {
      id: 'HighBP',
      question: 'Do you have high blood pressure?',
      type: 'binary',
      icon: 'heart-pulse',
    },
    {
      id: 'HighChol',
      question: 'Do you have high cholesterol?',
      type: 'binary',
      icon: 'molecule',
    },
    {
      id: 'CholCheck',
      question: 'Have you checked your cholesterol in the last 5 years?',
      type: 'binary',
      icon: 'clipboard-check',
    },
    {
      id: 'BMI',
      question: 'Enter your Body Mass Index (BMI)',
      type: 'number',
      icon: 'scale-bathroom',
      placeholder: 'e.g., 24.5',
    },
    {
      id: 'Smoker',
      question: 'Have you smoked at least 100 cigarettes in your entire life (5 packs)?',
      type: 'binary',
      icon: 'smoking',
    },
    {
      id: 'Stroke',
      question: 'Have you ever had a stroke?',
      type: 'binary',
      icon: 'brain',
    },
    {
      id: 'HeartDiseaseorAttack',
      question: 'Have you had coronary heart disease or myocardial infarction?',
      type: 'binary',
      icon: 'heart-broken',
    },
    {
      id: 'PhysActivity',
      question: 'Have you done physical activity in the past 30 days (not including job)?',
      type: 'binary',
      icon: 'run',
    },
    {
      id: 'Fruits',
      question: 'Do you consume fruit at least once per day?',
      type: 'binary',
      icon: 'fruit-grapes',
    },
    {
      id: 'Veggies',
      question: 'Do you consume vegetables at least once per day?',
      type: 'binary',
      icon: 'carrot',
    },
    {
      id: 'HvyAlcoholConsump',
      question: 'Are you a heavy drinker? (Men >14 drinks/week, Women >7)',
      type: 'binary',
      icon: 'glass-cocktail',
    },
    {
      id: 'AnyHealthcare',
      question: 'Do you have any kind of health care coverage?',
      type: 'binary',
      icon: 'hospital-box',
    },
    {
      id: 'NoDocbcCost',
      question: 'Was there a time you needed to see a doctor but couldn\'t because of cost?',
      type: 'binary',
      icon: 'currency-usd',
    },
    {
      id: 'GenHlth',
      question: 'Rate your general health',
      type: 'scale',
      icon: 'heart-plus',
      options: [
        { value: 1, label: 'Excellent' },
        { value: 2, label: 'Very Good' },
        { value: 3, label: 'Good' },
        { value: 4, label: 'Fair' },
        { value: 5, label: 'Poor' },
      ],
    },
    {
      id: 'MentHlth',
      question: 'How many days during the past 30 days was your mental health not good?',
      type: 'number',
      icon: 'head-heart',
      placeholder: 'e.g., 5',
      max: 30,
    },
    {
      id: 'PhysHlth',
      question: 'How many days during the past 30 days was your physical health not good?',
      type: 'number',
      icon: 'run-fast',
      placeholder: 'e.g., 3',
      max: 30,
    },
    {
      id: 'DiffWalk',
      question: 'Do you have serious difficulty walking or climbing stairs?',
      type: 'binary',
      icon: 'stairs',
    },
    {
      id: 'Sex',
      question: 'What is your sex?',
      type: 'choice',
      icon: 'human-male-female',
      options: [
        { value: 0, label: 'Female' },
        { value: 1, label: 'Male' },
      ],
    },
    {
      id: 'Age',
      question: 'Select your age category',
      type: 'scale',
      icon: 'calendar',
      options: [
        { value: 1, label: '18-24' },
        { value: 2, label: '25-29' },
        { value: 3, label: '30-34' },
        { value: 4, label: '35-39' },
        { value: 5, label: '40-44' },
        { value: 6, label: '45-49' },
        { value: 7, label: '50-54' },
        { value: 8, label: '55-59' },
        { value: 9, label: '60-64' },
        { value: 10, label: '65-69' },
        { value: 11, label: '70-74' },
        { value: 12, label: '75-79' },
        { value: 13, label: '80+' },
      ],
    },
    {
      id: 'Education',
      question: 'What is your education level?',
      type: 'scale',
      icon: 'school',
      options: [
        { value: 1, label: 'No schooling' },
        { value: 2, label: 'Grades 1-8' },
        { value: 3, label: 'Grades 9-11' },
        { value: 4, label: 'High School Grad' },
        { value: 5, label: 'Some College' },
        { value: 6, label: 'College Grad' },
      ],
    },
    {
      id: 'Income',
      question: 'What is your income category?',
      type: 'scale',
      icon: 'cash',
      options: [
        { value: 1, label: 'Less than ₱120k' },
        { value: 2, label: '₱120k–₱240k' },
        { value: 3, label: '₱240k–₱480k' },
        { value: 4, label: '₱480k–₱720k' },
        { value: 5, label: '₱720k–₱1M' },
        { value: 6, label: '₱1M–₱1.5M' },
        { value: 7, label: '₱1.5M–₱2M' },
        { value: 8, label: '₱2M+' },
      ],
    },
  ];

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  // Load existing assessment and check health metrics on mount
  useEffect(() => {
    loadExistingAssessment();
    checkHealthMetrics();
  }, []);

  // Auto-fill BMI when reaching question 4 if health metrics exist
  useEffect(() => {
    if (currentStep === 3 && !bmiAutoFilled && hasHealthMetrics) {
      autoFillBMI();
    }
  }, [currentStep, hasHealthMetrics]);

  // Auto-fill Sex when reaching question 18 if health metrics exist
  useEffect(() => {
    if (currentStep === 17 && !sexAutoFilled && hasHealthMetrics) {
      autoFillSex();
    }
  }, [currentStep, hasHealthMetrics]);

  // Auto-fill Age when reaching question 19 if health metrics exist
  useEffect(() => {
    if (currentStep === 18 && !ageAutoFilled && hasHealthMetrics) {
      autoFillAge();
    }
  }, [currentStep, hasHealthMetrics]);

  const loadExistingAssessment = async () => {
    try {
      const result = await getMyAssessment();
      if (result && result.assessment) {
        setExistingAssessment(result.assessment);
        setAnswers(result.assessment.answers);
        toast.info('Loading your previous assessment');
      }
    } catch (error) {
      console.error('Error loading assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkHealthMetrics = async () => {
    try {
      const response = await api.getHealthMetrics();
      const metrics = response?.health_metrics;
      
      if (metrics && metrics.height && metrics.weight) {
        setHealthMetrics(metrics);
        setHasHealthMetrics(true);
      } else {
        setHasHealthMetrics(false);
      }
    } catch (error) {
      console.log('Error fetching health metrics:', error);
      setHasHealthMetrics(false);
    } finally {
      setHealthMetricsChecked(true);
    }
  };

  const autoFillBMI = () => {
    if (healthMetrics && healthMetrics.height && healthMetrics.weight) {
      const heightInMeters = healthMetrics.height / 100;
      const bmi = (healthMetrics.weight / (heightInMeters * heightInMeters)).toFixed(1);
      
      setAnswers(prev => ({ ...prev, BMI: parseFloat(bmi) }));
      setBmiAutoFilled(true);
      
      toast.success(`BMI auto-filled: ${bmi}`);
    }
  };

  const autoFillSex = () => {
    if (healthMetrics && healthMetrics.sex) {
      // Map 'male' to 1, 'female' to 0 for the assessment
      const sexValue = healthMetrics.sex === 'male' ? 1 : 0;
      
      setAnswers(prev => ({ ...prev, Sex: sexValue }));
      setSexAutoFilled(true);
      
      toast.success(`Sex auto-filled: ${healthMetrics.sex}`);
    }
  };

  const autoFillAge = () => {
    if (healthMetrics && healthMetrics.age) {
      const age = healthMetrics.age;
      let ageCategory;
      
      if (age >= 18 && age <= 24) ageCategory = 1;
      else if (age >= 25 && age <= 29) ageCategory = 2;
      else if (age >= 30 && age <= 34) ageCategory = 3;
      else if (age >= 35 && age <= 39) ageCategory = 4;
      else if (age >= 40 && age <= 44) ageCategory = 5;
      else if (age >= 45 && age <= 49) ageCategory = 6;
      else if (age >= 50 && age <= 54) ageCategory = 7;
      else if (age >= 55 && age <= 59) ageCategory = 8;
      else if (age >= 60 && age <= 64) ageCategory = 9;
      else if (age >= 65 && age <= 69) ageCategory = 10;
      else if (age >= 70 && age <= 74) ageCategory = 11;
      else if (age >= 75 && age <= 79) ageCategory = 12;
      else if (age >= 80) ageCategory = 13;
      else ageCategory = 1; // Default to 18-24 if age is below 18
      
      setAnswers(prev => ({ ...prev, Age: ageCategory }));
      setAgeAutoFilled(true);
      
      toast.success(`Age category auto-filled: ${age} years`);
    }
  };

  const handleCompleteHealthMetrics = () => {
    setShowIntroModal(false);
    setShowHealthMetricsModal(true);
  };

  const handleHealthMetricsComplete = () => {
    setShowHealthMetricsModal(false);
    setShowIntroModal(true);
    // Re-check health metrics after completing
    setTimeout(() => checkHealthMetrics(), 500);
  };

  const handleHealthMetricsExit = () => {
    setShowHealthMetricsModal(false);
    setShowIntroModal(false);
    // Exit the assessment since health metrics are required
    if (isInitial && onSkip) {
      onSkip();
    } else {
      navigation.goBack();
    }
  };

  const handleAnswer = (value) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = () => {
    if (answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === '') {
      toast.error('Please answer the question before continuing');
      return;
    }

    if (currentStep < questions.length - 1) {
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

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Submit assessment to backend
      const result = await submitDiabetesAssessment(answers);
      
      if (result && result.assessment) {
        const { prediction } = result.assessment;
        
        // Call onComplete if this is initial assessment
        if (isInitial && onComplete) {
          onComplete();
        }
        
        // Navigate to results screen with prediction data
        navigation.replace('AssessmentResults', {
          prediction,
          isUpdate: !!existingAssessment
        });
        
        toast.success(existingAssessment ? 'Assessment updated!' : 'Assessment completed!');
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast.error('Failed to submit assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'binary':
        return (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                answers[currentQuestion.id] === 0 && styles.optionButtonSelected,
              ]}
              onPress={() => handleAnswer(0)}
            >
              <Icon
                name="close-circle"
                size={24}
                color={answers[currentQuestion.id] === 0 ? '#FFFFFF' : colors.secondary}
              />
              <Text
                style={[
                  styles.optionText,
                  answers[currentQuestion.id] === 0 && styles.optionTextSelected,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                answers[currentQuestion.id] === 1 && styles.optionButtonSelected,
              ]}
              onPress={() => handleAnswer(1)}
            >
              <Icon
                name="check-circle"
                size={24}
                color={answers[currentQuestion.id] === 1 ? '#FFFFFF' : colors.secondary}
              />
              <Text
                style={[
                  styles.optionText,
                  answers[currentQuestion.id] === 1 && styles.optionTextSelected,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'choice':
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.id === 'Sex' && sexAutoFilled && (
              <View style={[styles.autoFillBanner, { backgroundColor: `${colors.success || '#27AE60'}15`, borderColor: colors.success || '#27AE60' }]}>
                <Icon name="check-circle" size={20} color={colors.success || '#27AE60'} />
                <Text style={[styles.autoFillText, { color: colors.text }]}>
                  Sex auto-filled from your health metrics
                </Text>
              </View>
            )}
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  answers[currentQuestion.id] === option.value && styles.optionButtonSelected,
                  currentQuestion.id === 'Sex' && sexAutoFilled && styles.optionButtonDisabled,
                ]}
                onPress={() => {
                  if (currentQuestion.id !== 'Sex' || !sexAutoFilled) {
                    handleAnswer(option.value);
                  }
                }}
                disabled={currentQuestion.id === 'Sex' && sexAutoFilled}
              >
                <Text
                  style={[
                    styles.optionText,
                    answers[currentQuestion.id] === option.value && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'scale':
        return (
          <View style={styles.scaleContainer}>
            {currentQuestion.id === 'Age' && ageAutoFilled && (
              <View style={[styles.autoFillBanner, { backgroundColor: `${colors.success || '#27AE60'}15`, borderColor: colors.success || '#27AE60' }]}>
                <Icon name="check-circle" size={20} color={colors.success || '#27AE60'} />
                <Text style={[styles.autoFillText, { color: colors.text }]}>
                  Age category auto-filled from your health metrics
                </Text>
              </View>
            )}
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.scaleButton,
                  answers[currentQuestion.id] === option.value && styles.scaleButtonSelected,
                  currentQuestion.id === 'Age' && ageAutoFilled && styles.scaleButtonDisabled,
                ]}
                onPress={() => {
                  if (currentQuestion.id !== 'Age' || !ageAutoFilled) {
                    handleAnswer(option.value);
                  }
                }}
                disabled={currentQuestion.id === 'Age' && ageAutoFilled}
              >
                <Text
                  style={[
                    styles.scaleText,
                    answers[currentQuestion.id] === option.value && styles.scaleTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'number':
        return (
          <View style={styles.inputContainer}>
            {currentQuestion.id === 'BMI' && bmiAutoFilled && (
              <View style={[styles.autoFillBanner, { backgroundColor: `${colors.success || '#27AE60'}15`, borderColor: colors.success || '#27AE60' }]}>
                <Icon name="check-circle" size={20} color={colors.success || '#27AE60'} />
                <Text style={[styles.autoFillText, { color: colors.text }]}>
                  BMI auto-calculated from your health metrics
                </Text>
              </View>
            )}
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
                currentQuestion.id === 'BMI' && bmiAutoFilled && styles.inputReadOnly
              ]}
              placeholder={currentQuestion.placeholder}
              placeholderTextColor={colors.secondary}
              keyboardType="numeric"
              value={answers[currentQuestion.id]?.toString() || ''}
              onChangeText={(text) => {
                const numValue = parseFloat(text);
                if (!isNaN(numValue) || text === '') {
                  handleAnswer(text === '' ? '' : numValue);
                  if (currentQuestion.id === 'BMI') {
                    setBmiAutoFilled(false); // Mark as manually edited
                  }
                }
              }}
              editable={currentQuestion.id !== 'BMI' || !bmiAutoFilled}
            />
            {currentQuestion.id === 'BMI' && !hasHealthMetrics && (
              <View style={[styles.infoMessage, { backgroundColor: `${colors.secondary}10`, borderColor: `${colors.secondary}30` }]}>
                <Icon name="information-outline" size={16} color={colors.secondary} />
                <Text style={[styles.infoMessageText, { color: colors.secondary }]}>
                  Complete your health profile for automatic BMI calculation
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginLeft: 8,
    },
    closeButton: {
      padding: 8,
    },
    skipButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    progressBarContainer: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    progressText: {
      fontSize: 12,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 8,
    },
    content: {
      flexGrow: 1,
      padding: 24,
      paddingBottom: 40,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 24,
    },
    questionText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 30,
    },
    optionsContainer: {
      gap: 8,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 8,
      gap: 8,
    },
    optionButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionButtonDisabled: {
      opacity: 0.6,
    },
    optionText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    optionTextSelected: {
      color: '#FFFFFF',
    },
    scaleContainer: {
      gap: 10,
    },
    scaleButton: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    scaleButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scaleButtonDisabled: {
      opacity: 0.6,
    },
    scaleText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    scaleTextSelected: {
      color: '#FFFFFF',
    },
    inputContainer: {
      marginTop: 8,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      fontWeight: '500',
      textAlign: 'center',
    },
    inputReadOnly: {
      backgroundColor: `${colors.primary}08`,
      borderColor: colors.primary,
      opacity: 0.8,
    },
    autoFillBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
      gap: 8,
    },
    autoFillText: {
      fontSize: 13,
      flex: 1,
    },
    infoMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 12,
      gap: 8,
    },
    infoMessageText: {
      fontSize: 12,
      flex: 1,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
      gap: 8,
    },
    warningText: {
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    nextButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextButtonDisabled: {
      opacity: 0.6,
    },
    nextButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
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
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    modalDescription: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 14,
    },
    modalFeatures: {
      width: '100%',
      marginBottom: 14,
    },
    modalFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      paddingLeft: 4,
    },
    modalFeatureText: {
      fontSize: 13,
      marginLeft: 10,
      flex: 1,
    },
    modalInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 6,
    },
    modalInfoText: {
      fontSize: 12,
      fontStyle: 'italic',
    },
    modalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingVertical: 12,
      borderRadius: 10,
      marginBottom: 8,
      gap: 6,
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    modalSkipButton: {
      paddingVertical: 8,
    },
    modalSkipText: {
      fontSize: 13,
      fontWeight: '500',
    },
    diagnosedMessageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
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
  });

  // Check if user is diagnosed - skip initial assessment
  const isDiagnosed = user?.diagnosis_status === 'prediabetes' || user?.diagnosis_status === 'type2_diabetes';
  
  if (isDiagnosed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (isInitial && onSkip) {
                onSkip();
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Risk Assessment</Text>
          <View style={styles.headerActions} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.diagnosedMessageContainer}>
            <Icon name="information-outline" size={64} color={colors.primary} />
            <Text style={styles.diagnosedTitle}>Assessment Not Required</Text>
            <Text style={styles.diagnosedMessage}>
              Since you have been diagnosed with {user?.diagnosis_status === 'prediabetes' ? 'prediabetes' : 'type 2 diabetes'}, 
              you don't need to complete this risk assessment.
              {'\n\n'}
              You can track your health through lifestyle monitoring and receive personalized recommendations.
            </Text>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                if (isInitial && onSkip) {
                  onSkip();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Introduction Modal */}
      <Modal
        visible={showIntroModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // If health metrics don't exist, exit the assessment
          if (!hasHealthMetrics) {
            if (isInitial && onSkip) {
              onSkip();
            } else {
              navigation.goBack();
            }
          } else {
            setShowIntroModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="clipboard-text" size={36} color={colors.primary} />
            </View>
            
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Diabetes Risk Assessment
            </Text>
            
            <Text style={[styles.modalDescription, { color: colors.secondary }]}>
              This comprehensive assessment will help evaluate your risk factors for diabetes. It includes questions about:
            </Text>
            
            {healthMetricsChecked && !hasHealthMetrics && (
              <View style={[styles.warningBanner, { backgroundColor: `${colors.warning || '#F39C12'}15`, borderColor: colors.warning || '#F39C12' }]}>
                <Icon name="alert-circle" size={20} color={colors.warning || '#F39C12'} />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  For accurate BMI calculation, please complete your health profile first.
                </Text>
              </View>
            )}
            
            <View style={styles.modalFeatures}>
              <View style={styles.modalFeatureItem}>
                <Icon name="heart-pulse" size={18} color={colors.primary} />
                <Text style={[styles.modalFeatureText, { color: colors.text }]}>
                  Health conditions & history
                </Text>
              </View>
              <View style={styles.modalFeatureItem}>
                <Icon name="food-apple" size={18} color={colors.primary} />
                <Text style={[styles.modalFeatureText, { color: colors.text }]}>
                  Lifestyle & dietary habits
                </Text>
              </View>
              <View style={styles.modalFeatureItem}>
                <Icon name="dumbbell" size={18} color={colors.primary} />
                <Text style={[styles.modalFeatureText, { color: colors.text }]}>
                  Physical activity levels
                </Text>
              </View>
              <View style={styles.modalFeatureItem}>
                <Icon name="account" size={18} color={colors.primary} />
                <Text style={[styles.modalFeatureText, { color: colors.text }]}>
                  Demographics & general health
                </Text>
              </View>
            </View>
            
            <View style={styles.modalInfo}>
              <Icon name="clock-outline" size={18} color={colors.secondary} />
              <Text style={[styles.modalInfoText, { color: colors.secondary }]}>
                Takes approximately 5-10 minutes
              </Text>
            </View>
            
            {healthMetricsChecked && !hasHealthMetrics ? (
              <>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleCompleteHealthMetrics}
                  activeOpacity={0.8}
                >
                  <Icon name="account-details" size={18} color="#FFFFFF" />
                  <Text style={styles.modalButtonText}>Complete Health Profile to Continue</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalSkipButton}
                  onPress={() => {
                    setShowIntroModal(false);
                    if (isInitial && onSkip) {
                      onSkip();
                    } else {
                      navigation.goBack();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalSkipText, { color: colors.secondary }]}>
                    {isInitial ? 'Skip Assessment for Now' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowIntroModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonText}>Start Assessment</Text>
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                
                {isInitial && onSkip && (
                  <TouchableOpacity
                    style={styles.modalSkipButton}
                    onPress={() => {
                      setShowIntroModal(false);
                      if (onSkip) {
                        onSkip();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalSkipText, { color: colors.secondary }]}>
                      I'll do this later
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {loading || !healthMetricsChecked ? (
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.questionText, { marginTop: 16 }]}>Loading...</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              {currentStep > 0 && (
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <Icon name="chevron-left" size={28} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>
                {existingAssessment ? 'Update Assessment' : 'Diabetes Risk Assessment'}
              </Text>
              {isInitial ? (
                <TouchableOpacity 
                  style={styles.skipButton} 
                  onPress={() => {
                    if (onSkip) {
                      onSkip();
                    }
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Question {currentStep + 1} of {questions.length}
            </Text>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconContainer}>
                <Icon name={currentQuestion.icon} size={40} color={colors.primary} />
              </View>

              <Text style={styles.questionText}>{currentQuestion.question}</Text>

              {renderQuestion()}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity 
                style={[styles.nextButton, submitting && styles.nextButtonDisabled]} 
                onPress={handleNext}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.nextButtonText}>
                    {currentStep === questions.length - 1 
                      ? (existingAssessment ? 'Update Assessment' : 'Submit Assessment')
                      : 'Next'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* Health Metrics Modal */}
      <Modal
        visible={showHealthMetricsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleHealthMetricsExit}
      >
        <HealthMetricsSetupScreen
          onComplete={handleHealthMetricsComplete}
          onSkip={handleHealthMetricsExit}
        />
      </Modal>
    </SafeAreaView>
  );
};

export default DiabetesRiskAssessmentScreen;
