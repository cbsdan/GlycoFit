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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';

const SmokingIntakeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [smokingStatus, setSmokingStatus] = useState('never');
  const [cigarettesPerDay, setCigarettesPerDay] = useState('0');
  const [yearsSmoked, setYearsSmoked] = useState('');
  const [smokingData, setSmokingData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [diabetesRisk, setDiabetesRisk] = useState(null);

  const smokingStatusOptions = [
    { value: 'never', label: 'Never Smoked', icon: 'close-circle-outline' },
    { value: 'former', label: 'Former Smoker', icon: 'history' },
    { value: 'current', label: 'Current Smoker', icon: 'smoking' },
  ];

  const cigarettesPerDayOptions = [
    { value: '0', label: 'None (0)' },
    { value: '1-5', label: 'Light (1-5)' },
    { value: '6-10', label: 'Moderate (6-10)' },
    { value: '11-20', label: 'Heavy (11-20)' },
    { value: '>20', label: 'Very Heavy (>20)' },
  ];

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await api.getSmokingIntakeHistory();
      if (response.data.success) {
        const data = response.data.data && response.data.data.length > 0 ? response.data.data[0] : null;
        
        if (data) {
          setSmokingData(data);
          // Sort sessions from latest to oldest
          const sortedSessions = (data.smoking_sessions || []).sort((a, b) => {
            const dateA = new Date(a.recorded_at || a.start_date);
            const dateB = new Date(b.recorded_at || b.start_date);
            return dateB - dateA; // Descending order (latest first)
          });
          setSessions(sortedSessions);
          setSmokingStatus('never');
          setDiabetesRisk(data.diabetes_risk || null);
          
          // Load most recent active session if available
          const activeSessions = (data.smoking_sessions || []).filter(s => s.status === 'active');
          if (activeSessions.length > 0) {
            const recent = activeSessions[0];
            setCigarettesPerDay(recent.cigarettes_per_day || '0');
            setYearsSmoked(recent.duration_years?.toString() || '');
          } else if (data.smoking_sessions && data.smoking_sessions.length > 0) {
            // Load last session if no active session
            const recent = data.smoking_sessions[data.smoking_sessions.length - 1];
            setCigarettesPerDay(recent.cigarettes_per_day || '0');
            setYearsSmoked(recent.duration_years?.toString() || '');
          }
        } else {
          setSmokingData(null);
          setSessions([]);
        }
      }
    } catch (error) {
      console.error('Error loading smoking history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculatePackYears = () => {
    if (smokingStatus === 'never' || cigarettesPerDay === '0') return 0;
    
    const years = parseFloat(yearsSmoked) || 0;
    let cigarettesPerDayNum = 0;
    
    switch (cigarettesPerDay) {
      case '1-5':
        cigarettesPerDayNum = 3;
        break;
      case '6-10':
        cigarettesPerDayNum = 8;
        break;
      case '11-20':
        cigarettesPerDayNum = 15;
        break;
      case '>20':
        cigarettesPerDayNum = 25;
        break;
      default:
        cigarettesPerDayNum = 0;
    }
    
    // Pack-years = (cigarettes per day ÷ 20) × years smoked
    return ((cigarettesPerDayNum / 20) * years).toFixed(2);
  };

  const handleDeleteSession = (sessionId) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this smoking session? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteSmokingSession(sessionId);
              if (response.data.success) {
                Alert.alert('Success', 'Session deleted successfully');
                loadHistory();
              }
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to delete session'
              );
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (smokingStatus !== 'never' && !yearsSmoked) {
      Alert.alert('Missing Information', 'Please enter the number of years smoked.');
      return;
    }

    if (smokingStatus !== 'never' && cigarettesPerDay === '0') {
      Alert.alert('Missing Information', 'Please select cigarettes per day.');
      return;
    }

    try {
      setLoading(true);
      const packYears = calculatePackYears();
      
      const response = await api.saveSmokingIntake({
        smoking_status: smokingStatus,
        cigarettes_per_day: cigarettesPerDay,
        years_smoked: smokingStatus === 'never' ? 0 : parseFloat(yearsSmoked),
        pack_years: parseFloat(packYears),
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Smoking intake recorded successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                loadHistory();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error saving smoking intake:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to save smoking intake'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return '#27AE60';
      case 'low_moderate':
        return '#F39C12';
      case 'moderate':
        return '#E67E22';
      case 'moderate_high':
        return '#E74C3C';
      case 'high':
        return '#C0392B';
      case 'very_high':
        return '#7F1D1D';
      default:
        return colors.secondary;
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return 'shield-check';
      case 'low_moderate':
      case 'moderate':
        return 'shield-alert';
      case 'moderate_high':
      case 'high':
      case 'very_high':
        return 'alert-circle';
      default:
        return 'information';
    }
  };

  const getRiskLabel = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return 'Low Risk';
      case 'low_moderate':
        return 'Low-Moderate Risk';
      case 'moderate':
        return 'Moderate Risk';
      case 'moderate_high':
        return 'Moderate-High Risk';
      case 'high':
        return 'High Risk';
      case 'very_high':
        return 'Very High Risk';
      default:
        return 'Unknown Risk';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'never':
        return '#27AE60';
      case 'former':
        return '#F39C12';
      case 'current':
        return '#E74C3C';
      default:
        return colors.secondary;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    optionButton: {
      width: '30%',
      marginHorizontal: 4,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionButtonActive: {
      borderColor: '#E74C3C',
      backgroundColor: `${colors.primary}15`,
    },
    optionIcon: {
      marginBottom: 8,
    },
    optionLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    packYearsCard: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 24,
    },
    packYearsTitle: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 4,
    },
    packYearsValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    packYearsSubtitle: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    quitInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    quitText: {
      fontSize: 14,
      color: '#27AE60',
      marginLeft: 8,
      fontWeight: '500',
    },
    riskCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 2,
    },
    riskHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    riskLevel: {
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 8,
    },
    riskExplanation: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    sessionEndDate: {
      fontSize: 11,
      color: colors.secondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 24,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    historySection: {
      marginTop: 16,
    },
    historyCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    historyDate: {
      fontSize: 12,
      color: colors.secondary,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    deleteButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    historyDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    historyDetailItem: {
      flex: 1,
    },
    historyDetailLabel: {
      fontSize: 11,
      color: colors.secondary,
      marginBottom: 2,
    },
    historyDetailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 8,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Smoking Intake</Text>
          <Text style={styles.subtitle}>
            Track your smoking history to better understand health risks. Pack-years are calculated to predict diabetes and cardiovascular risk based on medical research (Willi et al., 2007; Pan et al., 2015).
          </Text>
        </View>

        {/* Smoking Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Have you ever smoked cigarettes?</Text>
          <View style={styles.optionGrid}>
            {smokingStatusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  smokingStatus === option.value && styles.optionButtonActive,
                ]}
                onPress={() => {
                  setSmokingStatus(option.value);
                  if (option.value === 'never') {
                    setCigarettesPerDay('0');
                    setYearsSmoked('0');
                  }
                }}
                activeOpacity={0.7}
              >
                <Icon
                  name={option.icon}
                  size={24}
                  color={smokingStatus === option.value ? colors.primary : colors.secondary}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cigarettes Per Day (only if not never) */}
        {smokingStatus !== 'never' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              How many cigarettes do you {smokingStatus === 'former' ? 'used to' : ''} smoke per day?
            </Text>
            <View style={styles.optionGrid}>
              {cigarettesPerDayOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    cigarettesPerDay === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setCigarettesPerDay(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Years Smoked (only if not never) */}
        {smokingStatus !== 'never' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>For how many years {smokingStatus === 'former' ? 'did' : 'have'} you smoke{smokingStatus === 'current' ? 'd' : ''}?</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of years"
              placeholderTextColor={colors.secondary}
              value={yearsSmoked}
              onChangeText={setYearsSmoked}
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Pack-Years Calculation */}
        {smokingStatus !== 'never' && yearsSmoked && cigarettesPerDay !== '0' && (
          <View style={styles.packYearsCard}>
            <Text style={styles.packYearsTitle}>Calculated Pack-Years</Text>
            <Text style={styles.packYearsValue}>{calculatePackYears()}</Text>
            <Text style={styles.packYearsSubtitle}>
              Pack-years = (cigarettes/day ÷ 20) × years smoked
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save Smoking Intake</Text>
          )}
        </TouchableOpacity>

        {/* Cumulative Summary Card */}
        {smokingData && smokingData.current_status !== 'never' && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Your Smoking Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cumulative Pack-Years</Text>
                <Text style={styles.summaryValue}>{smokingData.cumulative_pack_years ? smokingData.cumulative_pack_years.toFixed(1) : '0.0'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Sessions</Text>
                <Text style={styles.summaryValue}>{String(sessions.length)}</Text>
              </View>
            </View>
            {smokingData.years_since_quit && (
              <View style={styles.quitInfo}>
                <Icon name="check-circle" size={16} color="#27AE60" />
                <Text style={styles.quitText}>
                  {`Quit ${smokingData.years_since_quit.toFixed(1)} years ago`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Diabetes Risk Assessment */}
        {diabetesRisk && (
          <View style={[styles.riskCard, { borderColor: getRiskColor(diabetesRisk.risk_level) }]}>
            <View style={styles.riskHeader}>
              <Icon 
                name={getRiskIcon(diabetesRisk.risk_level)} 
                size={24} 
                color={getRiskColor(diabetesRisk.risk_level)} 
              />
              <Text style={[styles.riskLevel, { color: getRiskColor(diabetesRisk.risk_level) }]}>
                {String(getRiskLabel(diabetesRisk.risk_level))}
              </Text>
            </View>
            <Text style={styles.riskExplanation}>{String(diabetesRisk.explanation)}</Text>
          </View>
        )}

        {/* History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Smoking Sessions</Text>
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : sessions.length > 0 ? (
            sessions.map((session, index) => (
              <View key={session.session_id || index} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyDate}>
                    {formatDate(session.recorded_at || session.start_date)}
                  </Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: session.status === 'active' ? '#E74C3C' : '#95A5A6' 
                  }]}>
                    <Text style={styles.statusBadgeText}>
                      {session.status === 'active' ? 'Active' : 'Quit'}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyDetails}>
                  <View style={styles.historyDetailItem}>
                    <Text style={styles.historyDetailLabel}>Cigarettes/Day</Text>
                    <Text style={styles.historyDetailValue}>{String(session.cigarettes_per_day)}</Text>
                  </View>
                  <View style={styles.historyDetailItem}>
                    <Text style={styles.historyDetailLabel}>Duration</Text>
                    <Text style={styles.historyDetailValue}>{`${String(session.duration_years)} yrs`}</Text>
                  </View>
                  <View style={styles.historyDetailItem}>
                    <Text style={styles.historyDetailLabel}>Pack-Years</Text>
                    <Text style={styles.historyDetailValue}>{session.pack_years ? session.pack_years.toFixed(1) : '0.0'}</Text>
                  </View>
                </View>
                {session.end_date && (
                  <Text style={styles.sessionEndDate}>
                    {`Ended: ${formatDate(session.end_date)}`}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => handleDeleteSession(session.session_id)}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                >
                  <Icon name="delete" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="history" size={48} color={colors.secondary} />
              <Text style={styles.emptyStateText}>No smoking sessions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SmokingIntakeScreen;
