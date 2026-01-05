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
import { createSleepBaseline, updateSleepBaseline } from '../services/api';

/**
 * SleepBaselineScreen - Mandatory onboarding questionnaire for sleep tracking
 * 
 * This screen collects the user's baseline sleep pattern which:
 * - Is required before daily tracking can begin
 * - Can only be submitted once (immutable)
 * - Provides initial risk assessment before daily data accumulates
 */
const SleepBaselineScreen = ({ navigation, route }) => {
  const { colors, isDarkMode } = useTheme();
  
  // Check if editing existing baseline
  const existingBaseline = route.params?.baseline;
  const isEditMode = !!existingBaseline;
  
  // Parse existing times if in edit mode
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const [hour, minute] = timeStr.split(':').map(Number);
    return { hour, minute };
  };
  
  // Form state - pre-fill if editing
  const [currentStep, setCurrentStep] = useState(0);
  const [avgSleepHours, setAvgSleepHours] = useState(
    existingBaseline?.baseline_avg_sleep_hours || 7
  );
  const [nights6hPlus, setNights6hPlus] = useState(
    existingBaseline?.baseline_nights_6h_plus_per_week || 5
  );
  const [bedtimeConsistency, setBedtimeConsistency] = useState(
    existingBaseline?.baseline_bedtime_consistency || 3
  );
  const [usualBedtime, setUsualBedtime] = useState(
    parseTime(existingBaseline?.usual_bedtime) || { hour: 22, minute: 30 }
  );
  const [usualWakeTime, setUsualWakeTime] = useState(
    parseTime(existingBaseline?.usual_wake_time) || { hour: 6, minute: 30 }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const questions = [
    {
      id: 'avg_sleep',
      title: 'Average Sleep Duration',
      question: 'On average, how many hours do you usually sleep per night?',
      description: 'Think about your typical sleep over the past month.',
      helpText: 'Research shows 7-8 hours is optimal for metabolic health.',
      accessibilityHint: 'Use the slider to select your average hours of sleep per night',
    },
    {
      id: 'nights_6h',
      title: 'Adequate Sleep Nights',
      question: 'On how many nights per week do you usually sleep at least 6 hours?',
      description: 'Count nights where you got 6 or more hours of sleep.',
      helpText: 'Getting less than 6 hours increases insulin resistance risk.',
      accessibilityHint: 'Select the number of nights per week you sleep at least 6 hours',
    },
    {
      id: 'consistency',
      title: 'Bedtime Consistency',
      question: 'Is your bedtime usually consistent?',
      description: 'Do you go to bed around the same time each night?',
      helpText: 'Irregular sleep schedules can affect blood sugar regulation.',
      accessibilityHint: 'Rate how consistent your bedtime is from 1 to 5',
    },
    {
      id: 'bedtime',
      title: 'Usual Bedtime',
      question: 'What time do you usually go to bed?',
      description: 'Select your typical bedtime on weeknights.',
      helpText: 'This helps us track bedtime variability over time.',
      accessibilityHint: 'Select your usual bedtime hour and minute',
    },
    {
      id: 'wake_time',
      title: 'Usual Wake Time',
      question: 'What time do you usually wake up?',
      description: 'Select your typical wake time on weekdays.',
      helpText: 'Consistent wake times support healthy circadian rhythms.',
      accessibilityHint: 'Select your usual wake time hour and minute',
    },
  ];

  const consistencyLabels = [
    { value: 1, label: 'Very inconsistent', description: 'Bedtime varies by 2+ hours' },
    { value: 2, label: 'Somewhat inconsistent', description: 'Bedtime varies by 1-2 hours' },
    { value: 3, label: 'Moderately consistent', description: 'Bedtime varies by 30-60 min' },
    { value: 4, label: 'Mostly consistent', description: 'Bedtime varies by 15-30 min' },
    { value: 5, label: 'Very consistent', description: 'Same bedtime every night' },
  ];

  const formatTime = (hour, minute) => {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatTimeFor24h = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

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
      const bedtime24 = formatTimeFor24h(usualBedtime.hour, usualBedtime.minute);
      const waketime24 = formatTimeFor24h(usualWakeTime.hour, usualWakeTime.minute);
      
      if (isEditMode) {
        await updateSleepBaseline(
          avgSleepHours,
          nights6hPlus,
          bedtimeConsistency,
          bedtime24,
          waketime24
        );
      } else {
        await createSleepBaseline(
          avgSleepHours,
          nights6hPlus,
          bedtimeConsistency,
          bedtime24,
          waketime24
        );
      }
      
      // Announce success for screen readers
      AccessibilityInfo.announceForAccessibility(
        isEditMode ? 'Sleep baseline updated successfully' : 'Sleep baseline saved successfully'
      );
      
      // Navigate back - parent screen will refresh via useFocusEffect
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.error || 
        (isEditMode ? 'Failed to update sleep baseline' : 'Failed to save sleep baseline');
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

  const renderAvgSleepQuestion = () => {
    // Available sleep hours options (3 to 12 in 0.5 increments)
    const sleepOptions = [];
    for (let h = 3; h <= 12; h += 0.5) {
      sleepOptions.push(h);
    }
    
    return (
      <View style={styles.questionContent}>
        <Text 
          style={[styles.sliderValue, { color: colors.primary }]}
          accessibilityLabel={`${avgSleepHours} hours selected`}
        >
          {avgSleepHours} hours
        </Text>
        
        {/* Quick select buttons */}
        <View style={styles.hoursButtonRow}>
          <TouchableOpacity
            style={[styles.hourAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAvgSleepHours(Math.max(3, avgSleepHours - 0.5))}
            accessibilityLabel="Decrease by half hour"
          >
            <Icon name="minus" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.hoursDisplay}>
            <Text style={[styles.hoursDisplayText, { color: colors.text }]}>
              {avgSleepHours}h
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.hourAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAvgSleepHours(Math.min(12, avgSleepHours + 0.5))}
            accessibilityLabel="Increase by half hour"
          >
            <Icon name="plus" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        {/* Common presets */}
        <Text style={[styles.presetsLabel, { color: colors.secondary }]}>Quick select:</Text>
        <View style={styles.presetsRow}>
          {[5, 6, 7, 8, 9].map((h) => (
            <TouchableOpacity
              key={h}
              style={[
                styles.presetButton,
                { 
                  backgroundColor: avgSleepHours === h ? colors.primary : colors.card,
                  borderColor: avgSleepHours === h ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setAvgSleepHours(h)}
              accessibilityRole="button"
              accessibilityState={{ selected: avgSleepHours === h }}
            >
              <Text style={[
                styles.presetButtonText,
                { color: avgSleepHours === h ? '#FFFFFF' : colors.text }
              ]}>
                {h}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Visual indicator for optimal range */}
        <View style={[styles.optimalRangeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon 
            name={avgSleepHours >= 7 && avgSleepHours <= 8 ? 'check-circle' : 'information'} 
            size={20} 
            color={avgSleepHours >= 7 && avgSleepHours <= 8 ? '#27AE60' : colors.secondary} 
          />
          <Text style={[styles.optimalRangeText, { color: colors.text }]}>
            {avgSleepHours >= 7 && avgSleepHours <= 8 
              ? 'This is the optimal range for metabolic health!' 
              : avgSleepHours < 6 
                ? 'Less than 6 hours may increase diabetes risk'
                : avgSleepHours > 9
                  ? 'More than 9 hours may indicate other health concerns'
                  : 'Getting closer to the optimal 7-8 hours'}
          </Text>
        </View>
      </View>
    );
  };

  const renderNights6hQuestion = () => (
    <View style={styles.questionContent}>
      <View style={styles.nightsGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.nightButton,
              { 
                backgroundColor: nights6hPlus === num ? colors.primary : colors.card,
                borderColor: nights6hPlus === num ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setNights6hPlus(num)}
            accessibilityRole="button"
            accessibilityState={{ selected: nights6hPlus === num }}
            accessibilityLabel={`${num} nights`}
          >
            <Text 
              style={[
                styles.nightButtonText, 
                { color: nights6hPlus === num ? '#FFFFFF' : colors.text }
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.nightsLabel, { color: colors.secondary }]}>
        nights per week
      </Text>
      
      {nights6hPlus < 5 && (
        <View style={[styles.warningCard, { backgroundColor: '#FFF3CD', borderColor: '#F39C12' }]}>
          <Icon name="alert" size={20} color="#F39C12" />
          <Text style={[styles.warningText, { color: '#856404' }]}>
            Getting adequate sleep on fewer than 5 nights may increase metabolic risk.
          </Text>
        </View>
      )}
    </View>
  );

  const renderConsistencyQuestion = () => (
    <View style={styles.questionContent}>
      {consistencyLabels.map((item) => (
        <TouchableOpacity
          key={item.value}
          style={[
            styles.consistencyOption,
            { 
              backgroundColor: bedtimeConsistency === item.value ? `${colors.primary}15` : colors.card,
              borderColor: bedtimeConsistency === item.value ? colors.primary : colors.border,
            }
          ]}
          onPress={() => setBedtimeConsistency(item.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: bedtimeConsistency === item.value }}
          accessibilityLabel={`${item.label}: ${item.description}`}
        >
          <View style={styles.consistencyOptionContent}>
            <View style={[
              styles.radioCircle,
              { borderColor: bedtimeConsistency === item.value ? colors.primary : colors.border }
            ]}>
              {bedtimeConsistency === item.value && (
                <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <View style={styles.consistencyTextContainer}>
              <Text style={[
                styles.consistencyLabel, 
                { color: bedtimeConsistency === item.value ? colors.primary : colors.text }
              ]}>
                {item.label}
              </Text>
              <Text style={[styles.consistencyDescription, { color: colors.secondary }]}>
                {item.description}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTimePicker = (time, setTime, label) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = [0, 15, 30, 45];
    
    return (
      <View style={styles.questionContent}>
        <View style={[styles.timePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.timeDisplay, { color: colors.primary }]}>
            {formatTime(time.hour, time.minute)}
          </Text>
          
          <View style={styles.timePickerRow}>
            <View style={styles.timeColumn}>
              <Text style={[styles.timeColumnLabel, { color: colors.secondary }]}>Hour</Text>
              <View style={styles.timeScrollContainer}>
                <ScrollView 
                  style={styles.timeScroll} 
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  accessibilityLabel={`${label} hour selector`}
                >
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.timeOption,
                        time.hour === h && { backgroundColor: `${colors.primary}20` }
                      ]}
                      onPress={() => setTime({ ...time, hour: h })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: time.hour === h }}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        { color: time.hour === h ? colors.primary : colors.text }
                      ]}>
                        {formatTime(h, 0).split(':')[0]} {h >= 12 ? 'PM' : 'AM'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            <View style={styles.timeColumn}>
              <Text style={[styles.timeColumnLabel, { color: colors.secondary }]}>Minute</Text>
              <View style={styles.timeScrollContainer}>
                <ScrollView 
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  accessibilityLabel={`${label} minute selector`}
                >
                  {minutes.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.timeOption,
                        time.minute === m && { backgroundColor: `${colors.primary}20` }
                      ]}
                      onPress={() => setTime({ ...time, minute: m })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: time.minute === m }}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        { color: time.minute === m ? colors.primary : colors.text }
                      ]}>
                        :{m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderQuestion = () => {
    switch (questions[currentStep].id) {
      case 'avg_sleep':
        return renderAvgSleepQuestion();
      case 'nights_6h':
        return renderNights6hQuestion();
      case 'consistency':
        return renderConsistencyQuestion();
      case 'bedtime':
        return renderTimePicker(usualBedtime, setUsualBedtime, 'Bedtime');
      case 'wake_time':
        return renderTimePicker(usualWakeTime, setUsualWakeTime, 'Wake time');
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
    hoursButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    hourAdjustButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    hoursDisplay: {
      paddingHorizontal: 32,
    },
    hoursDisplayText: {
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
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      margin: 6,
    },
    presetButtonText: {
      fontSize: 16,
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
    nightsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginHorizontal: -6,
    },
    nightButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      margin: 6,
    },
    nightButtonText: {
      fontSize: 24,
      fontWeight: '700',
    },
    nightsLabel: {
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
    consistencyOption: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
    },
    consistencyOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    radioCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    radioFill: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    consistencyTextContainer: {
      flex: 1,
    },
    consistencyLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    consistencyDescription: {
      fontSize: 13,
    },
    timePickerContainer: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
    },
    timeDisplay: {
      fontSize: 36,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 20,
    },
    timePickerRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    timeColumn: {
      alignItems: 'center',
      flex: 1,
    },
    timeColumnLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    timeScrollContainer: {
      height: 200,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    timeScroll: {
      flex: 1,
    },
    timeOption: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      marginVertical: 2,
    },
    timeOptionText: {
      fontSize: 16,
      textAlign: 'center',
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
          <Text style={styles.headerTitle}>Sleep Baseline</Text>
        </View>

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
        {/* Intro Card (only on first question) */}
        {currentStep === 0 && (
          <View style={styles.introCard}>
            <Icon name="moon-waning-crescent" size={40} color={colors.primary} style={styles.introIcon} />
            <Text style={styles.introTitle}>Let's understand your sleep patterns</Text>
            <Text style={styles.introText}>
              These questions help establish your baseline sleep habits. Your answers 
              will be used to assess diabetes risk and track improvements over time.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default SleepBaselineScreen;
