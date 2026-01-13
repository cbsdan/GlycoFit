import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Animated,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStepBaseline, updateStepBaseline } from '../services/api';

/**
 * StepBaselineScreen - Mandatory onboarding questionnaire for step tracking
 * 
 * This screen collects the user's baseline activity pattern which:
 * - Is required before daily tracking can begin
 * - Can be updated if activity levels change
 * - Provides initial risk assessment before daily data accumulates
 */
const StepBaselineScreen = ({ navigation, route }) => {
  const { colors, isDarkMode } = useTheme();
  
  // Check if editing existing baseline
  const existingBaseline = route.params?.baseline;
  const isEditMode = !!existingBaseline;
  
  // Form state - pre-fill if editing
  const [currentStep, setCurrentStep] = useState(0);
  const [avgDailySteps, setAvgDailySteps] = useState(
    existingBaseline?.baseline_avg_daily_steps || 5000
  );
  const [activityLevel, setActivityLevel] = useState(
    existingBaseline?.baseline_activity_level || 'sedentary'
  );
  const [daysActive, setDaysActive] = useState(
    existingBaseline?.baseline_days_active_per_week || 3
  );
  const [exerciseMinutes, setExerciseMinutes] = useState(
    existingBaseline?.baseline_exercise_minutes_per_week || 30
  );
  const [workType, setWorkType] = useState(
    existingBaseline?.baseline_work_type || 'desk'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const questions = [
    {
      id: 'avg_steps',
      title: 'Average Daily Steps',
      question: 'On average, how many steps do you take per day?',
      description: 'Think about your typical day over the past month.',
      helpText: 'Most adults average 3,000-4,000 steps. Aim for 10,000 for optimal health.',
      accessibilityHint: 'Use the slider to select your average daily steps',
    },
    {
      id: 'activity_level',
      title: 'Activity Level',
      question: 'How would you describe your overall activity level?',
      description: 'Consider your daily movement and exercise habits.',
      helpText: 'Regular physical activity helps improve insulin sensitivity.',
      accessibilityHint: 'Select your typical activity level',
    },
    {
      id: 'days_active',
      title: 'Active Days',
      question: 'How many days per week are you physically active?',
      description: 'Count days where you exercise or move significantly more than usual.',
      helpText: 'Aim for at least 5 days of moderate activity per week.',
      accessibilityHint: 'Select the number of active days per week',
    },
    {
      id: 'exercise_minutes',
      title: 'Exercise Duration',
      question: 'How many minutes of exercise do you typically do per week?',
      description: 'Include both structured exercise and active recreation.',
      helpText: '150 minutes per week is recommended for metabolic health.',
      accessibilityHint: 'Select your typical weekly exercise minutes',
    },
    {
      id: 'work_type',
      title: 'Work Environment',
      question: 'What best describes your typical work day?',
      description: 'Your work environment significantly impacts daily activity.',
      helpText: 'Desk workers should aim for regular movement breaks.',
      accessibilityHint: 'Select your typical work environment',
    },
  ];

  const activityLevels = [
    { 
      value: 'sedentary', 
      label: 'Sedentary', 
      description: 'Little to no exercise',
      icon: 'seat-recline-normal',
      color: '#E74C3C'
    },
    { 
      value: 'lightly_active', 
      label: 'Lightly Active', 
      description: 'Light exercise 1-3 days/week',
      icon: 'walk',
      color: '#F39C12'
    },
    { 
      value: 'moderately_active', 
      label: 'Moderately Active', 
      description: 'Moderate exercise 3-5 days/week',
      icon: 'run',
      color: '#3498DB'
    },
    { 
      value: 'very_active', 
      label: 'Very Active', 
      description: 'Hard exercise 6-7 days/week',
      icon: 'run-fast',
      color: '#27AE60'
    },
    { 
      value: 'extremely_active', 
      label: 'Extremely Active', 
      description: 'Very hard exercise & physical job',
      icon: 'medal',
      color: '#9B59B6'
    },
  ];

  const workTypes = [
    { 
      value: 'desk', 
      label: 'Desk Job', 
      description: 'Sitting most of the day',
      icon: 'laptop'
    },
    { 
      value: 'standing', 
      label: 'Standing Job', 
      description: 'Standing/walking moderately',
      icon: 'store'
    },
    { 
      value: 'active', 
      label: 'Active Job', 
      description: 'Frequent walking/movement',
      icon: 'walk'
    },
    { 
      value: 'physical', 
      label: 'Physical Job', 
      description: 'Heavy lifting/constant movement',
      icon: 'dumbbell'
    },
  ];

  const animateTransition = (direction) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === 'next' ? -50 : 50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideAnim.setValue(direction === 'next' ? 50 : -50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goToNextStep = () => {
    if (currentStep < questions.length - 1) {
      animateTransition('next');
      setTimeout(() => setCurrentStep(currentStep + 1), 150);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      animateTransition('prev');
      setTimeout(() => setCurrentStep(currentStep - 1), 150);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      if (isEditMode) {
        await updateStepBaseline(
          avgDailySteps,
          activityLevel,
          daysActive,
          exerciseMinutes,
          workType
        );
      } else {
        await createStepBaseline(
          avgDailySteps,
          activityLevel,
          daysActive,
          exerciseMinutes,
          workType
        );
      }
      
      AccessibilityInfo.announceForAccessibility(
        isEditMode ? 'Step baseline updated successfully' : 'Step baseline saved successfully'
      );
      
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.error || 
        (isEditMode ? 'Failed to update step baseline' : 'Failed to save step baseline');
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              backgroundColor: colors.primary,
              width: `${((currentStep + 1) / questions.length) * 100}%` 
            }
          ]} 
        />
      </View>
      <Text 
        style={[styles.progressText, { color: colors.secondary }]}
        accessibilityLabel={`Question ${currentStep + 1} of ${questions.length}`}
      >
        {currentStep + 1} of {questions.length}
      </Text>
    </View>
  );

  const renderAvgStepsQuestion = () => {
    const stepPresets = [1000, 3000, 5000, 7500, 10000, 12500, 15000];
    
    return (
      <View style={styles.questionContent}>
        <Text 
          style={[styles.sliderValue, { color: colors.primary }]}
          accessibilityLabel={`${avgDailySteps.toLocaleString()} steps selected`}
        >
          {avgDailySteps.toLocaleString()} steps
        </Text>
        
        <View style={styles.stepsButtonRow}>
          <TouchableOpacity
            style={[styles.stepAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAvgDailySteps(Math.max(500, avgDailySteps - 500))}
            accessibilityLabel="Decrease by 500 steps"
          >
            <Icon name="minus" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.stepsDisplay}>
            <Text style={[styles.stepsDisplayText, { color: colors.text }]}>
              {avgDailySteps.toLocaleString()}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.stepAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAvgDailySteps(Math.min(30000, avgDailySteps + 500))}
            accessibilityLabel="Increase by 500 steps"
          >
            <Icon name="plus" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.presetsLabel, { color: colors.secondary }]}>Quick select:</Text>
        <View style={styles.presetsRow}>
          {stepPresets.map((steps) => (
            <TouchableOpacity
              key={steps}
              style={[
                styles.presetButton,
                { 
                  backgroundColor: avgDailySteps === steps ? colors.primary : colors.card,
                  borderColor: avgDailySteps === steps ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setAvgDailySteps(steps)}
              accessibilityRole="button"
              accessibilityState={{ selected: avgDailySteps === steps }}
            >
              <Text style={[
                styles.presetButtonText,
                { color: avgDailySteps === steps ? '#FFFFFF' : colors.text }
              ]}>
                {steps >= 1000 ? `${steps / 1000}k` : steps}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={[styles.optimalRangeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon 
            name={avgDailySteps >= 7000 ? 'check-circle' : 'information'} 
            size={20} 
            color={avgDailySteps >= 7000 ? '#27AE60' : colors.secondary} 
          />
          <Text style={[styles.optimalRangeText, { color: colors.text }]}>
            {avgDailySteps >= 10000 
              ? '🎉 Excellent! You\'re meeting the recommended daily target!' 
              : avgDailySteps >= 7000
                ? '👍 Good! You\'re on track for metabolic health.'
                : avgDailySteps >= 5000
                  ? '💪 Keep working towards 7,000+ steps daily.'
                  : avgDailySteps >= 3000
                    ? '📈 Try to gradually increase your daily steps.'
                    : '⚠️ Low activity may increase diabetes risk. Aim for 5,000+ steps.'}
          </Text>
        </View>
      </View>
    );
  };

  const renderActivityLevelQuestion = () => (
    <View style={styles.questionContent}>
      {activityLevels.map((level) => (
        <TouchableOpacity
          key={level.value}
          style={[
            styles.activityLevelOption,
            { 
              backgroundColor: activityLevel === level.value ? `${level.color}15` : colors.card,
              borderColor: activityLevel === level.value ? level.color : colors.border,
            }
          ]}
          onPress={() => setActivityLevel(level.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: activityLevel === level.value }}
          accessibilityLabel={`${level.label}: ${level.description}`}
        >
          <View style={styles.activityLevelContent}>
            <View style={[
              styles.activityIcon,
              { backgroundColor: `${level.color}20` }
            ]}>
              <Icon name={level.icon} size={28} color={level.color} />
            </View>
            <View style={styles.activityTextContainer}>
              <Text style={[
                styles.activityLabel, 
                { color: activityLevel === level.value ? level.color : colors.text }
              ]}>
                {level.label}
              </Text>
              <Text style={[styles.activityDescription, { color: colors.secondary }]}>
                {level.description}
              </Text>
            </View>
            {activityLevel === level.value && (
              <Icon name="check-circle" size={24} color={level.color} />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDaysActiveQuestion = () => (
    <View style={styles.questionContent}>
      <View style={styles.daysGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.dayButton,
              { 
                backgroundColor: daysActive === num ? colors.primary : colors.card,
                borderColor: daysActive === num ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setDaysActive(num)}
            accessibilityRole="button"
            accessibilityState={{ selected: daysActive === num }}
            accessibilityLabel={`${num} days`}
          >
            <Text 
              style={[
                styles.dayButtonText, 
                { color: daysActive === num ? '#FFFFFF' : colors.text }
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.daysLabel, { color: colors.secondary }]}>
        days per week
      </Text>
      
      {daysActive < 3 && (
        <View style={[styles.warningCard, { backgroundColor: '#FFF3CD', borderColor: '#F39C12' }]}>
          <Icon name="alert" size={20} color="#F39C12" />
          <Text style={[styles.warningText, { color: '#856404' }]}>
            Being active less than 3 days per week may increase metabolic risk.
          </Text>
        </View>
      )}
      
      {daysActive >= 5 && (
        <View style={[styles.successCard, { backgroundColor: '#D4EDDA', borderColor: '#27AE60' }]}>
          <Icon name="check-circle" size={20} color="#27AE60" />
          <Text style={[styles.successText, { color: '#155724' }]}>
            Great! Meeting WHO recommendations for physical activity.
          </Text>
        </View>
      )}
    </View>
  );

  const renderExerciseMinutesQuestion = () => {
    const minutePresets = [0, 30, 60, 90, 150, 210, 300];
    
    return (
      <View style={styles.questionContent}>
        <Text 
          style={[styles.sliderValue, { color: colors.primary }]}
          accessibilityLabel={`${exerciseMinutes} minutes selected`}
        >
          {exerciseMinutes} min/week
        </Text>
        
        <View style={styles.minutesButtonRow}>
          <TouchableOpacity
            style={[styles.minuteAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExerciseMinutes(Math.max(0, exerciseMinutes - 15))}
            accessibilityLabel="Decrease by 15 minutes"
          >
            <Icon name="minus" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.minutesDisplay}>
            <Text style={[styles.minutesDisplayText, { color: colors.text }]}>
              {exerciseMinutes}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.minuteAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExerciseMinutes(Math.min(420, exerciseMinutes + 15))}
            accessibilityLabel="Increase by 15 minutes"
          >
            <Icon name="plus" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.presetsLabel, { color: colors.secondary }]}>Quick select:</Text>
        <View style={styles.presetsRow}>
          {minutePresets.map((min) => (
            <TouchableOpacity
              key={min}
              style={[
                styles.presetButton,
                { 
                  backgroundColor: exerciseMinutes === min ? colors.primary : colors.card,
                  borderColor: exerciseMinutes === min ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setExerciseMinutes(min)}
              accessibilityRole="button"
              accessibilityState={{ selected: exerciseMinutes === min }}
            >
              <Text style={[
                styles.presetButtonText,
                { color: exerciseMinutes === min ? '#FFFFFF' : colors.text }
              ]}>
                {min}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={[styles.optimalRangeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon 
            name={exerciseMinutes >= 150 ? 'check-circle' : 'information'} 
            size={20} 
            color={exerciseMinutes >= 150 ? '#27AE60' : colors.secondary} 
          />
          <Text style={[styles.optimalRangeText, { color: colors.text }]}>
            {exerciseMinutes >= 150 
              ? '🎉 Meeting WHO guidelines for physical activity!' 
              : exerciseMinutes >= 75
                ? '💪 Getting there! Aim for 150 minutes per week.'
                : '⚠️ Increase exercise to reduce diabetes risk. Target: 150 min/week.'}
          </Text>
        </View>
      </View>
    );
  };

  const renderWorkTypeQuestion = () => (
    <View style={styles.questionContent}>
      {workTypes.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[
            styles.workTypeOption,
            { 
              backgroundColor: workType === type.value ? `${colors.primary}15` : colors.card,
              borderColor: workType === type.value ? colors.primary : colors.border,
            }
          ]}
          onPress={() => setWorkType(type.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: workType === type.value }}
          accessibilityLabel={`${type.label}: ${type.description}`}
        >
          <View style={styles.workTypeContent}>
            <View style={[
              styles.workIcon,
              { backgroundColor: workType === type.value ? `${colors.primary}20` : colors.border }
            ]}>
              <Icon 
                name={type.icon} 
                size={28} 
                color={workType === type.value ? colors.primary : colors.secondary} 
              />
            </View>
            <View style={styles.workTextContainer}>
              <Text style={[
                styles.workLabel, 
                { color: workType === type.value ? colors.primary : colors.text }
              ]}>
                {type.label}
              </Text>
              <Text style={[styles.workDescription, { color: colors.secondary }]}>
                {type.description}
              </Text>
            </View>
            {workType === type.value && (
              <Icon name="check-circle" size={24} color={colors.primary} />
            )}
          </View>
        </TouchableOpacity>
      ))}
      
      {workType === 'desk' && (
        <View style={[styles.infoCard, { backgroundColor: '#E3F2FD', borderColor: '#3498DB' }]}>
          <Icon name="lightbulb-on" size={20} color="#3498DB" />
          <Text style={[styles.infoText, { color: '#1565C0' }]}>
            💡 Tip: Take short walking breaks every hour to improve metabolic health.
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuestion = () => {
    switch (questions[currentStep].id) {
      case 'avg_steps':
        return renderAvgStepsQuestion();
      case 'activity_level':
        return renderActivityLevelQuestion();
      case 'days_active':
        return renderDaysActiveQuestion();
      case 'exercise_minutes':
        return renderExerciseMinutesQuestion();
      case 'work_type':
        return renderWorkTypeQuestion();
      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    introCard: {
      backgroundColor: `${colors.primary}10`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    introIcon: {
      alignSelf: 'center',
      marginBottom: 12,
    },
    introTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    introText: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    progressContainer: {
      marginBottom: 24,
    },
    progressBar: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressText: {
      fontSize: 12,
      textAlign: 'right',
      marginTop: 8,
    },
    questionContainer: {
      flex: 1,
    },
    questionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    questionText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      lineHeight: 30,
    },
    questionDescription: {
      fontSize: 15,
      color: colors.secondary,
      marginBottom: 8,
      lineHeight: 22,
    },
    helpText: {
      fontSize: 13,
      color: colors.primary,
      fontStyle: 'italic',
      marginBottom: 24,
    },
    questionContent: {
      marginTop: 16,
    },
    sliderValue: {
      fontSize: 48,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 20,
    },
    stepsButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    stepAdjustButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    stepsDisplay: {
      paddingHorizontal: 32,
    },
    stepsDisplayText: {
      fontSize: 32,
      fontWeight: '700',
    },
    minutesButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    minuteAdjustButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    minutesDisplay: {
      paddingHorizontal: 32,
    },
    minutesDisplayText: {
      fontSize: 32,
      fontWeight: '700',
    },
    presetsLabel: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 12,
    },
    presetsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    presetButton: {
      minWidth: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      margin: 6,
      paddingHorizontal: 12,
    },
    presetButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    optimalRangeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 24,
      borderWidth: 1,
    },
    optimalRangeText: {
      fontSize: 14,
      marginLeft: 12,
      flex: 1,
      lineHeight: 20,
    },
    activityLevelOption: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
    },
    activityLevelContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    activityIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    activityTextContainer: {
      flex: 1,
    },
    activityLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    activityDescription: {
      fontSize: 13,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginHorizontal: -6,
    },
    dayButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      margin: 6,
    },
    dayButtonText: {
      fontSize: 24,
      fontWeight: '700',
    },
    daysLabel: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 16,
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 24,
      borderWidth: 1,
    },
    warningText: {
      fontSize: 14,
      marginLeft: 12,
      flex: 1,
      lineHeight: 20,
    },
    successCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 24,
      borderWidth: 1,
    },
    successText: {
      fontSize: 14,
      marginLeft: 12,
      flex: 1,
      lineHeight: 20,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 16,
      borderWidth: 1,
    },
    infoText: {
      fontSize: 14,
      marginLeft: 12,
      flex: 1,
      lineHeight: 20,
    },
    workTypeOption: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
    },
    workTypeContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    workIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    workTextContainer: {
      flex: 1,
    },
    workLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    workDescription: {
      fontSize: 13,
    },
    navigationButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 32,
      paddingBottom: 20,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      minWidth: 120,
      justifyContent: 'center',
    },
    prevButton: {
      borderWidth: 2,
    },
    nextButton: {
      flex: 1,
      marginLeft: 12,
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '600',
      marginHorizontal: 8,
    },
    submitButton: {
      flex: 1,
      marginLeft: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Baseline</Text>
        </View>

        {/* Intro Card (only on first question) */}
        {currentStep === 0 && (
          <View style={styles.introCard}>
            <Icon name="walk" size={40} color={colors.primary} style={styles.introIcon} />
            <Text style={styles.introTitle}>Let's understand your activity patterns</Text>
            <Text style={styles.introText}>
              These questions help establish your baseline activity habits. Your answers 
              will be used to assess diabetes risk and track improvements over time.
            </Text>
          </View>
        )}

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Question */}
        <Animated.View 
          style={[
            styles.questionContainer,
            { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }
          ]}
        >
          <Text style={styles.questionTitle}>{questions[currentStep].title}</Text>
          <Text 
            style={styles.questionText}
            accessibilityRole="header"
          >
            {questions[currentStep].question}
          </Text>
          <Text style={styles.questionDescription}>
            {questions[currentStep].description}
          </Text>
          <Text style={styles.helpText}>
            💡 {questions[currentStep].helpText}
          </Text>
          
          {renderQuestion()}
        </Animated.View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {currentStep > 0 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton, { borderColor: colors.border }]}
              onPress={goToPrevStep}
              accessibilityRole="button"
              accessibilityLabel="Previous question"
            >
              <Icon name="chevron-left" size={20} color={colors.text} />
              <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 120 }} />
          )}

          {currentStep < questions.length - 1 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={goToNextStep}
              accessibilityRole="button"
              accessibilityLabel="Next question"
            >
              <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Next</Text>
              <Icon name="chevron-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Save baseline and continue"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="check" size={20} color="#FFFFFF" />
                  <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Save Baseline</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StepBaselineScreen;