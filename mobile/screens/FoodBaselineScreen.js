import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const FoodBaselineScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [existingBaseline, setExistingBaseline] = useState(null);

  useEffect(() => {
    fetchBaselineQuestions();
    fetchExistingBaseline();
  }, []);

  const fetchBaselineQuestions = async () => {
    try {
      const response = await api.getFoodBaselineQuestions();
      
      if (response.success) {
        setQuestions(response.data.questions);
      }
    } catch (error) {
      console.error('Error fetching baseline questions:', error);
      toast.show('Failed to load questions', 'error');
    }
  };

  const fetchExistingBaseline = async () => {
    try {
      setLoading(true);
      
      const response = await api.getFoodBaseline();

      if (response.success && response.data) {
        setExistingBaseline(response.data);
        setResponses(response.data.responses || {});
      }
    } catch (error) {
      console.error('Error fetching existing baseline:', error);
      // It's okay if there's no existing baseline
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (key, value) => {
    setResponses(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    if (!responses[currentQuestion.key]) {
      toast.show('Please answer the current question', 'warning');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate all questions are answered
      const unansweredQuestions = questions.filter(q => !responses[q.key]);
      
      if (unansweredQuestions.length > 0) {
        Alert.alert(
          'Incomplete Assessment',
          `You have ${unansweredQuestions.length} unanswered question(s). Do you want to continue anyway?`,
          [
            { text: 'Go Back', style: 'cancel' },
            { text: 'Submit Anyway', onPress: () => submitBaseline() }
          ]
        );
        return;
      }

      await submitBaseline();
    } catch (error) {
      console.error('Error submitting baseline:', error);
      toast.show('Failed to submit assessment', 'error');
    }
  };

  const submitBaseline = async () => {
    try {
      setSaving(true);

      const response = await api.submitFoodBaseline(responses);

      if (response.success) {
        toast.show('Assessment saved successfully!', 'success');
        
        Alert.alert(
          'Assessment Complete',
          `Your baseline risk score is ${response.data.baseline_risk_score.toFixed(1)}%. You can now view your comprehensive risk assessment in the Food Intake screen.`,
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      }
    } catch (error) {
      console.error('Error submitting baseline:', error);
      toast.show('Failed to save assessment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderQuestion = () => {
    if (questions.length === 0 || currentQuestionIndex >= questions.length) {
      return null;
    }

    const question = questions[currentQuestionIndex];
    const currentResponse = responses[question.key];

    return (
      <View style={styles.questionContainer}>
        <Text style={[styles.questionNumber, { color: colors.primary }]}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        
        <Text style={[styles.questionText, { color: colors.text }]}>
          {question.question}
        </Text>

        {question.type === 'scale' && question.options && (
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: currentResponse === option ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => handleResponseChange(question.key, option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: currentResponse === option ? '#FFF' : colors.text,
                    }
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {question.type === 'number' && (
          <TextInput
            style={[
              styles.numberInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              }
            ]}
            keyboardType="numeric"
            placeholder="Enter number"
            placeholderTextColor={colors.secondary}
            value={currentResponse ? currentResponse.toString() : ''}
            onChangeText={(text) => handleResponseChange(question.key, parseFloat(text) || 0)}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Food Baseline Assessment</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Icon name="information" size={24} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              This assessment helps us understand your eating habits to evaluate your risk of prediabetes.
              Your responses will be combined with your daily food logs for a comprehensive analysis.
            </Text>
          </View>

          {existingBaseline && (
            <View style={[styles.existingBaselineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="check-circle" size={20} color={colors.success} />
              <Text style={[styles.existingBaselineText, { color: colors.text }]}>
                You have completed this assessment. You can edit your responses below.
              </Text>
            </View>
          )}

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  backgroundColor: colors.primary,
                }
              ]}
            />
          </View>

          {renderQuestion()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={[styles.navigationContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.navButton,
              {
                backgroundColor: currentQuestionIndex === 0 ? colors.disabled : colors.secondary,
              }
            ]}
            onPress={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <Icon name="chevron-left" size={24} color="#FFF" />
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.navButtonText}>
                  {currentQuestionIndex === questions.length - 1 ? 'Submit' : 'Next'}
                </Text>
                <Icon name="chevron-right" size={24} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  existingBaselineCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  existingBaselineText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  numberInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FoodBaselineScreen;
