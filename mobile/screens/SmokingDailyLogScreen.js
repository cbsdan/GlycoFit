import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

/**
 * SmokingDailyLogScreen - Manual daily smoking entry
 * 
 * Features:
 * - Auto-fills with yesterday's date
 * - Cigarette count input
 * - Optional notes
 * - Edit/delete existing entries
 */
const SmokingDailyLogScreen = ({ navigation, route }) => {
  const { colors, isDarkMode } = useTheme();
  const { prefilledDate } = route.params || {};
  
  // Get yesterday's date as default
  const getYesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  };

  const formatDateForDisplay = (date) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatDateForAPI = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Form state
  const [selectedDate, setSelectedDate] = useState(
    prefilledDate ? new Date(prefilledDate) : getYesterday()
  );
  const [cigarettesCount, setCigarettesCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingRecord, setExistingRecord] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load existing record for selected date
  useEffect(() => {
    loadExistingRecord();
  }, [selectedDate]);

  const loadExistingRecord = async () => {
    setIsLoading(true);
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await api.getDailySmokingRecords(dateStr, dateStr, 1);
      
      if (response.success && response.data && response.data.length > 0) {
        const record = response.data[0];
        setExistingRecord(record);
        
        // Pre-fill form with existing data
        if (record.cigarettes_count !== undefined) {
          setCigarettesCount(record.cigarettes_count);
        }
        if (record.notes) {
          setNotes(record.notes);
        }
      } else {
        setExistingRecord(null);
        // Reset to defaults for new entry
        setCigarettesCount(0);
        setNotes('');
      }
    } catch (error) {
      console.error('Error loading existing record:', error);
      setExistingRecord(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (cigarettesCount < 0) {
      Alert.alert('Invalid Count', 'Cigarette count cannot be negative.');
      return;
    }

    if (cigarettesCount > 100) {
      Alert.alert('Warning', 'You entered a very high number. Please verify this is correct.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => submitRecord() }
      ]);
      return;
    }

    await submitRecord();
  };

  const submitRecord = async () => {
    setIsSubmitting(true);
    
    try {
      const response = await api.logDailySmoking({
        date: formatDateForAPI(selectedDate),
        cigarettes_count: cigarettesCount,
        notes: notes.trim() || null
      });
      
      AccessibilityInfo.announceForAccessibility('Smoking log saved successfully');
      
      // Navigate back - parent screen will refresh via useFocusEffect
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save smoking log';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this smoking log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteDailySmokingRecord(formatDateForAPI(selectedDate));
              AccessibilityInfo.announceForAccessibility('Smoking log deleted');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete smoking log');
            }
          },
        },
      ]
    );
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    
    // Don't allow future dates
    if (newDate > new Date()) {
      Alert.alert('Invalid Date', 'You cannot log smoking for future dates.');
      return;
    }
    
    setSelectedDate(newDate);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      // Don't allow future dates
      if (selectedDate > new Date()) {
        Alert.alert('Invalid Date', 'You cannot log smoking for future dates.');
        return;
      }
      setSelectedDate(selectedDate);
    }
  };

  const adjustCount = (delta) => {
    const newCount = Math.max(0, cigarettesCount + delta);
    setCigarettesCount(newCount);
  };

  const getCountWarning = () => {
    if (cigarettesCount === 0) {
      return {
        icon: 'check-circle',
        color: '#27AE60',
        text: 'Great! No cigarettes smoked today.',
        bgColor: '#27AE6015'
      };
    } else if (cigarettesCount <= 5) {
      return {
        icon: 'information',
        color: '#3498DB',
        text: 'Light smoking day',
        bgColor: '#3498DB15'
      };
    } else if (cigarettesCount <= 10) {
      return {
        icon: 'alert',
        color: '#F39C12',
        text: 'Moderate smoking - consider reduction strategies',
        bgColor: '#F39C1215'
      };
    } else {
      return {
        icon: 'alert-circle',
        color: '#E74C3C',
        text: 'Heavy smoking - please consult healthcare provider',
        bgColor: '#E74C3C15'
      };
    }
  };

  const countPresets = [0, 5, 10, 15, 20];

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
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    skipButton: {
      padding: 8,
    },
    skipButtonText: {
      fontSize: 16,
      color: colors.secondary,
    },
    manualLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 16,
    },
    manualLabelText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 6,
    },
    dateNavigator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    dateNavButton: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateDisplay: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    dateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    dateSubtext: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    countCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    questionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    countDisplay: {
      fontSize: 64,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 8,
    },
    countUnit: {
      fontSize: 16,
      color: colors.secondary,
      marginBottom: 24,
    },
    countButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    countAdjustButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primary,
      marginHorizontal: 24,
    },
    countAdjustButtonDisabled: {
      opacity: 0.3,
    },
    countPresetsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    countPresetButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 4,
    },
    countPresetButtonActive: {
      backgroundColor: `${colors.primary}20`,
      borderColor: colors.primary,
    },
    countPresetText: {
      fontSize: 14,
      color: colors.text,
    },
    countPresetTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    directInputButton: {
      marginTop: 8,
      paddingVertical: 8,
    },
    directInputButtonText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    warningIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    warningText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    notesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notesInput: {
      minHeight: 100,
      fontSize: 16,
      color: colors.text,
      textAlignVertical: 'top',
    },
    notesPlaceholder: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 12,
    },
    buttonContainer: {
      marginTop: 8,
      gap: 12,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    deleteButton: {
      backgroundColor: '#E74C3C15',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E74C3C',
    },
    deleteButtonText: {
      color: '#E74C3C',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.secondary,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const warning = getCountWarning();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Daily Smoking</Text>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Manual Entry Label */}
        <View style={styles.manualLabel}>
          <Icon name="pencil" size={14} color={colors.primary} />
          <Text style={styles.manualLabelText}>MANUAL ENTRY</Text>
        </View>

        {/* Date Navigator */}
        <View style={styles.dateNavigator}>
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={() => navigateDate(-1)}
          >
            <Icon name="chevron-left" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateDisplay}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{formatDateForDisplay(selectedDate)}</Text>
            <Text style={styles.dateSubtext}>Tap to change date</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={() => navigateDate(1)}
          >
            <Icon name="chevron-right" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Cigarette Count */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cigarettes Smoked</Text>
          <View style={styles.countCard}>
            <Text style={styles.questionText}>How many cigarettes did you smoke?</Text>
            
            <Text style={styles.countDisplay}>{cigarettesCount}</Text>
            <Text style={styles.countUnit}>cigarettes</Text>

            {/* Adjust Buttons */}
            <View style={styles.countButtonRow}>
              <TouchableOpacity 
                style={[
                  styles.countAdjustButton,
                  cigarettesCount === 0 && styles.countAdjustButtonDisabled
                ]}
                onPress={() => adjustCount(-1)}
                disabled={cigarettesCount === 0}
              >
                <Icon name="minus" size={28} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.countAdjustButton}
                onPress={() => adjustCount(1)}
              >
                <Icon name="plus" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Preset Buttons */}
            <View style={styles.countPresetsRow}>
              {countPresets.map(preset => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.countPresetButton,
                    cigarettesCount === preset && styles.countPresetButtonActive
                  ]}
                  onPress={() => setCigarettesCount(preset)}
                >
                  <Text style={[
                    styles.countPresetText,
                    cigarettesCount === preset && styles.countPresetTextActive
                  ]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Direct Input */}
            <TouchableOpacity 
              style={styles.directInputButton}
              onPress={() => {
                Alert.prompt(
                  'Enter Count',
                  'Enter the exact number of cigarettes:',
                  (text) => {
                    const count = parseInt(text, 10);
                    if (!isNaN(count) && count >= 0) {
                      setCigarettesCount(count);
                    }
                  },
                  'plain-text',
                  cigarettesCount.toString(),
                  'numeric'
                );
              }}
            >
              <Text style={styles.directInputButtonText}>Enter custom number</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Warning/Info Card */}
        <View style={[styles.warningCard, { backgroundColor: warning.bgColor }]}>
          <Icon 
            name={warning.icon} 
            size={24} 
            color={warning.color} 
            style={styles.warningIcon}
          />
          <Text style={[styles.warningText, { color: warning.color }]}>
            {warning.text}
          </Text>
        </View>

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesPlaceholder}>
              Add any notes about triggers, situations, or feelings...
            </Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Type your notes here..."
              placeholderTextColor={colors.secondary}
              multiline
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Icon name="check" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {existingRecord ? 'Update Entry' : 'Save Entry'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {existingRecord && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Icon name="delete" size={20} color="#E74C3C" />
              <Text style={styles.deleteButtonText}>Delete Entry</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SmokingDailyLogScreen;
