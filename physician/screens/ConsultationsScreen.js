import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function ConsultationsScreen() {
  const { colors: theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState('upcoming'); // upcoming, completed, prescriptions

  // Placeholder data
  const consultations = [
    {
      id: 1,
      patientName: 'Sarah Williams',
      type: 'video',
      date: 'Today',
      time: '2:00 PM',
      duration: '30 min',
      status: 'upcoming',
      reason: 'Follow-up consultation',
    },
    {
      id: 2,
      patientName: 'Robert Brown',
      type: 'video',
      date: 'Today',
      time: '4:30 PM',
      duration: '45 min',
      status: 'upcoming',
      reason: 'Initial consultation',
    },
    {
      id: 3,
      patientName: 'Emily Davis',
      type: 'chat',
      date: 'Tomorrow',
      time: '10:00 AM',
      duration: '20 min',
      status: 'upcoming',
      reason: 'Prescription renewal',
    },
    {
      id: 4,
      patientName: 'Michael Johnson',
      type: 'video',
      date: 'Yesterday',
      time: '3:00 PM',
      duration: '40 min',
      status: 'completed',
      reason: 'Blood sugar management',
      notes: 'Adjusted insulin dosage',
    },
  ];

  const prescriptions = [
    {
      id: 1,
      patientName: 'Sarah Williams',
      medication: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      date: '2 days ago',
      status: 'active',
    },
    {
      id: 2,
      patientName: 'Robert Brown',
      medication: 'Insulin Glargine',
      dosage: '20 units',
      frequency: 'Once daily',
      date: '1 week ago',
      status: 'active',
    },
    {
      id: 3,
      patientName: 'Emily Davis',
      medication: 'Glipizide',
      dosage: '5mg',
      frequency: 'Before meals',
      date: '3 days ago',
      status: 'pending',
    },
  ];

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'upcoming'
  );
  const completedConsultations = consultations.filter(
    (c) => c.status === 'completed'
  );

  const getTypeIcon = (type) => {
    return type === 'video' ? 'videocam' : 'chatbubble';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return theme.success;
      case 'pending':
        return theme.warning;
      default:
        return theme.secondary;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'upcoming' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setSelectedTab('upcoming')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === 'upcoming' ? theme.primary : theme.secondary,
              },
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'completed' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setSelectedTab('completed')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === 'completed' ? theme.primary : theme.secondary,
              },
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'prescriptions' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setSelectedTab('prescriptions')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === 'prescriptions'
                    ? theme.primary
                    : theme.secondary,
              },
            ]}
          >
            Prescriptions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {selectedTab === 'upcoming' && (
          <View style={styles.section}>
            {upcomingConsultations.map((consultation) => (
              <TouchableOpacity
                key={consultation.id}
                style={[
                  styles.consultationCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...theme.shadow,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.typeIconContainer,
                      { backgroundColor: theme.primary + '20' },
                    ]}
                  >
                    <Ionicons
                      name={getTypeIcon(consultation.type)}
                      size={24}
                      color={theme.primary}
                    />
                  </View>
                  <View style={styles.consultationInfo}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {consultation.patientName}
                    </Text>
                    <Text
                      style={[styles.consultationReason, { color: theme.secondary }]}
                    >
                      {consultation.reason}
                    </Text>
                  </View>
                </View>

                <View style={styles.consultationDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.date}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.time}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons
                      name="hourglass"
                      size={16}
                      color={theme.secondary}
                    />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.duration}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.startButton,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Ionicons name="videocam" size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Start Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rescheduleButton, { borderColor: theme.border }]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedTab === 'completed' && (
          <View style={styles.section}>
            {completedConsultations.map((consultation) => (
              <TouchableOpacity
                key={consultation.id}
                style={[
                  styles.consultationCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...theme.shadow,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.typeIconContainer,
                      { backgroundColor: theme.success + '20' },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.success}
                    />
                  </View>
                  <View style={styles.consultationInfo}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {consultation.patientName}
                    </Text>
                    <Text
                      style={[styles.consultationReason, { color: theme.secondary }]}
                    >
                      {consultation.reason}
                    </Text>
                  </View>
                </View>

                <View style={styles.consultationDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.date}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.time}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons
                      name="hourglass"
                      size={16}
                      color={theme.secondary}
                    />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.duration}
                    </Text>
                  </View>
                </View>

                {consultation.notes && (
                  <View
                    style={[
                      styles.notesContainer,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Ionicons
                      name="document-text"
                      size={16}
                      color={theme.secondary}
                    />
                    <Text style={[styles.notesText, { color: theme.text }]}>
                      {consultation.notes}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.viewDetailsButton,
                    { borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.viewDetailsText, { color: theme.primary }]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedTab === 'prescriptions' && (
          <View style={styles.section}>
            {prescriptions.map((prescription) => (
              <View
                key={prescription.id}
                style={[
                  styles.prescriptionCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...theme.shadow,
                  },
                ]}
              >
                <View style={styles.prescriptionHeader}>
                  <View style={styles.prescriptionInfo}>
                    <Text style={[styles.medicationName, { color: theme.text }]}>
                      {prescription.medication}
                    </Text>
                    <Text
                      style={[styles.patientNameSmall, { color: theme.secondary }]}
                    >
                      {prescription.patientName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          getStatusColor(prescription.status) + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(prescription.status) },
                      ]}
                    >
                      {prescription.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.prescriptionDetails}>
                  <View style={styles.prescriptionRow}>
                    <Text style={[styles.prescriptionLabel, { color: theme.secondary }]}>
                      Dosage:
                    </Text>
                    <Text style={[styles.prescriptionValue, { color: theme.text }]}>
                      {prescription.dosage}
                    </Text>
                  </View>
                  <View style={styles.prescriptionRow}>
                    <Text style={[styles.prescriptionLabel, { color: theme.secondary }]}>
                      Frequency:
                    </Text>
                    <Text style={[styles.prescriptionValue, { color: theme.text }]}>
                      {prescription.frequency}
                    </Text>
                  </View>
                  <View style={styles.prescriptionRow}>
                    <Text style={[styles.prescriptionLabel, { color: theme.secondary }]}>
                      Prescribed:
                    </Text>
                    <Text style={[styles.prescriptionValue, { color: theme.text }]}>
                      {prescription.date}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.editPrescriptionButton,
                    { borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={theme.primary} />
                  <Text
                    style={[styles.editPrescriptionText, { color: theme.primary }]}
                  >
                    Edit Prescription
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  consultationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consultationInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  consultationReason: {
    fontSize: 13,
  },
  consultationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rescheduleButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
  },
  viewDetailsButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prescriptionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  prescriptionInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  patientNameSmall: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  prescriptionDetails: {
    marginBottom: 12,
    gap: 8,
  },
  prescriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prescriptionLabel: {
    fontSize: 13,
  },
  prescriptionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  editPrescriptionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  editPrescriptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
