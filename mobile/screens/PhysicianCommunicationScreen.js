import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';

const PhysicianCommunicationScreen = ({ route, navigation }) => {
  const { relationship } = route.params;
  const { colors } = useTheme();
  const toast = useToast();

  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [consultations, setConsultations] = useState([]);
  
  // Modal states for consultation request
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDate, setRequestDate] = useState(new Date());
  const [requestTime, setRequestTime] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAppointments(),
        fetchPrescriptions(),
        fetchConsultations(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.show('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.getAppointments(null, relationship.physician.id || relationship.physician._id);
      if (response.success) {
        setAppointments(response.data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const fetchPrescriptions = async () => {
    try {
      const response = await api.getPrescriptions('active', relationship.physician.id || relationship.physician._id);
      if (response.success) {
        setPrescriptions(response.data);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  };

  const fetchConsultations = async () => {
    try {
      const response = await api.getConsultations(null, relationship.physician.id || relationship.physician._id);
      if (response.success) {
        setConsultations(response.data);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    }
  };

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabContainer, { backgroundColor: colors.card }]}
      contentContainerStyle={styles.tabContentContainer}
    >
      {['overview', 'appointments', 'prescriptions', 'consultations'].map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            selectedTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
          onPress={() => setSelectedTab(tab)}
        >
          <Icon
            name={
              tab === 'overview' ? 'view-dashboard' :
              tab === 'appointments' ? 'calendar-clock' :
              tab === 'prescriptions' ? 'pill' : 'video'
            }
            size={20}
            color={selectedTab === tab ? colors.primary : colors.secondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === tab ? colors.primary : colors.secondary },
            ]}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderOverview = () => {
    const upcomingAppointments = appointments.filter(
      apt => apt.status === 'pending' || apt.status === 'confirmed'
    ).slice(0, 3);
    
    const activePrescriptions = prescriptions.filter(
      rx => rx.status === 'active'
    );
    
    const scheduledConsultations = consultations.filter(
      c => c.status === 'scheduled'
    ).slice(0, 3);

    return (
      <View style={styles.overviewContainer}>
        {/* Physician Info Card */}
        <View style={[styles.physicianCard, { backgroundColor: colors.card }]}>
          <View style={styles.physicianHeader}>
            <View style={styles.avatarContainer}>
                {relationship.physician.user.avatar?.url ? (
                <Image source={{ uri: relationship.physician.user.avatar.url }} style={styles.avatar} />
                ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                    {relationship.physician.user.first_name[0]}{relationship.physician.user.last_name[0]}
                    </Text>
                </View>
                )}
            </View>
            <View style={styles.physicianInfo}>
              <Text style={[styles.physicianName, { color: colors.text }]}>
                Dr. {relationship.physician.user.first_name} {relationship.physician.user.last_name}
              </Text>
              <Text style={[styles.physicianSpec, { color: colors.secondary }]}>
                {relationship.physician.specialization}
              </Text>
              <Text style={[styles.connectedSince, { color: colors.secondary }]}>
                Connected since {new Date(relationship.relationship.acceptance_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('PhysicianMessages', { relationship })}
            >
              <Icon name="chat" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="calendar-check" size={32} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {upcomingAppointments.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>
              Upcoming
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="pill" size={32} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {activePrescriptions.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>
              Active Rx
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="video" size={32} color={colors.info} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {scheduledConsultations.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>
              Scheduled
            </Text>
          </View>
        </View>

        {/* Recent Activity */}
        {upcomingAppointments.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Upcoming Appointments
            </Text>
            {upcomingAppointments.map((apt) => (
              <TouchableOpacity
                key={apt.id}
                style={[styles.listItem, { borderBottomColor: colors.border }]}
              >
                <Icon name="calendar" size={24} color={colors.primary} />
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]}>
                    {apt.appointment_type}
                  </Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.secondary }]}>
                    {new Date(apt.appointment_date).toLocaleString()}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: apt.status === 'confirmed' ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: apt.status === 'confirmed' ? colors.success : colors.warning }
                  ]}>
                    {apt.status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderAppointments = () => {
    const upcoming = appointments.filter(apt => 
      apt.status === 'pending' || apt.status === 'confirmed'
    );
    const past = appointments.filter(apt => 
      apt.status === 'completed' || apt.status === 'cancelled'
    );

    return (
      <View style={styles.tabContent}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => {/* TODO: Navigate to create appointment */}}
        >
          <Icon name="calendar-plus" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Book New Appointment</Text>
        </TouchableOpacity>

        {upcoming.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Upcoming</Text>
            {upcoming.map((apt) => renderAppointmentCard(apt))}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}>
              Past
            </Text>
            {past.map((apt) => renderAppointmentCard(apt))}
          </>
        )}

        {appointments.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="calendar-blank" size={64} color={colors.secondary} />
            <Text style={[styles.emptyText, { color: colors.secondary }]}>
              No appointments yet
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderAppointmentCard = (apt) => (
    <View key={apt.id} style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <Icon name="calendar" size={24} color={colors.primary} />
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {apt.appointment_type}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
            {new Date(apt.appointment_date).toLocaleString()}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor:
              apt.status === 'confirmed' ? colors.success + '20' :
              apt.status === 'pending' ? colors.warning + '20' :
              apt.status === 'completed' ? colors.info + '20' :
              colors.error + '20'
          }
        ]}>
          <Text style={[
            styles.statusText,
            {
              color:
                apt.status === 'confirmed' ? colors.success :
                apt.status === 'pending' ? colors.warning :
                apt.status === 'completed' ? colors.info :
                colors.error
            }
          ]}>
            {apt.status}
          </Text>
        </View>
      </View>
      
      {apt.reason && (
        <Text style={[styles.cardReason, { color: colors.text }]}>
          Reason: {apt.reason}
        </Text>
      )}
      
      {(apt.status === 'pending' || apt.status === 'confirmed') && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.cardButton, { borderColor: colors.primary }]}
            onPress={() => {/* TODO: Reschedule */}}
          >
            <Text style={[styles.cardButtonText, { color: colors.primary }]}>
              Reschedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardButton, { borderColor: colors.error }]}
            onPress={async () => {
              try {
                await api.cancelAppointment(apt.id, 'Cancelled by patient');
                toast.show('Appointment cancelled', 'success');
                fetchAppointments();
              } catch (error) {
                toast.show('Failed to cancel appointment', 'error');
              }
            }}
          >
            <Text style={[styles.cardButtonText, { color: colors.error }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPrescriptions = () => {
    const active = prescriptions.filter(rx => rx.status === 'active');
    const inactive = prescriptions.filter(rx => rx.status !== 'active');

    return (
      <View style={styles.tabContent}>
        {active.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Active</Text>
            {active.map((rx) => renderPrescriptionCard(rx))}
          </>
        )}

        {inactive.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}>
              Inactive
            </Text>
            {inactive.map((rx) => renderPrescriptionCard(rx))}
          </>
        )}

        {prescriptions.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="pill" size={64} color={colors.secondary} />
            <Text style={[styles.emptyText, { color: colors.secondary }]}>
              No prescriptions yet
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderPrescriptionCard = (rx) => (
    <View key={rx.id} style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <Icon name="pill" size={24} color={colors.success} />
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {rx.medication_name}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
            {rx.dosage} • {rx.frequency}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: rx.status === 'active' ? colors.success + '20' : colors.secondary + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: rx.status === 'active' ? colors.success : colors.secondary }
          ]}>
            {rx.status}
          </Text>
        </View>
      </View>

      <View style={styles.prescriptionDetails}>
        {rx.duration_days && (
          <Text style={[styles.detailText, { color: colors.text }]}>
            Duration: {rx.duration_days} days
          </Text>
        )}
        {rx.refills_remaining !== null && (
          <Text style={[styles.detailText, { color: colors.text }]}>
            Refills remaining: {rx.refills_remaining}
          </Text>
        )}
        {rx.instructions && (
          <Text style={[styles.detailText, { color: colors.text }]}>
            Instructions: {rx.instructions}
          </Text>
        )}
      </View>

      {rx.status === 'active' && rx.refills_remaining > 0 && (
        <TouchableOpacity
          style={[styles.refillButton, { backgroundColor: colors.primary }]}
          onPress={async () => {
            try {
              await api.requestPrescriptionRefill(rx.id);
              toast.show('Refill requested', 'success');
              fetchPrescriptions();
            } catch (error) {
              toast.show(error.response?.data?.message || 'Failed to request refill', 'error');
            }
          }}
        >
          <Icon name="reload" size={20} color="#FFFFFF" />
          <Text style={styles.refillButtonText}>Request Refill</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderConsultations = () => {
    const pending = consultations.filter(c => c.status === 'pending');
    const approved = consultations.filter(c => c.status === 'approved' || c.status === 'scheduled');
    const rejected = consultations.filter(c => c.status === 'rejected');
    const completed = consultations.filter(c => c.status === 'completed');

    const handleSubmitRequest = async () => {
      if (!requestReason.trim()) {
        toast.show('Please enter a reason for consultation', 'error');
        return;
      }

      try {
        setRequestLoading(true);
        const formattedTime = requestTime || requestDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        await api.createConsultation(
          relationship.physician.id || relationship.physician._id,
          requestDate.toISOString(),
          formattedTime,
          'video',
          30,
          requestReason.trim(),
          ''
        );
        
        toast.show('Consultation request sent!', 'success');
        setShowRequestModal(false);
        setRequestReason('');
        setRequestTime('');
        fetchConsultations();
      } catch (error) {
        console.error('Error creating consultation:', error);
        toast.show(error.response?.data?.message || 'Failed to request consultation', 'error');
      } finally {
        setRequestLoading(false);
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

    return (
      <View style={styles.tabContent}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowRequestModal(true)}
        >
          <Icon name="video-plus" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Request New Consultation</Text>
        </TouchableOpacity>

        {pending.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>
              <Icon name="clock-outline" size={18} color={colors.warning} /> Pending Requests
            </Text>
            {pending.map((c) => (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1 }]}>
                <View style={[styles.pendingBanner, { backgroundColor: colors.warning }]}>
                  <Text style={styles.pendingBannerText}>AWAITING PHYSICIAN APPROVAL</Text>
                </View>
                <View style={styles.cardHeader}>
                  <Icon name="clock-outline" size={24} color={colors.warning} />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Video Consultation
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
                      {formatDate(c.scheduled_date)} at {formatTime(c.scheduled_date, c.scheduled_time)}
                    </Text>
                  </View>
                </View>
                {c.reason && (
                  <Text style={[styles.cardReason, { color: colors.text }]}>
                    Reason: {c.reason}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.cardButton, { borderColor: colors.error, marginTop: 12 }]}
                  onPress={async () => {
                    try {
                      await api.cancelConsultation(c.id, 'Cancelled by patient');
                      toast.show('Request cancelled', 'success');
                      fetchConsultations();
                    } catch (error) {
                      toast.show('Failed to cancel request', 'error');
                    }
                  }}
                >
                  <Text style={[styles.cardButtonText, { color: colors.error }]}>
                    Cancel Request
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {approved.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}>
              <Icon name="check-circle" size={18} color={colors.success} /> Approved
            </Text>
            {approved.map((c) => (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.success, borderWidth: 1 }]}>
                <View style={styles.cardHeader}>
                  <Icon name="video" size={24} color={colors.success} />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Video Consultation
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
                      {formatDate(c.scheduled_date)} at {formatTime(c.scheduled_date, c.scheduled_time)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.statusText, { color: colors.success }]}>APPROVED</Text>
                  </View>
                </View>

                {c.reason && (
                  <Text style={[styles.cardReason, { color: colors.text }]}>
                    Reason: {c.reason}
                  </Text>
                )}

                {/* Meeting Details */}
                {c.meeting_link && (
                  <View style={[styles.meetingCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                    <View style={styles.meetingHeader}>
                      <Icon name="google" size={20} color={colors.primary} />
                      <Text style={[styles.meetingPlatform, { color: colors.primary }]}>Google Meet</Text>
                    </View>
                    {c.meeting_password && (
                      <Text style={[styles.meetingPassword, { color: colors.secondary }]}>
                        Password: {c.meeting_password}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.joinMeetingButton, { backgroundColor: colors.success }]}
                      onPress={() => openMeetingLink(c.meeting_link)}
                    >
                      <Icon name="video" size={20} color="#FFFFFF" />
                      <Text style={styles.joinMeetingText}>Join Meeting</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.cardButton, { borderColor: colors.error }]}
                    onPress={async () => {
                      try {
                        await api.cancelConsultation(c.id, 'Cancelled by patient');
                        toast.show('Consultation cancelled', 'success');
                        fetchConsultations();
                      } catch (error) {
                        toast.show('Failed to cancel', 'error');
                      }
                    }}
                  >
                    <Text style={[styles.cardButtonText, { color: colors.error }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {rejected.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}>
              <Icon name="close-circle" size={18} color={colors.error} /> Rejected
            </Text>
            {rejected.map((c) => (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.error, borderWidth: 1, opacity: 0.8 }]}>
                <View style={styles.cardHeader}>
                  <Icon name="close-circle" size={24} color={colors.error} />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Video Consultation
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
                      {formatDate(c.scheduled_date)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.error + '20' }]}>
                    <Text style={[styles.statusText, { color: colors.error }]}>REJECTED</Text>
                  </View>
                </View>
                {c.rejection_reason && (
                  <Text style={[styles.cardReason, { color: colors.error }]}>
                    Reason: {c.rejection_reason}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {completed.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}>
              <Icon name="check-all" size={18} color={colors.info} /> Completed
            </Text>
            {completed.map((c) => renderConsultationCard(c))}
          </>
        )}

        {consultations.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="video" size={64} color={colors.secondary} />
            <Text style={[styles.emptyText, { color: colors.secondary }]}>
              No consultations yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.secondary }]}>
              Request a consultation with your physician
            </Text>
          </View>
        )}

        {/* Request Consultation Modal */}
        <Modal
          visible={showRequestModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRequestModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Request Consultation
                </Text>
                <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Preferred Date *
                </Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar" size={20} color={colors.primary} />
                  <Text style={[styles.dateButtonText, { color: colors.text }]}>
                    {requestDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.modalLabel, { color: colors.text, marginTop: 16 }]}>
                  Preferred Time *
                </Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Icon name="clock-outline" size={20} color={colors.primary} />
                  <Text style={[styles.dateButtonText, { color: colors.text }]}>
                    {requestTime || '09:00'}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.modalLabel, { color: colors.text, marginTop: 16 }]}>
                  Reason for Consultation *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }
                  ]}
                  placeholder="Describe the reason for your consultation..."
                  placeholderTextColor={colors.secondary}
                  value={requestReason}
                  onChangeText={setRequestReason}
                  multiline
                  numberOfLines={4}
                />

                <View style={[styles.infoBox, { backgroundColor: colors.info + '10' }]}>
                  <Icon name="information" size={20} color={colors.info} />
                  <Text style={[styles.infoText, { color: colors.info }]}>
                    Your physician will review your request and provide a Google Meet link if approved.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmitRequest}
                  disabled={requestLoading}
                >
                  {requestLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="send" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Submit Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Date</Text>
              <ScrollView style={styles.pickerScroll}>
                {Array.from({ length: 30 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.pickerItem,
                        requestDate.toDateString() === date.toDateString() && { backgroundColor: colors.primary + '20' }
                      ]}
                      onPress={() => {
                        setRequestDate(date);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        { color: requestDate.toDateString() === date.toDateString() ? colors.primary : colors.text }
                      ]}>
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.pickerCloseButton, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={[styles.pickerCloseText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Time</Text>
              <ScrollView style={styles.pickerScroll}>
                {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                  '16:00', '16:30', '17:00', '17:30', '18:00'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerItem,
                      requestTime === time && { backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => {
                      setRequestTime(time);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      { color: requestTime === time ? colors.primary : colors.text }
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.pickerCloseButton, { borderColor: colors.border }]}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={[styles.pickerCloseText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const renderConsultationCard = (consultation) => (
    <View key={consultation.id} style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <Icon name="video" size={24} color={colors.info} />
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {consultation.consultation_type} Consultation
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
            {new Date(consultation.scheduled_date).toLocaleString()}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor:
              consultation.status === 'scheduled' ? colors.info + '20' :
              consultation.status === 'completed' ? colors.success + '20' :
              colors.secondary + '20'
          }
        ]}>
          <Text style={[
            styles.statusText,
            {
              color:
                consultation.status === 'scheduled' ? colors.info :
                consultation.status === 'completed' ? colors.success :
                colors.secondary
            }
          ]}>
            {consultation.status}
          </Text>
        </View>
      </View>

      {consultation.reason && (
        <Text style={[styles.cardReason, { color: colors.text }]}>
          Reason: {consultation.reason}
        </Text>
      )}

      {consultation.status === 'scheduled' && consultation.meeting_url && (
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: colors.success }]}
          onPress={() => {/* TODO: Open meeting URL */}}
        >
          <Icon name="video" size={20} color="#FFFFFF" />
          <Text style={styles.joinButtonText}>Join Video Call</Text>
        </TouchableOpacity>
      )}

      {consultation.status === 'scheduled' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.cardButton, { borderColor: colors.primary }]}
            onPress={() => {/* TODO: Reschedule */}}
          >
            <Text style={[styles.cardButtonText, { color: colors.primary }]}>
              Reschedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardButton, { borderColor: colors.error }]}
            onPress={async () => {
              try {
                await api.cancelConsultation(consultation.id, 'Cancelled by patient');
                toast.show('Consultation cancelled', 'success');
                fetchConsultations();
              } catch (error) {
                toast.show('Failed to cancel consultation', 'error');
              }
            }}
          >
            <Text style={[styles.cardButtonText, { color: colors.error }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {consultation.status === 'completed' && !consultation.patient_rating && (
        <TouchableOpacity
          style={[styles.rateButton, { borderColor: colors.primary }]}
          onPress={() => {/* TODO: Rate consultation */}}
        >
          <Icon name="star-outline" size={20} color={colors.primary} />
          <Text style={[styles.rateButtonText, { color: colors.primary }]}>
            Rate Consultation
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          My Physician
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'appointments' && renderAppointments()}
        {selectedTab === 'prescriptions' && renderPrescriptions()}
        {selectedTab === 'consultations' && renderConsultations()}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tabContainer: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    maxHeight: 60,
  },
  tabContentContainer: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    minWidth: 120,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  overviewContainer: {
    padding: 16,
  },
  physicianCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  physicianHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
   physicianHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  activeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  physicianInfo: {
    flex: 1,
  },
  physicianName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  physicianSpec: {
    fontSize: 14,
    marginBottom: 4,
  },
  connectedSince: {
    fontSize: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tabContent: {
    padding: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
  },
  cardReason: {
    fontSize: 14,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cardButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prescriptionDetails: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    marginBottom: 4,
  },
  refillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  refillButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal Styles
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
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateButtonText: {
    fontSize: 15,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Meeting Card Styles
  pendingBanner: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  pendingBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  meetingCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  meetingPlatform: {
    fontSize: 14,
    fontWeight: '600',
  },
  meetingPassword: {
    fontSize: 13,
    marginBottom: 12,
  },
  joinMeetingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  joinMeetingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContent: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PhysicianCommunicationScreen;
