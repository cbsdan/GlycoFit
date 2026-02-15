import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSleepSummary,
  checkSleepBaseline,
  refreshSleepMetrics,
  syncHealthConnectSleep,
  getDailySleepRecords,
  deleteDailySleepRecord,
  cleanupDuplicateSleepRecords,
} from '../services/api';
import {
  initializeHealthConnect,
  getSleepData,
  requestHealthPermission,
  getHealthConnectSdkStatus,
  SdkAvailabilityStatus,
  openHealthConnectSettingsPage,
} from '../services/healthConnectService';
import { LifestyleRecommendationsSection } from '../components/recommendations';

/**
 * SleepTrackingScreen - Main dashboard for sleep tracking
 * 
 * Features:
 * - Shows current metrics and risk assessment
 * - Quick access to log daily sleep
 * - Health Connect sync option
 * - Educational content about sleep and diabetes
 * - Recent sleep history
 */
const SleepTrackingScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [recordsToShow, setRecordsToShow] = useState(7); // 7, 30, or 60

  // Load data on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Check if baseline exists
      const baselineCheck = await checkSleepBaseline();
      const hasBaselineValue = baselineCheck?.has_baseline || false;
      setHasBaseline(hasBaselineValue);

      if (hasBaselineValue) {
        // Load full summary if baseline exists
        try {
          const summaryResponse = await getSleepSummary();
          if (summaryResponse?.success && summaryResponse?.data) {
            setSummary(summaryResponse.data);
          }

          // Fetch up to 60 days of records for display
          const recordsResponse = await getDailySleepRecords(null, null, 60);
          if (recordsResponse?.success && recordsResponse?.data) {
            setRecentRecords(recordsResponse.data);
          } else {
            // Fallback to summary's recent_records if daily fetch fails
            setRecentRecords(summaryResponse?.data?.recent_records || []);
          }
        } catch (summaryError) {
          console.error('Error loading sleep summary:', summaryError);
          // Continue without summary data
        }
      }
    } catch (error) {
      console.error('Error loading sleep data:', error);
      setHasBaseline(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSleepMetrics();
      await loadData();
    } catch (error) {
      console.error('Error refreshing:', error);
    }
    setIsRefreshing(false);
  };

  const handleStartBaseline = () => {
    navigation.navigate('SleepBaseline');
  };

  const handleLogSleep = () => {
    navigation.navigate('SleepDailyLog');
  };

  // Helper function to extract local date and time from ISO timestamp
  // Health Connect returns times in local timezone, we need to preserve that
  const parseLocalDateTime = (isoString) => {
    // Parse the ISO string to get the local date/time components
    // isoString format: "2026-01-05T04:14:00.000+08:00" or "2026-01-05T04:14:00Z"
    const date = new Date(isoString);

    // Get local date in YYYY-MM-DD format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;

    // Get local time in HH:mm format
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const localTime = `${hours}:${minutes}`;

    return { localDate, localTime };
  };

  // Get the sleep date (the night of sleep - if bedtime is after midnight, use previous day)
  const getSleepDate = (bedtimeIso, wakeTimeIso) => {
    const bedtime = new Date(bedtimeIso);
    const wakeTime = new Date(wakeTimeIso);

    // If bedtime is between midnight and 6am, the sleep session started the night before
    // So we use the wakeTime's date as the "sleep date"
    // Otherwise, we use the bedtime's date
    const bedtimeHours = bedtime.getHours();

    // Use the date when you went to bed (before midnight) or woke up (if you went to bed after midnight)
    // For sleep tracking, we typically want the date you started sleeping
    const referenceDate = bedtimeHours >= 0 && bedtimeHours < 6 ? wakeTime : bedtime;

    // Get local date
    const year = referenceDate.getFullYear();
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // Check for overlapping records between Health Connect and manual entries
  const findOverlappingDates = (healthConnectRecords, manualRecords) => {
    const manualDates = new Set(manualRecords.map(r => r.date));
    const overlappingDates = [];

    for (const hcRecord of healthConnectRecords) {
      const sleepDate = getSleepDate(hcRecord.startTime, hcRecord.endTime);

      if (manualDates.has(sleepDate)) {
        overlappingDates.push(sleepDate);
      }
    }

    return [...new Set(overlappingDates)]; // Remove duplicates
  };

  // Handle deleting a manual sleep record
  const handleDeleteRecord = (record) => {
    if (record.source !== 'manual') {
      Alert.alert('Cannot Delete', 'Health Connect data cannot be deleted from this app. Use the Health Connect app to manage wearable data.');
      return;
    }

    Alert.alert(
      'Delete Sleep Log',
      `Are you sure you want to delete the sleep log for ${record.date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDailySleepRecord(record.date, 'manual');
              Alert.alert('Deleted', 'Sleep log has been deleted.');
              await handleRefresh();
            } catch (error) {
              console.error('Error deleting record:', error);
              Alert.alert('Error', 'Failed to delete sleep log.');
            }
          },
        },
      ]
    );
  };

  // Handle tapping on a record
  const handleRecordPress = async (record) => {
    if (record.source === 'health_connect') {
      // Health Connect records - fetch all sessions for this date from Health Connect
      if (Platform.OS !== 'android') {
        Alert.alert('Health Connect Data', `Duration: ${record.sleep_duration_hours}h\n\nHealth Connect is only available on Android.`);
        return;
      }

      try {
        // Fetch sleep sessions for this specific date from Health Connect
        const recordDate = new Date(record.date);
        const startOfDay = new Date(recordDate);
        startOfDay.setHours(0, 0, 0, 0);
        // Include previous day evening (for overnight sleep that started before midnight)
        startOfDay.setDate(startOfDay.getDate() - 1);
        startOfDay.setHours(18, 0, 0, 0); // Start from 6 PM previous day

        const endOfDay = new Date(recordDate);
        endOfDay.setHours(23, 59, 59, 999);

        const sleepRecords = await getSleepData(startOfDay, endOfDay);

        // Filter to only sessions that belong to this date
        const sessionsForDate = sleepRecords.filter(session => {
          const sleepDate = getSleepDate(session.startTime, session.endTime);
          return sleepDate === record.date;
        });

        if (sessionsForDate.length === 0) {
          // No sessions found in Health Connect (might have been deleted)
          Alert.alert(
            'Health Connect Data',
            `Date: ${record.date}\nTotal Duration: ${record.sleep_duration_hours}h\n\nNo session details available from Health Connect.`,
            [{ text: 'OK' }]
          );
          return;
        }

        // Format each session for display
        const sessionDetails = sessionsForDate.map((session, index) => {
          const bedtime = parseLocalDateTime(session.startTime);
          const wakeTime = parseLocalDateTime(session.endTime);
          const duration = calculateDurationHours(session.startTime, session.endTime);

          // Determine session type based on duration and time
          const bedtimeHour = parseInt(bedtime.localTime.split(':')[0]);
          let sessionType = 'Sleep';
          if (duration < 1) {
            sessionType = 'Nap';
          } else if (duration < 3) {
            sessionType = bedtimeHour >= 12 && bedtimeHour < 18 ? 'Afternoon Nap' : 'Sleep';
          } else {
            sessionType = 'Main Sleep';
          }

          return `${index + 1}. ${sessionType}\n   🛏️ ${formatTime12h(bedtime.localTime)} → ${formatTime12h(wakeTime.localTime)}\n   ⏱️ ${duration}h`;
        }).join('\n\n');

        const totalDuration = sessionsForDate.reduce((sum, session) => {
          return sum + calculateDurationHours(session.startTime, session.endTime);
        }, 0);

        Alert.alert(
          `Sleep Sessions - ${record.date}`,
          `${sessionsForDate.length} session(s) recorded:\n\n${sessionDetails}\n\n━━━━━━━━━━━━━━━━\nTotal: ${Math.round(totalDuration * 10) / 10}h\n\nHealth Connect data cannot be edited here.`,
          [{ text: 'OK' }]
        );

      } catch (error) {
        console.error('Error fetching sleep sessions:', error);
        // Fallback to simple display
        Alert.alert(
          'Health Connect Data',
          `Date: ${record.date}\nBedtime: ${formatTime12h(record.bedtime)}\nWake: ${formatTime12h(record.wake_time)}\nDuration: ${record.sleep_duration_hours}h\n\nCould not fetch session details.`,
          [{ text: 'OK' }]
        );
      }
    } else {
      // Manual entries can be edited
      navigation.navigate('SleepDailyLog', {
        prefilledDate: record.date,
      });
    }
  };

  const handleHealthConnectSync = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Available', 'Health Connect is only available on Android devices.');
      return;
    }

    // Show sync confirmation with cleanup option
    Alert.alert(
      'Sync Sleep Data',
      'Would you like to sync your sleep data from Health Connect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync & Clean Duplicates',
          onPress: async () => {
            await syncSleepData();
            await handleCleanupDuplicates(false); // Silent cleanup
          },
        },
        {
          text: 'Sync Only',
          onPress: () => syncSleepData(),
        },
      ]
    );
  };

  const syncSleepData = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Available', 'Health Connect is only available on Android devices.');
      return;
    }

    setIsSyncing(true);

    try {
      // Check SDK status first
      const sdkStatus = await getHealthConnectSdkStatus();
      console.log('SDK Status:', sdkStatus);

      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        Alert.alert(
          'Health Connect Not Installed',
          'Health Connect is required to sync sleep data from your smartwatch.\n\nWould you like to install it from the Play Store?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Install',
              onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata')
            },
          ]
        );
        setIsSyncing(false);
        return;
      }

      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        Alert.alert(
          'Update Required',
          'Health Connect needs to be updated to sync sleep data.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Update',
              onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata')
            },
          ]
        );
        setIsSyncing(false);
        return;
      }

      // Initialize Health Connect
      await initializeHealthConnect();

      // Request sleep permissions
      const permissions = [
        { accessType: 'read', recordType: 'SleepSession' },
      ];

      console.log('Requesting sleep permissions...');
      const grantedPermissions = await requestHealthPermission(permissions);
      console.log('Granted permissions:', grantedPermissions);

      // Check if permissions were granted
      if (!grantedPermissions || grantedPermissions.length === 0) {
        Alert.alert(
          'Permission Required',
          'Please grant permission to read sleep data from Health Connect.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => openHealthConnectSettingsPage()
            },
          ]
        );
        setIsSyncing(false);
        return;
      }

      // Fetch sleep data from last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      console.log('Fetching sleep data from Health Connect...');
      const sleepRecords = await getSleepData(startDate, endDate);
      console.log('Sleep records fetched:', sleepRecords?.length || 0);

      if (!sleepRecords || sleepRecords.length === 0) {
        Alert.alert(
          'No Sleep Data',
          'No sleep data found in Health Connect for the last 30 days.\n\nMake sure your wearable app is syncing sleep data to Health Connect.',
          [{ text: 'OK' }]
        );
        setIsSyncing(false);
        return;
      }

      // Fetch existing manual records to check for overlaps (for logging purposes)
      let manualRecords = [];

      try {
        const existingRecordsResponse = await getDailySleepRecords(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          null,
          'manual'
        );
        if (existingRecordsResponse?.success && existingRecordsResponse?.data) {
          manualRecords = existingRecordsResponse.data;
        }
      } catch (e) {
        console.warn('Could not fetch existing manual records:', e);
      }

      // Check for overlapping dates (Health Connect always takes priority)
      const overlappingDates = findOverlappingDates(sleepRecords, manualRecords);

      if (overlappingDates.length > 0) {
        console.log('Found overlapping dates (Health Connect will overwrite):', overlappingDates);
      }

      // Transform records using local time (fix timezone issue)
      // Health Connect data always overwrites manual entries for the same date
      const transformedRecords = sleepRecords.map((record, index) => {
        const bedtime = parseLocalDateTime(record.startTime);
        const wakeTime = parseLocalDateTime(record.endTime);
        const sleepDate = getSleepDate(record.startTime, record.endTime);
        const duration = calculateDurationHours(record.startTime, record.endTime);

        // Log each record for debugging
        console.log(`Record ${index + 1}:`, {
          originalStart: record.startTime,
          originalEnd: record.endTime,
          parsedBedtime: bedtime.localTime,
          parsedWakeTime: wakeTime.localTime,
          sleepDate: sleepDate,
          duration: duration,
        });

        return {
          date: sleepDate,
          bedtime: bedtime.localTime,
          wake_time: wakeTime.localTime,
          sleep_duration_hours: duration,
          stages: record.stages || null,
          metadata: {
            source_app: record.metadata?.dataOrigin || 'health_connect',
            device: record.metadata?.device || null,
          }
        };
      });

      // Group records by date and keep only the longest sleep session for each date
      // This filters out naps and keeps only the main overnight sleep
      const recordsByDate = {};
      for (const record of transformedRecords) {
        if (!recordsByDate[record.date] || record.sleep_duration_hours > recordsByDate[record.date].sleep_duration_hours) {
          recordsByDate[record.date] = record;
        }
      }
      const dedupedRecords = Object.values(recordsByDate);

      console.log(`Original records: ${transformedRecords.length}, After deduplication: ${dedupedRecords.length}`);
      if (transformedRecords.length !== dedupedRecords.length) {
        console.log('Duplicate dates found - keeping longest sleep session per date (naps excluded)');
      }

      console.log('Syncing', dedupedRecords.length, 'records to cloud...');
      const syncResponse = await syncHealthConnectSleep(dedupedRecords);

      if (syncResponse.success) {
        const syncedCount = syncResponse.data?.synced_count || syncResponse.synced || dedupedRecords.length;
        const overwriteText = overlappingDates.length > 0
          ? `\n\n${overlappingDates.length} manual entry(s) were replaced with wearable data.`
          : '';
        const dedupText = transformedRecords.length !== dedupedRecords.length
          ? `\n\n${transformedRecords.length - dedupedRecords.length} shorter sleep session(s) (naps) were excluded.`
          : '';

        Alert.alert(
          'Sync Complete',
          `Successfully synced ${syncedCount} sleep records from your wearable!\n\nYour sleep metrics will be updated.${overwriteText}${dedupText}`,
          [{ text: 'OK' }]
        );

        // Refresh data
        await handleRefresh();
      } else {
        throw new Error(syncResponse.error || 'Sync failed');
      }

    } catch (error) {
      console.error('Health Connect sync error:', error);

      let errorMessage = 'Failed to sync sleep data. Please try again.';

      if (error.code === 'NOT_INSTALLED') {
        errorMessage = 'Health Connect is not installed. Please install it from the Play Store.';
      } else if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission to access sleep data was denied.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Sync Error', errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCleanupDuplicates = async (showConfirm = true) => {
    const performCleanup = async () => {
      try {
        const response = await cleanupDuplicateSleepRecords();
        if (response.success) {
          if (response.deleted_count > 0) {
            Alert.alert(
              'Cleanup Complete',
              `Removed ${response.deleted_count} duplicate record(s). Your sleep data has been updated.`
            );
            await handleRefresh();
          } else if (showConfirm) {
            Alert.alert('No Duplicates', 'No duplicate records found.');
          }
        }
      } catch (error) {
        console.error('Cleanup error:', error);
        Alert.alert('Cleanup Error', 'Failed to clean up duplicates. Please try again.');
      }
    };

    if (showConfirm) {
      Alert.alert(
        'Clean Up Duplicates',
        'This will remove duplicate sleep records and keep the most recent entry for each date. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clean Up',
            onPress: () => performCleanup(),
          },
        ]
      );
    } else {
      await performCleanup();
    }
  };

  // Helper to convert "HH:mm" time to minutes from midnight
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const calculateDurationHours = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 10) / 10; // Round to 1 decimal
  };

  const getRiskColor = (category) => {
    switch (category) {
      case 'low': return '#27AE60';
      case 'moderate': return '#F39C12';
      case 'high': return '#E67E22';
      case 'very_high': return '#E74C3C';
      default: return colors.secondary;
    }
  };

  const getRiskLabel = (category) => {
    switch (category) {
      case 'low': return 'Low Risk';
      case 'moderate': return 'Moderate Risk';
      case 'high': return 'High Risk';
      case 'very_high': return 'Very High Risk';
      default: return 'Unknown';
    }
  };

  const formatTime12h = (time24) => {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':').map(Number);
    const hour = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const getDataSourceLabel = (source) => {
    switch (source) {
      case 'manual': return { label: 'Manual', icon: 'pencil', color: '#3498DB' };
      case 'health_connect': return { label: 'Smartwatch', icon: 'watch', color: '#9B59B6' };
      case 'mixed': return { label: 'Mixed', icon: 'sync', color: '#27AE60' };
      case 'manual_only': return { label: 'Manual Only', icon: 'pencil', color: '#3498DB' };
      default: return { label: 'Unknown', icon: 'help-circle', color: colors.secondary };
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
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    refreshButton: {
      padding: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Baseline CTA
    baselineCTA: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    baselineIcon: {
      marginBottom: 16,
    },
    baselineTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    baselineDescription: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    baselineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    baselineButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    // Risk Card
    riskCard: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    riskHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    riskTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      opacity: 0.9,
    },
    riskBadge: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    riskBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    riskScore: {
      fontSize: 48,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    riskLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      opacity: 0.9,
    },
    riskFactors: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },
    riskFactorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    riskFactorText: {
      fontSize: 13,
      color: '#FFFFFF',
      marginLeft: 8,
      opacity: 0.9,
    },
    // Metrics Grid
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
      marginBottom: 16,
    },
    metricCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 6,
    },
    metricIcon: {
      marginBottom: 8,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    metricUnit: {
      fontSize: 12,
      color: colors.secondary,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    // Quick Actions
    actionsContainer: {
      flexDirection: 'row',
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginRight: 6,
    },
    actionButtonSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 0,
      marginLeft: 6,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    actionButtonTextSecondary: {
      color: colors.text,
    },
    retakeBaselineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retakeBaselineText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.secondary,
      marginLeft: 8,
    },
    // Data Source
    dataSourceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dataSourceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    dataSourceInfo: {
      flex: 1,
    },
    dataSourceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    dataSourceSubtext: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 2,
    },
    // Recent Records
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    recordCardContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    recordCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    recordCardReadOnly: {
      opacity: 0.85,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    editIcon: {
      marginLeft: 8,
    },
    lockIcon: {
      marginLeft: 8,
      opacity: 0.5,
    },
    deleteRecordButton: {
      paddingLeft: 8,
      marginLeft: 2,
    },
    recordDate: {
      flex: 1,
    },
    recordDateText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    recordDateSubtext: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 2,
    },
    recordStats: {
      alignItems: 'flex-end',
    },
    recordDuration: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    recordSource: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    recordSourceText: {
      fontSize: 10,
      color: colors.secondary,
      marginLeft: 4,
    },
    emptyRecords: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyRecordsText: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 12,
    },
    // Show More/Less Button
    showMoreButton: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    showMoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    recordCountText: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    // Education Section
    educationCard: {
      backgroundColor: `${colors.primary}10`,
      borderRadius: 16,
      padding: 20,
      marginTop: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    educationTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    educationText: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 22,
      marginBottom: 8,
    },
    educationBullet: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    educationBulletText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      marginLeft: 8,
      lineHeight: 20,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.secondary, marginTop: 12 }}>
            Loading sleep data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show baseline CTA if not completed
  if (!hasBaseline) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sleep Tracking</Text>
          </View>

          <View style={styles.baselineCTA}>
            <Icon
              name="moon-waning-crescent"
              size={64}
              color={colors.primary}
              style={styles.baselineIcon}
            />
            <Text style={styles.baselineTitle}>
              Set Up Sleep Tracking
            </Text>
            <Text style={styles.baselineDescription}>
              Answer a few questions about your sleep habits to establish your baseline.
              This helps us provide accurate diabetes risk assessments based on your sleep patterns.
            </Text>
            <TouchableOpacity
              style={styles.baselineButton}
              onPress={handleStartBaseline}
              accessibilityRole="button"
              accessibilityLabel="Start sleep baseline questionnaire"
            >
              <Icon name="clipboard-check" size={20} color="#FFFFFF" />
              <Text style={styles.baselineButtonText}>Complete Baseline</Text>
            </TouchableOpacity>
          </View>

          {/* Educational Content */}
          <View style={styles.educationCard}>
            <Text style={styles.educationTitle}>
              Why Sleep Matters for Diabetes Risk
            </Text>
            <Text style={styles.educationText}>
              Research shows strong connections between sleep patterns and diabetes risk:
            </Text>
            <View style={styles.educationBullet}>
              <Icon name="circle-small" size={20} color={colors.primary} />
              <Text style={styles.educationBulletText}>
                <Text style={{ fontWeight: '600' }}>Short sleep (&lt;6 hours)</Text> increases
                insulin resistance and diabetes risk by 28%
              </Text>
            </View>
            <View style={styles.educationBullet}>
              <Icon name="circle-small" size={20} color={colors.primary} />
              <Text style={styles.educationBulletText}>
                <Text style={{ fontWeight: '600' }}>Long sleep (&gt;9 hours)</Text> may indicate
                underlying health issues and is associated with higher diabetes incidence
              </Text>
            </View>
            <View style={styles.educationBullet}>
              <Icon name="circle-small" size={20} color={colors.primary} />
              <Text style={styles.educationBulletText}>
                <Text style={{ fontWeight: '600' }}>Irregular bedtimes</Text> disrupt circadian
                rhythms and impair glucose metabolism
              </Text>
            </View>
            <View style={styles.educationBullet}>
              <Icon name="circle-small" size={20} color={colors.primary} />
              <Text style={styles.educationBulletText}>
                <Text style={{ fontWeight: '600' }}>Optimal sleep (7-8 hours)</Text> with
                consistent bedtime supports healthy blood sugar levels
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main dashboard view when baseline exists
  const metrics = summary?.metrics || {};
  const risk = summary?.risk_assessment || {};
  const riskColor = getRiskColor(risk.risk_category);
  const sourceInfo = getDataSourceLabel(metrics.dominant_sleep_source);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sleep Tracking</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh data"
          >
            <Icon name="refresh" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Risk Assessment Card */}
        <View style={[styles.riskCard, { backgroundColor: riskColor }]}>
          <View style={styles.riskHeader}>
            <Text style={styles.riskTitle}>SLEEP-RELATED DIABETES RISK</Text>
          </View>
          <Text style={styles.riskScore}>{Math.round(risk.risk_score || 0)}</Text>
          <Text style={styles.riskLabel}>{getRiskLabel(risk.risk_category)}</Text>

          {risk.risk_factors && risk.risk_factors.length > 0 && (
            <View style={styles.riskFactors}>
              {risk.risk_factors.slice(0, 3).map((factor, index) => (
                <View key={index} style={styles.riskFactorItem}>
                  <Icon name="alert-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.riskFactorText}>
                    {factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.riskBadge}>
            <Text style={styles.riskBadgeText}>
              {metrics.days_with_data_30d || 0} days tracked
            </Text>
          </View>
        </View>

        {/* Retake Baseline Button */}
        <TouchableOpacity
          style={styles.retakeBaselineButton}
          onPress={() => navigation.navigate('SleepBaseline', { baseline: summary?.baseline })}
          accessibilityRole="button"
          accessibilityLabel="Retake sleep baseline questionnaire"
        >
          <Icon name="refresh" size={18} color={colors.secondary} />
          <Text style={styles.retakeBaselineText}>Retake Baseline Questionnaire</Text>
        </TouchableOpacity>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Icon name="clock-outline" size={24} color={colors.primary} style={styles.metricIcon} />
            <Text style={styles.metricValue}>
              {metrics.avg_sleep_7d?.toFixed(1) || '--'}
              <Text style={styles.metricUnit}> hrs</Text>
            </Text>
            <Text style={styles.metricLabel}>7-Day Average</Text>
          </View>

          <View style={styles.metricCard}>
            <Icon name="calendar-month" size={24} color={colors.primary} style={styles.metricIcon} />
            <Text style={styles.metricValue}>
              {metrics.avg_sleep_30d?.toFixed(1) || '--'}
              <Text style={styles.metricUnit}> hrs</Text>
            </Text>
            <Text style={styles.metricLabel}>30-Day Average</Text>
          </View>

          <View style={styles.metricCard}>
            <Icon name="bed" size={24} color={colors.primary} style={styles.metricIcon} />
            <Text style={styles.metricValue}>
              {formatTime12h(metrics.bedtime_mean_30d)}
            </Text>
            <Text style={styles.metricLabel}>Avg Bedtime</Text>
          </View>

          <View style={styles.metricCard}>
            <Icon name="chart-line-variant" size={24} color={colors.primary} style={styles.metricIcon} />
            <Text style={styles.metricValue}>
              ±{metrics.sleep_variability_30d?.toFixed(1) || '0'}
              <Text style={styles.metricUnit}> hrs</Text>
            </Text>
            <Text style={styles.metricLabel}>Variability</Text>
          </View>
        </View>

        {/* Data Source Indicator */}
        <View style={styles.dataSourceCard}>
          <View style={[styles.dataSourceIcon, { backgroundColor: `${sourceInfo.color}20` }]}>
            <Icon name={sourceInfo.icon} size={20} color={sourceInfo.color} />
          </View>
          <View style={styles.dataSourceInfo}>
            <Text style={styles.dataSourceLabel}>Data Source: {sourceInfo.label}</Text>
            <Text style={styles.dataSourceSubtext}>
              {metrics.dominant_sleep_source === 'health_connect'
                ? 'Automatically synced from your wearable'
                : metrics.dominant_sleep_source === 'mixed'
                  ? 'Combining manual logs and smartwatch data'
                  : 'Based on your manual entries'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLogSleep}
            accessibilityRole="button"
            accessibilityLabel="Log last night's sleep"
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Log Sleep</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleHealthConnectSync}
            disabled={isSyncing}
            accessibilityRole="button"
            accessibilityLabel="Sync with Health Connect"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Icon name="watch" size={20} color={colors.text} />
            )}
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              {isSyncing ? 'Syncing...' : 'Sync Watch'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Records */}
        <Text style={styles.sectionTitle}>Recent Sleep Logs</Text>
        {recentRecords.length > 0 ? (
          recentRecords.slice(0, recordsToShow).map((record, index) => {
            const recordSource = getDataSourceLabel(record.source);
            const recordDate = new Date(record.date);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let dateLabel = recordDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });

            if (record.date === today.toISOString().split('T')[0]) {
              dateLabel = 'Today';
            } else if (record.date === yesterday.toISOString().split('T')[0]) {
              dateLabel = 'Yesterday';
            }

            const isManual = record.source === 'manual';

            return (
              <View key={index} style={styles.recordCardContainer}>
                <TouchableOpacity
                  style={[
                    styles.recordCard,
                    !isManual && styles.recordCardReadOnly,
                  ]}
                  onPress={() => handleRecordPress(record)}
                  accessibilityRole="button"
                  accessibilityLabel={`Sleep log for ${dateLabel}${isManual ? ', tap to edit' : ', read-only wearable data'}`}
                  accessibilityHint={isManual ? 'Opens editor for this sleep log' : 'Shows sleep details from wearable'}
                >
                  <View style={styles.recordDate}>
                    <Text style={styles.recordDateText}>{dateLabel}</Text>
                    <Text style={styles.recordDateSubtext}>
                      Bedtime: {formatTime12h(record.bedtime)}
                    </Text>
                  </View>
                  <View style={styles.recordStats}>
                    <Text style={styles.recordDuration}>
                      {record.sleep_duration_hours}h
                    </Text>
                    <View style={styles.recordSource}>
                      <Icon name={recordSource.icon} size={12} color={recordSource.color} />
                      <Text style={styles.recordSourceText}>{recordSource.label}</Text>
                    </View>
                  </View>
                  {!isManual && (
                    <Icon name="lock" size={14} color={colors.secondary} style={styles.lockIcon} />
                  )}
                  {isManual && (
                    <TouchableOpacity
                      style={styles.deleteRecordButton}
                      onPress={() => handleDeleteRecord(record)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete sleep log for ${dateLabel}`}
                    >
                      <Icon name="delete-outline" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyRecords}>
            <Icon name="calendar-blank" size={40} color={colors.secondary} />
            <Text style={styles.emptyRecordsText}>
              No sleep logs yet. Tap "Log Sleep" to record your first entry!
            </Text>
          </View>
        )}

        {/* Show More/Less Button */}
        {recentRecords.length > 7 && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => {
              if (recordsToShow === 7) {
                setRecordsToShow(30);
              } else if (recordsToShow === 30) {
                setRecordsToShow(60);
              } else {
                setRecordsToShow(7);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={recordsToShow === 7 ? 'Show more sleep logs' : 'Show fewer sleep logs'}
          >
            <Text style={styles.showMoreButtonText}>
              {recordsToShow === 7 && `Show More (${Math.min(30, recentRecords.length)} days)`}
              {recordsToShow === 30 && recentRecords.length > 30 && `Show All (${Math.min(60, recentRecords.length)} days)`}
              {recordsToShow === 30 && recentRecords.length <= 30 && 'Show Less'}
              {recordsToShow === 60 && 'Show Less'}
            </Text>
            <Text style={styles.recordCountText}>
              Showing {Math.min(recordsToShow, recentRecords.length)} of {recentRecords.length} logs
            </Text>
          </TouchableOpacity>
        )}

        {/* Education / Explanation */}
        <View style={styles.educationCard}>
          <Text style={styles.educationTitle}>
            📊 How Your Data Improves Over Time
          </Text>
          <Text style={styles.educationText}>
            Your sleep risk assessment becomes more accurate as you log more data:
          </Text>
          <View style={styles.educationBullet}>
            <Icon name="numeric-1-circle" size={18} color={colors.primary} />
            <Text style={styles.educationBulletText}>
              <Text style={{ fontWeight: '600' }}>First week:</Text> Baseline provides
              initial estimate based on your typical patterns
            </Text>
          </View>
          <View style={styles.educationBullet}>
            <Icon name="numeric-2-circle" size={18} color={colors.primary} />
            <Text style={styles.educationBulletText}>
              <Text style={{ fontWeight: '600' }}>After 7 days:</Text> Weekly averages
              start reflecting your actual sleep habits
            </Text>
          </View>
          <View style={styles.educationBullet}>
            <Icon name="numeric-3-circle" size={18} color={colors.primary} />
            <Text style={styles.educationBulletText}>
              <Text style={{ fontWeight: '600' }}>After 30 days:</Text> Monthly averages and
              variability provide comprehensive risk picture
            </Text>
          </View>
          <Text style={[styles.educationText, { marginTop: 12, fontStyle: 'italic' }]}>
            💡 Tip: Connecting a smartwatch provides automatic, accurate tracking without
            manual entry.
          </Text>
        </View>

        {/* AI-Powered Timeline Predictions */}
        <LifestyleRecommendationsSection trackerType="sleep" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SleepTrackingScreen;
