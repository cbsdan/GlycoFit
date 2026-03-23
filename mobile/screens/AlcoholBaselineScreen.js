/**
 * Alcohol Baseline Assessment Screen
 * 
 * Multi-step questionnaire to establish user's typical drinking pattern
 * over the past 3 months. Required before daily alcohol logging.
 * 
 * Evidence-based assessment using CDC/NIAAA guidelines and ADA research.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { createAlcoholBaseline, updateAlcoholBaseline, getAlcoholBaseline } from '../services/api';

const { width } = Dimensions.get('window');

const AlcoholBaselineScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isRetake = route?.params?.isRetake || false;

  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [baselineDrinkingDaysPerWeek, setBaselineDrinkingDaysPerWeek] = useState(0);
  const [baselineDrinksPerOccasion, setBaselineDrinksPerOccasion] = useState(0);
  const [baselineBingeFrequencyPerMonth, setBaselineBingeFrequencyPerMonth] = useState(0);
  const [drinkingPattern, setDrinkingPattern] = useState('none');
  const [yearsAtCurrentPattern, setYearsAtCurrentPattern] = useState(0);
  const [drinksWithMeals, setDrinksWithMeals] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showStandardDrinkModal, setShowStandardDrinkModal] = useState(false);

  const userGender = user?.gender?.toLowerCase() || 'male';
  const bingeDrinkThreshold = userGender === 'female' ? 4 : 5;

  useEffect(() => {
    if (isRetake) {
      loadExistingBaseline();
    } else {
      setLoadingExisting(false);
    }
  }, []);

  const loadExistingBaseline = async () => {
    try {
      const baseline = await getAlcoholBaseline();
      if (baseline) {
        setBaselineDrinkingDaysPerWeek(baseline.baseline_drinking_days_per_week || 0);
        setBaselineDrinksPerOccasion(baseline.baseline_drinks_per_occasion || 0);
        setBaselineBingeFrequencyPerMonth(baseline.baseline_binge_frequency_per_month || 0);
        setDrinkingPattern(baseline.drinking_pattern || 'none');
        setYearsAtCurrentPattern(baseline.years_at_current_pattern || 0);
        setDrinksWithMeals(baseline.drinks_with_meals || false);
      }
    } catch (error) {
      console.error('Error loading baseline:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  const steps = [
    {
      id: 0,
      title: 'Drinking Frequency',
      question: 'How many days per week do you typically drink alcohol?',
      subtitle: 'Think about your average drinking pattern over the past 3 months',
      value: baselineDrinkingDaysPerWeek,
      setValue: setBaselineDrinkingDaysPerWeek,
      min: 0,
      max: 7,
      step: 1,
      unit: 'days/week',
      icon: 'calendar-week',
    },
    {
      id: 1,
      title: 'Drinks Per Occasion',
      question: 'On a typical drinking day, how many drinks do you consume?',
      subtitle: '1 drink = 12oz beer, 5oz wine, or 1.5oz spirits (14g alcohol)',
      value: baselineDrinksPerOccasion,
      setValue: setBaselineDrinksPerOccasion,
      min: 0,
      max: 20,
      step: 0.5,
      unit: 'drinks',
      icon: 'glass-cocktail',
    },
    {
      id: 2,
      title: 'Binge Episodes',
      question: `In the past month, how many times did you have ${bingeDrinkThreshold}+ drinks in one occasion?`,
      subtitle: userGender === 'female' 
        ? 'For women: ≥4 drinks within ~2 hours' 
        : 'For men: ≥5 drinks within ~2 hours',
      value: baselineBingeFrequencyPerMonth,
      setValue: setBaselineBingeFrequencyPerMonth,
      min: 0,
      max: 31,
      step: 1,
      unit: 'episodes',
      icon: 'alert-circle',
    },
    {
      id: 3,
      title: 'Drinking Pattern',
      question: 'Which best describes your drinking pattern?',
      subtitle: 'Select the option that most closely matches your habits',
      type: 'select',
      value: drinkingPattern,
      setValue: setDrinkingPattern,
      options: [
        { label: "I don't drink", value: 'none', icon: 'glass-wine', color: '#4CAF50' },
        { label: 'Special occasions only', value: 'occasional', icon: 'party-popper', color: '#8BC34A' },
        { label: 'Weekends only', value: 'weekends', icon: 'calendar-weekend', color: '#FFC107' },
        { label: 'Most weeks', value: 'regular', icon: 'calendar-check', color: '#FF9800' },
        { label: 'Daily', value: 'daily', icon: 'calendar-today', color: '#F44336' },
      ],
      icon: 'timeline',
    },
    {
      id: 4,
      title: 'Duration',
      question: 'How long have you maintained this drinking pattern?',
      subtitle: 'Longer duration at heavy drinking increases diabetes risk',
      value: yearsAtCurrentPattern,
      setValue: setYearsAtCurrentPattern,
      min: 0,
      max: 50,
      step: 1,
      unit: 'years',
      icon: 'clock-outline',
    },
    {
      id: 5,
      title: 'Meal Context',
      question: 'Do you typically drink with meals?',
      subtitle: 'Drinking with food reduces diabetes risk',
      type: 'boolean',
      value: drinksWithMeals,
      setValue: setDrinksWithMeals,
      icon: 'silverware-fork-knife',
    },
  ];

  const currentStepData = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Upsert: try update first, create only if no baseline exists yet
      try {
        await updateAlcoholBaseline(
          baselineDrinkingDaysPerWeek,
          baselineDrinksPerOccasion,
          baselineBingeFrequencyPerMonth,
          drinkingPattern,
          yearsAtCurrentPattern,
          drinksWithMeals
        );
      } catch (updateError) {
        if (updateError?.response?.status === 404) {
          await createAlcoholBaseline(
            baselineDrinkingDaysPerWeek,
            baselineDrinksPerOccasion,
            baselineBingeFrequencyPerMonth,
            drinkingPattern,
            yearsAtCurrentPattern,
            drinksWithMeals
          );
        } else {
          throw updateError;
        }
      }

      Alert.alert(
        'Success',
        isRetake 
          ? 'Baseline updated successfully!' 
          : 'Baseline assessment completed! You can now log daily alcohol consumption.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (isRetake) {
                navigation.goBack();
              } else {
                navigation.replace('AlcoholTracking');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving baseline:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to save baseline. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSliderStep = () => (
    <View style={styles.stepContent}>
      <Icon name={currentStepData.icon} size={64} color={colors.primary} style={styles.stepIcon} />
      
      <Text style={[styles.question, { color: colors.text }]}>
        {currentStepData.question}
      </Text>
      
      {currentStep === 1 ? (
        <View style={styles.subtitleContainer}>
          <Text style={[styles.subtitle, styles.marginBotLow, { color: colors.secondary }]}>
            {currentStepData.subtitle}
          </Text>
          <TouchableOpacity onPress={() => setShowStandardDrinkModal(true)}>
            <Text style={[styles.linkText, { color: colors.primary }]}>
              See standard drink reference
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={[styles.subtitle, { color: colors.secondary }]}>
          {currentStepData.subtitle}
        </Text>
      )}

      <View style={styles.valueContainer}>
        <Text style={[styles.valueText, { color: colors.primary }]}>
          {currentStepData.value % 1 === 0 
            ? currentStepData.value.toFixed(0) 
            : currentStepData.value.toFixed(1)}
        </Text>
        <Text style={[styles.unitText, { color: colors.secondary }]}>
          {currentStepData.unit}
        </Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={currentStepData.min}
        maximumValue={currentStepData.max}
        step={currentStepData.step}
        value={currentStepData.value}
        onValueChange={currentStepData.setValue}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      <View style={styles.rangeLabels}>
        <Text style={[styles.rangeLabel, { color: colors.secondary }]}>
          {currentStepData.min}
        </Text>
        <Text style={[styles.rangeLabel, { color: colors.secondary }]}>
          {currentStepData.max}
        </Text>
      </View>
    </View>
  );

  const renderSelectStep = () => (
    <View style={styles.stepContent}>
      <Icon name={currentStepData.icon} size={64} color={colors.primary} style={styles.stepIcon} />
      
      <Text style={[styles.question, { color: colors.text }]}>
        {currentStepData.question}
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        {currentStepData.subtitle}
      </Text>

      <View style={styles.optionsContainer}>
        {currentStepData.options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionCard,
              { 
                backgroundColor: colors.card,
                borderColor: currentStepData.value === option.value ? option.color : colors.border,
                borderWidth: currentStepData.value === option.value ? 2 : 1,
              },
            ]}
            onPress={() => currentStepData.setValue(option.value)}
          >
            <Icon 
              name={option.icon} 
              size={32} 
              color={currentStepData.value === option.value ? option.color : colors.secondary} 
            />
            <Text 
              style={[
                styles.optionLabel, 
                { 
                  color: currentStepData.value === option.value ? colors.text : colors.secondary,
                  fontWeight: currentStepData.value === option.value ? '600' : '400',
                }
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderBooleanStep = () => (
    <View style={styles.stepContent}>
      <Icon name={currentStepData.icon} size={64} color={colors.primary} style={styles.stepIcon} />
      
      <Text style={[styles.question, { color: colors.text }]}>
        {currentStepData.question}
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        {currentStepData.subtitle}
      </Text>

      <View style={styles.booleanContainer}>
        <TouchableOpacity
          style={[
            styles.booleanCard,
            {
              backgroundColor: colors.card,
              borderColor: currentStepData.value === true ? '#4CAF50' : colors.border,
              borderWidth: currentStepData.value === true ? 2 : 1,
            },
          ]}
          onPress={() => currentStepData.setValue(true)}
        >
          <Icon 
            name="check-circle" 
            size={48} 
            color={currentStepData.value === true ? '#4CAF50' : colors.secondary} 
          />
          <Text 
            style={[
              styles.booleanLabel,
              { 
                color: currentStepData.value === true ? colors.text : colors.secondary,
                fontWeight: currentStepData.value === true ? '600' : '400',
              }
            ]}
          >
            Yes
          </Text>
          <Text style={[styles.booleanHint, { color: colors.secondary }]}>
            Protective factor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.booleanCard,
            {
              backgroundColor: colors.card,
              borderColor: currentStepData.value === false ? '#FF9800' : colors.border,
              borderWidth: currentStepData.value === false ? 2 : 1,
            },
          ]}
          onPress={() => currentStepData.setValue(false)}
        >
          <Icon 
            name="close-circle" 
            size={48} 
            color={currentStepData.value === false ? '#FF9800' : colors.secondary} 
          />
          <Text 
            style={[
              styles.booleanLabel,
              { 
                color: currentStepData.value === false ? colors.text : colors.secondary,
                fontWeight: currentStepData.value === false ? '600' : '400',
              }
            ]}
          >
            No
          </Text>
          <Text style={[styles.booleanHint, { color: colors.secondary }]}>
            Risk factor
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loadingExisting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Standard Drink Reference Modal */}
      <Modal
        visible={showStandardDrinkModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStandardDrinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Standard Drink Reference
              </Text>
              <TouchableOpacity
                onPress={() => setShowStandardDrinkModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Image
                source={require('../assets/standard-pour.jpg')}
                style={styles.standardDrinkImage}
                resizeMode="contain"
              />
              <Text style={[styles.modalDescription, { color: colors.secondary }]}>
                One standard drink contains approximately 14 grams of pure alcohol.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isRetake ? 'Update Baseline' : 'Baseline Assessment'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.secondary }]}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${progress}%`, backgroundColor: colors.primary }
          ]} 
        />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentStepData.type === 'select' && renderSelectStep()}
        {currentStepData.type === 'boolean' && renderBooleanStep()}
        {!currentStepData.type && renderSliderStep()}
      </ScrollView>

      {/* Footer buttons */}
      <View style={[styles.footer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>
                {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
              </Text>
              {currentStep < totalSteps - 1 && (
                <Icon name="arrow-right" size={20} color="#FFFFFF" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  progressContainer: {
    height: 4,
  },
  progressBar: {
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContent: {
    alignItems: 'center',
  },
  stepIcon: {
    marginBottom: 24,
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },  subtitleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  }, marginBotLow: {
    marginBottom: 0
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 16,
  },
  standardDrinkImage: {
    width: '100%',
    height: 300,
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },  subtitleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 16,
  },
  standardDrinkImage: {
    width: '100%',
    height: 300,
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  valueText: {
    fontSize: 48,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 16,
    marginTop: 4,
  },
  slider: {
    width: width - 80,
    height: 40,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width - 80,
    marginTop: 8,
  },
  rangeLabel: {
    fontSize: 14,
  },
  optionsContainer: {
    width: '100%',
    marginTop: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  booleanContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 32,
  },
  booleanCard: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  booleanLabel: {
    fontSize: 18,
    marginTop: 12,
  },
  booleanHint: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default AlcoholBaselineScreen;
