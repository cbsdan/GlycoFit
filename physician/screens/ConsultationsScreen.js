import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { consultationAPI, prescriptionAPI } from '../services/api';

export default function ConsultationsScreen() {
  const { colors: theme } = useTheme();
  const { showToast } = useToast();
  const [selectedTab, setSelectedTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [consultations, setConsultations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (selectedTab === 'pending') {
        const response = await consultationAPI.getPending();
        if (response.success) {
          setPendingRequests(response.data);
        }
      } else if (selectedTab === 'prescriptions') {
        const response = await prescriptionAPI.getAll();
        if (response.success) {
          setPrescriptions(response.data);
        }
      } else {
        const status = selectedTab === 'upcoming' ? 'approved' : 'completed';
        const response = await consultationAPI.getAll({ status });
        if (response.success) {
          setConsultations(response.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Silent fail for data loading
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleApprove = (consultation) => {
    setSelectedConsultation(consultation);
    setMeetingLink('');
    setMeetingPassword('');
    setShowApproveModal(true);
  };

  const handleReject = (consultation) => {
    setSelectedConsultation(consultation);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitApproval = async () => {
    if (!meetingLink.trim()) {
      showToast('Please enter a Google Meet link', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const response = await consultationAPI.approve(selectedConsultation.id, {
        meeting_link: meetingLink.trim(),
        meeting_password: meetingPassword.trim(),
        platform: 'google_meet',
      });

      if (response.success) {
        showToast('Consultation approved successfully', 'success');
        setShowApproveModal(false);
        fetchData();
      } else {
        showToast(response.message || 'Failed to approve', 'error');
      }
    } catch (error) {
      console.error('Error approving consultation:', error);
      showToast('Failed to approve consultation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const submitRejection = async () => {
    try {
      setActionLoading(true);
      const response = await consultationAPI.reject(selectedConsultation.id, rejectReason);

      if (response.success) {
        showToast('Consultation rejected', 'success');
        setShowRejectModal(false);
        fetchData();
      } else {
        showToast(response.message || 'Failed to reject', 'error');
      }
    } catch (error) {
      console.error('Error rejecting consultation:', error);
      showToast('Failed to reject consultation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openMeetingLink = (link) => {
    if (link) {
      Linking.openURL(link);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString, timeString) => {
    if (timeString) return timeString;
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 16 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'approved' || c.status === 'scheduled'
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
      case 'approved':
        return theme.success;
      case 'pending':
        return theme.warning;
      case 'rejected':
        return theme.error;
      default:
        return theme.secondary;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Tab Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabContainer}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'pending' && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('pending')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selectedTab === 'pending' ? theme.primary : theme.secondary,
                },
              ]}
            >
              Pending ({pendingRequests.length})
            </Text>
          </TouchableOpacity>

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
        </ScrollView>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Pending Requests Tab */}
        {selectedTab === 'pending' && (
          <View style={styles.section}>
            {pendingRequests.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                <Ionicons name="hourglass-outline" size={64} color={theme.secondary} />
                <Text style={[styles.emptyStateText, { color: theme.text }]}>
                  No pending requests
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                  Patient consultation requests will appear here
                </Text>
              </View>
            ) : (
              pendingRequests.map((consultation) => (
                <View
                  key={consultation.id}
                  style={[
                    styles.consultationCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.warning,
                      borderWidth: 2,
                      ...theme.shadow,
                    },
                  ]}
                >
                  <View style={[styles.pendingBadge, { backgroundColor: theme.warning }]}>
                    <Text style={styles.pendingBadgeText}>PENDING REQUEST</Text>
                  </View>
                  
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.typeIconContainer,
                        { backgroundColor: theme.warning + '20' },
                      ]}
                    >
                      <Ionicons
                        name={getTypeIcon(consultation.consultation_type)}
                        size={24}
                        color={theme.warning}
                      />
                    </View>
                    <View style={styles.consultationInfo}>
                      <Text style={[styles.patientName, { color: theme.text }]}>
                        {consultation.patient?.first_name} {consultation.patient?.last_name}
                      </Text>
                      <Text
                        style={[styles.consultationReason, { color: theme.secondary }]}
                      >
                        {consultation.reason || 'No reason provided'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.consultationDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar" size={16} color={theme.secondary} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        {formatDate(consultation.scheduled_date)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="time" size={16} color={theme.secondary} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="hourglass" size={16} color={theme.secondary} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        {consultation.duration_minutes} min
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.approveButton, { backgroundColor: theme.success }]}
                      onPress={() => handleApprove(consultation)}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectButton, { backgroundColor: theme.error }]}
                      onPress={() => handleReject(consultation)}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {selectedTab === 'upcoming' && (
          <View style={styles.section}>
            {upcomingConsultations.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                <Ionicons name="calendar-outline" size={64} color={theme.secondary} />
                <Text style={[styles.emptyStateText, { color: theme.text }]}>
                  No consultations
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                  Approved consultations will appear here
                </Text>
              </View>
            ) : (
              upcomingConsultations.map((consultation) => (
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
                      name={getTypeIcon(consultation.consultation_type)}
                      size={24}
                      color={theme.primary}
                    />
                  </View>
                  <View style={styles.consultationInfo}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {consultation.patient?.first_name} {consultation.patient?.last_name}
                    </Text>
                    <Text
                      style={[styles.consultationReason, { color: theme.secondary }]}
                    >
                      {consultation.reason || 'Consultation'}
                    </Text>
                  </View>
                </View>

                <View style={styles.consultationDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatDate(consultation.scheduled_date)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons
                      name="hourglass"
                      size={16}
                      color={theme.secondary}
                    />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.duration_minutes} min
                    </Text>
                  </View>
                </View>

                {/* Meeting Link Info */}
                {consultation.meeting_link && (
                  <View style={[styles.meetingInfo, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
                    <Ionicons name="videocam" size={18} color={theme.primary} />
                    <View style={styles.meetingDetails}>
                      <Text style={[styles.meetingLabel, { color: theme.primary }]}>Google Meet</Text>
                      {consultation.meeting_password && (
                        <Text style={[styles.meetingPassword, { color: theme.secondary }]}>
                          Password: {consultation.meeting_password}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.startButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => openMeetingLink(consultation.meeting_link)}
                  >
                    <Ionicons name="videocam" size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Join Meeting</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )))}
          </View>
        )}

        {selectedTab === 'completed' && (
          <View style={styles.section}>
            {completedConsultations.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                <Ionicons name="checkmark-done-outline" size={64} color={theme.secondary} />
                <Text style={[styles.emptyStateText, { color: theme.text }]}>
                  No consultations
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                  Completed consultations will appear here
                </Text>
              </View>
            ) : (
              completedConsultations.map((consultation) => (
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
                      {consultation.patient?.first_name} {consultation.patient?.last_name}
                    </Text>
                    <Text
                      style={[styles.consultationReason, { color: theme.secondary }]}
                    >
                      {consultation.reason || 'Consultation'}
                    </Text>
                  </View>
                </View>

                <View style={styles.consultationDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatDate(consultation.scheduled_date)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons
                      name="hourglass"
                      size={16}
                      color={theme.secondary}
                    />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {consultation.duration_minutes} min
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
            )))}
          </View>
        )}

        {selectedTab === 'prescriptions' && (
          <View style={styles.section}>
            {prescriptions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                <Ionicons name="medical-outline" size={64} color={theme.secondary} />
                <Text style={[styles.emptyStateText, { color: theme.text }]}>
                  No prescriptions
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                  Prescriptions will appear here
                </Text>
              </View>
            ) : (
              prescriptions.map((prescription) => (
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
            )))}
          </View>
        )}
      </ScrollView>

      {/* Approve Modal */}
      <Modal
        visible={showApproveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApproveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Approve Consultation
              </Text>
              <TouchableOpacity onPress={() => setShowApproveModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedConsultation && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                  Patient: {selectedConsultation.patient?.first_name} {selectedConsultation.patient?.last_name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                  Date: {formatDate(selectedConsultation.scheduled_date)} at {formatTime(selectedConsultation.scheduled_date, selectedConsultation.scheduled_time)}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Google Meet Link *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { 
                        backgroundColor: theme.surface, 
                        color: theme.text,
                        borderColor: theme.border 
                      },
                    ]}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    placeholderTextColor={theme.secondary}
                    value={meetingLink}
                    onChangeText={setMeetingLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Meeting Password (optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { 
                        backgroundColor: theme.surface, 
                        color: theme.text,
                        borderColor: theme.border 
                      },
                    ]}
                    placeholder="Enter password if any"
                    placeholderTextColor={theme.secondary}
                    value={meetingPassword}
                    onChangeText={setMeetingPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: theme.success }]}
                  onPress={submitApproval}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Approve Consultation</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Reject Consultation
              </Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedConsultation && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                  Patient: {selectedConsultation.patient?.first_name} {selectedConsultation.patient?.last_name}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Reason for Rejection (optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textArea,
                      { 
                        backgroundColor: theme.surface, 
                        color: theme.text,
                        borderColor: theme.border 
                      },
                    ]}
                    placeholder="Enter reason..."
                    placeholderTextColor={theme.secondary}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: theme.error }]}
                  onPress={submitRejection}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Reject Consultation</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    maxHeight: 50,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  pendingBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 8,
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
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    gap: 10,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  meetingPassword: {
    fontSize: 12,
    marginTop: 2,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
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
  emptyState: {
    padding: 48,
    marginTop: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '80%',
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
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
