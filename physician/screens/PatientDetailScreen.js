import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { patientAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function PatientDetailScreen({ route, navigation }) {
  const { patient, relationship } = route.params;
  const { colors: theme } = useTheme();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchPatientDetails();
  }, []);

  const fetchPatientDetails = async () => {
    try {
      setLoading(true);
      const patientId = patient.id || patient._id;
      const response = await patientAPI.getPatientDetails(patientId);
      
      if (response.success) {
        setPatientData(response.data);
      } else {
        // Use the passed patient data as fallback
        setPatientData({
          ...patient,
          health_data: {},
          prescriptions: [],
          consultations: [],
          appointments: [],
        });
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
      // Use passed data as fallback
      setPatientData({
        ...patient,
        health_data: {},
        prescriptions: [],
        consultations: [],
        appointments: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatientDetails();
    setRefreshing(false);
  };

  const getGlucoseStatus = (level) => {
    if (!level) return { color: theme.secondary, status: 'No data', icon: 'help-circle' };
    if (level < 70) return { color: theme.error, status: 'Low', icon: 'arrow-down-circle' };
    if (level < 100) return { color: theme.success, status: 'Normal', icon: 'checkmark-circle' };
    if (level < 126) return { color: theme.warning, status: 'Pre-diabetic', icon: 'alert-circle' };
    return { color: theme.error, status: 'High', icon: 'arrow-up-circle' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Patient Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.secondary, marginTop: 16 }}>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const data = patientData || patient;
  const healthInfo = data.health_info || {};
  const healthData = data.health_data || {};
  const glucoseStatus = getGlucoseStatus(healthInfo.glucose_level || healthData.latest_glucose);

  const renderOverview = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Patient Info Card */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.patientHeader}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {data.first_name?.charAt(0) || '?'}{data.last_name?.charAt(0) || ''}
            </Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, { color: theme.text }]}>
              {`${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown Patient'}
            </Text>
            <Text style={[styles.patientEmail, { color: theme.secondary }]}>
              {data.email || 'No email'}
            </Text>
            {data.phone && (
              <Text style={[styles.patientPhone, { color: theme.secondary }]}>
                <Ionicons name="call-outline" size={14} /> {data.phone}
              </Text>
            )}
          </View>
        </View>
        
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color={theme.secondary} />
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>Patient Since</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {formatDate(data.relationship?.acceptance_date || relationship?.acceptance_date)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="fitness-outline" size={18} color={theme.secondary} />
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>Condition</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {healthInfo.condition || data.diabetic_type || 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Health Overview</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.card, ...theme.shadow }]}>
          <View style={[styles.statIconContainer, { backgroundColor: glucoseStatus.color + '20' }]}>
            <Ionicons name={glucoseStatus.icon} size={24} color={glucoseStatus.color} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {healthInfo.glucose_level || healthData.latest_glucose || '--'}
          </Text>
          <Text style={[styles.statUnit, { color: theme.secondary }]}>mg/dL</Text>
          <Text style={[styles.statLabel, { color: glucoseStatus.color }]}>{glucoseStatus.status}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, ...theme.shadow }]}>
          <View style={[styles.statIconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="heart" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {healthData.latest_heart_rate || healthInfo.heart_rate || '--'}
          </Text>
          <Text style={[styles.statUnit, { color: theme.secondary }]}>bpm</Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>Heart Rate</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, ...theme.shadow }]}>
          <View style={[styles.statIconContainer, { backgroundColor: theme.success + '20' }]}>
            <Ionicons name="footsteps" size={24} color={theme.success} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {healthData.today_steps?.toLocaleString() || '--'}
          </Text>
          <Text style={[styles.statUnit, { color: theme.secondary }]}>steps</Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>Today</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, ...theme.shadow }]}>
          <View style={[styles.statIconContainer, { backgroundColor: theme.warning + '20' }]}>
            <Ionicons name="flame" size={24} color={theme.warning} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {healthData.today_calories || '--'}
          </Text>
          <Text style={[styles.statUnit, { color: theme.secondary }]}>kcal</Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>Burned</Text>
        </View>
      </View>

      {/* Additional Health Metrics */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Additional Metrics</Text>
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Ionicons name="moon" size={20} color={theme.secondary} />
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.secondary }]}>Sleep</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {healthData.avg_sleep_hours ? `${healthData.avg_sleep_hours.toFixed(1)} hrs` : 'No data'}
              </Text>
            </View>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="water" size={20} color={theme.secondary} />
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.secondary }]}>Hydration</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {healthData.water_intake ? `${healthData.water_intake} ml` : 'No data'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Ionicons name="body" size={20} color={theme.secondary} />
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.secondary }]}>Weight</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {healthData.weight ? `${healthData.weight} kg` : (data.weight ? `${data.weight} kg` : 'No data')}
              </Text>
            </View>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="speedometer" size={20} color={theme.secondary} />
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.secondary }]}>BMI</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {healthData.bmi ? healthData.bmi.toFixed(1) : 'No data'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('PatientChat', { patient: data, relationship })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Send Message</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.success }]}
          onPress={() => navigation.navigate('Consultations')}
        >
          <Ionicons name="videocam" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Schedule Consultation</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );

  const renderMedications = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="medkit" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Active Prescriptions</Text>
        </View>
        
        {(data.prescriptions && data.prescriptions.length > 0) ? (
          data.prescriptions.map((rx, index) => (
            <View key={rx.id || index} style={[styles.medicationItem, { borderBottomColor: theme.border }]}>
              <View style={styles.medicationInfo}>
                <Text style={[styles.medicationName, { color: theme.text }]}>{rx.medication_name}</Text>
                <Text style={[styles.medicationDosage, { color: theme.secondary }]}>
                  {rx.dosage} - {rx.frequency}
                </Text>
                <Text style={[styles.medicationDate, { color: theme.secondary }]}>
                  Started: {formatDate(rx.start_date)}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.statusText, { color: theme.success }]}>Active</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No active prescriptions</Text>
          </View>
        )}
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Consultations History */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="videocam" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Consultations</Text>
        </View>
        
        {(data.consultations && data.consultations.length > 0) ? (
          data.consultations.slice(0, 5).map((consultation, index) => (
            <View key={consultation.id || index} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
              <View style={styles.historyIcon}>
                <Ionicons name="videocam-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  Video Consultation
                </Text>
                <Text style={[styles.historyDate, { color: theme.secondary }]}>
                  {formatDateTime(consultation.scheduled_date)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: consultation.status === 'completed' ? theme.success + '20' : theme.warning + '20' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: consultation.status === 'completed' ? theme.success : theme.warning }
                ]}>
                  {consultation.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No consultation history</Text>
          </View>
        )}
      </View>

      {/* Appointments History */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow, marginTop: 16 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar" size={24} color={theme.success} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Appointments</Text>
        </View>
        
        {(data.appointments && data.appointments.length > 0) ? (
          data.appointments.slice(0, 5).map((apt, index) => (
            <View key={apt.id || index} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
              <View style={styles.historyIcon}>
                <Ionicons name="location-outline" size={20} color={theme.success} />
              </View>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  {apt.type || 'In-Person Visit'}
                </Text>
                <Text style={[styles.historyDate, { color: theme.secondary }]}>
                  {formatDateTime(apt.date)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: apt.status === 'completed' ? theme.success + '20' : theme.primary + '20' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: apt.status === 'completed' ? theme.success : theme.primary }
                ]}>
                  {apt.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No appointment history</Text>
          </View>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {`${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Patient Details'}
        </Text>
        <TouchableOpacity 
          style={styles.chatIconButton}
          onPress={() => navigation.navigate('PatientChat', { patient: data, relationship })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {['overview', 'medications', 'history'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              selectedTab === tab && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Ionicons
              name={
                tab === 'overview' ? 'person' :
                tab === 'medications' ? 'medkit' : 'time'
              }
              size={18}
              color={selectedTab === tab ? theme.primary : theme.secondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === tab ? theme.primary : theme.secondary },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {selectedTab === 'overview' && renderOverview()}
      {selectedTab === 'medications' && renderMedications()}
      {selectedTab === 'history' && renderHistory()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  chatIconButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 16,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  patientPhone: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    width: (width - 48) / 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  metricInfo: {
    marginLeft: 12,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  medicationDosage: {
    fontSize: 14,
    marginTop: 2,
  },
  medicationDate: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
