import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  healthConnectManager,
  initializeHealthConnect as initHealthConnect,
  requestAllHealthPermissions,
  getTodayData,
  getThisWeekData,
  getActivityData,
  getVitalsData,
  getBodyMeasurementsData,
  getSleepData,
  getNutritionData,
  HealthRecordTypes,
} from '../services/healthConnectService';

const HealthDataScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // today, week, month
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    initializeHealthConnect();
  }, []);

  // Fetch data when period changes
  useEffect(() => {
    if (isInitialized && hasPermissions) {
      fetchHealthData();
    }
  }, [selectedPeriod, isInitialized, hasPermissions]);

  const initializeHealthConnect = async () => {
    try {
      setIsLoading(true);
      await initHealthConnect();
      setIsInitialized(true);
      
      const status = await healthConnectManager.getSdkStatus();
      console.log('🔍 Health Connect SDK Status:', status);
      
      if (healthConnectManager.isSdkAvailable()) {
        toast.success('Health Connect initialized successfully!');
        // Don't try to fetch data yet - always show permission screen first
        // This ensures user explicitly grants all needed permissions
      } else {
        toast.error(`Health Connect not available: ${healthConnectManager.getSdkStatusDescription()}`);
      }
    } catch (error) {
      console.error('Failed to initialize Health Connect:', error);
      
      // Show user-friendly error with action buttons
      let message = error.message || 'Failed to initialize Health Connect';
      let buttons = [{ text: 'OK' }];
      
      if (error.code === 'NOT_INSTALLED' || error.code === 'UPDATE_REQUIRED' || error.code === 'SERVICE_UNAVAILABLE') {
        message = error.suggestion || message;
        buttons = [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Play Store', 
            onPress: () => {
              if (error.playStoreUrl) {
                Linking.openURL(error.playStoreUrl).catch(err => {
                  console.error('Failed to open Play Store:', err);
                  toast.error('Could not open Play Store');
                });
              }
            }
          }
        ];
      }
      
      Alert.alert(
        'Health Connect Required',
        message,
        buttons
      );
      
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      setIsLoading(true);
      
      // Ensure Health Connect is initialized before requesting permissions
      if (!isInitialized || !healthConnectManager.isInitialized) {
        console.log('⚠️ Health Connect not initialized, initializing now...');
        try {
          await initHealthConnect();
          setIsInitialized(true);
        } catch (initError) {
          console.error('❌ Initialization failed:', initError);
          
          // Show error dialog
          let message = initError.message || 'Failed to initialize Health Connect';
          let buttons = [{ text: 'OK' }];
          
          if (initError.code === 'NOT_INSTALLED' || initError.code === 'UPDATE_REQUIRED' || initError.code === 'SERVICE_UNAVAILABLE') {
            message = initError.suggestion || message;
            buttons = [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Play Store', 
                onPress: () => {
                  if (initError.playStoreUrl) {
                    Linking.openURL(initError.playStoreUrl).catch(err => {
                      console.error('Failed to open Play Store:', err);
                      toast.error('Could not open Play Store');
                    });
                  }
                }
              }
            ];
          }
          
          Alert.alert('Initialization Failed', message, buttons);
          toast.error(initError.message);
          return;
        }
        
        // Verify initialization succeeded
        if (!healthConnectManager.isInitialized) {
          toast.error('Health Connect initialization failed');
          return;
        }
      }
      
      // Refresh SDK status to ensure we have the latest
      const currentStatus = await healthConnectManager.getSdkStatus();
      console.log('📊 Current SDK Status before permission request:', currentStatus);
      console.log('📊 SDK is available?', healthConnectManager.isSdkAvailable());
      
      console.log('🔐 Requesting all health permissions...');
      const permissions = await requestAllHealthPermissions();
      
      console.log('📋 Permission Results:', permissions);
      console.log('📋 Result type:', typeof permissions);
      console.log('📋 Is array?', Array.isArray(permissions));
      
      // react-native-health-connect may return an empty array even when permissions are granted
      // If the dialog was shown and no error was thrown, assume at least some permissions were granted
      let grantedCount = 0;
      let totalCount = 20; // Total: 16 read + 4 write permissions
      
      if (Array.isArray(permissions)) {
        grantedCount = permissions.length;
        if (grantedCount > 0) {
          console.log('✅ Granted Permissions:', permissions.map(p => `${p.accessType}:${p.recordType}`).join(', '));
        }
      } else if (typeof permissions === 'object' && permissions !== null) {
        grantedCount = Object.values(permissions).filter(Boolean).length;
      }
      
      // If dialog was shown and completed without error, assume success even if return is empty
      // This is a known behavior with react-native-health-connect
      if (grantedCount === 0 && Array.isArray(permissions)) {
        console.log('⚠️ Empty array returned, but dialog was shown. Assuming permissions granted.');
        // Try to fetch data - if it works, permissions were granted
        setHasPermissions(true);
        toast.success('Permissions processed - checking data access...');
        
        try {
          await fetchHealthData();
          toast.success('Health Connect permissions granted!');
        } catch (error) {
          console.error('Failed to fetch after permission grant:', error);
          setHasPermissions(false);
          Alert.alert(
            'Permission Issue',
            'Could not access health data. Please try granting permissions again or check Health Connect settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Try Again', onPress: () => requestPermissions() }
            ]
          );
        }
      } else if (grantedCount > 0) {
        setHasPermissions(true);
        toast.success(`Granted ${grantedCount}/${totalCount} permissions`);
        
        if (grantedCount < totalCount) {
          setTimeout(() => {
            Alert.alert(
              'Limited Permissions',
              `Only ${grantedCount} out of ${totalCount} permissions were granted. Some health data may not be available.\n\nYou can grant more permissions later in Settings → Apps → GlycoFit → Permissions.`,
              [{ text: 'OK' }]
            );
          }, 1000);
        }
        
        fetchHealthData();
      } else {
        toast.error('No permissions granted');
        Alert.alert(
          'Permissions Required',
          'Health data access requires permissions. Please grant at least some permissions to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => requestPermissions() }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);
      
      // Show user-friendly error with action buttons
      let message = error.message || 'Failed to request permissions';
      let buttons = [{ text: 'OK' }];
      
      if (error.code === 'NOT_INSTALLED' || error.code === 'UPDATE_REQUIRED' || error.code === 'SERVICE_UNAVAILABLE') {
        message = error.suggestion || message;
        buttons = [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Play Store', 
            onPress: () => {
              if (error.playStoreUrl) {
                Linking.openURL(error.playStoreUrl).catch(err => {
                  console.error('Failed to open Play Store:', err);
                  toast.error('Could not open Play Store');
                });
              }
            }
          }
        ];
      }
      
      Alert.alert(
        'Cannot Request Permissions',
        message,
        buttons
      );
      
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealthData = async () => {
    try {
      setIsLoading(true);
      
      const today = new Date();
      let startDate, endDate = today;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
      }

      console.log('📅 Fetching health data from', startDate.toISOString(), 'to', endDate.toISOString());

      // Fetch all categories of health data with individual error handling
      // This prevents one permission error from breaking the entire fetch
      let activity = { steps: [], distance: [], activeCalories: [], totalCalories: [], exerciseSessions: [] };
      let vitals = { heartRate: [], bloodPressure: [], bloodGlucose: [], oxygenSaturation: [], restingHeartRate: [] };
      let sleep = [];

      try {
        activity = await getActivityData(startDate, endDate);
      } catch (error) {
        console.warn('⚠️ Failed to fetch activity data:', error.message);
      }

      try {
        vitals = await getVitalsData(startDate, endDate);
      } catch (error) {
        console.warn('⚠️ Failed to fetch vitals data:', error.message);
      }

      try {
        sleep = await getSleepData(startDate, endDate);
      } catch (error) {
        console.warn('⚠️ Failed to fetch sleep data:', error.message);
      }

      console.log('📊 Activity Data:', {
        steps: Array.isArray(activity?.steps) ? activity.steps.length : 0,
        distance: Array.isArray(activity?.distance) ? activity.distance.length : 0,
        activeCalories: Array.isArray(activity?.activeCalories) ? activity.activeCalories.length : 0,
      });

      console.log('❤️ Vitals Data:', {
        heartRate: Array.isArray(vitals?.heartRate) ? vitals.heartRate.length : 0,
        bloodPressure: Array.isArray(vitals?.bloodPressure) ? vitals.bloodPressure.length : 0,
      });

      console.log('😴 Sleep Data:', {
        sleepSessions: Array.isArray(sleep) ? sleep.length : 0,
      });

      const allData = {
        activity,
        vitals,
        sleep,
        fetchedAt: new Date().toISOString(),
      };

      setHealthData(allData);
      
      // Count successful data categories
      const hasActivityData = activity.steps?.length > 0 || activity.distance?.length > 0;
      const hasVitalsData = vitals.heartRate?.length > 0 || vitals.bloodPressure?.length > 0;
      const hasSleepData = sleep?.length > 0;
      const successCount = [hasActivityData, hasVitalsData, hasSleepData].filter(Boolean).length;
      
      if (successCount > 0) {
        toast.success(`Health data loaded (${successCount}/3 categories available)`);
      } else {
        toast.info('No health data available. Try granting more permissions or add data in Health Connect.');
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      toast.error('Failed to fetch health data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealthData();
    setIsRefreshing(false);
  };

  const renderDataCard = (title, icon, iconColor, data, dataKey, onPress) => {
    // Handle both direct array and nested object structures
    let value = 0;
    let records = [];
    
    if (data && dataKey) {
      const recordData = data[dataKey];
      if (Array.isArray(recordData)) {
        records = recordData;
        value = recordData.length;
      } else if (recordData && typeof recordData === 'object' && Array.isArray(recordData.records)) {
        // Handle case where data might be { records: [...] }
        records = recordData.records;
        value = recordData.records.length;
      }
    }
    
    const handlePress = () => {
      if (onPress && value > 0) {
        onPress(title, records);
      }
    };
    
    return (
      <TouchableOpacity
        style={[styles.dataCard, { borderColor: colors.border }]}
        onPress={handlePress}
        disabled={value === 0}
        activeOpacity={value > 0 ? 0.7 : 1}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Icon name={icon} size={24} color={iconColor} />
        </View>
        <Text style={[styles.dataTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.dataValue, { color: colors.primary }]}>
          {value} records
        </Text>
        {value > 0 && (
          <Icon name="chevron-right" size={20} color={colors.secondary} style={styles.chevron} />
        )}
      </TouchableOpacity>
    );
  };

  const renderSummaryCard = (title, value, unit, icon, iconColor, timestamp) => {
    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryHeader}>
          <Icon name={icon} size={20} color={iconColor} />
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.summaryValueContainer}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{value}</Text>
          <Text style={[styles.summaryUnit, { color: colors.secondary }]}>{unit}</Text>
        </View>
        {timestamp && (
          <Text style={[styles.summaryTimestamp, { color: colors.secondary }]}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  };

  const calculateStepsTotal = () => {
    if (!healthData?.activity?.steps || !Array.isArray(healthData.activity.steps)) return 0;
    return healthData.activity.steps.reduce((sum, record) => sum + (record.count || 0), 0);
  };

  const calculateCaloriesTotal = () => {
    if (!healthData?.activity?.activeCalories || !Array.isArray(healthData.activity.activeCalories)) return 0;
    return healthData.activity.activeCalories.reduce(
      (sum, record) => sum + (record.energy?.inKilocalories || 0), 
      0
    ).toFixed(0);
  };

  const getLatestHeartRate = () => {
    if (!healthData?.vitals?.heartRate || 
        !Array.isArray(healthData.vitals.heartRate) ||
        healthData.vitals.heartRate.length === 0) 
      return { bpm: '--', time: null };
    
    // Get the most recent heart rate record
    const latest = healthData.vitals.heartRate[healthData.vitals.heartRate.length - 1];
    console.log('💓 Latest Heart Rate Record:', latest);
    
    // Heart rate data is in samples array
    if (latest.samples && Array.isArray(latest.samples) && latest.samples.length > 0) {
      const latestSample = latest.samples[latest.samples.length - 1];
      return {
        bpm: latestSample.beatsPerMinute || '--',
        time: latestSample.time || null
      };
    }
    
    return { bpm: '--', time: null };
  };

  const getAverageHeartRate = () => {
    if (!healthData?.vitals?.heartRate || 
        !Array.isArray(healthData.vitals.heartRate) ||
        healthData.vitals.heartRate.length === 0) 
      return '--';
    
    let totalBpm = 0;
    let sampleCount = 0;
    
    healthData.vitals.heartRate.forEach(record => {
      if (record.samples && Array.isArray(record.samples)) {
        record.samples.forEach(sample => {
          if (sample.beatsPerMinute) {
            totalBpm += sample.beatsPerMinute;
            sampleCount++;
          }
        });
      }
    });
    
    if (sampleCount === 0) return '--';
    return Math.round(totalBpm / sampleCount);
  };

  const showRecordDetails = (title, records) => {
    console.log(`📋 Showing ${title} details:`, records);
    
    let message = `${title}\n\n`;
    
    if (title === 'Sleep Sessions') {
      records.forEach((record, index) => {
        const startTime = new Date(record.startTime).toLocaleString();
        const endTime = new Date(record.endTime).toLocaleString();
        const duration = ((new Date(record.endTime) - new Date(record.startTime)) / (1000 * 60 * 60)).toFixed(1);
        message += `Session ${index + 1}:\n`;
        message += `  Start: ${startTime}\n`;
        message += `  End: ${endTime}\n`;
        message += `  Duration: ${duration} hours\n\n`;
      });
    } else if (title === 'Heart Rate') {
      const avgBpm = getAverageHeartRate();
      const latestHR = getLatestHeartRate();
      const latestBpm = latestHR.bpm;
      
      // Count total samples
      let totalSamples = 0;
      records.forEach(record => {
        if (record.samples && Array.isArray(record.samples)) {
          totalSamples += record.samples.length;
        }
      });
      
      message += `Total readings: ${totalSamples}\n`;
      message += `Latest: ${latestBpm} bpm\n`;
      message += `Average: ${avgBpm} bpm\n\n`;
      message += `Recent readings:\n`;
      
      // Get recent samples from the last few records
      const recentSamples = [];
      records.slice(-5).forEach(record => {
        if (record.samples && Array.isArray(record.samples)) {
          record.samples.forEach(sample => {
            recentSamples.push({
              time: sample.time,
              bpm: sample.beatsPerMinute
            });
          });
        }
      });
      
      recentSamples.slice(-10).reverse().forEach(sample => {
        const time = new Date(sample.time).toLocaleTimeString();
        message += `  ${time}: ${sample.bpm} bpm\n`;
      });
    } else if (title === 'Steps') {
      const total = calculateStepsTotal();
      message += `Total steps: ${total.toLocaleString()}\n\n`;
      records.forEach((record, index) => {
        const time = new Date(record.startTime).toLocaleString();
        message += `${time}: ${record.count} steps\n`;
      });
    } else if (title === 'Active Calories') {
      const total = calculateCaloriesTotal();
      message += `Total: ${total} kcal\n\n`;
      records.forEach((record, index) => {
        const time = new Date(record.startTime).toLocaleString();
        const kcal = record.energy?.inKilocalories || 0;
        message += `${time}: ${kcal.toFixed(0)} kcal\n`;
      });
    } else {
      message += `Total records: ${records.length}\n\n`;
      records.forEach((record, index) => {
        message += `Record ${index + 1}:\n${JSON.stringify(record, null, 2)}\n\n`;
      });
    }
    
    Alert.alert(title, message, [{ text: 'Close' }]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondary,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    periodSelector: {
      flexDirection: 'row',
      marginBottom: 20,
      gap: 8,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    periodButtonTextActive: {
      color: '#fff',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    summaryCard: {
      width: '48%',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '500',
    },
    summaryValueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    summaryUnit: {
      fontSize: 14,
    },
    summaryTimestamp: {
      fontSize: 11,
      marginTop: 4,
    },
    dataGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    dataCard: {
      width: '48%',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    dataTitle: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
      textAlign: 'center',
    },
    dataValue: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    chevron: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    actionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    setupContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    setupIcon: {
      marginBottom: 24,
    },
    setupTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    setupDescription: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
  });

  if (!isInitialized || !hasPermissions) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Health Data</Text>
          <Text style={styles.headerSubtitle}>Connect to Health Connect</Text>
        </View>
        
        <View style={styles.setupContainer}>
          <View style={styles.setupIcon}>
            <Icon name="heart-pulse" size={80} color={colors.primary} />
          </View>
          
          <Text style={styles.setupTitle}>
            {!isInitialized ? 'Initialize Health Connect' : 'Grant Permissions'}
          </Text>
          
          <Text style={styles.setupDescription}>
            {!isInitialized 
              ? 'Connect to Health Connect to view your health data from various apps and devices.'
              : 'We need your permission to access health data. This includes steps, heart rate, sleep, and more.'}
          </Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={!isInitialized ? initializeHealthConnect : requestPermissions}
            >
              <Icon name={!isInitialized ? "link" : "shield-check"} size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {!isInitialized ? 'Initialize' : 'Grant Permissions'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Health Data</Text>
        <Text style={styles.headerSubtitle}>
          {healthData ? `Last updated: ${new Date(healthData.fetchedAt).toLocaleTimeString()}` : 'No data loaded'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'today' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('today')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'today' && styles.periodButtonTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'week' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'week' && styles.periodButtonTextActive,
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'month' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'month' && styles.periodButtonTextActive,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !healthData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading health data...</Text>
          </View>
        ) : !healthData ? (
          <View style={styles.emptyContainer}>
            <Icon name="database-off" size={64} color={colors.secondary} />
            <Text style={styles.emptyText}>
              No health data available.{'\n'}Pull to refresh or tap below to load data.
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={fetchHealthData}
            >
              <Icon name="refresh" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Load Data</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Summary</Text>
              <View style={styles.summaryGrid}>
                {renderSummaryCard(
                  'Steps',
                  calculateStepsTotal().toLocaleString(),
                  'steps',
                  'walk',
                  '#4CAF50'
                )}
                {renderSummaryCard(
                  'Calories',
                  calculateCaloriesTotal(),
                  'kcal',
                  'fire',
                  '#FF5722'
                )}
                {(() => {
                  const latestHR = getLatestHeartRate();
                  return renderSummaryCard(
                    'Latest HR',
                    latestHR.bpm,
                    'bpm',
                    'heart-pulse',
                    '#E91E63',
                    latestHR.time
                  );
                })()}
                {renderSummaryCard(
                  'Avg HR',
                  getAverageHeartRate(),
                  'bpm',
                  'heart',
                  '#E91E63'
                )}
              </View>
            </View>

            {/* Activity Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Steps', 'walk', '#4CAF50', healthData.activity, 'steps', showRecordDetails)}
                {renderDataCard('Distance', 'map-marker-distance', '#2196F3', healthData.activity, 'distance', showRecordDetails)}
                {renderDataCard('Active Calories', 'fire', '#FF5722', healthData.activity, 'activeCalories', showRecordDetails)}
                {renderDataCard('Exercise', 'dumbbell', '#9C27B0', healthData.activity, 'exerciseSessions', showRecordDetails)}
              </View>
            </View>

            {/* Vitals Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vitals</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Heart Rate', 'heart-pulse', '#E91E63', healthData.vitals, 'heartRate', showRecordDetails)}
                {renderDataCard('Blood Pressure', 'blood-bag', '#F44336', healthData.vitals, 'bloodPressure', showRecordDetails)}
                {renderDataCard('Blood Glucose', 'water', '#00BCD4', healthData.vitals, 'bloodGlucose', showRecordDetails)}
                {renderDataCard('Oxygen', 'air-filter', '#03A9F4', healthData.vitals, 'oxygenSaturation', showRecordDetails)}
              </View>
            </View>

            {/* Sleep Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sleep</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Sleep Sessions', 'sleep', '#673AB7', { sleep: healthData.sleep }, 'sleep', showRecordDetails)}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HealthDataScreen;
