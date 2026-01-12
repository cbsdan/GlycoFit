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
import { logDailySleep, getDailySleepRecords, deleteDailySleepRecord } from '../services/api';

/**
 * SleepDailyLogScreen - Manual daily sleep entry
 * 
 * Features:
 * - Auto-fills with yesterday's date
 * - Bedtime and sleep duration input
 * - Optional quality rating and notes
 * - Clear labeling as "Manual Entry"
 */
const SleepDailyLogScreen = ({ navigation, route }) => {
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
  const [bedtimeHour, setBedtimeHour] = useState(22);
  const [bedtimeMinute, setBedtimeMinute] = useState(30);
  const [sleepDuration, setSleepDuration] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(null);
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
      const response = await getDailySleepRecords(dateStr, dateStr, 1, 'manual');
      
      if (response.success && response.data && response.data.length > 0) {
        const record = response.data[0];
        setExistingRecord(record);
        
        // Pre-fill form with existing data
        if (record.bedtime) {
          const [h, m] = record.bedtime.split(':').map(Number);
          setBedtimeHour(h);
          setBedtimeMinute(m);
        }
        if (record.sleep_duration_hours) {
          setSleepDuration(record.sleep_duration_hours);
        }
        if (record.sleep_quality) {
          setSleepQuality(record.sleep_quality);
        }
        if (record.notes) {
          setNotes(record.notes);
        }
      } else {
        setExistingRecord(null);
        // Reset to defaults for new entry
        setBedtimeHour(22);
        setBedtimeMinute(30);
        setSleepDuration(7);
        setSleepQuality(null);
        setNotes('');
      }
    } catch (error) {
      console.error('Error loading existing record:', error);
      setExistingRecord(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (hour, minute) => {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatTimeFor24h = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const deriveWakeTime = () => {
    const totalMinutes = bedtimeHour * 60 + bedtimeMinute + Math.round(sleepDuration * 60);
    const wakeHour = Math.floor(totalMinutes / 60) % 24;
    const wakeMinute = totalMinutes % 60;
    return formatTime(wakeHour, wakeMinute);
  };

  const handleSubmit = async () => {
    // Validation
    if (sleepDuration < 0 || sleepDuration > 24) {
      Alert.alert('Invalid Duration', 'Sleep duration must be between 0 and 24 hours.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await logDailySleep(
        formatDateForAPI(selectedDate),
        formatTimeFor24h(bedtimeHour, bedtimeMinute),
        sleepDuration,
        null, // wake_time is derived on backend
        sleepQuality,
        notes.trim() || null
      );
      
      AccessibilityInfo.announceForAccessibility('Sleep log saved successfully');
      
      // Navigate back - parent screen will refresh via useFocusEffect
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save sleep log';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this sleep log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDailySleepRecord(formatDateForAPI(selectedDate), 'manual');
              AccessibilityInfo.announceForAccessibility('Sleep log deleted');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete sleep log');
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
      Alert.alert('Invalid Date', 'You cannot log sleep for future dates.');
      return;
    }
    
    setSelectedDate(newDate);
  };

  const qualityLabels = [
    { value: 1, label: 'Very Poor', icon: 'emoticon-sad', color: '#E74C3C' },
    { value: 2, label: 'Poor', icon: 'emoticon-neutral', color: '#F39C12' },
    { value: 3, label: 'Fair', icon: 'emoticon-neutral', color: '#F1C40F' },
    { value: 4, label: 'Good', icon: 'emoticon-happy', color: '#27AE60' },
    { value: 5, label: 'Excellent', icon: 'emoticon-excited', color: '#2ECC71' },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

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
    sourceLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 16,
    },
    sourceLabelText: {
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
    bedtimeCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    questionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    timeDisplay: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 16,
    },
    timePickerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    timeColumn: {
      alignItems: 'center',
      marginHorizontal: 8,
    },
    timeColumnLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginBottom: 8,
    },
    timeScrollContainer: {
      height: 150,
      width: 100,
      backgroundColor: colors.background,
      borderRadius: 12,
      overflow: 'hidden',
    },
    timeScroll: {
      flex: 1,
    },
    timeOption: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    timeOptionSelected: {
      backgroundColor: `${colors.primary}20`,
    },
    timeOptionText: {
      fontSize: 16,
      color: colors.text,
    },
    timeOptionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    durationCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationValue: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    durationUnit: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    durationButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    durationAdjustButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    durationDisplay: {
      paddingHorizontal: 24,
    },
    durationDisplayText: {
      fontSize: 28,
      fontWeight: '700',
    },
    durationPresetsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    durationPresetButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      margin: 4,
    },
    durationPresetText: {
      fontSize: 14,
      fontWeight: '600',
    },
    wakeTimePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    wakeTimeText: {
      fontSize: 14,
      color: colors.secondary,
      marginLeft: 8,
    },
    wakeTimeValue: {
      fontWeight: '600',
      color: colors.text,
    },
    qualityCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    qualityGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    qualityOption: {
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      flex: 1,
      marginHorizontal: 4,
    },
    qualityOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    qualityLabel: {
      fontSize: 10,
      color: colors.secondary,
      marginTop: 6,
      textAlign: 'center',
    },
    notesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notesInput: {
      fontSize: 16,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    notesCounter: {
      fontSize: 12,
      color: colors.secondary,
      textAlign: 'right',
      marginTop: 8,
    },
    buttons: {
      marginTop: 24,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FDEDEE',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E74C3C',
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#E74C3C',
      marginLeft: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: `${colors.primary}10`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 12,
      lineHeight: 20,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.secondary, marginTop: 12 }}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>
            {existingRecord ? 'Edit Sleep Log' : 'Log Sleep'}
          </Text>
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip entry"
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Source Label */}
        <View style={styles.sourceLabel}>
          <Icon name="pencil" size={14} color={colors.primary} />
          <Text style={styles.sourceLabelText}>MANUAL ENTRY</Text>
        </View>

        {/* Date Navigator */}
        <View style={styles.dateNavigator}>
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={() => navigateDate(-1)}
            accessibilityLabel="Previous day"
          >
            <Icon name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>{formatDateForDisplay(selectedDate)}</Text>
            <Text style={styles.dateSubtext}>
              {formatDateForAPI(selectedDate) === formatDateForAPI(getYesterday()) 
                ? 'Yesterday' 
                : formatDateForAPI(selectedDate)}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={() => navigateDate(1)}
            accessibilityLabel="Next day"
          >
            <Icon name="chevron-right" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="information" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Daily logs help improve your sleep metrics and diabetes risk assessment. 
            The more you log, the more accurate your insights become.
          </Text>
        </View>

        {/* Bedtime Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bedtime</Text>
          <View style={styles.bedtimeCard}>
            <Text style={styles.questionText}>
              What time did you go to bed?
            </Text>
            <Text style={styles.timeDisplay}>
              {formatTime(bedtimeHour, bedtimeMinute)}
            </Text>
            <View style={styles.timePickerRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hour</Text>
                <View style={styles.timeScrollContainer}>
                  <ScrollView 
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {hours.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timeOption,
                          bedtimeHour === h && styles.timeOptionSelected,
                        ]}
                        onPress={() => setBedtimeHour(h)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: bedtimeHour === h }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          bedtimeHour === h && styles.timeOptionTextSelected,
                        ]}>
                          {formatTime(h, 0).split(':')[0]} {h >= 12 ? 'PM' : 'AM'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Minute</Text>
                <View style={styles.timeScrollContainer}>
                  <ScrollView 
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {minutes.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.timeOption,
                          bedtimeMinute === m && styles.timeOptionSelected,
                        ]}
                        onPress={() => setBedtimeMinute(m)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: bedtimeMinute === m }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          bedtimeMinute === m && styles.timeOptionTextSelected,
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

        {/* Duration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleep Duration</Text>
          <View style={styles.durationCard}>
            <Text style={styles.questionText}>
              How many hours did you sleep?
            </Text>
            <Text style={styles.durationValue}>{sleepDuration}</Text>
            <Text style={styles.durationUnit}>hours</Text>
            
            {/* Button-based duration selector */}
            <View style={styles.durationButtonRow}>
              <TouchableOpacity
                style={[styles.durationAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSleepDuration(Math.max(0, sleepDuration - 0.5))}
                accessibilityLabel="Decrease by half hour"
              >
                <Icon name="minus" size={24} color={colors.text} />
              </TouchableOpacity>
              
              <View style={styles.durationDisplay}>
                <Text style={[styles.durationDisplayText, { color: colors.text }]}>
                  {sleepDuration}h
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.durationAdjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSleepDuration(Math.min(14, sleepDuration + 0.5))}
                accessibilityLabel="Increase by half hour"
              >
                <Icon name="plus" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Quick presets */}
            <View style={styles.durationPresetsRow}>
              {[5, 6, 7, 8, 9, 10].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.durationPresetButton,
                    { 
                      backgroundColor: sleepDuration === h ? colors.primary : colors.card,
                      borderColor: sleepDuration === h ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSleepDuration(h)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sleepDuration === h }}
                >
                  <Text style={[
                    styles.durationPresetText,
                    { color: sleepDuration === h ? '#FFFFFF' : colors.text }
                  ]}>
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Wake Time Preview */}
            <View style={styles.wakeTimePreview}>
              <Icon name="weather-sunny" size={16} color={colors.secondary} />
              <Text style={styles.wakeTimeText}>
                Estimated wake time: <Text style={styles.wakeTimeValue}>{deriveWakeTime()}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Sleep Quality Section (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleep Quality (Optional)</Text>
          <View style={styles.qualityCard}>
            <Text style={styles.questionText}>
              How would you rate your sleep?
            </Text>
            <View style={styles.qualityGrid}>
              {qualityLabels.map((q) => (
                <TouchableOpacity
                  key={q.value}
                  style={[
                    styles.qualityOption,
                    sleepQuality === q.value && styles.qualityOptionSelected,
                  ]}
                  onPress={() => setSleepQuality(sleepQuality === q.value ? null : q.value)}
                  accessibilityRole="button"
                  accessibilityLabel={q.label}
                  accessibilityState={{ selected: sleepQuality === q.value }}
                >
                  <Icon name={q.icon} size={24} color={q.color} />
                  <Text style={styles.qualityLabel}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Notes Section (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <View style={styles.notesCard}>
            <TextInput
              style={styles.notesInput}
              placeholder="Any factors that affected your sleep? (e.g., caffeine, stress, exercise)"
              placeholderTextColor={colors.secondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={200}
              accessibilityLabel="Sleep notes"
            />
            <Text style={styles.notesCounter}>{notes.length}/200</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={existingRecord ? 'Update sleep log' : 'Save sleep log'}
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
              accessibilityRole="button"
              accessibilityLabel="Delete sleep log"
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

export default SleepDailyLogScreen;
