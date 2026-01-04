import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export default function HealthMetricsSetupScreen({ onComplete, onSkip, navigation }) {
  const { colors: theme, isDarkMode } = useTheme();
  const toast = useToast();
  
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [diagnosisStatus, setDiagnosisStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Show skip button only during initial setup (when onSkip prop is provided)
  const showSkipButton = !!onSkip;

  // Calculate BMI in real-time
  const calculateBMI = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      const heightInMeters = h / 100;
      return (w / (heightInMeters * heightInMeters)).toFixed(1);
    }
    return null;
  };

  // Get BMI category and color based on WHO standards
  const getBMICategory = (bmi) => {
    if (!bmi) return null;
    const bmiValue = parseFloat(bmi);
    
    if (bmiValue < 18.5) {
      return { category: 'Underweight', color: '#3498db', icon: 'arrow-down-circle' };
    } else if (bmiValue >= 18.5 && bmiValue < 25) {
      return { category: 'Normal Weight', color: '#27ae60', icon: 'checkmark-circle' };
    } else if (bmiValue >= 25 && bmiValue < 30) {
      return { category: 'Overweight', color: '#f39c12', icon: 'warning' };
    } else if (bmiValue >= 30 && bmiValue < 35) {
      return { category: 'Obese Class I', color: '#e67e22', icon: 'alert-circle' };
    } else if (bmiValue >= 35 && bmiValue < 40) {
      return { category: 'Obese Class II', color: '#d35400', icon: 'alert-circle' };
    } else {
      return { category: 'Obese Class III', color: '#c0392b', icon: 'alert-circle' };
    }
  };

  const currentBMI = calculateBMI();
  const bmiInfo = getBMICategory(currentBMI);

  const validateForm = () => {
    const newErrors = {};

    if (!age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 150) {
      newErrors.age = 'Please enter a valid age (1-150)';
    }

    if (!sex) {
      newErrors.sex = 'Please select your sex';
    }

    if (!height) {
      newErrors.height = 'Height is required';
    } else if (isNaN(height) || parseFloat(height) < 50 || parseFloat(height) > 300) {
      newErrors.height = 'Please enter a valid height in cm (50-300)';
    }

    if (!weight) {
      newErrors.weight = 'Weight is required';
    } else if (isNaN(weight) || parseFloat(weight) < 10 || parseFloat(weight) > 500) {
      newErrors.weight = 'Please enter a valid weight in kg (10-500)';
    }

    if (!diagnosisStatus) {
      newErrors.diagnosisStatus = 'Please select your diagnosis status';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all fields correctly');
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await api.updateHealthMetrics(
        parseInt(age),
        sex.toLowerCase(),
        parseFloat(height),
        parseFloat(weight),
        diagnosisStatus
      );

      if (response.success) {
        const bmi = response.bmi;
        toast.success(`Health metrics saved! ${bmi ? `Your BMI: ${bmi}` : ''}`);
        onComplete();
      } else {
        toast.error('Failed to save health metrics');
      }
    } catch (error) {
      console.error('Error saving health metrics:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Only allow skip when onSkip prop is provided (initial setup)
    if (onSkip) {
      onSkip();
    } else if (navigation) {
      // If no onSkip but navigation exists, just go back
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={theme.statusBar} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="fitness" size={50} color={theme.primary} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>
            Complete Your Profile
          </Text>
          <Text style={[styles.subtitle, { color: theme.secondary }]}>
            Help us personalize your experience by providing your health metrics
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Age Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Age (years)</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.age ? theme.error : theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Enter your age"
                placeholderTextColor={theme.inputPlaceholder}
                value={age}
                onChangeText={(text) => {
                  setAge(text);
                  if (errors.age) setErrors({ ...errors, age: null });
                }}
                keyboardType="numeric"
              />
            </View>
            {errors.age && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.age}
              </Text>
            )}
          </View>

          {/* Sex Selection */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Sex</Text>
            <View style={styles.sexButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.sexButton,
                  {
                    backgroundColor: sex === 'male' ? theme.primary : theme.inputBackground,
                    borderColor: errors.sex ? theme.error : (sex === 'male' ? theme.primary : theme.inputBorder),
                  },
                ]}
                onPress={() => {
                  setSex('male');
                  if (errors.sex) setErrors({ ...errors, sex: null });
                }}
              >
                <Ionicons
                  name="male"
                  size={24}
                  color={sex === 'male' ? '#FFFFFF' : theme.secondary}
                />
                <Text style={[
                  styles.sexButtonText,
                  { color: sex === 'male' ? '#FFFFFF' : theme.text }
                ]}>
                  Male
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sexButton,
                  {
                    backgroundColor: sex === 'female' ? theme.primary : theme.inputBackground,
                    borderColor: errors.sex ? theme.error : (sex === 'female' ? theme.primary : theme.inputBorder),
                  },
                ]}
                onPress={() => {
                  setSex('female');
                  if (errors.sex) setErrors({ ...errors, sex: null });
                }}
              >
                <Ionicons
                  name="female"
                  size={24}
                  color={sex === 'female' ? '#FFFFFF' : theme.secondary}
                />
                <Text style={[
                  styles.sexButtonText,
                  { color: sex === 'female' ? '#FFFFFF' : theme.text }
                ]}>
                  Female
                </Text>
              </TouchableOpacity>
            </View>
            {errors.sex && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.sex}
              </Text>
            )}
          </View>

          {/* Height Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Height (cm)</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.height ? theme.error : theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="resize-outline"
                size={20}
                color={theme.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Enter your height in cm"
                placeholderTextColor={theme.inputPlaceholder}
                value={height}
                onChangeText={(text) => {
                  setHeight(text);
                  if (errors.height) setErrors({ ...errors, height: null });
                }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.height && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.height}
              </Text>
            )}
          </View>

          {/* Weight Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Weight (kg)</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.weight ? theme.error : theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="scale-outline"
                size={20}
                color={theme.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Enter your weight in kg"
                placeholderTextColor={theme.inputPlaceholder}
                value={weight}
                onChangeText={(text) => {
                  setWeight(text);
                  if (errors.weight) setErrors({ ...errors, weight: null });
                }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.weight && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.weight}
              </Text>
            )}
          </View>

          {/* Diagnosis Status Selection */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Diagnosis Status</Text>
            <View style={styles.diagnosisButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.diagnosisButton,
                  {
                    backgroundColor: diagnosisStatus === 'not_diagnosed' ? theme.primary : theme.inputBackground,
                    borderColor: errors.diagnosisStatus ? theme.error : (diagnosisStatus === 'not_diagnosed' ? theme.primary : theme.inputBorder),
                  },
                ]}
                onPress={() => {
                  setDiagnosisStatus('not_diagnosed');
                  if (errors.diagnosisStatus) setErrors({ ...errors, diagnosisStatus: null });
                }}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color={diagnosisStatus === 'not_diagnosed' ? '#FFFFFF' : theme.secondary}
                />
                <Text style={[
                  styles.diagnosisButtonText,
                  { color: diagnosisStatus === 'not_diagnosed' ? '#FFFFFF' : theme.text }
                ]}>
                  I am not diagnosed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.diagnosisButton,
                  {
                    backgroundColor: diagnosisStatus === 'prediabetes' ? theme.primary : theme.inputBackground,
                    borderColor: errors.diagnosisStatus ? theme.error : (diagnosisStatus === 'prediabetes' ? theme.primary : theme.inputBorder),
                  },
                ]}
                onPress={() => {
                  setDiagnosisStatus('prediabetes');
                  if (errors.diagnosisStatus) setErrors({ ...errors, diagnosisStatus: null });
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={24}
                  color={diagnosisStatus === 'prediabetes' ? '#FFFFFF' : theme.secondary}
                />
                <Text style={[
                  styles.diagnosisButtonText,
                  { color: diagnosisStatus === 'prediabetes' ? '#FFFFFF' : theme.text }
                ]}>
                  I am diagnosed with Prediabetes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.diagnosisButton,
                  {
                    backgroundColor: diagnosisStatus === 'type2_diabetes' ? theme.primary : theme.inputBackground,
                    borderColor: errors.diagnosisStatus ? theme.error : (diagnosisStatus === 'type2_diabetes' ? theme.primary : theme.inputBorder),
                  },
                ]}
                onPress={() => {
                  setDiagnosisStatus('type2_diabetes');
                  if (errors.diagnosisStatus) setErrors({ ...errors, diagnosisStatus: null });
                }}
              >
                <Ionicons
                  name="medical-outline"
                  size={24}
                  color={diagnosisStatus === 'type2_diabetes' ? '#FFFFFF' : theme.secondary}
                />
                <Text style={[
                  styles.diagnosisButtonText,
                  { color: diagnosisStatus === 'type2_diabetes' ? '#FFFFFF' : theme.text }
                ]}>
                  I am diagnosed with Type 2 Diabetes
                </Text>
              </TouchableOpacity>
            </View>
            {errors.diagnosisStatus && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.diagnosisStatus}
              </Text>
            )}
          </View>

          {/* Info Box */}
          <View style={[styles.infoBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              This information helps us calculate your BMI and provide personalized recommendations.
            </Text>
          </View>

          {/* BMI Display */}
          {currentBMI && bmiInfo && (
            <View style={[styles.bmiContainer, { backgroundColor: bmiInfo.color + '15', borderColor: bmiInfo.color + '40' }]}>
              <View style={styles.bmiHeader}>
                <Ionicons name={bmiInfo.icon} size={28} color={bmiInfo.color} />
                <View style={styles.bmiTextContainer}>
                  <Text style={[styles.bmiLabel, { color: theme.secondary }]}>Your BMI</Text>
                  <Text style={[styles.bmiValue, { color: theme.text }]}>{currentBMI}</Text>
                </View>
              </View>
              <View style={[styles.bmiCategoryBadge, { backgroundColor: bmiInfo.color }]}>
                <Text style={styles.bmiCategoryText}>{bmiInfo.category}</Text>
              </View>
              <Text style={[styles.bmiDescription, { color: theme.secondary }]}>
                {bmiInfo.category === 'Normal Weight' 
                  ? 'Great! You are within a healthy weight range.'
                  : bmiInfo.category === 'Underweight'
                  ? 'Consider consulting with a healthcare provider about healthy weight gain.'
                  : bmiInfo.category === 'Overweight'
                  ? 'Consider a balanced diet and regular exercise for better health.'
                  : 'We recommend consulting with a healthcare provider for personalized guidance.'}
              </Text>
            </View>
          )}

          {/* BMI Reference Citation */}
          <View style={[styles.referenceBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.referenceTitle, { color: theme.text }]}>BMI Classification Reference</Text>
            <Text style={[styles.referenceText, { color: theme.secondary }]}>
              Based on World Health Organization (WHO) standards for adults:
            </Text>
            <View style={styles.referenceList}>
              <Text style={[styles.referenceItem, { color: theme.secondary }]}>• Underweight: BMI &lt; 18.5</Text>
              <Text style={[styles.referenceItem, { color: theme.secondary }]}>• Normal weight: BMI 18.5 - 24.9</Text>
              <Text style={[styles.referenceItem, { color: theme.secondary }]}>• Overweight: BMI 25.0 - 29.9</Text>
              <Text style={[styles.referenceItem, { color: theme.secondary }]}>• Obese: BMI ≥ 30.0</Text>
            </View>
            <Text style={[styles.referenceSource, { color: theme.secondary }]}>
              Source: WHO Global Database on Body Mass Index (BMI)
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary },
              isLoading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Skip Button */}
          {showSkipButton && (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              disabled={isLoading}
            >
              <Text style={[styles.skipButtonText, { color: theme.secondary }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  sexButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  sexButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  sexButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  diagnosisButtonsContainer: {
    gap: 12,
  },
  diagnosisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 15,
  },
  diagnosisButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    textAlign: 'left',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 25,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 55,
    borderRadius: 12,
    marginBottom: 15,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bmiContainer: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 20,
  },
  bmiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bmiTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  bmiLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  bmiValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  bmiCategoryBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bmiCategoryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bmiDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  referenceBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 25,
  },
  referenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  referenceText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  referenceList: {
    marginLeft: 8,
    marginBottom: 8,
  },
  referenceItem: {
    fontSize: 11,
    lineHeight: 16,
  },
  referenceSource: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
