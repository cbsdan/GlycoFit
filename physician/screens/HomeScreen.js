import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { physicianAPI, patientAPI, appointmentAPI, physicianAPI as profileAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function HomeScreen() {
  const { colors: theme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [isActive, setIsActive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [patientRequests, setPatientRequests] = useState([]);
  const [activePatients, setActivePatients] = useState([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    pendingRequests: 0,
    todayAppointments: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [statsRes, requestsRes, patientsRes, appointmentsRes] = await Promise.all([
        physicianAPI.getStats(),
        patientAPI.getRequests(),
        patientAPI.getPatients(),
        appointmentAPI.getAll({ date: new Date().toISOString() }),
      ]);

      if (statsRes.success) {
        setStats({
          totalPatients: statsRes.data.total_patients || 0,
          activePatients: statsRes.data.active_patients || 0,
          pendingRequests: statsRes.data.pending_requests || 0,
          todayAppointments: statsRes.data.today_appointments || 0,
        });
      }

      if (requestsRes.success) {
        setPatientRequests(requestsRes.data.slice(0, 3)); // Show only first 3
      }

      if (patientsRes.success) {
        setActivePatients(patientsRes.data.slice(0, 3)); // Show only first 3
      }

      if (appointmentsRes.success) {
        setTodayAppointments(appointmentsRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, []);

  const handleAcceptRequest = async (requestId) => {
    try {
      const response = await patientAPI.acceptRequest(requestId);
      if (response.success) {
        toast.success('Patient request accepted');
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      const response = await patientAPI.declineRequest(requestId);
      if (response.success) {
        toast.success('Patient request declined');
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error declining request:', error);
      toast.error('Failed to decline request');
    }
  };

  const handleToggleAvailability = async (value) => {
    try {
      const response = await profileAPI.updateAvailability({ is_active: value });
      if (response.success) {
        setIsActive(value);
        toast.success(`You are now ${value ? 'available' : 'unavailable'}`);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 16 }}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high':
        return theme.error;
      case 'medium':
        return theme.warning;
      case 'low':
        return theme.success;
      default:
        return theme.secondary;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'stable':
        return theme.success;
      case 'needs_attention':
        return theme.warning;
      case 'critical':
        return theme.error;
      default:
        return theme.secondary;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
        <View>
          <Text style={[styles.welcomeText, { color: theme.secondary }]}>
            Welcome back,
          </Text>
          <Text style={[styles.doctorName, { color: theme.text }]}>
            Dr. {user?.first_name || ''} {user?.last_name || ''}
          </Text>
        </View>
      </View>

      {/* Availability Status Card */}
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            ...theme.shadow,
          },
        ]}
      >
        <View style={styles.statusHeader}>
          <View style={styles.statusTitleContainer}>
            <Ionicons
              name={isActive ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={isActive ? theme.success : theme.error}
            />
            <Text style={[styles.statusTitle, { color: theme.text }]}>
              {isActive ? 'Accepting Patients' : 'Not Accepting Patients'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={handleToggleAvailability}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text style={[styles.statusDescription, { color: theme.secondary }]}>
          {isActive
            ? 'You are currently visible to patients and accepting new requests'
            : 'Your profile is hidden from patients. Toggle to start accepting requests'}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, ...theme.shadow },
          ]}
        >
          <Ionicons name="people" size={28} color={theme.primary} />
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {stats?.totalPatients ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>
            Total Patients
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, ...theme.shadow },
          ]}
        >
          <Ionicons name="heart" size={28} color={theme.success} />
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {stats?.activePatients ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>
            Active Patients
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, ...theme.shadow },
          ]}
        >
          <Ionicons name="notifications" size={28} color={theme.warning} />
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {stats?.pendingRequests ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>
            Requests
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, ...theme.shadow },
          ]}
        >
          <Ionicons name="calendar" size={28} color={theme.info} />
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {stats?.todayAppointments ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>
            Today
          </Text>
        </View>
      </View>

      {/* Patient Requests Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Patient Requests
          </Text>
          <TouchableOpacity>
            <Text style={[styles.viewAllText, { color: theme.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {patientRequests.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>No pending requests</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
              Patient requests will appear here
            </Text>
          </View>
        ) : (
          patientRequests.map((request) => (
          <TouchableOpacity
            key={request.id}
            style={[
              styles.requestCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                ...theme.shadow,
              },
            ]}
          >
            <View style={styles.requestHeader}>
              <View style={styles.patientInfo}>
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.primary + '20' },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {request.patientName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.patientDetails}>
                  <Text style={[styles.patientName, { color: theme.text }]}>
                    {request.patientName}
                  </Text>
                  <Text
                    style={[styles.patientMetadata, { color: theme.secondary }]}
                  >
                    {request.age} years • {request.condition}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.urgencyBadge,
                  { backgroundColor: getUrgencyColor(request.urgency) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.urgencyText,
                    { color: getUrgencyColor(request.urgency) },
                  ]}
                >
                  {request.urgency.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.requestTime, { color: theme.secondary }]}>
              Requested {request.requestDate}
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.acceptButton, { backgroundColor: theme.success }]}
                onPress={() => handleAcceptRequest(request._id || request.id)}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineButton, { borderColor: theme.error }]}
                onPress={() => handleDeclineRequest(request._id || request.id)}
              >
                <Ionicons name="close" size={18} color={theme.error} />
                <Text style={[styles.declineButtonText, { color: theme.error }]}>
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
        )}
      </View>

      {/* Active Patients Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Active Patients
          </Text>
          <TouchableOpacity>
            <Text style={[styles.viewAllText, { color: theme.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {activePatients.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="heart-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>No active patients yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
              Your patients will appear here
            </Text>
          </View>
        ) : (
          activePatients.map((patient) => (
          <TouchableOpacity
            key={patient.id}
            style={[
              styles.patientCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                ...theme.shadow,
              },
            ]}
          >
            <View style={styles.patientCardContent}>
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: theme.primary + '20' },
                ]}
              >
                <Text style={[styles.avatarText, { color: theme.primary }]}>
                  {patient.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.patientCardInfo}>
                <View style={styles.patientCardHeader}>
                  <Text style={[styles.patientName, { color: theme.text }]}>
                    {patient.name}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(patient.status) },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.patientMetadata, { color: theme.secondary }]}
                >
                  {patient.age} years • {patient.condition}
                </Text>
                <Text
                  style={[styles.lastVisitText, { color: theme.secondary }]}
                >
                  Last visit: {patient.lastVisit}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.secondary}
              />
            </View>
          </TouchableOpacity>
        ))
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  patientDetails: {
    marginLeft: 12,
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  patientMetadata: {
    fontSize: 13,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  requestTime: {
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 60,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  patientCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  patientCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  lastVisitText: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
