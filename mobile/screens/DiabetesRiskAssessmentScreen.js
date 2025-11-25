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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getMyAssessment, submitDiabetesAssessment } from '../services/api';

const DiabetesRiskAssessmentScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingAssessment, setExistingAssessment] = useState(null);

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

  // Load existing assessment on mount
  useEffect(() => {
    loadExistingAssessment();
  }, []);

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
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  answers[currentQuestion.id] === option.value && styles.optionButtonSelected,
                ]}
                onPress={() => handleAnswer(option.value)}
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
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.scaleButton,
                  answers[currentQuestion.id] === option.value && styles.scaleButtonSelected,
                ]}
                onPress={() => handleAnswer(option.value)}
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
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={currentQuestion.placeholder}
              placeholderTextColor={colors.secondary}
              keyboardType="numeric"
              value={answers[currentQuestion.id]?.toString() || ''}
              onChangeText={(text) => {
                const numValue = parseFloat(text);
                if (!isNaN(numValue) || text === '') {
                  handleAnswer(text === '' ? '' : numValue);
                }
              }}
            />
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
      flex: 1,
      padding: 24,
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
      gap: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    optionButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
  });

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
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
              <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
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
    </SafeAreaView>
  );
};

export default DiabetesRiskAssessmentScreen;
