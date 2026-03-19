import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { patientAPI, consultationAPI, chatService, soapNoteAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function PatientsScreen() {
  const navigation = useNavigation();
  const { colors: theme } = useTheme();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); // all, active, requests, rejected, disconnected
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePatients, setActivePatients] = useState([]);
  const [patientRequests, setPatientRequests] = useState([]);
  const [rejectedPatients, setRejectedPatients] = useState([]);
  const [disconnectedPatients, setDisconnectedPatients] = useState([]);
  const [patientMetrics, setPatientMetrics] = useState({});

  // Schedule modal state (Accept patient + schedule appointment)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingPatient, setSchedulingPatient] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showDatePickerPS, setShowDatePickerPS] = useState(false);
  const [showTimePickerPS, setShowTimePickerPS] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const [patientsRes, requestsRes, rejectedRes, disconnectedRes] = await Promise.all([
        patientAPI.getPatients(null, 'active'),
        patientAPI.getRequests(),
        patientAPI.getPatients(null, 'declined'),
        patientAPI.getPatients(null, 'inactive'),
      ]);

      const dedup = (arr) => {
        const seen = new Set();
        return arr.filter(p => {
          const id = p._id || p.id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      };

      if (patientsRes.success) {
        setActivePatients(dedup(patientsRes.data));
      }

      if (requestsRes.success) {
        setPatientRequests(dedup(requestsRes.data));
      }

      if (rejectedRes.success) {
        setRejectedPatients(dedup(rejectedRes.data));
      }

      if (disconnectedRes.success) {
        setDisconnectedPatients(dedup(disconnectedRes.data));
      }

      // Fetch per-patient metrics (non-fatal)
      try {
        const patients = patientsRes.success ? (patientsRes.data || []) : [];

        const [soapResultsArr, consultRes, convRes] = await Promise.all([
          Promise.all(
            patients.map((p) =>
              soapNoteAPI.getByPatient(p._id || p.id).catch(() => ({ count: 0 }))
            )
          ),
          consultationAPI.getAll(),
          chatService.getConversations(),
        ]);

        const metricsMap = {};

        // Count SOAP notes per patient_id
        patients.forEach((p, idx) => {
          const pid = p._id || p.id;
          if (pid) {
            if (!metricsMap[pid]) metricsMap[pid] = { consultationCount: 0, unreadCount: 0, pendingAppts: 0 };
            metricsMap[pid].consultationCount = soapResultsArr[idx]?.count ?? 0;
          }
        });

        // Count pending appointments per patient_id
        if (consultRes?.data) {
          consultRes.data.forEach((c) => {
            const pid = c.patient_id;
            if (pid) {
              if (!metricsMap[pid]) metricsMap[pid] = { consultationCount: 0, unreadCount: 0, pendingAppts: 0 };
              if ((c.status || '').toLowerCase() === 'pending') {
                metricsMap[pid].pendingAppts += 1;
              }
            }
          });
        }

        // Map unread message count per patient_id
        if (convRes?.conversations) {
          convRes.conversations.forEach((conv) => {
            const pid = conv.patient_id;
            if (pid) {
              if (!metricsMap[pid]) metricsMap[pid] = { consultationCount: 0, unreadCount: 0, pendingAppts: 0 };
              metricsMap[pid].unreadCount = conv.unread_count || 0;
            }
          });
        }

        setPatientMetrics(metricsMap);
      } catch (metricsError) {
        console.warn('Failed to load patient metrics:', metricsError);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      showToast('Failed to load patients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatients();
    setRefreshing(false);
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const response = await patientAPI.acceptRequest(requestId);
      if (response.success) {
        showToast('Patient request accepted', 'success');
        fetchPatients();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      showToast('Failed to accept request', 'error');
    }
  };

  const handleScheduleRequest = (patient) => {
    setSchedulingPatient(patient);
    setScheduleDate(new Date());
    setScheduleTime('09:00');
    setShowScheduleModal(true);
  };

  const submitScheduleRequest = async () => {
    try {
      setScheduleLoading(true);
      const requestId = schedulingPatient._id || schedulingPatient.id;

      // Accept the patient connection first
      const acceptRes = await patientAPI.acceptRequest(requestId);
      if (!acceptRes.success) {
        showToast(acceptRes.message || 'Failed to accept patient', 'error');
        return;
      }

      // Create a consultation with the chosen date/time
      const patientUserId = schedulingPatient.patient?._id || schedulingPatient.patient?.id;
      await consultationAPI.create({
        patient_id: patientUserId,
        scheduled_date: scheduleDate.toISOString(),
        scheduled_time: scheduleTime,
        consultation_type: 'in-person',
        duration_minutes: 30,
        reason: 'Initial consultation',
      });

      showToast('Patient accepted and appointment scheduled', 'success');
      setShowScheduleModal(false);
      fetchPatients();
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      showToast('Failed to schedule appointment', 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  const allPatients = [
    ...activePatients.map(p => ({ ...p, _listStatus: 'active' })),
    ...patientRequests.map(r => ({ ...r, _listStatus: 'request' })),
    ...rejectedPatients.map(p => ({ ...p, _listStatus: 'rejected' })),
    ...disconnectedPatients.map(p => ({ ...p, _listStatus: 'disconnected' })),
  ];

  const filteredPatients = allPatients.filter((patient) => {
    // For requests/rejected/disconnected: patient.patient has the user data
    // For active: patient has the user data directly
    let patientName = '';
    if (patient._listStatus === 'request' && patient.patient) {
      patientName = `${patient.patient.first_name || ''} ${patient.patient.last_name || ''}`.trim();
    } else if ((patient._listStatus === 'rejected' || patient._listStatus === 'disconnected') && patient.patient) {
      patientName = `${patient.patient.first_name || ''} ${patient.patient.last_name || ''}`.trim();
    } else {
      patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    }

    const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      selectedTab === 'all'
        ? patient._listStatus === 'active' || patient._listStatus === 'request'
        : (selectedTab === 'active' && patient._listStatus === 'active') ||
          (selectedTab === 'requests' && patient._listStatus === 'request') ||
          (selectedTab === 'rejected' && patient._listStatus === 'rejected') ||
          (selectedTab === 'disconnected' && patient._listStatus === 'disconnected');
    return matchesSearch && matchesTab;
  });

  const getGlucoseColor = (level) => {
    if (level < 100) return theme.success;
    if (level < 140) return theme.warning;
    return theme.error;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 16 }}>Loading patients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="search" size={20} color={theme.secondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search patients..."
              placeholderTextColor={theme.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'all' && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('all')}
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'all' ? theme.primary : theme.secondary },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'active' && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('active')}
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'active' ? theme.primary : theme.secondary },
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'requests' && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('requests')}
          >
            <View style={styles.tabWithBadge}>
              <Text
                style={[
                  styles.tabText,
                  { color: selectedTab === 'requests' ? theme.primary : theme.secondary },
                ]}
              >
                Requests
              </Text>
              {patientRequests.length > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>{patientRequests.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'rejected' && {
                borderBottomColor: theme.error,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('rejected')}
          >
            <View style={styles.tabWithBadge}>
              <Text
                style={[
                  styles.tabText,
                  { color: selectedTab === 'rejected' ? theme.error : theme.secondary },
                ]}
              >
                Rejected
              </Text>
              {rejectedPatients.length > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>{rejectedPatients.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'disconnected' && {
                borderBottomColor: theme.secondary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedTab('disconnected')}
          >
            <View style={styles.tabWithBadge}>
              <Text
                style={[
                  styles.tabText,
                  { color: selectedTab === 'disconnected' ? theme.secondary : theme.secondary },
                ]}
              >
                Disconnected
              </Text>
              {disconnectedPatients.length > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.secondary }]}>
                  <Text style={styles.badgeText}>{disconnectedPatients.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </ScrollView>
        </View>

        {/* Patient List */}
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredPatients.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
              <Ionicons
                name={
                  selectedTab === 'rejected' ? 'close-circle-outline' :
                  selectedTab === 'disconnected' ? 'link-outline' : 'people-outline'
                }
                size={64}
                color={theme.secondary}
              />
              <Text style={[styles.emptyStateText, { color: theme.text }]}>
                {selectedTab === 'all' ? 'No patients yet' :
                  selectedTab === 'active' ? 'No active patients' :
                  selectedTab === 'requests' ? 'No pending requests' :
                  selectedTab === 'rejected' ? 'No rejected patients' :
                  'No disconnected patients'}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                {selectedTab === 'requests' ? 'Patient requests will appear here' :
                  selectedTab === 'rejected' ? 'Declined patient requests will appear here' :
                  selectedTab === 'disconnected' ? 'Patients who disconnected will appear here' :
                  'Start connecting with patients to see them here'}
              </Text>
            </View>
          ) : (
            filteredPatients.map((patient) => {
              if (patient._listStatus === 'request') {
                return (
                  <TouchableOpacity
                    key={`request-${patient._id || patient.id}`}
                    style={[
                      styles.patientCard,
                      { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow },
                    ]}
                  >
                    <View style={styles.requestHeader}>
                      <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                        <Text style={[styles.avatarText, { color: theme.primary }]}>
                          {patient.patient?.first_name?.charAt(0) || '?'}
                        </Text>
                      </View>
                      <View style={styles.patientInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>
                          {patient.patient ? `${patient.patient.first_name} ${patient.patient.last_name}` : 'Unknown'}
                        </Text>
                        <Text style={[styles.patientDetails, { color: theme.secondary }]}>
                          {patient.patient?.email || 'No email'}
                        </Text>
                        <Text style={[styles.requestTime, { color: theme.secondary }]}>
                          Requested {patient.request_date ? new Date(patient.request_date).toLocaleDateString() : 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.acceptButton, { backgroundColor: theme.success }]}
                        onPress={() => handleAcceptRequest(patient._id || patient.id)}
                      >
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.declineButton, { borderColor: theme.primary }]}
                        onPress={() => handleScheduleRequest(patient)}
                      >
                        <Ionicons name="calendar-outline" size={14} color={theme.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.declineText, { color: theme.primary }]}>Schedule</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }

              if (patient._listStatus === 'rejected') {
                const name = patient.patient
                  ? `${patient.patient.first_name || ''} ${patient.patient.last_name || ''}`.trim()
                  : `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown';
                const email = patient.patient?.email || patient.email || 'No email';
                const initial = (patient.patient?.first_name || patient.first_name || '?').charAt(0);
                return (
                  <View
                    key={`rejected-${patient._id || patient.id}`}
                    style={[
                      styles.patientCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.error + '60',
                        borderWidth: 1,
                        opacity: 0.85,
                        ...theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.requestHeader}>
                      <View style={[styles.avatar, { backgroundColor: theme.error + '18' }]}>
                        <Text style={[styles.avatarText, { color: theme.error }]}>{initial}</Text>
                      </View>
                      <View style={styles.patientInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>{name}</Text>
                        <Text style={[styles.patientDetails, { color: theme.secondary }]}>{email}</Text>
                        {patient.request_date && (
                          <Text style={[styles.requestTime, { color: theme.secondary }]}>
                            Requested {new Date(patient.request_date).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.badge, { backgroundColor: theme.error + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>REJECTED</Text>
                      </View>
                    </View>
                    {patient.notes && (
                      <Text style={[styles.patientDetails, { color: theme.secondary, marginTop: 6, fontStyle: 'italic' }]}>
                        Reason: {patient.notes}
                      </Text>
                    )}
                  </View>
                );
              }

              if (patient._listStatus === 'disconnected') {
                const name = patient.patient
                  ? `${patient.patient.first_name || ''} ${patient.patient.last_name || ''}`.trim()
                  : `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown';
                const email = patient.patient?.email || patient.email || 'No email';
                const initial = (patient.patient?.first_name || patient.first_name || '?').charAt(0);
                return (
                  <View
                    key={`disconnected-${patient._id || patient.id}`}
                    style={[
                      styles.patientCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.secondary + '60',
                        borderWidth: 1,
                        opacity: 0.75,
                        ...theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.requestHeader}>
                      <View style={[styles.avatar, { backgroundColor: theme.secondary + '18' }]}>
                        <Text style={[styles.avatarText, { color: theme.secondary }]}>{initial}</Text>
                      </View>
                      <View style={styles.patientInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>{name}</Text>
                        <Text style={[styles.patientDetails, { color: theme.secondary }]}>{email}</Text>
                        {patient.acceptance_date && (
                          <Text style={[styles.requestTime, { color: theme.secondary }]}>
                            Previously connected since {new Date(patient.acceptance_date).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.badge, { backgroundColor: theme.secondary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.secondary }}>DISCONNECTED</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              // Active patient card
              return (
                <TouchableOpacity
                  key={`active-${patient._id || patient.id}`}
                  style={[
                    styles.patientCard,
                    { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow },
                  ]}
                  onPress={() => navigation.navigate('PatientDetail', {
                    patient: patient,
                    relationship: {
                      id: patient.relationship?.id || patient.relationship_id || patient._id,
                      patient: patient,
                      acceptance_date: patient.relationship?.acceptance_date,
                    }
                  })}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                      <Text style={[styles.avatarText, { color: theme.primary }]}>
                        {patient.first_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <View style={styles.patientInfo}>
                      <Text style={[styles.patientName, { color: theme.text }]}>
                        {`${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown'}
                      </Text>
                      <Text style={[styles.patientDetails, { color: theme.secondary }]}>
                        {patient.email || 'No email'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.chatButton, { backgroundColor: theme.primary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('PatientChat', {
                          patient: patient,
                          relationship: {
                            id: patient.relationship?.id || patient.relationship_id || patient._id,
                            patient: patient,
                          }
                        });
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.metricsContainer}>
                    <View style={styles.metric}>
                      <Ionicons name="calendar" size={16} color={theme.secondary} />
                      <Text style={[styles.metricLabel, { color: theme.secondary }]}>Consultations</Text>
                      <Text style={[styles.metricValue, { color: theme.text }]}>
                        {patientMetrics[patient._id || patient.id]?.consultationCount ?? '-'}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="chatbubbles" size={16} color={theme.secondary} />
                      <Text style={[styles.metricLabel, { color: theme.secondary }]}>Unread Msgs</Text>
                      <Text style={[styles.metricValue, { color: theme.text }]}>
                        {patientMetrics[patient._id || patient.id]?.unreadCount ?? '-'}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="calendar-outline" size={16} color={theme.warning} />
                      <Text style={[styles.metricLabel, { color: theme.secondary }]}>Pending Appts</Text>
                      <Text style={[styles.metricValue, { color: (patientMetrics[patient._id || patient.id]?.pendingAppts ?? 0) > 0 ? theme.warning : theme.text }]}>
                        {patientMetrics[patient._id || patient.id]?.pendingAppts ?? 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.viewDetailsContainer}>
                    <Text style={[styles.viewDetailsText, { color: theme.primary }]}>Tap to view details</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
      {/* ── Schedule Request Modal ── */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Schedule Appointment</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {schedulingPatient && (
              <ScrollView style={styles.modalBody}>
                <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                  Patient: {schedulingPatient.patient?.first_name} {schedulingPatient.patient?.last_name}
                </Text>

                <Text style={[styles.modalLabel, { color: theme.text, marginTop: 12 }]}>Appointment Date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowDatePickerPS(true)}
                >
                  <Ionicons name="calendar" size={20} color={theme.primary} />
                  <Text style={[styles.dateButtonText, { color: theme.text }]}>
                    {scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.modalLabel, { color: theme.text, marginTop: 16 }]}>Appointment Time</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowTimePickerPS(true)}
                >
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={[styles.dateButtonText, { color: theme.text }]}>{scheduleTime}</Text>
                </TouchableOpacity>

                <View style={[styles.scheduleInfoBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '40' }]}>
                  <Ionicons name="information-circle" size={18} color={theme.primary} />
                  <Text style={[styles.scheduleInfoText, { color: theme.text }]}>
                    Accepting this patient and scheduling their first appointment.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: theme.primary }]}
                  onPress={submitScheduleRequest}
                  disabled={scheduleLoading}
                >
                  {scheduleLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="calendar-check" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Accept & Schedule</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Date Picker for Schedule Modal */}
      <Modal
        visible={showDatePickerPS}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerPS(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Date</Text>
            <ScrollView style={styles.pickerScroll}>
              {Array.from({ length: 60 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.pickerItem,
                      scheduleDate.toDateString() === date.toDateString() && { backgroundColor: theme.primary + '20' },
                    ]}
                    onPress={() => { setScheduleDate(date); setShowDatePickerPS(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: scheduleDate.toDateString() === date.toDateString() ? theme.primary : theme.text }]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[styles.pickerCloseButton, { borderColor: theme.border }]} onPress={() => setShowDatePickerPS(false)}>
              <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker for Schedule Modal */}
      <Modal
        visible={showTimePickerPS}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePickerPS(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Time</Text>
            <ScrollView style={styles.pickerScroll}>
              {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.pickerItem, scheduleTime === time && { backgroundColor: theme.primary + '20' }]}
                  onPress={() => { setScheduleTime(time); setShowTimePickerPS(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: scheduleTime === time ? theme.primary : theme.text }]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.pickerCloseButton, { borderColor: theme.border }]} onPress={() => setShowTimePickerPS(false)}>
              <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  tabWrapper: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  patientCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 13,
  },
  chatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  metric: {
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  requestHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: "flex-start"
  },
  requestTime: {
    fontSize: 12,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 48,
    marginTop: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 16,
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
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Schedule modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 15,
    flex: 1,
  },
  scheduleInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  scheduleInfoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerScroll: {
    maxHeight: 280,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 15,
    textAlign: 'center',
  },
  pickerCloseButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
