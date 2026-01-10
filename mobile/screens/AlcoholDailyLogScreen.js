/**
 * Daily Alcohol Log Screen
 * 
 * Allows users to log daily alcohol consumption with context.
 * Auto-detects binge episodes and updates metrics after each entry.
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
  TextInput,
  Platform,
  Modal,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { logDailyAlcohol, getDailyAlcoholRecords } from '../services/api';

const AlcoholDailyLogScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const editDate = route?.params?.date;

  // Form state
  const [date, setDate] = useState(editDate ? new Date(editDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [drinksConsumed, setDrinksConsumed] = useState(0);
  const [drinkingContext, setDrinkingContext] = useState('other');
  const [timeOfDay, setTimeOfDay] = useState('evening');
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!editDate);
  const [showStandardDrinkModal, setShowStandardDrinkModal] = useState(false);

  const userGender = user?.gender?.toLowerCase() || 'male';
  const bingeDrinkThreshold = userGender === 'female' ? 4 : 5;
  const isBingeEpisode = drinksConsumed >= bingeDrinkThreshold;

  const contextOptions = [
    { label: 'With meal', value: 'meal', icon: 'silverware-fork-knife', color: '#4CAF50' },
    { label: 'Social event', value: 'social', icon: 'account-group', color: '#2196F3' },
    { label: 'Stress relief', value: 'stress', icon: 'emoticon-sad', color: '#FF9800' },
    { label: 'Celebration', value: 'celebration', icon: 'party-popper', color: '#9C27B0' },
    { label: 'Other', value: 'other', icon: 'dots-horizontal', color: '#757575' },
    { label: 'No specific context', value: 'none', icon: 'cancel', color: '#9E9E9E' },
  ];

  const timeOptions = [
    { label: 'Morning', value: 'morning', icon: 'weather-sunset-up' },
    { label: 'Afternoon', value: 'afternoon', icon: 'weather-sunny' },
    { label: 'Evening', value: 'evening', icon: 'weather-sunset-down' },
    { label: 'Night', value: 'night', icon: 'weather-night' },
  ];

  useEffect(() => {
    if (editDate) {
      loadExistingRecord();
    } else {
      setLoadingExisting(false);
    }
  }, []);

  const loadExistingRecord = async () => {
    try {
      const dateStr = editDate;
      const response = await getDailyAlcoholRecords(dateStr, dateStr, 1);
      
      if (response.records && response.records.length > 0) {
        const record = response.records[0];
        setDrinksConsumed(record.drinks_consumed || 0);
        setDrinkingContext(record.drinking_context || 'other');
        setTimeOfDay(record.time_of_day || 'evening');
        setNotes(record.notes || '');
      }
    } catch (error) {
      console.error('Error loading record:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (drinksConsumed < 0 || drinksConsumed > 20) {
      Alert.alert('Invalid Input', 'Please enter a valid number of drinks (0-20)');
      return;
    }

    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      await logDailyAlcohol(
        dateStr,
        drinksConsumed,
        null, // Auto-detected on backend
        drinkingContext,
        timeOfDay,
        notes || null
      );

      Alert.alert(
        'Success',
        'Alcohol consumption logged successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error logging alcohol:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to log alcohol. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {editDate ? 'Edit Entry' : 'Log Alcohol Consumption'}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Selection */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Date</Text>
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Drinks Consumed */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>
            Number of Drinks
          </Text>
          <TouchableOpacity onPress={() => setShowStandardDrinkModal(true)}>
            <Text style={[styles.hintLink, { color: colors.primary }]}>
              1 drink = 12oz beer, 5oz wine, or 1.5oz spirits (See reference)
            </Text>
          </TouchableOpacity>

          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, { color: colors.primary }]}>
              {drinksConsumed % 1 === 0 
                ? drinksConsumed.toFixed(0) 
                : drinksConsumed.toFixed(1)}
            </Text>
            <Text style={[styles.unitText, { color: colors.secondary }]}>
              drinks
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={20}
            step={0.5}
            value={drinksConsumed}
            onValueChange={setDrinksConsumed}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />

          <View style={styles.rangeLabels}>
            <Text style={[styles.rangeLabel, { color: colors.secondary }]}>0</Text>
            <Text style={[styles.rangeLabel, { color: colors.secondary }]}>20</Text>
          </View>

          {/* Binge warning */}
          {isBingeEpisode && (
            <View style={styles.warningBox}>
              <Icon name="alert" size={20} color="#F44336" />
              <Text style={styles.warningText}>
                This is considered a binge drinking episode ({bingeDrinkThreshold}+ drinks)
              </Text>
            </View>
          )}
        </View>

        {/* Drinking Context */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Context</Text>
          <View style={styles.contextGrid}>
            {contextOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.contextOption,
                  {
                    backgroundColor: drinkingContext === option.value 
                      ? `${option.color}20` 
                      : colors.background,
                    borderColor: drinkingContext === option.value 
                      ? option.color 
                      : colors.border,
                  },
                ]}
                onPress={() => setDrinkingContext(option.value)}
              >
                <Icon 
                  name={option.icon} 
                  size={24} 
                  color={drinkingContext === option.value ? option.color : colors.secondary} 
                />
                <Text 
                  style={[
                    styles.contextLabel,
                    { 
                      color: drinkingContext === option.value ? option.color : colors.text,
                    }
                  ]}
                  numberOfLines={2}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time of Day */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Time of Day</Text>
          <View style={styles.timeGrid}>
            {timeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeOption,
                  {
                    backgroundColor: timeOfDay === option.value 
                      ? colors.primary + '20' 
                      : colors.background,
                    borderColor: timeOfDay === option.value 
                      ? colors.primary 
                      : colors.border,
                  },
                ]}
                onPress={() => setTimeOfDay(option.value)}
              >
                <Icon 
                  name={option.icon} 
                  size={28} 
                  color={timeOfDay === option.value ? colors.primary : colors.secondary} 
                />
                <Text 
                  style={[
                    styles.timeLabel,
                    { 
                      color: timeOfDay === option.value ? colors.primary : colors.text,
                      fontWeight: timeOfDay === option.value ? '600' : '400',
                    }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
          <TextInput
            style={[
              styles.notesInput,
              { 
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              }
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about this entry..."
            placeholderTextColor={colors.secondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {editDate ? 'Update Entry' : 'Save Entry'}
            </Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
  },
  hintLink: {
    fontSize: 12,
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 16,
    marginLeft: 12,
  },
  valueContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  valueText: {
    fontSize: 40,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 14,
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rangeLabel: {
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    color: '#F44336',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  contextOption: {
    width: '31%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  contextLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  timeOption: {
    width: '48%',
    margin: '1%',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  timeLabel: {
    fontSize: 14,
    marginTop: 8,
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 100,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AlcoholDailyLogScreen;
