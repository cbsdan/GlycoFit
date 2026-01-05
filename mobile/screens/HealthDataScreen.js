import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
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
import healthDataSyncService from '../services/healthDataSyncService';

const HealthDataScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const spinValue = useRef(new Animated.Value(0)).current;
  const hasInitializedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // today, week, month
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isInitializationInProgress, setIsInitializationInProgress] = useState(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeHealthConnect();
      loadLastSyncTime();
    }
  }, []);

  // Fetch data when period changes
  useEffect(() => {
    if (isInitialized && hasPermissions) {
      fetchHealthData();
    }
  }, [selectedPeriod, isInitialized, hasPermissions]);

  const loadLastSyncTime = async () => {
    try {
      const syncTime = await healthDataSyncService.getLastSyncTime();
      setLastSyncTime(syncTime);
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  };

  const initializeHealthConnect = async () => {
    // Prevent multiple initialization attempts
    if (isInitializationInProgress || isInitialized) {
      return;
    }

    try {
      setIsInitializationInProgress(true);
      setIsLoading(true);
      await initHealthConnect();
      setIsInitialized(true);
      
      const status = await healthConnectManager.getSdkStatus();
      console.log('🔍 Health Connect SDK Status:', status);
      
      if (healthConnectManager.isSdkAvailable()) {
        console.log('✅ Health Connect is available, requesting permissions...');
        // After successful initialization, automatically request permissions
        // This ensures user gets prompted to grant permissions on first launch
        await requestPermissions();
      } else {
        console.warn('❌ Health Connect not available:', healthConnectManager.getSdkStatusDescription());
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
      setIsInitializationInProgress(false);
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
      
      console.log('🔐 Requesting all health permissions...');
      toast.info('Opening permission dialog...');
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
        console.log('⚠️ Empty array returned, but dialog was shown. Checking if permissions actually work...');
        
        try {
          // Try to fetch data to verify permissions were actually granted
          await fetchHealthData();
          // If we get here, permissions worked!
          setHasPermissions(true);
          toast.success('Health Connect permissions granted!');
        } catch (error) {
          console.error('❌ Permission verification failed:', error);
          
          // Check if this is a permission error
          const errorMsg = error.message?.toLowerCase() || '';
          const isPermissionError = errorMsg.includes('permission') || errorMsg.includes('lacks');
          
          if (isPermissionError) {
            // Permissions were NOT actually granted despite the dialog
            console.warn('⚠️ Permissions were not actually granted. Showing Settings option...');
            setHasPermissions(false);
            
            Alert.alert(
              'Permissions Not Granted',
              'The Health Connect permission dialog was shown but permissions were not granted to the app. Please open Settings to manually grant permissions.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Open Settings', 
                  onPress: () => {
                    try {
                      Linking.openSettings();
                    } catch (err) {
                      console.error('Could not open settings:', err);
                      toast.error('Could not open app settings');
                    }
                  }
                }
              ]
            );
            
            toast.error('Permissions were not granted. Please enable them in Settings.');
          } else {
            // Different error - not a permission issue
            setHasPermissions(false);
            Alert.alert(
              'Data Access Failed',
              'Could not verify data access. Please try again or check your Health Connect settings.\n\n' + error.message,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Try Again', onPress: () => requestPermissions() }
              ]
            );
          }
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
        
        await fetchHealthData();
      } else {
        // No permissions granted - offer to try again or go to settings
        console.log('❌ User denied all permissions');
        toast.error('No permissions granted');
        
        Alert.alert(
          'Permissions Required',
          'Health data access requires permissions. You can:\n\n1. Try requesting again\n2. Open Settings to manually grant permissions',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Try Again', 
              onPress: () => requestPermissions(),
              style: 'default'
            },
            { 
              text: 'Open Settings', 
              onPress: () => {
                // Open the app settings
                try {
                  Linking.openSettings();
                } catch (error) {
                  console.error('Could not open settings:', error);
                  toast.error('Could not open app settings');
                }
              },
              style: 'default'
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Permission request error:', error);
      
      // Show user-friendly error with action buttons
      let message = error.message || 'Failed to request permissions';
      let buttons = [{ text: 'OK' }];
      
      // Check if it's a Health Connect specific error
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
      } else if (error.message && error.message.includes('permission') && error.message.toLowerCase().includes('denied')) {
        // Permission denied error - offer settings option
        message = 'Permissions were denied. You can enable them in Settings.';
        buttons = [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              try {
                Linking.openSettings();
              } catch (err) {
                console.error('Could not open settings:', err);
                toast.error('Could not open app settings');
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

      // Fetch only steps and calories from activity
      let activity = { steps: [], activeCalories: [] };
      let sleep = [];

      try {
        const activityData = await getActivityData(startDate, endDate);
        activity.steps = activityData.steps || [];
        activity.activeCalories = activityData.activeCalories || [];
      } catch (error) {
        console.warn('⚠️ Failed to fetch activity data:', error.message);
      }

      try {
        sleep = await getSleepData(startDate, endDate);
      } catch (error) {
        console.warn('⚠️ Failed to fetch sleep data:', error.message);
      }

      console.log('📊 Activity Data:', {
        steps: Array.isArray(activity?.steps) ? activity.steps.length : 0,
        activeCalories: Array.isArray(activity?.activeCalories) ? activity.activeCalories.length : 0,
      });

      console.log('😴 Sleep Data:', {
        sleepSessions: Array.isArray(sleep) ? sleep.length : 0,
      });

      const allData = {
        activity,
        sleep,
        fetchedAt: new Date().toISOString(),
      };

      setHealthData(allData);
      
      // Count successful data categories
      const hasActivityData = activity.steps?.length > 0 || activity.activeCalories?.length > 0;
      const hasSleepData = sleep?.length > 0;
      const successCount = [hasActivityData, hasSleepData].filter(Boolean).length;
      
      if (successCount > 0) {
        toast.success(`Health data loaded (${successCount}/2 categories available)`);
      } else {
        toast.info('No health data available. Try adding data in Health Connect.');
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      toast.error('Failed to fetch health data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSyncing) {
      // Start rotation animation
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Stop rotation animation
      spinValue.setValue(0);
    }
  }, [isSyncing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSync = async () => {
    if (!healthData) {
      toast.info('Please load health data first');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await healthDataSyncService.syncData(healthData);
      
      if (result.success) {
        const insertedCount = result.inserted_count || 0;
        const skippedCount = result.skipped_count || 0;
        
        if (insertedCount > 0) {
          toast.success(`Successfully synced ${insertedCount} new health records`);
        } else {
          toast.info(`All data already synced (${skippedCount} records)`);
        }
        await loadLastSyncTime();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync health data: ' + error.message);
    } finally {
      setIsSyncing(false);
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
    // Not used anymore - keeping for compatibility
    return { bpm: '--', time: null };
  };

  const getAverageHeartRate = () => {
    // Not used anymore - keeping for compatibility
    return '--';
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
    syncContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    syncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      gap: 8,
      width: '100%',
      maxWidth: 300,
    },
    syncButtonDisabled: {
      opacity: 0.6,
    },
    syncButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    lastSyncText: {
      marginTop: 8,
      fontSize: 12,
      color: colors.secondary,
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

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never synced';
    
    try {
      const now = new Date();
      // Handle both string timestamp and object with timestamp property
      const timestampStr = typeof lastSyncTime === 'string' ? lastSyncTime : lastSyncTime.timestamp;
      const syncDate = new Date(timestampStr);
      
      // Check if date is valid
      if (isNaN(syncDate.getTime())) return 'Never synced';
      
      const diffMs = now - syncDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return syncDate.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting sync time:', error);
      return 'Never synced';
    }
  };

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

      {/* Sync Button and Status */}
      <View style={styles.syncContainer}>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={isSyncing || !healthData}
        >
          {isSyncing ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Icon name="sync" size={20} color="#fff" />
            </Animated.View>
          ) : (
            <Icon name="cloud-upload" size={20} color="#fff" />
          )}
          <Text style={styles.syncButtonText}>
            {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.lastSyncText}>
          Last sync: {formatLastSyncTime()}
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
            {/* Activity Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Steps', 'walk', '#4CAF50', healthData.activity, 'steps', showRecordDetails)}
                {renderDataCard('Active Calories', 'fire', '#FF5722', healthData.activity, 'activeCalories', showRecordDetails)}
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
