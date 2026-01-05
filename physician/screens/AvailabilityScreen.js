import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { availabilityService } from '../services/api';

const AvailabilityScreen = () => {
  const { colors: theme } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilities, setAvailabilities] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);

  // Form state
  const [selectedDay, setSelectedDay] = useState(0);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [slotDuration, setSlotDuration] = useState(30);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const slotDurations = [15, 30, 45, 60];

  useEffect(() => {
    fetchAvailabilities();
  }, []);

  const fetchAvailabilities = async () => {
    try {
      setLoading(true);
      const response = await availabilityService.getAll();
      if (response.success) {
        setAvailabilities(response.data);
      }
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      showToast('Failed to load availability schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAvailabilities();
    setRefreshing(false);
  };

  const handleOpenModal = (availability = null) => {
    if (availability) {
      setEditingAvailability(availability);
      setSelectedDay(availability.day_of_week);
      
      // Parse time strings
      const [startHour, startMin] = availability.start_time.split(':');
      const [endHour, endMin] = availability.end_time.split(':');
      
      const start = new Date();
      start.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
      setStartTime(start);
      
      const end = new Date();
      end.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
      setEndTime(end);
      
      setSlotDuration(availability.slot_duration_minutes);
    } else {
      setEditingAvailability(null);
      setSelectedDay(0);
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      setStartTime(new Date(now));
      now.setHours(17, 0, 0, 0);
      setEndTime(new Date(now));
      setSlotDuration(30);
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        day_of_week: selectedDay,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        slot_duration_minutes: slotDuration,
      };

      if (editingAvailability) {
        const response = await availabilityService.update(editingAvailability.id, data);
        if (response.success) {
          showToast('Availability updated successfully', 'success');
        }
      } else {
        const response = await availabilityService.create(data);
        if (response.success) {
          showToast('Availability created successfully', 'success');
        }
      }

      setModalVisible(false);
      fetchAvailabilities();
    } catch (error) {
      console.error('Error saving availability:', error);
      showToast(error.response?.data?.message || 'Failed to save availability', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await availabilityService.delete(id);
      if (response.success) {
        showToast('Availability deleted successfully', 'success');
        fetchAvailabilities();
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
      showToast('Failed to delete availability', 'error');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const groupByDay = () => {
    const grouped = {};
    dayNames.forEach((_, index) => {
      grouped[index] = [];
    });

    availabilities.forEach(av => {
      grouped[av.day_of_week].push(av);
    });

    return grouped;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const groupedAvailabilities = groupByDay();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Availability Schedule</Text>
          <Text style={[styles.subtitle, { color: theme.secondary }]}>
            Set your weekly availability for appointments
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => handleOpenModal()}
        >
          <Icon name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
      >
        {dayNames.map((dayName, index) => (
          <View key={index} style={[styles.daySection, { backgroundColor: theme.card }]}>
            <Text style={[styles.dayName, { color: theme.text }]}>{dayName}</Text>
            
            {groupedAvailabilities[index].length === 0 ? (
              <View style={[styles.noAvailability, { backgroundColor: theme.background }]}>
                <Icon name="close-circle-outline" size={20} color={theme.secondary} />
                <Text style={[styles.noAvailabilityText, { color: theme.secondary }]}>
                  No availability set
                </Text>
              </View>
            ) : (
              groupedAvailabilities[index].map((av) => (
                <View key={av.id} style={[styles.availabilityCard, { borderColor: theme.border }]}>
                  <View style={styles.availabilityInfo}>
                    <View style={styles.timeRow}>
                      <Icon name="clock-outline" size={20} color={theme.primary} />
                      <Text style={[styles.timeText, { color: theme.text }]}>
                        {av.start_time.substring(0, 5)} - {av.end_time.substring(0, 5)}
                      </Text>
                    </View>
                    <View style={styles.durationRow}>
                      <Icon name="timer-outline" size={16} color={theme.secondary} />
                      <Text style={[styles.durationText, { color: theme.secondary }]}>
                        {av.slot_duration_minutes} min slots
                      </Text>
                    </View>
                  </View>
                  <View style={styles.availabilityActions}>
                    <TouchableOpacity
                      style={[styles.iconButton, { backgroundColor: theme.background }]}
                      onPress={() => handleOpenModal(av)}
                    >
                      <Icon name="pencil" size={18} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconButton, { backgroundColor: theme.background }]}
                      onPress={() => handleDelete(av.id)}
                    >
                      <Icon name="delete" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingAvailability ? 'Edit Availability' : 'Add Availability'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Day Selection */}
              <Text style={[styles.label, { color: theme.text }]}>Day of Week</Text>
              <View style={styles.dayButtons}>
                {dayNames.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      { borderColor: theme.border },
                      selectedDay === index && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setSelectedDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        { color: selectedDay === index ? '#FFFFFF' : theme.text }
                      ]}
                    >
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Start Time */}
              <Text style={[styles.label, { color: theme.text }]}>Start Time</Text>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Icon name="clock-outline" size={20} color={theme.primary} />
                <Text style={[styles.timeButtonText, { color: theme.text }]}>
                  {formatTime(startTime)}
                </Text>
              </TouchableOpacity>

              {showStartPicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  is24Hour={false}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowStartPicker(false);
                    } else {
                      setShowStartPicker(Platform.OS === 'ios');
                    }
                    if (selectedDate) {
                      setStartTime(selectedDate);
                    }
                  }}
                />
              )}

              {/* End Time */}
              <Text style={[styles.label, { color: theme.text }]}>End Time</Text>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Icon name="clock-outline" size={20} color={theme.primary} />
                <Text style={[styles.timeButtonText, { color: theme.text }]}>
                  {formatTime(endTime)}
                </Text>
              </TouchableOpacity>

              {showEndPicker && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  is24Hour={false}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowEndPicker(false);
                    } else {
                      setShowEndPicker(Platform.OS === 'ios');
                    }
                    if (selectedDate) {
                      setEndTime(selectedDate);
                    }
                  }}
                />
              )}

              {/* Slot Duration */}
              <Text style={[styles.label, { color: theme.text }]}>Appointment Slot Duration</Text>
              <View style={styles.durationButtons}>
                {slotDurations.map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationButton,
                      { borderColor: theme.border },
                      slotDuration === duration && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setSlotDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        { color: slotDuration === duration ? '#FFFFFF' : theme.text }
                      ]}
                    >
                      {duration} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>
                  {editingAvailability ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  daySection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  noAvailability: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  noAvailabilityText: {
    fontSize: 14,
  },
  availabilityCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  availabilityInfo: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 13,
  },
  availabilityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  dayButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AvailabilityScreen;
