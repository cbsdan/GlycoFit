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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { patientAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function PatientsScreen() {
  const navigation = useNavigation();
  const { colors: theme } = useTheme();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); // all, active, requests
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePatients, setActivePatients] = useState([]);
  const [patientRequests, setPatientRequests] = useState([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const [patientsRes, requestsRes] = await Promise.all([
        patientAPI.getPatients(),
        patientAPI.getRequests(),
      ]);

      if (patientsRes.success) {
        setActivePatients(patientsRes.data);
      }

      if (requestsRes.success) {
        setPatientRequests(requestsRes.data);
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

  const handleDeclineRequest = async (requestId) => {
    try {
      const response = await patientAPI.declineRequest(requestId);
      if (response.success) {
        showToast('Patient request declined', 'success');
        fetchPatients();
      }
    } catch (error) {
      console.error('Error declining request:', error);
      showToast('Failed to decline request', 'error');
    }
  };

  const allPatients = [...activePatients.map(p => ({ ...p, status: 'active' })), ...patientRequests.map(r => ({ ...r, status: 'request' }))];

  const filteredPatients = allPatients.filter((patient) => {
    // For requests: patient.patient has the user data
    // For active: patient has the user data directly
    let patientName = '';
    if (patient.status === 'request' && patient.patient) {
      patientName = `${patient.patient.first_name || ''} ${patient.patient.last_name || ''}`.trim();
    } else {
      patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    }
    
    const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      selectedTab === 'all' ||
      (selectedTab === 'active' && patient.status === 'active') ||
      (selectedTab === 'requests' && patient.status === 'request');
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
      <View style={styles.tabContainer}>
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
              {
                color: selectedTab === 'all' ? theme.primary : theme.secondary,
              },
            ]}
          >
            All Patients
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
              {
                color: selectedTab === 'active' ? theme.primary : theme.secondary,
              },
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
                {
                  color:
                    selectedTab === 'requests' ? theme.primary : theme.secondary,
                },
              ]}
            >
              Requests
            </Text>
            {patientRequests.length > 0 && (
              <View
                style={[styles.badge, { backgroundColor: theme.error }]}
              >
                <Text style={styles.badgeText}>{patientRequests.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
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
            <Ionicons name="people-outline" size={64} color={theme.secondary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>
              {selectedTab === 'all' ? 'No patients yet' : 
               selectedTab === 'active' ? 'No active patients' : 
               'No pending requests'}
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
              {selectedTab === 'requests' 
                ? 'Patient requests will appear here'
                : 'Start connecting with patients to see them here'}
            </Text>
          </View>
        ) : (
          filteredPatients.map((patient) =>
          patient.status === 'request' ? (
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
              <View style={styles.requestHeader}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.primary + '20' },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {patient.patient?.first_name?.charAt(0) || '?'}
                  </Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={[styles.patientName, { color: theme.text }]}>
                    {patient.patient ? `${patient.patient.first_name} ${patient.patient.last_name}` : 'Unknown'}
                  </Text>
                  <Text
                    style={[styles.patientDetails, { color: theme.secondary }]}
                  >
                    {patient.patient?.email || 'No email'}
                  </Text>
                  <Text
                    style={[styles.requestTime, { color: theme.secondary }]}
                  >
                    Requested {patient.request_date ? new Date(patient.request_date).toLocaleDateString() : 'Unknown'}
                  </Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    { backgroundColor: theme.success },
                  ]}
                  onPress={() => handleAcceptRequest(patient._id || patient.id)}
                >
                  <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.declineButton, { borderColor: theme.error }]}
                  onPress={() => handleDeclineRequest(patient._id || patient.id)}
                >
                  <Text style={[styles.declineText, { color: theme.error }]}>
                    Decline
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ) : (
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
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.primary + '20' },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {patient.first_name?.charAt(0) || '?'}
                  </Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={[styles.patientName, { color: theme.text }]}>
                    {`${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown'}
                  </Text>
                  <Text
                    style={[styles.patientDetails, { color: theme.secondary }]}
                  >
                    {patient.email || 'No email'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.chatButton, { backgroundColor: theme.primary }]}
                  onPress={() => navigation.navigate('PatientChat', {
                    patient: patient,
                    relationship: {
                      id: patient.relationship?.id || patient.relationship_id || patient._id,
                      patient: patient,
                    }
                  })}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.metricsContainer}>
                <View style={styles.metric}>
                  <Ionicons name="water" size={16} color={theme.secondary} />
                  <Text style={[styles.metricLabel, { color: theme.secondary }]}>
                    Glucose
                  </Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: getGlucoseColor(patient.health_info?.glucose_level || 0) },
                    ]}
                  >
                    {patient.health_info?.glucose_level || 0} mg/dL
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Ionicons name="medkit" size={16} color={theme.secondary} />
                  <Text style={[styles.metricLabel, { color: theme.secondary }]}>
                    Medications
                  </Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {patient.health_info?.medications || 0} active
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Ionicons name="time" size={16} color={theme.secondary} />
                  <Text style={[styles.metricLabel, { color: theme.secondary }]}>
                    Last Visit
                  </Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {patient.health_info?.last_visit ? new Date(patient.health_info.last_visit).toLocaleDateString() : 'Never'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        ))}
      </ScrollView>
      </View>
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
    justifyContent: 'space-between',
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
});
